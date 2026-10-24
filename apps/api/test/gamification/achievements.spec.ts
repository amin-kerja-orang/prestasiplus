import { GamificationAchievementsSchema } from '@pp/contract'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { StreakService } from '../../src/modules/wallet'
import { bareStudent, bootGamificationApp, dataOf, ledgerOf, signIn, userIdOf, walletOf, START, STUDENT_EMPTY, type GamificationTestApp } from './helpers'

/**
 * SW10-03: the BR-M14-16 achievement criteria are evaluated after a practice-mode session (FR-M14-51). An achievement
 * unlocks once per user and pays its syiling + XP once (ledger `achievement`, key `achievement:<id>`, "Pencapaian: {name}").
 */
describe('M14 achievements: evaluateAchievements (BR-M14-16, FR-M14-51)', () => {
  let t: GamificationTestApp

  beforeAll(async () => {
    t = await bootGamificationApp()
  }, 120_000)
  afterAll(async () => {
    await t.close()
  })
  beforeEach(() => {
    t.facts.counts = { all: 0, practice: 0 }
    t.facts.accurate = 0
    t.facts.masteryRows = []
    t.clock.set(START)
  })

  const idOf = async (name: string) => (await t.db.query<{ id: string }>(`select id::text from achievements where name = $1`, [name]))[0]!.id
  const unlockRows = (userId: string) =>
    t.db.query<{ name: string; is_test: boolean }>(`select a.name, ua.is_test from user_achievements ua join achievements a on a.id = ua.achievement_id where ua.user_id = $1 order by ua.id`, [userId])
  const achievementRows = async (userId: string) => (await ledgerOf(t, userId)).filter((r) => r.source === 'achievement')

  it('Langkah Pertama: the first practice session unlocks it and pays +5 syiling, +3 XP once (ledger row, wallet, unlock row)', async () => {
    const u = await bareStudent(t, 'Langkah')
    t.facts.counts = { all: 1, practice: 1 }
    const out = await t.gamification.evaluateAchievements(u, { isTest: false })
    const id = await idOf('Langkah Pertama')
    expect(out).toEqual({ unlockedIds: [id], syiling: 5, xp: 3 })
    expect(await unlockRows(u)).toEqual([{ name: 'Langkah Pertama', is_test: false }])
    expect(await ledgerOf(t, u)).toEqual([expect.objectContaining({ type: 'earn', source: 'achievement', source_id: `achievement:${id}`, amount: 5, balance_after: 5, description: 'Pencapaian: Langkah Pertama', is_test: false })])
    expect(await walletOf(t, u)).toMatchObject({ current_syiling: 5, total_syiling_earned: 5, xp: 3 })
  })

  it('idempotent: evaluating again, or in parallel, unlocks nothing new and credits nothing twice', async () => {
    const u = await bareStudent(t, 'Sekali')
    t.facts.counts = { all: 1, practice: 1 }
    const runs = await Promise.all(Array.from({ length: 5 }, () => t.gamification.evaluateAchievements(u, { isTest: false })))
    expect(runs.filter((r) => r.unlockedIds.length === 1)).toHaveLength(1)
    const again = await t.gamification.evaluateAchievements(u, { isTest: false })
    expect(again).toEqual({ unlockedIds: [], syiling: 0, xp: 0 })
    expect(await unlockRows(u)).toHaveLength(1)
    expect(await achievementRows(u)).toHaveLength(1)
    expect(await walletOf(t, u)).toMatchObject({ current_syiling: 5, xp: 3 })
  })

  it('nothing is unlocked while no criterion is met (a brand-new pupil with no practice)', async () => {
    const u = await bareStudent(t, 'Kosong')
    expect(await t.gamification.evaluateAchievements(u, { isTest: false })).toEqual({ unlockedIds: [], syiling: 0, xp: 0 })
    expect(await unlockRows(u)).toEqual([])
    expect(await walletOf(t, u)).toBeUndefined()
  })

  it('several criteria in one pass unlock in catalogue order, and a reward feeds the later criteria (lifetime syiling, unlocked count)', async () => {
    const u = await bareStudent(t, 'Berantai')
    await t.wallet.credit({ userId: u, amount: 95, isTest: false, source: 'admin_award', sourceId: 'seed-95', description: 'Anugerah' })
    t.facts.counts = { all: 10, practice: 10 }
    const out = await t.gamification.evaluateAchievements(u, { isTest: false })
    // Langkah Pertama (+5 -> lifetime 100), Pelajar Rajin (+15), then Pengumpul Syiling (lifetime 100 reached by the first reward) in id order
    expect((await unlockRows(u)).map((r) => r.name)).toEqual(['Langkah Pertama', 'Pelajar Rajin', 'Pengumpul Syiling'])
    expect(out.syiling).toBe(5 + 15 + 10)
    expect(out.xp).toBe(3 + 10 + 5)
    expect(await achievementRows(u)).toHaveLength(3)
  })

  it('"Pengumpul Lencana" (15 unlocked) counts the unlocks of the same pass', async () => {
    const u = await bareStudent(t, 'Lencana')
    await t.db.query(`update achievements set criterion_min = 2 where name = 'Pengumpul Lencana'`)
    try {
      t.facts.counts = { all: 10, practice: 10 }
      await t.gamification.evaluateAchievements(u, { isTest: false })
      expect((await unlockRows(u)).map((r) => r.name)).toContain('Pengumpul Lencana')
    } finally {
      await t.db.query(`update achievements set criterion_min = 15 where name = 'Pengumpul Lencana'`)
    }
  })

  it('streak badges follow the stored streak (Streak 3 Hari at 3 days, not at 2)', async () => {
    const u = await bareStudent(t, 'Berturut')
    const streaks = t.app.get(StreakService)
    t.clock.set('2026-10-19T09:00:00+08:00')
    await streaks.touch(u)
    t.clock.set('2026-10-20T09:00:00+08:00')
    await streaks.touch(u)
    await t.gamification.evaluateAchievements(u, { isTest: false })
    expect(await unlockRows(u)).toEqual([])
    t.clock.set('2026-10-21T09:00:00+08:00')
    await streaks.touch(u)
    await t.gamification.evaluateAchievements(u, { isTest: false })
    expect((await unlockRows(u)).map((r) => r.name)).toEqual(['Streak 3 Hari'])
    expect((await achievementRows(u))[0]).toMatchObject({ amount: 10, description: 'Pencapaian: Streak 3 Hari' })
  })

  it('the practice-fact criteria: accurate sessions, subjects, Matematik / Sains correct answers, overall accuracy (85 %)', async () => {
    const u = await bareStudent(t, 'Fakta')
    t.facts.accurate = 10
    t.facts.masteryRows = [
      { subjectId: '1', subjectName: 'Bahasa Melayu', subjectOrder: 1, correct: 300, answered: 330 },
      { subjectId: '2', subjectName: 'Matematik', subjectOrder: 2, correct: 100, answered: 120 },
      { subjectId: '3', subjectName: 'Sains', subjectOrder: 3, correct: 200, answered: 250 },
      { subjectId: '4', subjectName: 'Sejarah', subjectOrder: 4, correct: 120, answered: 150 },
      { subjectId: '5', subjectName: 'Bahasa Inggeris', subjectOrder: 5, correct: 130, answered: 150 },
    ]
    // answered 1000, correct 850 -> exactly 85 %
    await t.gamification.evaluateAchievements(u, { isTest: false })
    expect((await unlockRows(u)).map((r) => r.name).sort()).toEqual(['Ilmuwan Sejati', 'Pakar Sains', 'Penjelajah', 'Tepat Sasaran', 'Tokoh Matematik'])
    // 849 correct of 1000: the accuracy criterion is not met
    const v = await bareStudent(t, 'Fakta Dua')
    t.facts.masteryRows = [{ subjectId: '1', subjectName: 'Bahasa Melayu', subjectOrder: 1, correct: 849, answered: 1000 }]
    t.facts.accurate = 9
    await t.gamification.evaluateAchievements(v, { isTest: false })
    expect((await unlockRows(v)).map((r) => r.name)).toEqual([])
  })

  it('a rewarded referral count and the mystery box openings (M15) are read from their owners', async () => {
    const u = await bareStudent(t, 'Rujukan')
    await t.db.query(`update achievements set criterion_min = 1 where name in ('Sahabat Belajar', 'Ahli Kotak Misteri')`)
    try {
      const friend = await bareStudent(t, 'Kawan')
      await t.db.query(`insert into referral_codes (user_id, code) values ($1::bigint, 'ABCDEFG')`, [u])
      await t.db.query(`insert into referrals (referrer_id, referee_id, code_used, rewarded) values ($1::bigint, $2::bigint, 'ABCDEFG', true)`, [u, friend])
      await t.gamification.evaluateAchievements(u, { isTest: false })
      expect((await unlockRows(u)).map((r) => r.name)).toEqual(['Sahabat Belajar'])
    } finally {
      await t.db.query(`update achievements set criterion_min = 3 where name = 'Sahabat Belajar'`)
      await t.db.query(`update achievements set criterion_min = 10 where name = 'Ahli Kotak Misteri'`)
    }
  })

  it('challenge completions and consecutive perfect days (Wira JomBelajar) come from the completion rows', async () => {
    const u = await bareStudent(t, 'Cabaran Lengkap')
    await t.db.query(`update achievements set criterion_min = 2 where name = 'Wira JomBelajar'`)
    await t.db.query(`update achievements set criterion_min = 15 where name = 'Cabaran Selesai'`)
    try {
      const fill = (day: string) =>
        t.db.query(
          `insert into challenge_completions (user_id, challenge_id, completion_date, completed_at, is_test)
           select $1::bigint, id, $2::date, now(), false from challenges where is_active`,
          [u, day],
        )
      await fill('2026-10-19') // today only: one perfect day is not two
      await t.gamification.evaluateAchievements(u, { isTest: false })
      expect(await unlockRows(u)).toEqual([])
      await fill('2026-10-18') // yesterday as well -> two consecutive perfect days; 20 completions reach "Cabaran Selesai" at 15
      await t.gamification.evaluateAchievements(u, { isTest: false })
      expect((await unlockRows(u)).map((r) => r.name).sort()).toEqual(['Cabaran Selesai', 'Wira JomBelajar'])
    } finally {
      await t.db.query(`update achievements set criterion_min = 30 where name = 'Wira JomBelajar'`)
      await t.db.query(`update achievements set criterion_min = 20 where name = 'Cabaran Selesai'`)
    }
  })

  it('a complimentary pupil (coins off) unlocks and gets the XP but no syiling row', async () => {
    const u = await bareStudent(t, 'Percuma')
    await t.db.query(`update users set is_complimentary = true where id = $1`, [u])
    t.facts.counts = { all: 1, practice: 1 }
    const out = await t.gamification.evaluateAchievements(u, { isTest: false })
    expect(out).toMatchObject({ syiling: 0, xp: 3 })
    expect(await unlockRows(u)).toHaveLength(1)
    expect(await ledgerOf(t, u)).toEqual([])
  })

  it('Mod Pelajar stamps the unlock and its ledger row is_test', async () => {
    const u = await bareStudent(t, 'Ujian')
    t.facts.counts = { all: 1, practice: 1 }
    await t.gamification.evaluateAchievements(u, { isTest: true })
    expect(await unlockRows(u)).toEqual([{ name: 'Langkah Pertama', is_test: true }])
    expect((await achievementRows(u))[0]!.is_test).toBe(true)
  })

  it('inside a rolled-back caller transaction no unlock and no reward is kept', async () => {
    const u = await bareStudent(t, 'Undur')
    t.facts.counts = { all: 1, practice: 1 }
    await expect(
      t.prisma.transaction(async (tx) => {
        await t.gamification.evaluateAchievements(u, { isTest: false, tx })
        throw new Error('caller fails after the evaluation')
      }),
    ).rejects.toThrow('caller fails')
    expect(await unlockRows(u)).toEqual([])
    expect(await ledgerOf(t, u)).toEqual([])
  })

  it('S15 shows the unlock: "1/25", the card unlocked with its time, progress capped at the target', async () => {
    const who = await signIn(t, STUDENT_EMPTY)
    const u = await userIdOf(t.db, STUDENT_EMPTY)
    t.facts.counts = { all: 1, practice: 1 }
    await t.gamification.evaluateAchievements(u, { isTest: false })
    const d = GamificationAchievementsSchema.parse(dataOf(await who.get('/gamification/achievements')))
    expect(d.unlocked).toBe(1)
    expect(d.items[0]).toMatchObject({ name: 'Langkah Pertama', unlocked: true, progress: { value: 1, target: 1 } })
    expect(d.items[0]!.unlockedAt).toMatch(/\+08:00$/)
  })
})
