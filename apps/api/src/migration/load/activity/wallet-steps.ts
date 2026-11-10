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
      const items: { legacyId: string; values: WalletValues; tierUnmapped: boolean }[] = []
      for (const row of rows) {
        const legacyId = idOf(row)
        const userId = resolveFk(row.user_id, users) ?? undefined
        const out = transformWallet(row, {
          userId,
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
      const items: LegacyRow[] = []
      for (const row of rows) {
        const legacyId = idOf(row)
        const userId = resolveFk(row.user_id, users) ?? undefined
        const out = transformLedger(row, { userId })
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

// ---------------------------------------------------------------- opening balance

/** Ledger source and legacy id prefix of the opening-balance row (one per wallet that its own ledger does not explain). */
export const OPENING_SOURCE = 'legacy_opening'
export const OPENING_ID_PREFIX = 'opening:'
const OPENING_DESCRIPTION = 'Baki bawaan dari sistem lama'

interface OpeningRow {
  wallet_legacy_id: string
  user_id: string
  balance: string
  ledger_sum: string
  ledger_rows: string
  has_opening: boolean
  created_text: string
}

/**
 * Opening balance (T-B5b follow-up, PO): V3 keeps `wallets.current_syiling` equal to the sum of the user's ledger rows (WalletService: the
 * wallet is a stored balance kept in step with the ledger). V2 kept two independent counters, so a migrated wallet can hold syiling that its
 * migrated ledger does not explain: balance credited without a ledger row (the V2 teacher and other non-pupil wallets, whose rewards are
 * written to the wallet only), ledger rows that V2 rejected here, or V2's own drift. For each such wallet ONE ledger row (`source =
 * legacy_opening`, `legacy_id = opening:<wallet id>`) carries the difference, dated just before the user's first ledger row, so
 * SUM(ledger) = balance again and every later V3 movement chains from the true balance. The wallet and the V2 ledger rows are never touched.
 * A positive difference is an `earn`, a negative one a `spend` (the sign rule of `ck_coin_ledger_amount_sign`). Re-runs recompute the row
 * (the migrated-row UPDATE door of the append-only trigger); a wallet that needs none is `excluded`.
 */
export function walletOpeningStep(a: ActivityContext): AnyEntityStep {
  const entity = 'wallet_opening'
  return {
    entity,
    source: a.source,
    extract: (after) => readById(a.pool, 'student_wallets', after, a.pageSize),
    keyOf: idOf,
    async load(rows: StagedRow[], ctx: BatchContext): Promise<BatchResult> {
      const ids = rows.map(idOf)
      const res = await ctx.db.query<OpeningRow>(
        `SELECT w.legacy_id AS wallet_legacy_id, w.user_id::text AS user_id, w.current_syiling::text AS balance,
                coalesce(l.s, 0)::text AS ledger_sum, coalesce(l.n, 0)::text AS ledger_rows,
                EXISTS (SELECT 1 FROM coin_ledger o WHERE o.legacy_source = $2 AND o.legacy_id = $3::text || w.legacy_id) AS has_opening,
                to_char((coalesce(l.first_at - interval '1 second', w.created_at)) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS created_text
           FROM wallets w
           LEFT JOIN LATERAL (SELECT sum(x.amount) AS s, count(*) AS n, min(x.created_at) AS first_at FROM coin_ledger x
                               WHERE x.user_id = w.user_id AND x.legacy_source = $2 AND x.legacy_id NOT LIKE $3::text || '%') l ON true
          WHERE w.legacy_source = $2::text AND w.legacy_id = ANY($1::text[]) ORDER BY w.legacy_id`,
        [ids, ctx.source, OPENING_ID_PREFIX],
      )
      const items: LegacyRow[] = []
      let excluded = rows.length - res.rows.length
      for (const r of res.rows) {
        const diff = Number(r.balance) - Number(r.ledger_sum)
        if (diff === 0 && !r.has_opening) {
          excluded += 1
          continue
        }
        if (diff !== 0) a.notes.count(Number(r.ledger_rows) === 0 ? 'wallet_opening.no_ledger' : diff > 0 ? 'wallet_opening.ledger_short' : 'wallet_opening.ledger_over')
        items.push({
          legacyId: `${OPENING_ID_PREFIX}${r.wallet_legacy_id}`,
          values: {
            user_id: r.user_id,
            type: diff >= 0 ? 'earn' : 'spend',
            source: OPENING_SOURCE,
            source_id: null,
            amount: diff,
            balance_after: diff,
            description: OPENING_DESCRIPTION,
            created_at: r.created_text,
          },
        })
      }
      const out = await upsertAndMap(ctx, entity, 'coin_ledger', LEDGER_COLUMNS, items, { register: false })
      return { ...out, excluded }
    },
  }
}
