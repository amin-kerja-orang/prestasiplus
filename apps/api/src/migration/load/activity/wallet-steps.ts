/**
 * Wallet steps of `migrate:activity` (BE-29): `wallets`, `coin_ledger` and the wallet-versus-ledger drift scan.
 *
 * `student_wallets.syiling_balance` and the ledger are independent counters in .cloud and may disagree
 * (v2-data-migration.md section 5). Both are migrated as they are; the scan only REPORTS the users whose wallet
 * differs from the sum of their ledger rows or from the latest `balance_after`. Nothing is corrected, and the
 * report carries surrogate user ids only.
 */
import type pg from 'pg'

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
      // Tiers are registered by the catalogue group under the entity name `tiers`. A tier that was not adopted (no seeded
      // match, rejected UNSUPPORTED there) leaves the wallet with a null tier: it is counted, never dropped.
      const tiers = await ctx.idMap.resolveMany('tiers', distinctValues(rows, 'gamification_tier_id'))
      const students = await studentUsers(ctx, [...users.values()])
      const items: { legacyId: string; values: WalletValues; tierUnmapped: boolean }[] = []
      for (const row of rows) {
        const legacyId = idOf(row)
        const userId = resolveFk(row.user_id, users) ?? undefined
        const out = transformWallet(row, {
          userId,
          isStudent: userId !== undefined && students.has(userId),
          tierId: resolveFk(row.gamification_tier_id, tiers),
        })
        if (!out.ok) rejectRow(ctx, entity, legacyId, out.reject)
        else items.push({ legacyId, values: out.value, tierUnmapped: resolveFk(row.gamification_tier_id, tiers) === undefined })
      }
      // v2 allows one wallet per user: a second .cloud wallet of the same user is a DUPLICATE_KEY reject.
      const kept = await dropConflicts(ctx.db, items, {
        entity, table: 'wallets', column: 'user_id', expr: 'user_id::text', source: ctx.source, rejects: ctx.rejects,
        legacyIdOf: (i) => i.legacyId, valueOf: (i) => i.values.user_id,
      })
      const unmapped = kept.filter((i) => i.tierUnmapped).length
      if (unmapped > 0) a.notes.count('wallets.tier_unmapped', unmapped)
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

/** The part of a pool or a pooled client the drift scan needs. */
export interface Queryable {
  query<R extends pg.QueryResultRow>(text: string, values?: unknown[]): Promise<pg.QueryResult<R>>
}

/**
 * Compares the migrated wallets named in `byWallet` (wallet legacy id -> .cloud user id) with the migrated ledger of
 * their users and reports the mismatches to `drift`. Shared by the drift step (one batch) and by the rebuild that
 * follows a resumed apply (the full staged set).
 */
export async function scanWalletDrift(
  db: Queryable,
  source: string,
  byWallet: ReadonlyMap<string, string | null | undefined>,
  drift: ActivityContext['drift'],
): Promise<void> {
  const res = await db.query<DriftRow>(
    `SELECT w.legacy_id, w.current_syiling::text AS cur,
            (SELECT sum(l.amount)::text FROM coin_ledger l WHERE l.user_id = w.user_id AND l.legacy_source = $2) AS s,
            (SELECT l.balance_after::text FROM coin_ledger l WHERE l.user_id = w.user_id AND l.legacy_source = $2
             ORDER BY l.created_at DESC, l.id DESC LIMIT 1) AS last
     FROM wallets w WHERE w.legacy_source = $2 AND w.legacy_id = ANY($1::text[])
     ORDER BY w.legacy_id`,
    [[...byWallet.keys()], source],
  )
  for (const r of res.rows) {
    const kinds = walletDriftKinds({
      current: Number(r.cur),
      ledgerSum: r.s === null ? null : Number(r.s),
      lastBalance: r.last === null ? null : Number(r.last),
    })
    if (kinds.length === 0) continue
    const cloudUser = byWallet.get(r.legacy_id)
    if (cloudUser) drift.addId('wallet_ledger_mismatch', cloudUser)
    for (const k of kinds) drift.add(k === 'sum' ? 'wallet_ledger_sum_mismatch' : 'wallet_ledger_last_balance_mismatch')
  }
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
      await scanWalletDrift(ctx.db, ctx.source, new Map(rows.map((r) => [idOf(r), r.user_id])), a.drift)
      return excludedResult(rows.length)
    },
  }
}
