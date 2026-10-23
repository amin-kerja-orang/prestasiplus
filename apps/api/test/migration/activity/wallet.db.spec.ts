/**
 * Wallets, coin ledger, wallet-versus-ledger drift and recomputed streaks of `migrate:activity` against a real
 * PostgreSQL (cards AC3 and AC4, BE-29 Part A). The fixture is booted by `bootActivity` (BE-28 applied); this spec
 * replaces the fixture's activity rows in its OWN private database with synthetic ones (fictitious values, ids from
 * 3001 up) and runs only the wallet and streak entities.
 *
 * Planted (P1..P4 are migrated pupils, T is a migrated teacher when the fixture gives one):
 *   W3001 P1  balance 100, ledger +60 (bal 60), +40 (bal 100)       consistent
 *   W3002 P2  balance 50,  ledger +30 (bal 30), -10 (bal 20)         wallet differs from the ledger sum AND last balance
 *   W3003 P3  balance -5                                              rejected INVALID_VALUE
 *   W3004 P4  balance 7,   ledger: a spend with a positive amount     ledger row rejected; wallet has no ledger at all
 *   W3005 T   a teacher                                               rejected UNSUPPORTED
 *   sessions  P1 at 2026-05-20 05:00Z, 2026-05-31 01:00Z, 2026-05-30 23:30Z (= 31 May in Malaysia), 2026-05-31 23:30Z
 *             (= 1 June in Malaysia); P2 at 10, 11 and 12 May 05:00Z. The as-of day is 2026-06-01.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { AS_OF, bootActivity, type ActivityHarness } from './helpers'
import type { ActivityRunResult } from '../../../src/migration/load/activity'

const ONLY = ['wallets', 'coin_ledger', 'wallet_ledger_drift', 'practice_sessions', 'streaks']

let h: ActivityHarness
let p: string[] = []
let teacher: string | undefined
let dry: ActivityRunResult
let applied: ActivityRunResult

const v2 = async (legacyUser: string): Promise<string> =>
  (await h.q<{ new_id: string }>(`select new_id from etl_id_map where entity = 'users' and legacy_source = 'cloud' and legacy_id = $1`, [legacyUser]))[0]?.new_id ?? ''

beforeAll(async () => {
  h = await bootActivity()
  const pupils = await h.q<{ legacy_id: string }>(
    `select m.legacy_id from etl_id_map m join user_roles r on r.user_id = m.new_id::bigint and r.role = 'student'
     where m.entity = 'users' and m.legacy_source = 'cloud' order by m.legacy_id::bigint limit 4`,
  )
  p = pupils.map((r) => r.legacy_id)
  expect(p.length, 'the fixture must give four migrated pupils').toBe(4)
  teacher = (await h.q<{ legacy_id: string }>(
    `select m.legacy_id from etl_id_map m join user_roles r on r.user_id = m.new_id::bigint and r.role = 'teacher'
     where m.entity = 'users' and m.legacy_source = 'cloud' order by m.legacy_id::bigint limit 1`,
  ))[0]?.legacy_id

  // Private database: drop the fixture's activity rows so the planted users have no other wallet or session.
  await h.q(`truncate staging_cloud.student_wallets, staging_cloud.coin_transactions, staging_cloud.practice_sessions, staging_cloud.question_attempts`)
  const [p1, p2, p3, p4] = p as [string, string, string, string]
  await h.q(
    `insert into staging_cloud.student_wallets (id, user_id, syiling_balance, syiling_lifetime, streak_days, gamification_tier_id, created_at) values
       (3001, $1, 100, 150, 9, null, '2026-04-01T00:00:00Z'),
       (3002, $2, 50, 80, 0, null, '2026-04-01T00:00:00Z'),
       (3003, $3, -5, 10, 0, null, '2026-04-01T00:00:00Z'),
       (3004, $4, 7, 7, 0, null, '2026-04-01T00:00:00Z')`,
    [p1, p2, p3, p4],
  )
  if (teacher) {
    await h.q(`insert into staging_cloud.student_wallets (id, user_id, syiling_balance, syiling_lifetime, streak_days, gamification_tier_id, created_at) values (3005, $1, 1, 1, 0, null, '2026-04-01T00:00:00Z')`, [teacher])
  }
  await h.q(
    `insert into staging_cloud.coin_transactions (id, user_id, type, source, amount, balance_after, created_at) values
       (4001, $1, 'earn', 'practice', 60, 60, '2026-05-01T01:00:00Z'),
       (4002, $1, 'earn', 'practice', 40, 100, '2026-05-02T01:00:00Z'),
       (4003, $2, 'earn', 'practice', 30, 30, '2026-05-01T01:00:00Z'),
       (4004, $2, 'spend', 'practice', -10, 20, '2026-05-02T01:00:00Z'),
       (4005, $3, 'spend', 'practice', 5, 2, '2026-05-02T01:00:00Z')`,
    [p1, p2, p4],
  )
  const session = (id: number, user: string, startedAt: string) =>
    h.q(
      `insert into staging_cloud.practice_sessions (id, user_id, subject_id, mode, paper, client_uuid, total_questions, correct, accuracy, duration_seconds, syiling_earned, started_at, created_at)
       values ($1, $2, 1, 'random', 'paper1', null, 5, 1, 20, 60, 0, $3, $3)`,
      [id, user, startedAt],
    )
  await session(6001, p1, '2026-05-20T05:00:00Z')
  await session(6002, p1, '2026-05-31T01:00:00Z')
  await session(6003, p1, '2026-05-30T23:30:00Z')
  await session(6004, p1, '2026-05-31T23:30:00Z')
  await session(6005, p2, '2026-05-10T05:00:00Z')
  await session(6006, p2, '2026-05-11T05:00:00Z')
  await session(6007, p2, '2026-05-12T05:00:00Z')
}, 300_000)
afterAll(async () => {
  await h?.close()
})

describe('wallets and ledger (AC3)', () => {
  it('dry-runs without writing and applies with every reconciliation row ok', async () => {
    dry = await h.run('dry-run', { only: ONLY })
    expect(dry.report.status).toBe('succeeded')
    expect(await h.count('wallets', `t.legacy_source = 'cloud'`)).toBe(0)
    applied = await h.run('apply', { only: ONLY })
    expect(applied.report.status).toBe('succeeded')
    for (const r of applied.report.recon) expect(r.eligibleCount - r.loaded - r.rejected, r.entity).toBe(0)
    expect(applied.report.recon.map((r) => r.entity)).toEqual(ONLY)
  }, 180_000)

  it('keeps the .cloud balance of a planted wallet that differs from its ledger and corrects nothing', async () => {
    const rows = await h.q<{ legacy_id: string; current_syiling: number; total_syiling_earned: number; token_balance: number; xp: number; level: number; tier_id: string | null }>(
      `select legacy_id, current_syiling, total_syiling_earned, token_balance, xp, level, tier_id::text from wallets
       where legacy_source = 'cloud' and legacy_id in ('3001','3002','3003','3004','3005') order by legacy_id`,
    )
    expect(rows.map((r) => [r.legacy_id, r.current_syiling])).toEqual([['3001', 100], ['3002', 50], ['3004', 7]])
    expect(rows[1]).toMatchObject({ total_syiling_earned: 80, token_balance: 0, xp: 0, level: 1, tier_id: null })
    // The ledger of that user is exactly what .cloud holds: sum 20, last balance 20 (the wallet is not "fixed" to match).
    const ledger = await h.q<{ sum: string; last: string }>(
      `select sum(amount)::text as sum, (array_agg(balance_after order by created_at desc, id desc))[1]::text as last
       from coin_ledger where legacy_source = 'cloud' and user_id = $1::bigint`,
      [await v2(p[1] as string)],
    )
    expect(ledger[0]).toEqual({ sum: '20', last: '20' })
    // Every migrated wallet equals its staged value (balance never corrected).
    const diff = await h.q(
      `select w.legacy_id from wallets w join staging_cloud.student_wallets s on s.id::text = w.legacy_id
       where w.legacy_source = 'cloud' and w.current_syiling <> s.syiling_balance`,
    )
    expect(diff).toEqual([])
  })

  it('names the wallets whose balance, ledger sum or last balance disagree, with surrogate ids only', async () => {
    for (const run of [dry, applied]) {
      const ids = [...run.activity.drift.idsOf('wallet_ledger_mismatch')].sort()
      expect(ids).toEqual([p[1], p[3]].sort())
      expect(ids).not.toContain(p[0])
      for (const id of ids) expect(id).toMatch(/^\d{1,9}$/)
      expect(run.activity.drift.count('wallet_ledger_mismatch')).toBe(2)
      expect(run.activity.drift.count('wallet_ledger_sum_mismatch')).toBe(2)
      expect(run.activity.drift.count('wallet_ledger_last_balance_mismatch')).toBe(1)
    }
    const lines = applied.activity.drift.lines().join('\n')
    expect(lines).toContain('drift wallet_ledger_mismatch: 2')
  })

  it('rejects a negative balance, a teacher wallet and a ledger row with a wrong sign, with reason codes', async () => {
    const run = applied.report.runId
    const wallet = await h.q<{ legacy_id: string; reason: string; column_name: string }>(
      `select legacy_id, reason, column_name from etl_rejects where run_id = $1 and entity = 'wallets' order by legacy_id`, [run],
    )
    expect(wallet.find((r) => r.legacy_id === '3003')).toEqual({ legacy_id: '3003', reason: 'INVALID_VALUE', column_name: 'syiling_balance' })
    if (teacher) expect(wallet.find((r) => r.legacy_id === '3005')).toMatchObject({ reason: 'UNSUPPORTED' })
    expect(await h.count('wallets', `t.legacy_source = 'cloud' and t.legacy_id = '3003'`)).toBe(0)
    const ledger = await h.q<{ legacy_id: string; reason: string; column_name: string }>(
      `select legacy_id, reason, column_name from etl_rejects where run_id = $1 and entity = 'coin_ledger' and legacy_id = '4005'`, [run],
    )
    expect(ledger).toEqual([{ legacy_id: '4005', reason: 'INVALID_VALUE', column_name: 'amount' }])
    // Never flipped: no ledger row exists for it, and the other four are loaded as they are.
    expect(await h.count('coin_ledger', `t.legacy_source = 'cloud' and t.legacy_id = '4005'`)).toBe(0)
    const loaded = await h.q<{ legacy_id: string; type: string; amount: number; balance_after: number; source: string; source_id: string | null; description: string }>(
      `select legacy_id, type, amount, balance_after, source, source_id, description from coin_ledger
       where legacy_source = 'cloud' and legacy_id in ('4001','4002','4003','4004') order by legacy_id`,
    )
    expect(loaded.map((r) => [r.legacy_id, r.type, r.amount, r.balance_after])).toEqual([
      ['4001', 'earn', 60, 60], ['4002', 'earn', 40, 100], ['4003', 'earn', 30, 30], ['4004', 'spend', -10, 20],
    ])
    expect(loaded[0]).toMatchObject({ source: 'quiz_practice', source_id: null, description: '' })
  })
})

describe('streaks recomputed in Malaysia days (AC4)', () => {
  it('puts a 23:30 UTC session on the next Malaysia date', async () => {
    const s = (await h.q(
      `select "current", best, total_days, last_activity_date::text from streaks where legacy_source = 'cloud' and legacy_id = '3001'`,
    ))[0]
    // 31 May (23:30 UTC on 30 May and 01:00 UTC on 31 May share the day) and 1 June (23:30 UTC on 31 May), plus 20 May.
    expect(s).toEqual({ current: 2, best: 2, total_days: 3, last_activity_date: '2026-06-01' })
    // The same instants in UTC dates would have ended on 31 May: the SQL conversion is what moved it.
    const utc = await h.q<{ d: string }>(`select max((started_at at time zone 'UTC')::date)::text as d from practice_sessions where legacy_source = 'cloud' and user_id = $1::bigint`, [await v2(p[0] as string)])
    expect(utc[0]?.d).toBe('2026-05-31')
    expect(AS_OF).toBe('2026-06-01')
  })

  it('counts a run that ended before the as-of day as best but not current, and gives a wallet without sessions zeros', async () => {
    const rows = await h.q(
      `select legacy_id, "current", best, total_days, last_activity_date::text from streaks
       where legacy_source = 'cloud' and legacy_id in ('3002','3003','3004','3005') order by legacy_id`,
    )
    expect(rows).toEqual([
      { legacy_id: '3002', current: 0, best: 3, total_days: 3, last_activity_date: '2026-05-12' },
      { legacy_id: '3004', current: 0, best: 0, total_days: 0, last_activity_date: null },
    ])
  })

  it('reports an old streak_days that differs from the recomputed one as drift, by id only', async () => {
    expect([...applied.activity.drift.idsOf('streak_days_mismatch')]).toEqual([p[0]])
  })

  it('a second apply changes nothing', async () => {
    const before = await h.contentHashes()
    const again = await h.run('apply', { only: ONLY })
    expect(again.report.status).toBe('succeeded')
    for (const c of Object.values(again.report.counters)) {
      expect(c.inserted).toBe(0)
      expect(c.updated).toBe(0)
    }
    expect(await h.contentHashes()).toEqual(before)
  }, 180_000)
})
