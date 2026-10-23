/**
 * Wallet-versus-ledger drift is REPORTED, never failed (risk "Ledger integrity", plan 14.6). The fixture rejects all its
 * wallets, so this spec plants two (synthetic values, ids from 9001): one consistent, one whose balance differs from its
 * ledger sum. The run must stay `pass`, with the drift shown as `reported`.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runVerify } from '../../../src/migration/verify'
import { bootActivity, realGroups } from './helpers-verify'
import type { ActivityHarness } from '../activity/helpers'

let h: ActivityHarness

beforeAll(async () => {
  h = await bootActivity()
  const pupils = await h.q<{ legacy_id: string }>(
    `select m.legacy_id from etl_id_map m join user_roles r on r.user_id = m.new_id::bigint and r.role = 'student'
     where m.entity = 'users' and m.legacy_source = 'cloud' order by m.legacy_id::bigint limit 2`,
  )
  const [p1, p2] = pupils.map((r) => r.legacy_id) as [string, string]
  await h.q(`truncate staging_cloud.student_wallets, staging_cloud.coin_transactions`)
  await h.q(
    `insert into staging_cloud.student_wallets (id, user_id, syiling_balance, syiling_lifetime, streak_days, gamification_tier_id, created_at) values
       (9001, $1, 100, 150, 0, null, '2026-04-01T00:00:00Z'),
       (9002, $2, 50, 80, 0, null, '2026-04-01T00:00:00Z')`,
    [p1, p2],
  )
  await h.q(
    `insert into staging_cloud.coin_transactions (id, user_id, type, source, amount, balance_after, created_at) values
       (9101, $1, 'earn', 'practice', 60, 60, '2026-05-01T01:00:00Z'),
       (9102, $1, 'earn', 'practice', 40, 100, '2026-05-02T01:00:00Z'),
       (9103, $2, 'earn', 'practice', 30, 30, '2026-05-01T01:00:00Z'),
       (9104, $2, 'spend', 'practice', -10, 20, '2026-05-02T01:00:00Z')`,
    [p1, p2],
  )
  for (const mode of ['dry-run', 'apply'] as const) {
    const r = await h.run(mode, { groups: realGroups() })
    expect(r.report.status).toBe('succeeded')
  }
}, 300_000)
afterAll(async () => {
  await h?.close()
})

describe('wallet versus ledger drift', () => {
  it('is reported with its count and the run still passes', async () => {
    const report = await runVerify({ pool: h.env.pool, env: h.runEnv, source: 'cloud' })
    expect(report.entities.find((e) => e.entity === 'wallets')?.loaded).toBe(2)
    expect(report.entities.find((e) => e.entity === 'coin_ledger')?.loaded).toBe(4)
    const drift = report.checks.find((c) => c.name === 'wallet balance versus ledger sum (users with a difference)')
    expect(drift?.status).toBe('reported')
    expect(drift?.actual).toBe(1)
    expect(drift?.detail).toContain('2 wallets have migrated ledger rows, 1 of them differ')
    const sums = report.checks.find((c) => c.name === 'ledger amount sum, staging versus v2')
    expect({ expected: sums?.expected, actual: sums?.actual, status: sums?.status }).toEqual({ expected: '120', actual: '120', status: 'ok' })
    expect(report.checks.filter((c) => c.status === 'mismatch')).toEqual([])
    expect(report.status).toBe('pass')
  })
})
