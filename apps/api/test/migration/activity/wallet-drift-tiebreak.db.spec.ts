/**
 * The "last balance" of the wallet-versus-ledger drift scan when two ledger rows of one wallet share the same
 * `created_at` (AM-08c). The scan orders by `created_at DESC, id DESC`, so the row loaded later (the higher id) is the
 * last one. The fixture is booted by `bootActivity`; this spec replaces the fixture's activity rows in its OWN private
 * database with synthetic ones (fictitious values, ids from 7001 up) and runs only the wallet entities.
 *
 * Planted (P1, P2 are migrated pupils); in both cases the two ledger rows carry one instant, the lower ledger id
 * first, and the ledger sum equals the wallet balance, so only the "last balance" comparison can differ:
 *   W7001 P1  balance 20, ledger 7101 (+10, bal 10) and 7102 (+10, bal 20) at one instant   last = 20 -> consistent
 *   W7002 P2  balance 20, ledger 7103 (+15, bal 20) and 7104 (+5,  bal 15) at one instant   last = 15 -> last-balance drift
 * Taking the lower id as "last" would invert both verdicts.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { bootActivity, type ActivityHarness } from './helpers'
import type { ActivityRunResult } from '../../../src/migration/load/activity'

const ONLY = ['wallets', 'coin_ledger', 'wallet_ledger_drift']
const INSTANT = '2026-05-01T01:00:00Z'

let h: ActivityHarness
let p: string[] = []
let applied: ActivityRunResult

beforeAll(async () => {
  h = await bootActivity()
  const pupils = await h.q<{ legacy_id: string }>(
    `select m.legacy_id from etl_id_map m join user_roles r on r.user_id = m.new_id::bigint and r.role = 'student'
     where m.entity = 'users' and m.legacy_source = 'cloud' order by m.legacy_id::bigint limit 2`,
  )
  p = pupils.map((r) => r.legacy_id)
  expect(p.length, 'the fixture must give two migrated pupils').toBe(2)
  const [p1, p2] = p as [string, string]

  await h.q(`truncate staging_cloud.student_wallets, staging_cloud.coin_transactions, staging_cloud.practice_sessions, staging_cloud.question_attempts`)
  await h.q(
    `insert into staging_cloud.student_wallets (id, user_id, syiling_balance, syiling_lifetime, streak_days, gamification_tier_id, created_at) values
       (7001, $1, 20, 20, 0, null, '2026-04-01T00:00:00Z'),
       (7002, $2, 20, 20, 0, null, '2026-04-01T00:00:00Z')`,
    [p1, p2],
  )
  await h.q(
    `insert into staging_cloud.coin_transactions (id, user_id, type, source, amount, balance_after, created_at) values
       (7101, $1, 'earn', 'practice', 10, 10, $3::timestamptz),
       (7102, $1, 'earn', 'practice', 10, 20, $3::timestamptz),
       (7103, $2, 'earn', 'practice', 15, 20, $3::timestamptz),
       (7104, $2, 'earn', 'practice', 5, 15, $3::timestamptz)`,
    [p1, p2, INSTANT],
  )
  const dry = await h.run('dry-run', { only: ONLY })
  expect(dry.report.status).toBe('succeeded')
  applied = await h.run('apply', { only: ONLY })
}, 300_000)
afterAll(async () => {
  await h?.close()
})

describe('wallet drift: last balance on a created_at tie', () => {
  it('plants a real tie: equal created_at and a lower id with a different balance_after', async () => {
    expect(applied.report.status).toBe('succeeded')
    const rows = await h.q<{ legacy_id: string; id: string; created_at: string; balance_after: number }>(
      `select legacy_id, id::text, created_at::text, balance_after from coin_ledger
       where legacy_source = 'cloud' and legacy_id in ('7101','7102','7103','7104') order by legacy_id`,
    )
    expect(rows).toHaveLength(4)
    expect(new Set(rows.map((r) => r.created_at)).size).toBe(1)
    // The loaded ids follow the legacy ids: the higher id of each pair is 7102 and 7104.
    expect(BigInt(rows[1]!.id)).toBeGreaterThan(BigInt(rows[0]!.id))
    expect(BigInt(rows[3]!.id)).toBeGreaterThan(BigInt(rows[2]!.id))
    expect(rows[0]!.balance_after).not.toBe(rows[1]!.balance_after)
    expect(rows[2]!.balance_after).not.toBe(rows[3]!.balance_after)
  })

  it('takes the balance_after of the higher ledger id as the last one', () => {
    // P1: the higher id says 20 = wallet, so nothing is reported for it (the lower id's 10 would be a false drift).
    // P2: the higher id says 15 <> wallet 20, so exactly this wallet is reported (the lower id's 20 would hide it).
    expect([...applied.activity.drift.idsOf('wallet_ledger_mismatch')]).toEqual([p[1]])
    expect(applied.activity.drift.count('wallet_ledger_mismatch')).toBe(1)
    expect(applied.activity.drift.count('wallet_ledger_last_balance_mismatch')).toBe(1)
    // The sums agree with the wallets, so the sum comparison reports nothing.
    expect(applied.activity.drift.count('wallet_ledger_sum_mismatch')).toBe(0)
  })
})
