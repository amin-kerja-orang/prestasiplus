/**
 * Report rebuild after a RESUMED apply (BE-29 AC3, LEAD Q5). The drift collector and the notes live in memory, and a
 * resumed apply skips the batches a checkpoint already committed, so the figures those batches would have added are
 * missing. After such a run the figures that can be derived from committed data are recomputed over the full set, so
 * the final report equals the report of an uninterrupted run:
 *   - wallet / ledger drift and the streak drift: a scan of the whole staged `student_wallets` against the migrated
 *     wallets, ledger and streaks;
 *   - `practice_sessions.mode_rejected.*`, `exam_attempts.status_rejected.*`, `coin_ledger.rejected_amount`: counted from this run's `etl_rejects`;
 *   - `wallets.tier_unmapped`: wallets that loaded with no tier although staging names one.
 * Only steps that were part of the run are rebuilt. Counts and surrogate ids only.
 */
import type pg from 'pg'

import { SESSION_MODES_DEFERRED } from '../../transform/practice'
import { enumKey } from '../../transform/common'
import { examStatusRejectLabel } from '../../transform/exam'
import { readById } from '../source'
import type { ActivityContext } from './context'
import { scanWalletDrift } from './wallet-steps'

const WALLET_DRIFT_KINDS = ['wallet_ledger_mismatch', 'wallet_ledger_sum_mismatch', 'wallet_ledger_last_balance_mismatch'] as const

function resetNotes(a: ActivityContext, prefix: string): void {
  for (const k of [...a.notes.counters.keys()]) if (k === prefix || k.startsWith(`${prefix}.`)) a.notes.counters.delete(k)
}

export async function rebuildAfterResume(a: ActivityContext, pool: pg.Pool, runId: string, entities: readonly string[]): Promise<void> {
  const ran = new Set(entities)
  const source = a.source

  if (ran.has('wallet_ledger_drift')) {
    for (const k of WALLET_DRIFT_KINDS) a.drift.clear(k)
    let batch = new Map<string, string | null | undefined>()
    for await (const row of readById(pool, 'student_wallets', null, a.pageSize)) {
      batch.set(row.id ?? '', row.user_id)
      if (batch.size >= a.pageSize) {
        await scanWalletDrift(pool, source, batch, a.drift)
        batch = new Map()
      }
    }
    if (batch.size > 0) await scanWalletDrift(pool, source, batch, a.drift)
  }

  if (ran.has('streaks')) {
    a.drift.clear('streak_days_mismatch')
    const res = await pool.query<{ user_id: string | null; streak_days: string | null; cur: number }>(
      `SELECT sw.user_id::text AS user_id, sw.streak_days::text AS streak_days, st."current" AS cur
       FROM staging_cloud.student_wallets sw
       JOIN streaks st ON st.legacy_source = $1 AND st.legacy_id = sw.id::text
       ORDER BY sw.id`,
      [source],
    )
    for (const r of res.rows) {
      const old = r.streak_days === null ? null : Number(r.streak_days)
      if (old !== null && Number.isFinite(old) && old !== r.cur && r.user_id) a.drift.addId('streak_days_mismatch', r.user_id)
    }
  }

  if (ran.has('practice_sessions')) {
    resetNotes(a, 'practice_sessions.mode_rejected')
    const res = await pool.query<{ mode: string | null }>(
      `SELECT s.mode::text AS mode FROM etl_rejects r
       JOIN staging_cloud.practice_sessions s ON s.id::text = r.legacy_id
       WHERE r.run_id = $1::bigint AND r.entity = 'practice_sessions' AND r.column_name = 'mode'`,
      [runId],
    )
    for (const r of res.rows) {
      const mode = enumKey(r.mode)
      a.notes.count(`practice_sessions.mode_rejected.${mode !== null && SESSION_MODES_DEFERRED.includes(mode) ? mode : 'other'}`)
    }
  }

  if (ran.has('exam_attempts')) {
    resetNotes(a, 'exam_attempts.status_rejected')
    const res = await pool.query<{ slug: string | null }>(
      `SELECT st.slug::text AS slug FROM etl_rejects r
       JOIN staging_cloud.exam_attempts t ON t.id::text = r.legacy_id
       LEFT JOIN staging_cloud.attempt_statuses st ON st.id = t.status_id
       WHERE r.run_id = $1::bigint AND r.entity = 'exam_attempts' AND r.column_name = 'status'`,
      [runId],
    )
    for (const r of res.rows) a.notes.count(`exam_attempts.status_rejected.${examStatusRejectLabel(r.slug)}`)
  }

  if (ran.has('coin_ledger')) {
    resetNotes(a, 'coin_ledger.rejected_amount')
    const res = await pool.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM etl_rejects WHERE run_id = $1::bigint AND entity = 'coin_ledger' AND column_name = 'amount'`,
      [runId],
    )
    const n = Number(res.rows[0]?.n ?? 0)
    if (n > 0) a.notes.count('coin_ledger.rejected_amount', n)
  }

  if (ran.has('banners') && a.files !== undefined) {
    // Skipped batches did not count their files: rejects come from this run's rejects, the rest from the migrated rows.
    resetNotes(a, 'files.banners.image_path')
    const rej = await pool.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM etl_rejects WHERE run_id = $1::bigint AND entity = 'banners' AND column_name = 'image_path'`,
      [runId],
    )
    const loaded = await pool.query<{ n: string }>(`SELECT count(*)::text AS n FROM banners WHERE legacy_source = $1 AND image_file_id IS NOT NULL`, [source])
    const r = Number(rej.rows[0]?.n ?? 0)
    const l = Number(loaded.rows[0]?.n ?? 0)
    if (r > 0) a.notes.count('files.banners.image_path.rejected.resumed', r)
    if (l > 0) a.notes.count('files.banners.image_path.present', l)
  }

  if (ran.has('wallets')) {
    resetNotes(a, 'wallets.tier_unmapped')
    const res = await pool.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM wallets w
       JOIN staging_cloud.student_wallets sw ON sw.id::text = w.legacy_id
       WHERE w.legacy_source = $1 AND btrim(coalesce(sw.gamification_tier_id::text, '')) <> ''
         AND NOT EXISTS (SELECT 1 FROM etl_id_map m WHERE m.entity = 'tiers' AND m.legacy_source = $1
                         AND m.legacy_id = btrim(sw.gamification_tier_id::text))`,
      [source],
    )
    const n = Number(res.rows[0]?.n ?? 0)
    if (n > 0) a.notes.count('wallets.tier_unmapped', n)
  }
}
