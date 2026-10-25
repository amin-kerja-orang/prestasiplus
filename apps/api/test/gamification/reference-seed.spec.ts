import { GamificationAchievementsSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runSeeds, seedModules } from '../../prisma/seed'
import { gamificationCatalogueSeed } from '../../prisma/seed/core/gamification-catalogue'
import { identitySeed } from '../../prisma/seed/core/identity'
import { ACHIEVEMENT_ROWS, CHALLENGE_ROWS, SETTING_ROWS } from '../../prisma/seed/gamification-data'
import { walletSeed } from '../../prisma/seed/wallet'
import { createTestDatabase, type TestDatabase } from '../support/db'
import { ADMIN, bareStudent, bootGamificationApp, dataOf, signIn, type GamificationTestApp } from './helpers'

const n = async (db: TestDatabase, sql: string): Promise<number> => Number((await db.query<{ n: string }>(sql))[0]!.n)

/**
 * GAMIF-REF: the achievement catalogue and the 10 settings are REFERENCE data. A production run (`be:db:seed`
 * with demo modules refused) must load them, because no route creates them and the ETL only adopts them by name/key.
 */
describe('core-gamification-catalogue (reference seed)', () => {
  let db: TestDatabase
  beforeAll(async () => {
    db = await createTestDatabase()
  })
  afterAll(async () => {
    await db.drop()
  })

  it('is a reference module, registered once, and runs in production without ALLOW_DEMO_SEED', async () => {
    expect(gamificationCatalogueSeed.kind).toBe('reference')
    expect(seedModules.filter((m) => m.name === 'core-gamification-catalogue')).toHaveLength(1)
    const names = seedModules.map((m) => m.name)
    expect(names.indexOf('core-gamification-catalogue')).toBeLessThan(names.indexOf('gamification'))
    const ran = await runSeeds(seedModules, { prisma: db.prisma, env: { NODE_ENV: 'production' } })
    expect(ran).toContain('core-gamification-catalogue')
    expect(ran).not.toContain('gamification')
  })

  it('production loads the 25 achievements with a structured criterion, the 10 challenges with a metric and the 10 settings, and nothing demo', async () => {
    expect(await n(db, `select count(*)::text n from achievements`)).toBe(ACHIEVEMENT_ROWS.length)
    expect(ACHIEVEMENT_ROWS).toHaveLength(25)
    expect(await n(db, `select count(*)::text n from achievements where criterion_kind is null or criterion_min is null`)).toBe(0)
    expect(await n(db, `select count(*)::text n from challenges`)).toBe(CHALLENGE_ROWS.length)
    expect(await n(db, `select count(*)::text n from challenges where metric is null or reward_syiling <= 0 or is_active is not true`)).toBe(0)
    const settings = await db.query<{ key: string; value: string }>(`select key, value::text from gamification_settings order by key`)
    expect(settings.map((s) => s.key)).toEqual(SETTING_ROWS.map((s) => s.key).sort())
    expect(Object.fromEntries(settings.map((s) => [s.key, Number(s.value)]))).toMatchObject({ games_award_syiling: 0, flat_quiz_reward: 1, current_session_year: 2026 })
    // the other gamification stores are demo data and stay empty in production
    for (const t of ['syiling_rewards', 'rewards', 'draws', 'draw_prizes', 'learner_badges']) {
      expect(await n(db, `select count(*)::text n from ${t}`), t).toBe(0)
    }
    for (const t of ['achievements', 'challenges', 'gamification_settings']) {
      expect(await db.query(`select 1 from ${t} where legacy_source is not null or legacy_id is not null`), t).toHaveLength(0)
    }
  })

  it('is idempotent, leaves an admin edit alone and never duplicates a row the ETL adopted or inserted (re-run after the ETL)', async () => {
    await db.query(`update gamification_settings set value = 3000 where key = 'reward_budget_sen_session'`)
    await db.query(`update achievements set reward_syiling = 7 where name = 'Langkah Pertama'`)
    // what the ETL does: adopts a seeded row (legacy pair set, own spelling kept) and inserts a legacy row of its own
    await db.query(`update achievements set legacy_source = 'cloud', legacy_id = '1' where name = 'Langkah Pertama'`)
    await db.query(`insert into achievements (name, legacy_criteria_text, legacy_source, legacy_id) values ('PELAJAR RAJIN', 'Contoh', 'cloud', '2'), ('Bintang Kelas', 'Contoh', 'cloud', '3')`)
    await db.query(`delete from achievements where name = 'Pelajar Rajin'`)
    await db.query(`update challenges set legacy_source = 'cloud', legacy_id = '1' where title = 'Rajin Berlatih'`)
    await db.query(`delete from challenges where title = 'Si Tepat'`)
    await db.query(`insert into challenges (title, challenge_type, target_value, legacy_source, legacy_id) values ('SI TEPAT', 'accuracy', 80, 'cloud', '2')`)
    await runSeeds(seedModules, { prisma: db.prisma, env: { NODE_ENV: 'production' } })
    await runSeeds(seedModules, { prisma: db.prisma, env: { NODE_ENV: 'production' } })
    expect(await n(db, `select count(*)::text n from challenges`)).toBe(10)
    // 25 seeded names + the one legacy row with a name of its own; 'PELAJAR RAJIN' counts as 'Pelajar Rajin' (case-insensitive), so no twin
    expect(await n(db, `select count(*)::text n from achievements`)).toBe(26)
    expect(await n(db, `select count(*)::text n from achievements where upper(name) = 'PELAJAR RAJIN'`)).toBe(1)
    expect(await n(db, `select count(*)::text n from achievements where name = 'Langkah Pertama'`)).toBe(1)
    expect((await db.query<{ reward_syiling: number }>(`select reward_syiling from achievements where name = 'Langkah Pertama'`))[0]!.reward_syiling).toBe(7)
    expect(Number((await db.query<{ value: string }>(`select value::text from gamification_settings where key = 'reward_budget_sen_session'`))[0]!.value)).toBe(3000)
    expect(await n(db, `select count(*)::text n from gamification_settings`)).toBe(10)
  })

  it('does not break the demo `gamification` module that runs after it (no twin, the demo-only rows still load)', async () => {
    const demo = await createTestDatabase()
    try {
      await runSeeds(seedModules.filter((m) => ['core-gamification-catalogue', 'gamification'].includes(m.name)), { prisma: demo.prisma, env: { NODE_ENV: 'test' } })
      expect(await n(demo, `select count(*)::text n from achievements`)).toBe(25)
      expect(await n(demo, `select count(*)::text n from gamification_settings`)).toBe(10)
      expect(await n(demo, `select count(*)::text n from challenges`)).toBe(10)
      expect(await n(demo, `select count(*)::text n from syiling_rewards`)).toBe(11)
      expect(await n(demo, `select count(*)::text n from draws`)).toBe(1)
    } finally {
      await demo.drop()
    }
  })
})

