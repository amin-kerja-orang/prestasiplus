/**
 * A wallet whose staged tier was not adopted (no seeded tier carries its label) still loads, with `tier_id = null`
 * (BE-29, code-review group B finding 1). The tier itself stays rejected UNSUPPORTED, the wallet is counted in
 * `wallets.tier_unmapped`, its ledger loads and its streak is built like any loaded wallet.
 *
 * Synthetic rows (fictitious values, ids from 3101 up) in a private database; only the tier, wallet, ledger,
 * drift, session and streak entities run.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { bootActivity, type ActivityHarness } from './helpers'
import type { ActivityRunResult } from '../../../src/migration/load/activity'

const ONLY = ['tiers', 'wallets', 'coin_ledger', 'wallet_ledger_drift', 'practice_sessions', 'streaks']

let h: ActivityHarness
let p: string[] = []
let applied: ActivityRunResult

beforeAll(async () => {
  h = await bootActivity()
  p = (
    await h.q<{ legacy_id: string }>(
      `select m.legacy_id from etl_id_map m join user_roles r on r.user_id = m.new_id::bigint and r.role = 'student'
       where m.entity = 'users' and m.legacy_source = 'cloud' order by m.legacy_id::bigint limit 2`,
    )
  ).map((r) => r.legacy_id)
  expect(p.length, 'the fixture must give two migrated pupils').toBe(2)
  const [p1, p2] = p as [string, string]
  await h.q(`truncate staging_cloud.student_wallets, staging_cloud.coin_transactions, staging_cloud.practice_sessions, staging_cloud.question_attempts`)
  // v2 side: one seeded tier that no staged label matches. Staged side: one tier with a label the seeds do not carry.
  await h.q(`delete from tiers`)
  await h.q(`insert into tiers (tier_name, label_ms, icon, color, min_syiling, conversion_rate, sort_order) values ('bronze', 'Gangsa', 'B', '#cd7f32', 0, 50, 1)`)
  await h.q(`delete from staging_cloud.gamification_tiers`)
  await h.q(`insert into staging_cloud.gamification_tiers (id, label_ms, perks, sort_order) values (1, 'Tidak Wujud', null, 1)`)
  await h.q(
    `insert into staging_cloud.student_wallets (id, user_id, syiling_balance, syiling_lifetime, streak_days, gamification_tier_id, created_at) values
       (3101, $1, 100, 100, 0, 1, '2026-04-01T00:00:00Z'),
       (3102, $2, 5, 5, 0, null, '2026-04-01T00:00:00Z')`,
    [p1, p2],
  )
  await h.q(
    `insert into staging_cloud.coin_transactions (id, user_id, type, source, amount, balance_after, created_at) values
       (4101, $1, 'earn', 'practice', 60, 60, '2026-05-01T01:00:00Z'),
       (4102, $1, 'earn', 'practice', 40, 100, '2026-05-02T01:00:00Z')`,
    [p1],
  )
  await h.q(
    `insert into staging_cloud.practice_sessions (id, user_id, subject_id, mode, paper, client_uuid, total_questions, correct, accuracy, duration_seconds, syiling_earned, started_at, created_at)
     values (6101, $1, 1, 'random', 'paper1', null, 5, 1, 20, 60, 0, '2026-05-31T05:00:00Z', '2026-05-31T05:00:00Z')`,
    [p1],
  )
  expect((await h.run('dry-run', { only: ONLY })).report.status).toBe('succeeded')
  applied = await h.run('apply', { only: ONLY })
}, 300_000)
afterAll(async () => {
  await h?.close()
})

describe('wallet with an unmatched tier', () => {
  it('rejects the tier UNSUPPORTED, loads the wallet with a null tier and counts it', async () => {
    expect(applied.report.status).toBe('succeeded')
    const run = applied.report.runId
    const rejects = await h.q<{ entity: string; legacy_id: string; reason: string; column_name: string }>(
      `select entity, legacy_id, reason, column_name from etl_rejects where run_id = $1 order by entity, legacy_id`, [run],
    )
    expect(rejects).toEqual([{ entity: 'tiers', legacy_id: '1', reason: 'UNSUPPORTED', column_name: 'label_ms' }])
    expect(rejects.some((r) => r.reason === 'ORPHAN_PARENT')).toBe(false)
    const wallets = await h.q<{ legacy_id: string; current_syiling: number; tier_id: string | null }>(
      `select legacy_id, current_syiling, tier_id::text from wallets where legacy_source = 'cloud' and legacy_id in ('3101','3102') order by legacy_id`,
    )
    expect(wallets).toEqual([
      { legacy_id: '3101', current_syiling: 100, tier_id: null },
      { legacy_id: '3102', current_syiling: 5, tier_id: null },
    ])
    expect(applied.activity.notes.counters.get('wallets.tier_unmapped')).toBe(1)
    const recon = Object.fromEntries(applied.report.recon.map((r) => [r.entity, { loaded: r.loaded, rejected: r.rejected }]))
    expect(recon.wallets).toEqual({ loaded: 2, rejected: 0 })
    expect(recon.tiers).toEqual({ loaded: 0, rejected: 1 })
  })

  it('loads the ledger of that wallet and builds its streak like any loaded wallet', async () => {
    expect(await h.count('coin_ledger', `t.legacy_source = 'cloud' and t.legacy_id in ('4101','4102')`)).toBe(2)
    const streak = await h.q(`select total_days from streaks where legacy_source = 'cloud' and legacy_id = '3101'`)
    expect(streak).toEqual([{ total_days: 1 }])
    expect(await h.count('streaks', `t.legacy_source = 'cloud' and t.legacy_id = '3102'`)).toBe(1)
    // The ledger of the first wallet agrees with it (no drift); the second wallet has a balance and no ledger (drift).
    expect([...applied.activity.drift.idsOf('wallet_ledger_mismatch')]).toEqual([p[1]])
  })
})
