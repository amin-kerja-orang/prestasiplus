import { afterEach, describe, expect, it } from 'vitest'

import {
  bankScan,
  bankScanMaxQueue,
  bankScanMaxWaitMs,
  bankScanStatementTimeoutMs,
  DEFAULT_BANK_SCAN_MAX_QUEUE,
  DEFAULT_BANK_SCAN_MAX_WAIT_MS,
  DEFAULT_BANK_SCAN_STATEMENT_TIMEOUT_MS,
  isStatementTimeout,
} from '../../src/common/concurrency/bank-scan-gate'
import { ApiError } from '../../src/common/errors/api-error'
import { Prisma } from '../../src/db/generated/client'
import { runInClient } from '../../src/db/transaction'
import { QuestionsRepository } from '../../src/modules/questions'
import { OverviewRepository } from '../../src/modules/practice/reads/overview/overview.repository'

/**
 * The bank-wide statements share one per-process gate (`BANK_SCAN_CONCURRENCY`, default 3), so a burst of them cannot take
 * every pooled connection and starve the short transactions. A fake database counts how many such statements are in flight.
 */
function slowDb() {
  const state = { inflight: 0, peak: 0, total: 0 }
  const db = {
    $queryRaw() {
      state.inflight++
      state.total++
      state.peak = Math.max(state.peak, state.inflight)
      return new Promise<unknown[]>((resolve) =>
        setTimeout(() => {
          state.inflight--
          resolve([])
        }, 5),
      )
    },
  }
  return { state, prisma: { client: db } as never }
}

const saved = process.env.BANK_SCAN_CONCURRENCY
afterEach(() => {
  if (saved === undefined) delete process.env.BANK_SCAN_CONCURRENCY
  else process.env.BANK_SCAN_CONCURRENCY = saved
})

/** Twelve parallel calls of each bank-wide read. */
const burst = (q: QuestionsRepository, o: OverviewRepository): Promise<unknown>[] => {
  const scope = q.scopeSql({ status: 'approved', active: true }, true)
  return Array.from({ length: 12 }, (_, i) => [
    q.sampleIds({ subjectId: '7' }, 5, i), // phase 1 scan (an empty window ends the draw: no verification statement)
    q.eligibleIdsPage({ subjectId: '7' }, undefined, 50),
    q.unitCountsByLevelTp({ subjectId: '7', status: 'approved', active: true }),
    o.bankMatrix(),
    o.newestIdsOf(scope, 60),
  ]).flat()
}

describe('bank scan gate', () => {
  it('lets at most 3 bank-wide statements run at once by default', async () => {
    delete process.env.BANK_SCAN_CONCURRENCY
    const { state, prisma } = slowDb()
    await Promise.all(burst(new QuestionsRepository(prisma), new OverviewRepository(prisma)))
    expect(state.peak).toBe(3)
    expect(state.total).toBeGreaterThan(60)
  })

  it('BANK_SCAN_CONCURRENCY sets the number of slots', async () => {
    process.env.BANK_SCAN_CONCURRENCY = '1'
    const one = slowDb()
    await Promise.all(burst(new QuestionsRepository(one.prisma), new OverviewRepository(one.prisma)))
    expect(one.state.peak).toBe(1)
    process.env.BANK_SCAN_CONCURRENCY = '5'
    const five = slowDb()
    await Promise.all(burst(new QuestionsRepository(five.prisma), new OverviewRepository(five.prisma)))
    expect(five.state.peak).toBe(5)
  })

  it('statements that are not bank-wide (by-id checks) are not gated', async () => {
    process.env.BANK_SCAN_CONCURRENCY = '1'
    const { state, prisma } = slowDb()
    const q = new QuestionsRepository(prisma)
    await Promise.all(Array.from({ length: 6 }, () => q.eligibleAmong(['1', '2'], { subjectId: '7' })))
    expect(state.peak).toBe(6)
  })
})