describe('what a pupil and the admin see on a production-profile database (reference seeds + tiers, no demo gamification)', () => {
  let t: GamificationTestApp
  beforeAll(async () => {
    // walletSeed stands in for the tier reference seed (#230); the demo `gamification` module is NOT run.
    t = await bootGamificationApp({ seeds: [identitySeed, walletSeed, gamificationCatalogueSeed] })
  }, 120_000)
  afterAll(async () => {
    await t.close()
  })

  it('S15 lists the 25 achievements, and the first practice session unlocks "Langkah Pertama" and pays it once', async () => {
    const u = await bareStudent(t, 'Produksi')
    t.facts.counts = { all: 1, practice: 1 }
    const out = await t.gamification.evaluateAchievements(u, { isTest: false })
    expect(out.unlockedIds).toHaveLength(1)
    expect(out.syiling).toBe(5)
    const pupil = await signIn(t, 'pelajar2@demo.test')
    const res = await pupil.get('/gamification/achievements')
    expect(res.status).toBe(200)
    const d = GamificationAchievementsSchema.parse(dataOf(res))
    expect(d.total).toBe(25)
    expect(d.items).toHaveLength(25)
  })

  it('S13 lists the 10 daily challenges', async () => {
    const pupil = await signIn(t, 'pelajar2@demo.test')
    const res = await pupil.get('/gamification/challenges')
    expect(res.status).toBe(200)
    const body = res.body as { data: { title: string; rewardSyiling: number }[]; meta: { active: number } }
    expect(body.meta.active).toBe(10)
    expect(body.data.find((c) => c.title === 'Rajin Berlatih')?.rewardSyiling).toBe(15)
  })

  it('the admin S9 settings screen lists the 10 keys and a save of an existing key succeeds', async () => {
    const admin = await signIn(t, ADMIN)
    const list = dataOf<{ key: string }[]>(await admin.get('/admin/gamification/settings'))
    expect(list).toHaveLength(10)
    const put = await admin.put('/admin/gamification/settings', { settings: [{ key: 'flat_quiz_reward', value: 2 }] })
    expect(put.status, JSON.stringify(put.body)).toBe(200)
  })
})
