/**
 * GAMIF-REF: the reference seed `core-gamification-catalogue` runs BEFORE the ETL (the go-live `--seed-reference` step), so
 * the catalogue step adopts its rows: a staged achievement takes over the seeded row of the same name (case-insensitive) and
 * keeps the structured criterion, a staged setting takes over the seeded key, and only a name the seed does not know becomes
 * a legacy achievement without auto-unlock. A staged platform challenge takes over the seeded challenge of the same title and
 * keeps its metric and rewards (a legacy challenge has metric null and can never be completed). Without the seed (the old production state) every staged achievement is a legacy row.
 */
import { afterAll, describe, expect, it } from 'vitest'

import { runSeeds } from '../../../prisma/seed'
import { gamificationCatalogueSeed } from '../../../prisma/seed/core/gamification-catalogue'
import { catalogueGroup } from '../../../src/migration/load/activity/part-b'
import { bootActivity, type ActivityHarness } from './helpers'

const STAGED = [
  [1, 'Langkah Pertama'],
  [2, 'PELAJAR RAJIN'],
  [3, 'Bintang Kelas'],
] as const

const CHALLENGES = [
  [1, 'Rajin Berlatih', 'quiz_count', 3],
  [2, 'cabaran hujung minggu', 'streak', 2],
] as const

async function scenario(seeded: boolean): Promise<{ h: ActivityHarness; challenges: { title: string; legacy_id: string | null; metric: string | null; reward_syiling: number }[]; achievements: { name: string; legacy_id: string | null; criterion_kind: string | null }[]; settings: { key: string; legacy_id: string | null }[] }> {
  const h = await bootActivity()
  if (seeded) await runSeeds([gamificationCatalogueSeed], { prisma: h.env.db.prisma })
  const q = (sql: string) => h.env.pool.query(sql)
  for (const t of ['gamification_tiers', 'achievements', 'achievement_user', 'challenges', 'challenge_user', 'reward_settings']) await q(`delete from staging_cloud.${t}`)
  for (const [id, name] of STAGED) await q(`insert into staging_cloud.achievements (id, name, criteria) values (${id}, '${name}', 'Contoh')`)
  for (const [id, title, type, target] of CHALLENGES) await q(`insert into staging_cloud.challenges (id, created_by, classroom_id, challenge_type, title, target_value) values (${id}, null, null, '${type}', '${title}', ${target})`)
  await q(`insert into staging_cloud.reward_settings (id, reward_budget_sen_month, flat_quiz_reward, current_session_year, games_award_syiling) values (1, 300, 2, '2026', 0)`)
  expect((await h.run('dry-run', { groups: [catalogueGroup] })).report.status).toBe('succeeded')
  expect((await h.run('apply', { groups: [catalogueGroup] })).report.status).toBe('succeeded')
  const achievements = await h.q<{ name: string; legacy_id: string | null; criterion_kind: string | null }>(`select name, legacy_id, criterion_kind from achievements where legacy_id is not null or criterion_kind is null order by legacy_id::bigint nulls last, name`)
  const settings = await h.q<{ key: string; legacy_id: string | null }>(`select key, legacy_id from gamification_settings order by key`)
  const challenges = await h.q<{ title: string; legacy_id: string | null; metric: string | null; reward_syiling: number }>(`select title, legacy_id, metric, reward_syiling from challenges order by id`)
  return { h, challenges, achievements, settings }
}

describe('catalogue step with and without the reference seed', () => {
  let open: ActivityHarness | undefined
  afterAll(async () => {
    await open?.close()
  })

  it('seed first: adopts by name and key, keeps the structured criterion, the 6 other settings stay', async () => {
    const r = await scenario(true)
    open = r.h
    expect(r.achievements).toEqual([
      { name: 'Langkah Pertama', legacy_id: '1', criterion_kind: 'practice_sessions' },
      { name: 'Pelajar Rajin', legacy_id: '2', criterion_kind: 'practice_sessions' },
      { name: 'Bintang Kelas', legacy_id: '3', criterion_kind: null },
    ])
    expect(await r.h.count('achievements')).toBe(26)
    // a second apply (re-run) changes nothing and keeps the seed values of the adopted challenge
    const again = await r.h.run('apply', { groups: [catalogueGroup] })
    expect(again.report.status).toBe('succeeded')
    expect(await r.h.count('challenges')).toBe(11)
    expect((await r.h.q<{ metric: string; reward_syiling: number }>(`select metric, reward_syiling from challenges where title = 'Rajin Berlatih'`))).toEqual([{ metric: 'sessions', reward_syiling: 15 }])
    // 10 seeded challenges: 'Rajin Berlatih' is adopted (no twin, seed metric and reward kept); the title the seed does not know is a legacy row
    expect(r.challenges).toHaveLength(11)
    expect(r.challenges.filter((c) => c.title === 'Rajin Berlatih')).toEqual([{ title: 'Rajin Berlatih', legacy_id: '1', metric: 'sessions', reward_syiling: 15 }])
    expect(r.challenges.filter((c) => c.legacy_id !== null && c.legacy_id !== '1')).toEqual([{ title: 'cabaran hujung minggu', legacy_id: '2', metric: null, reward_syiling: 0 }])
    expect(r.settings).toHaveLength(10)
    expect(r.settings.filter((s) => s.legacy_id !== null).map((s) => s.key)).toEqual(['current_session_year', 'flat_quiz_reward', 'games_award_syiling', 'reward_budget_sen_month'])
    expect(Number((await r.h.q<{ value: string }>(`select value::text from gamification_settings where key = 'flat_quiz_reward'`))[0]!.value)).toBe(2)
    await r.h.close()
    open = undefined
  })

  it('no seed (old production state): every staged achievement is a legacy row with no criterion and only the 4 staged settings exist', async () => {
    const r = await scenario(false)
    open = r.h
    expect(r.achievements.map((a) => [a.name, a.criterion_kind])).toEqual([['Langkah Pertama', null], ['PELAJAR RAJIN', null], ['Bintang Kelas', null]])
    expect(await r.h.count('achievements')).toBe(3)
    expect(r.challenges).toEqual([
      { title: 'Rajin Berlatih', legacy_id: '1', metric: null, reward_syiling: 0 },
      { title: 'cabaran hujung minggu', legacy_id: '2', metric: null, reward_syiling: 0 },
    ])
    expect(r.settings.map((s) => s.key)).toEqual(['current_session_year', 'flat_quiz_reward', 'games_award_syiling', 'reward_budget_sen_month'])
  })
})
