/**
 * Wallet versus ledger (T-B5b follow-up): V3 keeps a wallet equal to the sum of its ledger rows, V2 kept two independent counters. The
 * `wallet_opening` step writes one `legacy_opening` ledger row per wallet that its V2 ledger does not explain, so after the run every
 * wallet equals its ledger and `migrate:verify` fails on any difference. The fixture rejects all its wallets, so this spec plants four
 * (synthetic values, ids from 9001): a consistent pupil, a pupil whose ledger is short of the balance, a pupil whose ledger is over it,
 * and a teacher (non-pupil) with a balance and no ledger row at all.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runVerify } from '../../../src/migration/verify'
import { bootActivity, realGroups } from './helpers-verify'
import type { ActivityHarness } from '../activity/helpers'

let h: ActivityHarness

const WALLET_CHECK = 'wallet balance versus ledger sum (users with a difference)'

beforeAll(async () => {
  h = await bootActivity()
  const pupils = await h.q<{ legacy_id: string }>(
    `select m.legacy_id from etl_id_map m join user_roles r on r.user_id = m.new_id::bigint and r.role = 'student'
     where m.entity = 'users' and m.legacy_source = 'cloud' order by m.legacy_id::bigint limit 3`,
  )
  const teachers = await h.q<{ legacy_id: string }>(
    `select m.legacy_id from etl_id_map m join user_roles r on r.user_id = m.new_id::bigint and r.role = 'teacher'
     where m.entity = 'users' and m.legacy_source = 'cloud' order by m.legacy_id::bigint limit 1`,
  )
  const [p1, p2, p3] = pupils.map((r) => r.legacy_id) as [string, string, string]
  const [t1] = teachers.map((r) => r.legacy_id) as [string]
  await h.q(`truncate staging_cloud.student_wallets, staging_cloud.coin_transactions`)
  await h.q(
    `insert into staging_cloud.student_wallets (id, user_id, syiling_balance, syiling_lifetime, streak_days, gamification_tier_id, created_at) values
       (9001, $1, 100, 150, 0, null, '2026-04-01T00:00:00Z'),
       (9002, $2, 50, 80, 0, null, '2026-04-01T00:00:00Z'),
       (9003, $3, 90, 120, 0, null, '2026-04-01T00:00:00Z'),
       (9004, $4, 500, 500, 0, null, '2026-04-01T00:00:00Z')`,
    [p1, p2, p3, t1],
  )
  await h.q(
    `insert into staging_cloud.coin_transactions (id, user_id, type, source, amount, balance_after, created_at) values
       (9101, $1, 'earn', 'practice', 60, 60, '2026-05-01T01:00:00Z'),
       (9102, $1, 'earn', 'practice', 40, 100, '2026-05-02T01:00:00Z'),
       (9103, $2, 'earn', 'practice', 30, 30, '2026-05-01T01:00:00Z'),
       (9104, $2, 'spend', 'practice', -10, 20, '2026-05-02T01:00:00Z'),
       (9105, $3, 'earn', 'practice', 100, 100, '2026-05-01T01:00:00Z')`,
    [p1, p2, p3],
  )
  for (const mode of ['dry-run', 'apply'] as const) {
    const r = await h.run(mode, { groups: realGroups() })
    expect(r.report.status).toBe('succeeded')
  }
}, 300_000)
afterAll(async () => {
  await h?.close()
})

describe('wallet versus ledger: the opening-balance row', () => {
  it('writes one legacy_opening row for each wallet its V2 ledger does not explain, and none for the consistent one', async () => {
    const rows = await h.q<{ legacy_id: string; type: string; amount: number; description: string; before_first: boolean }>(
      `select l.legacy_id, l.type, l.amount, l.description,
              l.created_at < coalesce((select min(x.created_at) from coin_ledger x where x.user_id = l.user_id and x.legacy_id not like 'opening:%'), 'infinity') as before_first
         from coin_ledger l where l.source = 'legacy_opening' order by l.legacy_id`,
    )
    expect(rows.map((r) => ({ id: r.legacy_id, type: r.type, amount: r.amount }))).toEqual([
      { id: 'opening:9002', type: 'earn', amount: 30 },
      { id: 'opening:9003', type: 'spend', amount: -10 },
      { id: 'opening:9004', type: 'earn', amount: 500 },
    ])
    expect(rows.every((r) => r.before_first && r.description === 'Baki bawaan dari sistem lama')).toBe(true)
    // Every wallet now equals its ledger; the wallet rows and the V2 ledger rows are untouched.
    const off = await h.q<{ n: number }>(
      `select count(*)::int as n from wallets w where w.legacy_source = 'cloud' and w.current_syiling <> coalesce((select sum(amount) from coin_ledger l where l.user_id = w.user_id), 0)`,
    )
    expect(off[0]?.n).toBe(0)
    expect((await h.q<{ n: number }>(`select count(*)::int as n from coin_ledger where legacy_id not like 'opening:%'`))[0]?.n).toBe(5)
  })

  it('is idempotent: a second apply changes nothing', async () => {
    const before = await h.q<{ n: number; s: number }>(`select count(*)::int as n, sum(amount)::int as s from coin_ledger`)
    const again = await h.run('apply', { groups: realGroups() })
    expect(again.report.status).toBe('succeeded')
    expect(await h.q<{ n: number; s: number }>(`select count(*)::int as n, sum(amount)::int as s from coin_ledger`)).toEqual(before)
  })

  it('verify passes and the check counts the differences it explains', async () => {
    const report = await runVerify({ pool: h.env.pool, env: h.runEnv, source: 'cloud' })
    expect(report.entities.find((e) => e.entity === 'wallets')?.loaded).toBe(4)
    expect(report.entities.find((e) => e.entity === 'coin_ledger')?.loaded).toBe(5)
    const opening = report.entities.find((e) => e.entity === 'wallet_opening')
    expect({ loaded: opening?.loaded, target: opening?.targetCount, status: opening?.status }).toEqual({ loaded: 3, target: 3, status: 'ok' })
    expect(report.entities.find((e) => e.entity === 'coin_ledger')?.targetCount).toBe(5)
    const drift = report.checks.find((c) => c.name === WALLET_CHECK)
    expect(drift?.status).toBe('ok')
    expect(drift?.actual).toBe(0)
    expect(drift?.detail).toContain('4 migrated wallets (1 of non-pupil users')
    expect(drift?.detail).toContain('3 carry an opening-balance row')
    const sums = report.checks.find((c) => c.name === 'ledger amount sum, staging versus v2')
    expect({ expected: sums?.expected, actual: sums?.actual, status: sums?.status }).toEqual({ expected: '220', actual: '220', status: 'ok' })
    expect(report.checks.filter((c) => c.status === 'mismatch')).toEqual([])
    expect(report.status).toBe('pass')
  })

  it('fails when a wallet no longer equals its ledger (the step did not cover it)', async () => {
    await h.q(`update wallets set current_syiling = current_syiling + 7 where legacy_source = 'cloud' and legacy_id = '9001'`)
    const report = await runVerify({ pool: h.env.pool, env: h.runEnv, source: 'cloud' })
    const drift = report.checks.find((c) => c.name === WALLET_CHECK)
    expect({ status: drift?.status, actual: drift?.actual }).toEqual({ status: 'mismatch', actual: 1 })
    expect(report.status).toBe('fail')
  })
})
