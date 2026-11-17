import { Prisma } from '../../db/generated/client'
import { ApiError } from '../errors/api-error'
import { currentTransaction } from '../../db/transaction'
import { Bulkhead } from './bulkhead'

/** Bank-wide statements that may run at the same time in one API process (the pool of 10 keeps the rest for short transactions). */
export const DEFAULT_BANK_SCAN_CONCURRENCY = 3
/** Longest a bank-wide statement waits for a slot before the request is answered 429 (retryable). */
export const DEFAULT_BANK_SCAN_MAX_WAIT_MS = 20_000
/** Most bank-wide statements that may queue for a slot; a newcomer past it is answered 429 at once. */
export const DEFAULT_BANK_SCAN_MAX_QUEUE = 200
/** Server-side `statement_timeout` of a gated statement: Postgres cancels it, the request is answered 429 (retryable). */
export const DEFAULT_BANK_SCAN_STATEMENT_TIMEOUT_MS = 30_000

const positiveInt = (raw: string | undefined, fallback: number): number => {
  const n = Number.parseInt((raw ?? '').trim(), 10)
  return Number.isInteger(n) && n >= 1 ? n : fallback
}

/** `BANK_SCAN_CONCURRENCY` (a positive integer); unset, blank or invalid means the default. Read per acquisition. */
export const bankScanConcurrency = (raw: string | undefined = process.env.BANK_SCAN_CONCURRENCY): number => positiveInt(raw, DEFAULT_BANK_SCAN_CONCURRENCY)
/** `BANK_SCAN_MAX_WAIT_MS`. */
export const bankScanMaxWaitMs = (raw: string | undefined = process.env.BANK_SCAN_MAX_WAIT_MS): number => positiveInt(raw, DEFAULT_BANK_SCAN_MAX_WAIT_MS)
/** `BANK_SCAN_MAX_QUEUE`. */
export const bankScanMaxQueue = (raw: string | undefined = process.env.BANK_SCAN_MAX_QUEUE): number => positiveInt(raw, DEFAULT_BANK_SCAN_MAX_QUEUE)
/** `BANK_SCAN_STATEMENT_TIMEOUT_MS`. */
export const bankScanStatementTimeoutMs = (raw: string | undefined = process.env.BANK_SCAN_STATEMENT_TIMEOUT_MS): number =>
  positiveInt(raw, DEFAULT_BANK_SCAN_STATEMENT_TIMEOUT_MS)

/** The retryable answer to an overloaded bank scan: 429 RATE_LIMITED with Retry-After (the path `isOverloadError` callers use), never a 500. */
export const bankScanOverloaded = (): ApiError => ApiError.of('RATE_LIMITED', { retryAfter: 5 })

/**
 * The one gate of the bank-wide reads: `sampleIds` scans, `eligibleIdsPage`, `unitCountsByLevelTp`, the dashboard's `bankMatrix` and
 * `newestIdsOf` windows. Wrap only the statement itself, never a job that waits for another gated job (no nesting, so no deadlock).
 */
export const bankScanGate = new Bulkhead(() => bankScanConcurrency(), {
  maxWaitMs: () => bankScanMaxWaitMs(),
  maxQueue: () => bankScanMaxQueue(),
  overloaded: () => bankScanOverloaded(),
})

/** The Prisma surface `bankScan` needs: a root client has `$transaction`; an interactive transaction client does not. */
export interface BankScanDb {
  $queryRaw: <T = unknown>(query: Prisma.Sql) => Prisma.PrismaPromise<T>
  $transaction?: unknown
}

/** True when Postgres cancelled the statement for `statement_timeout` (SQLSTATE 57014), however Prisma wrapped it. */
export function isStatementTimeout(err: unknown, depth = 0): boolean {
  if (typeof err !== 'object' || err === null || depth > 4) return false
  const e = err as { code?: unknown; message?: unknown; meta?: unknown; cause?: unknown }
  if (e.code === '57014') return true
  const meta = e.meta as { code?: unknown; message?: unknown } | undefined
  if (meta?.code === '57014') return true
  if (typeof e.message === 'string' && /statement timeout/i.test(e.message)) return true
  return e.cause !== undefined && isStatementTimeout(e.cause, depth + 1)
}

/**
 * Runs one bank-wide statement through the gate with a server-side timeout.
 *
 * - Outside a transaction: waits for a slot (bounded: `BANK_SCAN_MAX_WAIT_MS`, `BANK_SCAN_MAX_QUEUE`), then runs
 *   `[set_config('statement_timeout', ms, true), statement]` as one Prisma batch transaction. `set_config(..., true)` is transaction-local
 *   (like `SET LOCAL`, but it takes a bind parameter), so the pooled connection is left as it was and Postgres itself cancels a query
 *   that runs past the limit. A cancelled statement is answered as the retryable overload error.
 * - Inside an interactive transaction (`prisma.transaction`, e.g. an assigned-mission start holding an advisory lock, a remedial test
 *   generation): the statement runs directly on that transaction, with no gate wait and no timeout change. Waiting for a slot would
 *   hold the transaction's connection and lock while it queues; the transaction already owns its connection and has its own timeout.
 */
export async function bankScan<T>(db: BankScanDb, statement: Prisma.Sql): Promise<T[]> {
  if (currentTransaction() !== undefined) return db.$queryRaw<T[]>(statement)
  return bankScanGate.run(async () => {
    try {
      if (typeof db.$transaction !== 'function') return await db.$queryRaw<T[]>(statement) // a client that cannot batch (a test double)
      const limit = Prisma.sql`SELECT set_config('statement_timeout', ${String(bankScanStatementTimeoutMs())}, true)`
      const [, rows] = await (db.$transaction as (ops: Prisma.PrismaPromise<unknown>[]) => Promise<[unknown, T[]]>)([db.$queryRaw(limit), db.$queryRaw<T[]>(statement)])
      return rows
    } catch (err) {
      if (isStatementTimeout(err)) throw bankScanOverloaded()
      throw err
    }
  })
}