describe('bank scan bounds', () => {
  it('the three bounds default to 20000 ms wait, 200 queued and a 30000 ms statement timeout; blank or invalid values use the default', () => {
    expect([DEFAULT_BANK_SCAN_MAX_WAIT_MS, DEFAULT_BANK_SCAN_MAX_QUEUE, DEFAULT_BANK_SCAN_STATEMENT_TIMEOUT_MS]).toEqual([20_000, 200, 30_000])
    for (const bad of [undefined, '', 'x', '0', '-1']) {
      expect(bankScanMaxWaitMs(bad)).toBe(20_000)
      expect(bankScanMaxQueue(bad)).toBe(200)
      expect(bankScanStatementTimeoutMs(bad)).toBe(30_000)
    }
    expect([bankScanMaxWaitMs('500'), bankScanMaxQueue('7'), bankScanStatementTimeoutMs('1500')]).toEqual([500, 7, 1500])
  })

  it('recognises a Postgres statement timeout however Prisma wrapped it', () => {
    expect(isStatementTimeout({ code: '57014' })).toBe(true)
    expect(isStatementTimeout({ code: 'P2010', meta: { code: '57014' } })).toBe(true)
    expect(isStatementTimeout(new Error('canceling statement due to statement timeout'))).toBe(true)
    expect(isStatementTimeout({ message: 'x', cause: { code: '57014' } })).toBe(true)
    expect(isStatementTimeout(new Error('connection refused'))).toBe(false)
    expect(isStatementTimeout(null)).toBe(false)
  })

  /** A root-like client: `$transaction(ops)` resolves every lazy operation in order, like a Prisma batch. */
  function batchDb(run: (text: string) => unknown) {
    const seen: string[] = []
    let batches = 0
    const lazy = (q: Prisma.Sql) => ({ then: (ok: (v: unknown) => unknown, bad: (e: unknown) => unknown) => Promise.resolve().then(() => run(q.text)).then(ok, bad), text: q.text })
    return {
      seen,
      get batches() {
        return batches
      },
      db: {
        $queryRaw: (q: Prisma.Sql) => {
          seen.push(q.text)
          return lazy(q)
        },
        $transaction: async (ops: { then: (a: (v: unknown) => unknown, b: (e: unknown) => unknown) => unknown }[]) => {
          batches++
          const out: unknown[] = []
          for (const op of ops) out.push(await new Promise((ok, bad) => op.then(ok, bad)))
          return out
        },
      } as never,
    }
  }

  it('runs the statement in one batch after a transaction-local statement_timeout', async () => {
    const t = batchDb((text) => (text.includes('set_config') ? [{ set_config: '30000' }] : [{ id: 1n }]))
    const rows = await bankScan<{ id: bigint }>(t.db, Prisma.sql`SELECT 1`)
    expect(rows).toEqual([{ id: 1n }])
    expect(t.batches).toBe(1)
    expect(t.seen[0]).toContain("set_config('statement_timeout'")
    expect(t.seen[0]).toContain(', true)') // local to the batch transaction: the pooled connection is left as it was
    expect(t.seen[1]).toBe('SELECT 1')
  })

  it('a statement Postgres cancelled is the retryable 429, not a 500', async () => {
    const t = batchDb((text) => {
      if (text.includes('set_config')) return []
      throw Object.assign(new Error('canceling statement due to statement timeout'), { code: 'P2010', meta: { code: '57014' } })
    })
    const err = await bankScan(t.db, Prisma.sql`SELECT 1`).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err).toMatchObject({ code: 'RATE_LIMITED', retryAfter: 5 })
  })

  it('another database error is not turned into an overload', async () => {
    const t = batchDb((text) => {
      if (text.includes('set_config')) return []
      throw new Error('syntax error')
    })
    await expect(bankScan(t.db, Prisma.sql`SELECT 1`)).rejects.toThrow('syntax error')
  })

  it('inside an interactive transaction the statement runs directly: no gate wait, no batch', async () => {
    process.env.BANK_SCAN_CONCURRENCY = '1'
    const t = batchDb(() => [{ id: 2n }])
    const tx = {} as never
    // hold the only slot with an outside scan that never finishes during the check
    let release!: () => void
    const held = bankScan(
      { $queryRaw: () => new Promise<unknown[]>((r) => (release = () => r([]))) } as never,
      Prisma.sql`SELECT 0`,
    )
    await new Promise((r) => setTimeout(r, 5))
    const inside = await runInClient(tx, () => bankScan<{ id: bigint }>(t.db, Prisma.sql`SELECT 2`))
    expect(inside).toEqual([{ id: 2n }])
    expect(t.batches).toBe(0)
    release()
    await held
  })
})
