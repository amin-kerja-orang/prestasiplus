import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { bareUser, bootGamificationApp, challengeIdByTitle, ledgerOf, walletOf, type GamificationTestApp } from './helpers'

describe('entry points other modules call (AC2, card open question 3)', () => {
  let t: GamificationTestApp
  let kilat: string

  beforeAll(async () => {
    t = await bootGamificationApp()
    kilat = await challengeIdByTitle(t, 'Kilat Matematik') // 30 syiling, 25 XP
  }, 120_000)
  afterAll(async () => {
    await t.close()
  })

  const completions = async (userId: string) => t.db.query<{ challenge_id: string; completion_date: string; is_test: boolean }>(`select challenge_id::text, completion_date::text, is_test from challenge_completions where user_id = $1 order by id`, [userId])

  describe('claimChallenge: idempotent per user, challenge and Malaysia day (AC2)', () => {
    it('the first claim pays the reward once; a second claim the same day adds nothing', async () => {
      const u = await bareUser(t, 'Cabaran Satu')
      const first = await t.gamification.claimChallenge(u, kilat, { isTest: false })
      const second = await t.gamification.claimChallenge(u, kilat, { isTest: false })
      expect(first).toEqual({ claimed: true, syiling: 30, xp: 25 })
      expect(second).toEqual({ claimed: false, syiling: 0, xp: 0 })
      expect(await walletOf(t, u)).toMatchObject({ current_syiling: 30, total_syiling_earned: 30, xp: 25 })
      const rows = await ledgerOf(t, u)
      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject({ type: 'earn', source: 'daily_challenge', source_id: `challenge:${kilat}:2026-10-19`, amount: 30, description: 'Cabaran selesai: Kilat Matematik', is_test: false })
      expect(await completions(u)).toEqual([{ challenge_id: kilat, completion_date: '2026-10-19', is_test: false }])
    })

    it('parallel claims write ONE completion and ONE reward', async () => {
      const u = await bareUser(t, 'Cabaran Selari')
      const out = await Promise.all(Array.from({ length: 6 }, () => t.gamification.claimChallenge(u, kilat, { isTest: false })))
      expect(out.filter((r) => r.claimed)).toHaveLength(1)
      expect(await completions(u)).toHaveLength(1)
      expect(await ledgerOf(t, u)).toHaveLength(1)
      expect((await walletOf(t, u))!.xp).toBe(25)
    })

    it('the Malaysia day decides: 23:59 +08:00 and 00:01 the next day are two days, 00:01 UTC after midnight MYT is the same one', async () => {
      const u = await bareUser(t, 'Cabaran Hari')
      const at = (iso: string) => ({ isTest: false, at: new Date(iso) })
      expect((await t.gamification.claimChallenge(u, kilat, at('2026-10-20T15:59:00Z'))).claimed).toBe(true) // 23:59 MYT on the 20th
      expect((await t.gamification.claimChallenge(u, kilat, at('2026-10-20T16:01:00Z'))).claimed).toBe(true) // 00:01 MYT on the 21st
      expect((await t.gamification.claimChallenge(u, kilat, at('2026-10-21T10:00:00Z'))).claimed).toBe(false) // still the 21st
      expect((await completions(u)).map((c) => c.completion_date)).toEqual(['2026-10-20', '2026-10-21'])
      expect((await ledgerOf(t, u)).map((r) => r.source_id)).toEqual([`challenge:${kilat}:2026-10-20`, `challenge:${kilat}:2026-10-21`])
    })

    it('inside a rolled-back caller transaction nothing is kept (completion and reward are one unit)', async () => {
      const u = await bareUser(t, 'Cabaran Undur')
      await expect(
        t.prisma.transaction(async (tx) => {
          await t.gamification.claimChallenge(u, kilat, { isTest: false, tx })
          throw new Error('caller fails after the claim')
        }),
      ).rejects.toThrow('caller fails')
      expect(await completions(u)).toEqual([])
      expect(await walletOf(t, u)).toBeUndefined()
      expect((await t.gamification.claimChallenge(u, kilat, { isTest: false })).claimed).toBe(true)
    })

    it('Mod Pelajar: the completion and every wallet row are stamped is_test', async () => {
      const u = await bareUser(t, 'Cabaran Ujian')
      await t.gamification.claimChallenge(u, kilat, { isTest: true })
      expect((await completions(u))[0]!.is_test).toBe(true)
      expect((await ledgerOf(t, u))[0]!.is_test).toBe(true)
    })

    it('an inactive challenge pays nothing, an unknown one is 404', async () => {
      const u = await bareUser(t, 'Cabaran Mati')
      await t.db.query(`update challenges set is_active = false where id = $1`, [kilat])
      expect((await t.gamification.claimChallenge(u, kilat, { isTest: false })).claimed).toBe(false)
      await t.db.query(`update challenges set is_active = true where id = $1`, [kilat])
      await expect(t.gamification.claimChallenge(u, '999999', { isTest: false })).rejects.toMatchObject({ code: 'NOT_FOUND', message: 'Cabaran tidak dijumpai.' })
    })

    it('a student with coins switched off (complimentary) gets the completion and the XP but no syiling', async () => {
      const u = await bareUser(t, 'Cabaran Percuma')
      await t.db.query(`update users set is_complimentary = true where id = $1`, [u])
      expect(await t.gamification.claimChallenge(u, kilat, { isTest: false })).toEqual({ claimed: true, syiling: 0, xp: 25 })
      expect(await ledgerOf(t, u)).toEqual([])
      expect((await walletOf(t, u))!).toMatchObject({ current_syiling: 0, xp: 25 })
    })
  })

  describe('settleChallenges (the session-completed hook)', () => {
    it('claims exactly the active challenges whose target is reached, once, in (sortOrder, id) order', async () => {
      const u = await bareUser(t, 'Selesai')
      t.facts.day = { sessions: [{ sessionId: 's1', mode: 'random', correct: 12, total: 12, timeSpent: 660 }], chapterIds: ['1', '2', '3'] }
      const first = await t.gamification.settleChallenges(u, { isTest: false })
      // sessions 1, correct 12, best_accuracy 100, best correct 12, chapters 3, minutes 11 -> Mula Hari Ini, Rajin? (needs 3 sessions: no)
      const titles = (await t.db.query<{ title: string }>(`select c.title from challenge_completions cc join challenges c on c.id = cc.challenge_id where cc.user_id = $1 order by cc.id`, [u])).map((r) => r.title)
      expect(titles).toEqual(['Si Tepat', 'Penjelajah Topik', 'Kilat Matematik', 'Mula Hari Ini', 'Jawab 5 Betul', 'Latihan 10 Minit', 'Ketepatan 90%'])
      expect(first.claimedIds).toHaveLength(7)
      expect(first.syiling).toBe(20 + 25 + 30 + 10 + 12 + 20 + 35)
      const again = await t.gamification.settleChallenges(u, { isTest: false })
      expect(again).toEqual({ claimedIds: [], syiling: 0, xp: 0 })
      expect(await ledgerOf(t, u)).toHaveLength(7)
      t.facts.day = { sessions: [], chapterIds: [] }
    })
  })

  describe('canEarnSyiling and onGameResult (BE-44/BE-45 doorway)', () => {
    const setGames = (v: number) => t.db.query(`update gamification_settings set value = $1 where key = 'games_award_syiling'`, [v])

    it('XP always, syiling only while games_award_syiling = 1 and coins are enabled', async () => {
      const u = await bareUser(t, 'Permainan')
      await setGames(0)
      expect(await t.gamification.canEarnSyiling(u)).toBe(false)
      expect(await t.gamification.onGameResult(u, { game: 'betul_salah', event: 'end', coins: 9, xp: 4, correct: 3, detail: { maxStreak: 2 } }, { isTest: false })).toEqual({ coinsCredited: 0, xpAdded: 4 })
      expect(await ledgerOf(t, u)).toEqual([])
      await setGames(1)
      expect(await t.gamification.canEarnSyiling(u)).toBe(true)
      expect(await t.gamification.onGameResult(u, { game: 'betul_salah', event: 'end', coins: 9, xp: 4, correct: 3, detail: { maxStreak: 2 } }, { isTest: false })).toEqual({ coinsCredited: 9, xpAdded: 4 })
      expect((await ledgerOf(t, u))[0]).toMatchObject({ type: 'earn', source: 'betul_salah', amount: 9, description: 'Betul/Salah: 3 betul, streak 2' })
      expect(await walletOf(t, u)).toMatchObject({ current_syiling: 9, xp: 8 })
      await t.db.query(`update users set is_complimentary = true where id = $1`, [u])
      expect(await t.gamification.canEarnSyiling(u)).toBe(false)
    })

    it('with a result key the syiling credit is idempotent: a retried result pays and adds XP once', async () => {
      const u = await bareUser(t, 'Permainan Kunci')
      await setGames(1)
      const input = { game: 'jutawan_ilmu', event: 'end', coins: 5, xp: 3, detail: { level: 2, subject: 'Sains' }, key: 'match-77' }
      expect(await t.gamification.onGameResult(u, input, { isTest: false })).toEqual({ coinsCredited: 5, xpAdded: 3 })
      expect(await t.gamification.onGameResult(u, input, { isTest: false })).toEqual({ coinsCredited: 0, xpAdded: 0 })
      const rows = await ledgerOf(t, u)
      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject({ source: 'jutawan_ilmu', source_id: 'game:match-77', description: 'Jutawan Ilmu (Sains): Level 2' })
      expect(await walletOf(t, u)).toMatchObject({ current_syiling: 5, xp: 3 })
    })

    it('papan_bijak without coins pays the tier rate (bronze: 5 a correct answer, 25 a win)', async () => {
      const u = await bareUser(t, 'Papan Bijak')
      await setGames(1)
      expect((await t.gamification.onGameResult(u, { game: 'papan_bijak', event: 'correct', xp: 0 }, { isTest: false })).coinsCredited).toBe(5)
      expect((await t.gamification.onGameResult(u, { game: 'papan_bijak', event: 'win', xp: 0 }, { isTest: false })).coinsCredited).toBe(25)
    })

    it('Mod Pelajar game rows are stamped is_test', async () => {
      const u = await bareUser(t, 'Permainan Ujian')
      await setGames(1)
      await t.gamification.onGameResult(u, { game: 'benteng_ilmu', event: 'win', coins: 8, xp: 0 }, { isTest: true })
      expect((await ledgerOf(t, u))[0]).toMatchObject({ source: 'benteng_win', description: 'Juara Benteng Ilmu!', is_test: true })
    })
  })

  describe('unlockAchievement', () => {
    it('unlocks once (unique user + achievement) and pays the reward only on the inserting call', async () => {
      const u = await bareUser(t, 'Pencapaian')
      const id = (await t.db.query<{ id: string }>(`select id::text from achievements where name = 'Langkah Pertama'`))[0]!.id
      expect(await t.gamification.unlockAchievement(u, id, { isTest: false })).toEqual({ unlocked: true, syiling: 5, xp: 3 })
      expect(await t.gamification.unlockAchievement(u, id, { isTest: false })).toEqual({ unlocked: false, syiling: 0, xp: 0 })
      expect((await ledgerOf(t, u))).toHaveLength(1)
      expect((await ledgerOf(t, u))[0]).toMatchObject({ source: 'achievement', source_id: `achievement:${id}`, description: 'Pencapaian: Langkah Pertama' })
      expect(await walletOf(t, u)).toMatchObject({ current_syiling: 5, xp: 3 })
    })
  })
})
