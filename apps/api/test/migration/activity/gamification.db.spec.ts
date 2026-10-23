/**
 * BE-29 Part B, catalogue and gamification activity against a real PostgreSQL: tiers adopted by name, achievements
 * adopted by name, platform challenges only, settings pivot, completion day rules, unlocks, referrals and SPM targets.
 *
 * The staged rows are synthetic (fictitious values, surrogate ids). They are planted with SQL into `staging_cloud` after
 * the common boot; users are only UPDATED, never added, so the BE-28 fingerprint the preflight checks stays the same.
 * Only the Part B catalogue and activity groups run (`groups`), so Part A's steps do not take part.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { readCompletionRows, readUnlockRows } from '../../../src/migration/load/activity/gamification-steps'
import { activityGroupB, catalogueGroup } from '../../../src/migration/load/activity/part-b'
import { bootActivity, type ActivityHarness } from './helpers'

let h: ActivityHarness
let u: string[] = []
let s: string[] = []
let runId = ''
let reasons: Record<string, number> = {}
let notes: Record<string, number> = {}
let recon: Record<string, { source: number; eligible: number; loaded: number; rejected: number }> = {}
const groups = [catalogueGroup, activityGroupB]

async function collect<T>(gen: AsyncGenerator<T>): Promise<T[]> {
  const out: T[] = []
  for await (const x of gen) out.push(x)
  return out
}

const reject = (entity: string, reason: string, column: string): number => reasons[`${entity}|${reason}|${column}`] ?? 0

async function plant(): Promise<void> {
  const q = (sql: string, params: unknown[] = []) => h.env.pool.query(sql, params)
  // v2 side: what the seeds of a seeded environment hold.
  await q(`insert into tiers (tier_name, label_ms, icon, color, min_syiling, conversion_rate, sort_order) values
    ('bronze', 'Gangsa', 'B', '#cd7f32', 0, 50, 1), ('silver', 'Perak', 'S', '#c0c0c0', 500, 45, 2)`)
  await q(`insert into achievements (name, criterion_kind, criterion_min, reward_syiling) values ('Latih Tubi Pertama', 'practice_sessions', 1, 10)`)
  await q(`insert into gamification_settings (key, value, label) values ('flat_quiz_reward', 1, 'Syiling flat')`)

  // staged side
  for (const t of ['gamification_tiers', 'achievements', 'achievement_user', 'challenges', 'challenge_user', 'reward_settings']) {
    await q(`delete from staging_cloud.${t}`)
  }
  await q(`insert into staging_cloud.gamification_tiers (id, label_ms, perks, sort_order) values
    (1, 'Gangsa', 'a,b', 1), (2, 'PERAK', null, 2), (3, 'Tidak Wujud', null, 3)`)
  await q(`insert into staging_cloud.achievements (id, name, criteria) values
    (1, 'latih tubi pertama', 'Contoh'), (2, 'Pencapaian Baharu', 'Syarat contoh')`)
  await q(`insert into staging_cloud.challenges (id, created_by, classroom_id, type, title, criteria) values
    (1, null, null, 'quiz_count', 'Cabaran Platform', '{"target": 3}'),
    (2, ${u[0]}, null, 'quiz_count', 'Cabaran Guru', '{"target": 3}'),
    (3, null, null, 'harian', 'Jenis Tidak Dikenali', '{"target": 3}'),
    (4, null, null, 'accuracy', 'Tanpa Sasaran', 'contoh')`)
  await q(`insert into staging_cloud.reward_settings (id, reward_budget_sen_month, flat_quiz_reward, current_session_year, games_award_syiling)
    values (1, 300, 2, '2026', -1)`)
  await q(`insert into staging_cloud.challenge_user (challenge_id, user_id, progress, completed_at, claimed_on) values
    (1, ${u[0]}, 3, '2026-01-01T00:00:00Z', '2026-01-02'),
    (1, ${u[0]}, 3, '2026-01-03T01:00:00Z', '2026-01-03'),
    (1, ${u[0]}, 3, '2026-01-02T05:00:00Z', '2026-01-02'),
    (1, ${u[1]}, 3, '2026-01-01T23:30:00Z', null),
    (1, ${u[2]}, 1, null, null),
    (2, ${u[0]}, 3, null, '2026-01-05'),
    (3, ${u[1]}, 1, null, '2026-01-06'),
    (1, 99999, 3, null, '2026-01-02')`)
  await q(`insert into staging_cloud.achievement_user (achievement_id, user_id, unlocked_at) values
    (1, ${u[0]}, '2026-01-01T00:00:00Z'), (1, ${u[0]}, '2026-02-01T00:00:00Z'), (2, ${u[1]}, '2026-03-01T00:00:00Z'), (2, 99999, '2026-03-01T00:00:00Z')`)

  // users: only updates (the core fingerprint is not touched).
  await q(`update staging_cloud.users set referral_code = null, referred_by = null, spm_targets = null`)
  const codes: [string, string][] = [[u[0] as string, 'REFA'], [u[1] as string, 'REFB'], [u[2] as string, 'REFA']]
  for (const [id, code] of codes) await q(`update staging_cloud.users set referral_code = $2 where id = $1::bigint`, [id, code])
  const refs: [string, string][] = [[u[1] as string, u[0] as string], [u[2] as string, u[2] as string], [u[3] as string, '99999'], [u[4] as string, u[3] as string]]
  for (const [id, by] of refs) await q(`update staging_cloud.users set referred_by = $2::bigint where id = $1::bigint`, [id, by])
  const spm: [string, string][] = [
    [u[0] as string, JSON.stringify({ [s[0] as string]: 'A+', [s[1] as string]: 'b+' })],
    [u[1] as string, JSON.stringify({ [s[0] as string]: 'G' })],
    [u[2] as string, 'not json'],
    [u[3] as string, JSON.stringify([{ subject_id: Number(s[0]), grade: 'A' }, { subject_id: Number(s[0]), grade: 'B' }])],
    [u[4] as string, JSON.stringify({ '88888': 'A' })],
  ]
  for (const [id, text] of spm) await q(`update staging_cloud.users set spm_targets = $2 where id = $1::bigint`, [id, text])
}

beforeAll(async () => {
  h = await bootActivity()
  u = (await h.q<{ legacy_id: string }>(`select legacy_id from etl_id_map where legacy_source = 'cloud' and entity = 'users' order by legacy_id::bigint limit 5`)).map((r) => r.legacy_id)
  s = (await h.q<{ legacy_id: string }>(`select legacy_id from etl_id_map where legacy_source = 'cloud' and entity = 'subjects' order by legacy_id::bigint limit 2`)).map((r) => r.legacy_id)
  expect(u.length, 'five migrated users in the fixture').toBe(5)
  expect(s.length, 'two migrated subjects in the fixture').toBe(2)
  await plant()
  const dry = await h.run('dry-run', { groups })
  expect(dry.report.status).toBe('succeeded')
  const applied = await h.run('apply', { groups })
  expect(applied.report.status).toBe('succeeded')
  runId = applied.report.runId
  notes = Object.fromEntries(applied.activity.notes.counters)
  recon = Object.fromEntries(applied.report.recon.map((r) => [r.entity, { source: r.sourceCount, eligible: r.eligibleCount, loaded: r.loaded, rejected: r.rejected }]))
  const rows = await h.q<{ entity: string; reason: string; column_name: string; n: number }>(
    `select entity, reason, column_name, count(*)::int n from etl_rejects where run_id = $1 group by 1, 2, 3`, [runId],
  )
  reasons = Object.fromEntries(rows.map((r) => [`${r.entity}|${r.reason}|${r.column_name}`, r.n]))
}, 600_000)
afterAll(async () => {
  await h?.close()
})

describe('catalogue', () => {
  it('adopts the seeded tiers by name and rejects the one with no match', async () => {
    const tiers = await h.q<{ tier_name: string; icon: string; legacy_id: string | null }>(`select tier_name, icon, legacy_id from tiers order by tier_name`)
    expect(tiers).toEqual([
      { tier_name: 'bronze', icon: 'B', legacy_id: '1' },
      { tier_name: 'silver', icon: 'S', legacy_id: '2' },
    ])
    expect(await h.count('etl_id_map', `t.entity = 'tiers'`)).toBe(2)
    expect(reject('tiers', 'UNSUPPORTED', 'label_ms')).toBe(1)
    expect(recon.tiers).toEqual({ source: 3, eligible: 3, loaded: 2, rejected: 1 })
  })

  it('adopts the seeded achievement by upper-cased name and inserts the other with a null structured criterion', async () => {
    const rows = await h.q<{ name: string; criterion_kind: string | null; legacy_criteria_text: string | null; legacy_id: string }>(
      `select name, criterion_kind, legacy_criteria_text, legacy_id from achievements order by legacy_id`,
    )
    expect(rows).toEqual([
      { name: 'Latih Tubi Pertama', criterion_kind: 'practice_sessions', legacy_criteria_text: 'Contoh', legacy_id: '1' },
      { name: 'Pencapaian Baharu', criterion_kind: null, legacy_criteria_text: 'Syarat contoh', legacy_id: '2' },
    ])
  })

  it('loads platform challenges only: the teacher row is excluded, a bad type or no target is rejected', async () => {
    const rows = await h.q<{ legacy_id: string; metric: string | null; target_value: number }>(`select legacy_id, metric, target_value from challenges order by legacy_id`)
    expect(rows).toEqual([{ legacy_id: '1', metric: null, target_value: 3 }])
    expect(recon.challenges).toEqual({ source: 4, eligible: 3, loaded: 1, rejected: 2 })
    expect(reject('challenges', 'UNKNOWN_ENUM', 'type')).toBe(1)
    expect(reject('challenges', 'INVALID_VALUE', 'target_value')).toBe(1)
  })

  it('pivots reward_settings into key/value rows, adopting the seeded key', async () => {
    const rows = await h.q<{ key: string; value: string; legacy_id: string | null }>(`select key, value::text, legacy_id from gamification_settings order by key`)
    expect(rows).toEqual([
      { key: 'current_session_year', value: '2026.00', legacy_id: '1:current_session_year' },
      { key: 'flat_quiz_reward', value: '2.00', legacy_id: '1:flat_quiz_reward' },
      { key: 'reward_budget_sen_month', value: '300.00', legacy_id: '1:reward_budget_sen_month' },
    ])
    expect(reject('gamification_settings', 'INVALID_VALUE', 'games_award_syiling')).toBe(1)
    expect(recon.gamification_settings).toEqual({ source: 4, eligible: 4, loaded: 3, rejected: 1 })
  })
})

describe('completions and unlocks', () => {
  it('uses claimed_on, else the Malaysia date of completed_at; one row per day', async () => {
    const rows = await h.q<{ legacy_id: string; completion_date: string }>(`select legacy_id, completion_date::text from challenge_completions order by legacy_id`)
    const c = await h.q<{ id: string }>(`select new_id as id from etl_id_map where entity = 'challenges' and legacy_id = '1'`)
    expect(c.length).toBe(1)
    expect(rows).toEqual([
      { legacy_id: `1:${u[0]}:1`, completion_date: '2026-01-02' },
      { legacy_id: `1:${u[0]}:2`, completion_date: '2026-01-03' },
      { legacy_id: `1:${u[1]}:1`, completion_date: '2026-01-02' }, // 23:30 UTC on the 1st is the 2nd in Malaysia
    ])
  })

  it('excludes a row with no day and a completion of a teacher challenge; rejects a repeat day, an unknown user and a challenge that was not loaded', () => {
    // 8 rows: 3 loaded; excluded: no day (1) and teacher challenge 2 (1); rejected: repeat day, unknown user, challenge 3 (type not mapped).
    expect(recon.challenge_completions).toEqual({ source: 8, eligible: 6, loaded: 3, rejected: 3 })
    expect(reject('challenge_completions', 'DUPLICATE_KEY', 'claimed_on')).toBe(1)
    expect(reject('challenge_completions', 'ORPHAN_PARENT', 'user_id')).toBe(1)
    expect(reject('challenge_completions', 'ORPHAN_PARENT', 'challenge_id')).toBe(1)
  })

  it('counts a teacher-challenge completion as excluded in the run notes, not as a reject', () => {
    expect(notes['challenge_completions.excluded_teacher_challenge']).toBe(1)
    expect(notes['challenge_completions.no_day']).toBe(1)
  })

  it('reads the pivots with any page size, to the end and to the same keys as one big page', async () => {
    for (const read of [readCompletionRows, readUnlockRows]) {
      const all = (await collect(read(h.env.pool, null, 1000))).map((r) => r.key)
      expect(all.length).toBeGreaterThan(3)
      for (const pageSize of [1, 2, 3]) {
        expect((await collect(read(h.env.pool, null, pageSize))).map((r) => r.key), `${read.name} page size ${pageSize}`).toEqual(all)
      }
      // Resume after a key in the middle (inside a pair): the rest, once.
      const mid = all[1] as string
      expect((await collect(read(h.env.pool, mid, 1))).map((r) => r.key)).toEqual(all.slice(2))
    }
  }, 30_000)

  it('keeps the earliest unlock of a repeated pair and rejects the repeat and the unknown user', async () => {
    const rows = await h.q<{ legacy_id: string; unlocked_at: string }>(`select legacy_id, to_char(unlocked_at at time zone 'UTC', 'YYYY-MM-DD') as unlocked_at from user_achievements order by legacy_id`)
    expect(rows).toEqual([
      { legacy_id: `1:${u[0]}`, unlocked_at: '2026-01-01' },
      { legacy_id: `2:${u[1]}`, unlocked_at: '2026-03-01' },
    ])
    expect(reject('user_achievements', 'DUPLICATE_KEY', 'user_id')).toBe(1)
    expect(reject('user_achievements', 'ORPHAN_PARENT', 'user_id')).toBe(1)
  })
})

describe('referrals', () => {
  it('loads codes (a clashing code is DUPLICATE_KEY) and then referrals with the referrer code', async () => {
    const codes = await h.q<{ legacy_id: string; code: string }>(`select legacy_id, code from referral_codes order by legacy_id::bigint`)
    expect(codes).toEqual([{ legacy_id: u[0], code: 'REFA' }, { legacy_id: u[1], code: 'REFB' }])
    expect(reject('referral_codes', 'DUPLICATE_KEY', 'referral_code')).toBe(1)

    const refs = await h.q<{ legacy_id: string; code_used: string; rewarded: boolean }>(`select legacy_id, code_used, rewarded from referrals order by legacy_id::bigint`)
    expect(refs).toEqual([{ legacy_id: u[1], code_used: 'REFA', rewarded: false }])
  })

  it('rejects a self-referral, a missing referrer and a referrer without a code', () => {
    expect(reject('referrals', 'INVALID_VALUE', 'referred_by')).toBe(1)
    expect(reject('referrals', 'ORPHAN_PARENT', 'referred_by')).toBe(1)
    expect(reject('referrals', 'ORPHAN_PARENT', 'referral_code')).toBe(1)
    expect(recon.referrals).toEqual({ source: 4, eligible: 4, loaded: 1, rejected: 3 })
  })
})

describe('spm_targets', () => {
  it('loads one row per subject with the grade upper-cased, and rejects bad grades, shapes, subjects and repeats', async () => {
    const rows = await h.q<{ target_grade: string; legacy_id: string }>(`select target_grade, legacy_id from spm_targets order by legacy_id`)
    expect(rows.map((r) => `${r.legacy_id}=${r.target_grade}`).sort()).toEqual(
      [`${u[0]}:${s[0]}=A+`, `${u[0]}:${s[1]}=B+`, `${u[3]}:${s[0]}=A`].sort(),
    )
    expect(reject('spm_targets', 'INVALID_VALUE', 'target_grade')).toBe(1) // G is a result grade only
    expect(reject('spm_targets', 'INVALID_VALUE', 'spm_targets')).toBe(1) // not JSON
    expect(reject('spm_targets', 'DUPLICATE_KEY', 'subject_id')).toBe(1)
    expect(reject('spm_targets', 'ORPHAN_PARENT', 'subject_id')).toBe(1)
    expect(recon.spm_targets).toEqual({ source: 7, eligible: 7, loaded: 3, rejected: 4 })
  })
})

describe('re-run', () => {
  it('a second apply repeats nothing', async () => {
    const before = await h.contentHashes()
    const again = await h.run('apply', { groups })
    expect(again.report.status).toBe('succeeded')
    for (const [entity, c] of Object.entries(again.report.counters)) {
      expect(c.inserted, `${entity} inserted`).toBe(0)
      expect(c.updated, `${entity} updated`).toBe(0)
    }
    expect(await h.contentHashes()).toEqual(before)
  }, 120_000)
})
