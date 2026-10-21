/**
 * Wallet steps of `migrate:activity` (BE-29): `wallets`, `coin_ledger` and the wallet-versus-ledger drift scan.
 *
 * `student_wallets.syiling_balance` and the ledger are independent counters in .cloud and may disagree
 * (v2-data-migration.md section 5). Both are migrated as they are; the scan only REPORTS the users whose wallet
 * differs from the sum of their ledger rows or from the latest `balance_after`. Nothing is corrected, and the
 * report carries surrogate user ids only.
 */
import type { AnyEntityStep, BatchContext, BatchResult } from '../../kit/runner'
import { assertSurrogateLegacyId } from '../../kit/sql'
import type { LegacyRow } from '../../kit/upsert'
import { dropConflicts } from '../claim'
import { rejectRow, upsertAndMap } from '../helpers'
import { distinctValues, readById, resolveFk, type StagedRow } from '../source'
import { excludedResult } from '../../transform/activity-common'
import {
  LEDGER_COLUMNS,
  transformLedger,
  transformWallet,
  walletDriftKinds,
  WALLET_COLUMNS,
  type WalletValues,
} from '../../transform/wallet'
import type { ActivityContext } from './context'

export const idOf = (row: StagedRow): string => {
  const id = row.id ?? ''
  assertSurrogateLegacyId(id, 'migrate:activity')
  return id
}

/** The v2 user ids (text) in `userIds` that hold the student role. */
export async function studentUsers(ctx: BatchContext, userIds: readonly string[]): Promise<Set<string>> {
  if (userIds.length === 0) return new Set()
  const res = await ctx.db.query<{ id: string }>(
    `SELECT DISTINCT user_id::text AS id FROM user_roles WHERE role = 'student' AND user_id = ANY($1::bigint[])`,
    [[...new Set(userIds)]],
  )
  return new Set(res.rows.map((r) => r.id))
}

// ---------------------------------------------------------------- wallets

export function walletsStep(a: ActivityContext): AnyEntityStep {
  const entity = 'wallets'
  return {
    entity,
    source: a.source,
    extract: (after) => readById(a.pool, 'student_wallets', after, a.pageSize),
    keyOf: idOf,
    async load(rows: StagedRow[], ctx: BatchContext): Promise<BatchResult> {
      const users = await ctx.idMap.resolveMany('users', distinctValues(rows, 'user_id'))
      // Tiers are loaded by the catalogue group under the entity name `tiers`; an unresolved tier is ORPHAN_PARENT.
      const tiers = await ctx.idMap.resolveMany('tiers', distinctValues(rows, 'gamification_tier_id'))
      const students = await studentUsers(ctx, [...users.values()])
      const items: { legacyId: string; values: WalletValues }[] = []
      for (const row of rows) {
        const legacyId = idOf(row)
        const userId = resolveFk(row.user_id, users) ?? undefined
        const out = transformWallet(row, {
          userId,
          isStudent: userId !== undefined && students.has(userId),
          tierId: resolveFk(row.gamification_tier_id, tiers),
        })
        if (!out.ok) rejectRow(ctx, entity, legacyId, out.reject)
        else items.push({ legacyId, values: out.value })
      }
      // v2 allows one wallet per user: a second .cloud wallet of the same user is a DUPLICATE_KEY reject.
      const kept = await dropConflicts(ctx.db, items, {
        entity, table: 'wallets', column: 'user_id', expr: 'user_id::text', source: ctx.source, rejects: ctx.rejects,
        legacyIdOf: (i) => i.legacyId, valueOf: (i) => i.values.user_id,
      })
      return upsertAndMap(
        ctx, entity, 'wallets', WALLET_COLUMNS,
        kept.map((i): LegacyRow => ({ legacyId: i.legacyId, values: i.values as unknown as Record<string, unknown> })),
        { register: false },
      )
    },
  }
}

// ---------------------------------------------------------------- coin ledger

export function coinLedgerStep(a: ActivityContext): AnyEntityStep {
  const entity = 'coin_ledger'
  return {
    entity,
    source: a.source,
    extract: (after) => readById(a.pool, 'coin_transactions', after, a.pageSize),
    keyOf: idOf,
    async load(rows: StagedRow[], ctx: BatchContext): Promise<BatchResult> {
      const users = await ctx.idMap.resolveMany('users', distinctValues(rows, 'user_id'))
      const students = await studentUsers(ctx, [...users.values()])
      const items: LegacyRow[] = []
      for (const row of rows) {
        const legacyId = idOf(row)
        const userId = resolveFk(row.user_id, users) ?? undefined
        const out = transformLedger(row, { userId, isStudent: userId !== undefined && students.has(userId) })
        if (!out.ok) {
          rejectRow(ctx, entity, legacyId, out.reject)
          // A wrong sign is reported by count: the row is never flipped (AC3).
          if (out.reject.column === 'amount') a.notes.count('coin_ledger.rejected_amount')
        } else items.push({ legacyId, values: out.value as unknown as Record<string, unknown> })
      }
      return upsertAndMap(ctx, entity, 'coin_ledger', LEDGER_COLUMNS, items, { register: false })
    },
  }
}

// ---------------------------------------------------------------- drift scan

interface DriftRow {
  legacy_id: string
  cur: string
  s: string | null
  last: string | null
}

/**
 * Reads the migrated wallets of the batch and the migrated ledger of their users and reports the mismatches to
 * `a.drift` (kind `wallet_ledger_mismatch` with the .cloud user id; `wallet_ledger_sum_mismatch` and
 * `wallet_ledger_last_balance_mismatch` count each comparison). Loads nothing: every row is `excluded`.
 */
export function walletLedgerDriftStep(a: ActivityContext): AnyEntityStep {
  const entity = 'wallet_ledger_drift'
  return {
    entity,
    source: a.source,
    extract: (after) => readById(a.pool, 'student_wallets', after, a.pageSize),
    keyOf: idOf,
    async load(rows: StagedRow[], ctx: BatchContext): Promise<BatchResult> {
      const byWallet = new Map(rows.map((r) => [idOf(r), r.user_id]))
      const res = await ctx.db.query<DriftRow>(
        `SELECT w.legacy_id, w.current_syiling::text AS cur,
                (SELECT sum(l.amount)::text FROM coin_ledger l WHERE l.user_id = w.user_id AND l.legacy_source = $2) AS s,
                (SELECT l.balance_after::text FROM coin_ledger l WHERE l.user_id = w.user_id AND l.legacy_source = $2
                 ORDER BY l.created_at DESC, l.id DESC LIMIT 1) AS last
         FROM wallets w WHERE w.legacy_source = $2 AND w.legacy_id = ANY($1::text[])`,
        [[...byWallet.keys()], ctx.source],
      )
      for (const r of res.rows) {
        const kinds = walletDriftKinds({
          current: Number(r.cur),
          ledgerSum: r.s === null ? null : Number(r.s),
          lastBalance: r.last === null ? null : Number(r.last),
        })
        if (kinds.length === 0) continue
        const cloudUser = byWallet.get(r.legacy_id)
        if (cloudUser) a.drift.addId('wallet_ledger_mismatch', cloudUser)
        for (const k of kinds) a.drift.add(k === 'sum' ? 'wallet_ledger_sum_mismatch' : 'wallet_ledger_last_balance_mismatch')
      }
      return excludedResult(rows.length)
    },
  }
}
