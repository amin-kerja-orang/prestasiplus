import { GamificationAchievementsSchema, GamificationChallengeClaimResultSchema, RewardMysteryBoxOpenedSchema } from '@pp/contract'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { GamificationService } from '../../src/modules/gamification/gamification.service'
import { ADMIN, bareStudent, bareUser, bootGamificationApp, challengeIdByTitle, dataOf, ledgerOf, signIn, signInMod, START, STUDENT_MAJU, userIdOf, walletOf, type GamificationTestApp } from './helpers'

/**
 * S7-T04 part 16 (FR-GM-25.2, FR-GM-25.4, AC-GM-25.1, AC-GM-25.3, AC-GM-25.5, AC-GM-17.1): the triggers that evaluate the badges after
 * a Kotak Misteri opening, a challenge claim and a referral reward, the `battle_wins` read, the `is_test` rule of the badge count and
 * the safe wrapper that never fails its caller. The practice trigger is the BIND one (bijak-integration specs).
 */
describe('achievements: triggers, battle_wins, count (S7-T04 part 16)', () => {
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
    t.facts.day = { sessions: [], chapterIds: [] }
    t.clock.set(START)
  })

  const idOf = async (name: string) => (await t.db.query<{ id: string }>(`select id::text from achievements where name = $1`, [name]))[0]!.id
  const setMin = (name: string, min: number) => t.db.query(`update achievements set criterion_min = $2 where name = $1`, [name, min])
  const unlockRows = (userId: string) =>
    t.db.query<{ name: string; is_test: boolean }>(`select a.name, ua.is_test from user_achievements ua join achievements a on a.id = ua.achievement_id where ua.user_id = $1 order by ua.id`, [userId])
  const achievementRows = async (userId: string) => (await ledgerOf(t, userId)).filter((r) => r.source === 'achievement')

  describe('AC-GM-25.1: unlock and credit once', () => {
    it('the first session unlocks Langkah Pertama (+5 syiling, +3 XP) with its notice data; the second session credits nothing', async () => {
      const u = await bareStudent(t, 'Sesi Pertama')
      t.facts.counts = { all: 1, practice: 1 }
      const first = await t.gamification.evaluateAchievements(u, { isTest: false })
      expect(first).toMatchObject({ syiling: 5, xp: 3, unlocked: [{ code: await idOf('Langkah Pertama'), name: 'Langkah Pertama' }] })
      t.facts.counts = { all: 2, practice: 2 }
      expect(await t.gamification.evaluateAchievements(u, { isTest: false })).toEqual({ unlockedIds: [], unlocked: [], syiling: 0, xp: 0 })
      expect(await achievementRows(u)).toHaveLength(1)
      expect(await walletOf(t, u)).toMatchObject({ current_syiling: 5, xp: 3 })
    })
  })

  describe('AC-GM-25.5: the badge count', () => {
    it('7 of 26: the 7 real unlocks count, Mod Pelajar unlocks do not, in the achievements read and in unlocksOf', async () => {
      const u = await bareStudent(t, 'Tujuh Lencana')
      const all = await t.db.query<{ id: string }>(`select id::text from achievements order by id`)
      expect(all).toHaveLength(26)
      for (const [i, a] of all.entries()) {
        if (i < 9) await t.db.query(`insert into user_achievements (user_id, achievement_id, is_test) values ($1::bigint, $2::bigint, $3)`, [u, a.id, i >= 7])
      }
      const view = GamificationAchievementsSchema.parse(await t.gamification.achievements(u, ''))
      expect(view).toMatchObject({ unlocked: 7, total: 26 })
      expect(view.items.filter((i) => i.unlocked)).toHaveLength(7)
      const repo = (t.gamification as unknown as { repo: { unlocksOf(db: unknown, id: string): Promise<Map<string, Date>>; handle(): unknown } }).repo
      expect((await repo.unlocksOf(repo.handle(), u)).size).toBe(7)
    })
  })

  describe('Kotak Misteri trigger (Q7)', () => {
    it('the opening commits, then "Ahli Kotak Misteri" unlocks once on its own ledger row and the response names it', async () => {
      const u = await userIdOf(t.db, STUDENT_MAJU)
      await setMin('Ahli Kotak Misteri', 1)
      try {
        await t.wallet.creditTokens({ userId: u, amount: 10, source: 'admin_award', refId: 'achv-box:t', isTest: false })
        const api = await signIn(t, STUDENT_MAJU)
        const res = await api.post('/gamification/mystery-boxes/1/open')
        expect(res.status, JSON.stringify(res.body)).toBe(200)
        const o = RewardMysteryBoxOpenedSchema.parse(dataOf(res))
        const id = await idOf('Ahli Kotak Misteri')
        // The seeded pupil already meets two other criteria (streak, lifetime syiling): the pass unlocks those too, in catalogue order.
        expect(o.achievementsUnlocked).toContainEqual({ code: id, name: 'Ahli Kotak Misteri' })
        expect((await unlockRows(u)).map((r) => r.name)).toContain('Ahli Kotak Misteri')
        const rows = (await achievementRows(u)).filter((r) => r.source_id === `achievement:${id}`)
        expect(rows).toHaveLength(1)
        expect((await ledgerOf(t, u)).filter((r) => r.source === 'mystery_box')).toHaveLength(1)
        // A second opening unlocks nothing new: no field, no second reward row.
        const again = RewardMysteryBoxOpenedSchema.parse(dataOf(await api.post('/gamification/mystery-boxes/1/open')))
        expect(again.achievementsUnlocked).toBeUndefined()
        expect((await achievementRows(u)).filter((r) => r.source_id === `achievement:${id}`)).toHaveLength(1)
      } finally {
        await setMin('Ahli Kotak Misteri', 10)
      }
    })
  })

  describe('challenge claim trigger (AC-GM-17.1, FR-GM-25.2)', () => {
    it('a claim moves the completions badge: it unlocks, is paid once, and the claim result carries "Lencana baru: <name>!"', async () => {
      const u = await bareStudent(t, 'Tuntut Lencana')
      await setMin('Cabaran Selesai', 1)
      try {
        const id = await challengeIdByTitle(t, 'Mula Hari Ini')
        t.facts.day = { sessions: [{ sessionId: 's1', mode: 'random', correct: 12, total: 12, timeSpent: 660 }], chapterIds: ['1', '2', '3'] }
        const svc = (await import('../../src/modules/gamification/challenge-claims.service')).ChallengeClaimsService
        const claims = t.app.get(svc)
        const out = GamificationChallengeClaimResultSchema.parse(await claims.claim({ userId: u, isTest: false } as never, BigInt(id), null))
        expect(out.notices).toContain('Lencana baru: Cabaran Selesai!')
        expect((await unlockRows(u)).map((r) => r.name)).toEqual(['Cabaran Selesai'])
        expect((await achievementRows(u)).filter((r) => r.description === 'Pencapaian: Cabaran Selesai')).toHaveLength(1)
        expect(await t.db.query(`select 1 from challenge_claims where user_id = $1`, [u])).toHaveLength(1)
      } finally {
        await setMin('Cabaran Selesai', 20)
      }
    })

    it('a claim that unlocks nothing carries no badge notice', async () => {
      const u = await bareStudent(t, 'Tuntut Biasa')
      const id = await challengeIdByTitle(t, 'Mula Hari Ini')
      t.facts.day = { sessions: [{ sessionId: 's1', mode: 'random', correct: 12, total: 12, timeSpent: 660 }], chapterIds: ['1', '2', '3'] }
      const claims = t.app.get((await import('../../src/modules/gamification/challenge-claims.service')).ChallengeClaimsService)
      const out = await claims.claim({ userId: u, isTest: false } as never, BigInt(id), null)
      expect((out.notices ?? []).filter((n) => n.startsWith('Lencana baru'))).toEqual([])
    })
  })

  describe('referral trigger (Q6)', () => {
    it('the referrer\'s "Sahabat Belajar" unlocks right after the referral reward is paid', async () => {
      const referrer = await bareStudent(t, 'Perujuk')
      await setMin('Sahabat Belajar', 1)
      try {
        const code = (await t.gamification.referral(referrer)).code
        const friend = await bareUser(t, 'Kawan Rujukan')
        expect(await t.gamification.applyReferral(friend, code, { isTest: false })).toEqual({ applied: true })
        expect((await unlockRows(referrer)).map((r) => r.name)).toEqual(['Sahabat Belajar'])
        expect((await achievementRows(referrer)).map((r) => r.description)).toEqual(['Pencapaian: Sahabat Belajar'])
        // The referee earns the 25 only: nothing is evaluated for them.
        expect(await unlockRows(friend)).toEqual([])
      } finally {
        await setMin('Sahabat Belajar', 3)
      }
    })
  })

  describe('FR-GM-25.4 / AC-GM-25.3: battle_wins counts won real Battles only', () => {
    let battles = 0
    const battle = async (u: string, o: { side?: 'A' | 'B'; winner?: 'A' | 'B' | null; status?: string; ranking?: boolean; isTest?: boolean; opponent?: 'human' | 'bot' }) => {
      const side = o.side ?? 'A'
      const other = side === 'A' ? 'B' : 'A'
      const id = (
        await t.db.query<{ id: string }>(`insert into battles (mode, question_type, status, winner, counts_for_ranking, is_test) values ('quick_match', 'biasa', $1, $2, $3, $4) returning id::text`, [
          o.status ?? 'finished',
          o.winner === undefined ? side : o.winner,
          o.ranking ?? true,
          o.isTest ?? false,
        ])
      )[0]!.id
      await t.db.query(`insert into battle_participants (battle_id, side, user_id) values ($1::uuid, $2, $3::bigint)`, [id, side, u])
      if (o.opponent === 'bot') await t.db.query(`insert into battle_participants (battle_id, side, is_bot) values ($1::uuid, $2, true)`, [id, other])
      else await t.db.query(`insert into battle_participants (battle_id, side, user_id) values ($1::uuid, $2, $3::bigint)`, [id, other, await bareUser(t, `Lawan ${battles++}`)])
    }

    it('9 real wins + 5 robot wins + 1 forfeit win + a test win + a loss stay locked; the 10th real win unlocks Juara Battle once', async () => {
      const u = await bareStudent(t, 'Juara')
      for (let i = 0; i < 9; i++) await battle(u, {})
      for (let i = 0; i < 5; i++) await battle(u, { opponent: 'bot', ranking: false })
      await battle(u, { status: 'forfeited' }) // forfeit win
      await battle(u, { isTest: true })
      await battle(u, { winner: 'B' }) // a loss
      await battle(u, { winner: null }) // a draw
      await battle(u, { side: 'B', winner: 'A' }) // the opponent's win
      const repo = (t.gamification as unknown as { repo: { wonRealBattles(db: unknown, id: string): Promise<number>; handle(): unknown } }).repo
      expect(await repo.wonRealBattles(repo.handle(), u)).toBe(9)
      expect(await t.gamification.evaluateAchievements(u, { isTest: false })).toMatchObject({ unlocked: [] })
      expect((await unlockRows(u)).map((r) => r.name)).not.toContain('Juara Battle')
      await battle(u, {})
      expect(await repo.wonRealBattles(repo.handle(), u)).toBe(10)
      const out = await t.gamification.evaluateAchievements(u, { isTest: false })
      expect(out).toMatchObject({ syiling: 30, xp: 20, unlocked: [{ name: 'Juara Battle' }] })
      expect((await t.gamification.evaluateAchievements(u, { isTest: false })).unlocked).toEqual([])
      expect((await achievementRows(u)).filter((r) => r.description === 'Pencapaian: Juara Battle')).toHaveLength(1)
    })
  })

  describe('evaluateAchievementsSafely never fails its caller', () => {
    it('without a transaction: an error is swallowed and answers "nothing unlocked"', async () => {
      const u = await bareStudent(t, 'Selamat 1')
      const spy = vi.spyOn(GamificationService.prototype, 'evaluateAchievements').mockRejectedValueOnce(new Error('boom'))
      try {
        expect(await t.gamification.evaluateAchievementsSafely(u, { isTest: false })).toEqual({ unlockedIds: [], unlocked: [], syiling: 0, xp: 0 })
      } finally {
        spy.mockRestore()
      }
    })

    it('inside the caller\'s transaction: a database error rolls back to the savepoint and the transaction stays usable and commits the caller\'s own work', async () => {
      const u = await bareStudent(t, 'Selamat 2')
      const spy = vi.spyOn(GamificationService.prototype, 'evaluateAchievements').mockImplementationOnce(async (_id, o) => {
        await o.tx!.$executeRaw`SELECT 1/0`
        throw new Error('unreachable')
      })
      try {
        const out = await t.prisma.transaction(async (tx) => {
          await tx.$executeRaw`UPDATE users SET name = 'Selamat Dua' WHERE id = ${BigInt(u)}`
          const r = await t.gamification.evaluateAchievementsSafely(u, { tx, isTest: false })
          expect((await tx.$queryRaw<{ n: number }[]>`SELECT 1 AS n`)[0]!.n).toBe(1)
          return r
        })
        expect(out.unlocked).toEqual([])
        expect((await t.db.query<{ name: string }>(`select name from users where id = $1`, [u]))[0]!.name).toBe('Selamat Dua')
      } finally {
        spy.mockRestore()
      }
    })

    it('inside the caller\'s transaction on success: the unlock is kept and reported', async () => {
      const u = await bareStudent(t, 'Selamat 3')
      t.facts.counts = { all: 1, practice: 1 }
      const out = await t.prisma.transaction((tx) => t.gamification.evaluateAchievementsSafely(u, { tx, isTest: false }))
      expect(out.unlocked.map((b) => b.name)).toEqual(['Langkah Pertama'])
      expect(await unlockRows(u)).toHaveLength(1)
    })
  })

  describe('ruling 12: claims plus legacy completions', () => {
    it('counts claims and migrated completions once per (challenge, day); a V3 completion nobody claimed does not count', async () => {
      const u = await bareStudent(t, 'Hitung Tuntutan')
      const ids = await t.db.query<{ id: string }>(`select id::text from challenges order by id limit 4`)
      const [a, b, c, d] = ids.map((r) => r.id)
      await t.db.query(`insert into challenge_claims (user_id, challenge_id, myt_date, reward_syiling, reward_xp) values ($1::bigint, $2::bigint, '2026-10-19', 0, 0)`, [u, a])
      await t.db.query(`insert into challenge_completions (user_id, challenge_id, completion_date, legacy_source, legacy_id) values ($1::bigint, $2::bigint, '2026-10-19', 'cloud', $3)`, [u, a, `${u}-a`]) // same pair as the claim
      await t.db.query(`insert into challenge_completions (user_id, challenge_id, completion_date, legacy_source, legacy_id) values ($1::bigint, $2::bigint, '2026-10-18', 'cloud', $3)`, [u, b, `${u}-b`])
      await t.db.query(`insert into challenge_completions (user_id, challenge_id, completion_date) values ($1::bigint, $2::bigint, '2026-10-19')`, [u, c])
      await t.db.query(`insert into challenge_claims (user_id, challenge_id, myt_date, reward_syiling, reward_xp) values ($1::bigint, $2::bigint, '2026-10-18', 0, 0)`, [u, d])
      const repo = (t.gamification as unknown as { repo: { completionCount(db: unknown, id: string): Promise<number>; completionsByDay(db: unknown, id: string, day: string, n: number): Promise<Map<string, Set<string>>>; handle(): unknown } }).repo
      expect(await repo.completionCount(repo.handle(), u)).toBe(3)
      const byDay = await repo.completionsByDay(repo.handle(), u, '2026-10-19', 5)
      expect([...byDay.get('2026-10-19')!]).toEqual([a])
      expect([...byDay.get('2026-10-18')!].sort()).toEqual([b, d].sort())
    })
  })

  describe('Mod Pelajar', () => {
    it('a claim is refused in Mod Pelajar, so no badge is evaluated or paid', async () => {
      const mod = await signInMod(t, ADMIN)
      const id = await challengeIdByTitle(t, 'Mula Hari Ini')
      const before = (await t.db.query(`select 1 from user_achievements`)).length
      expect((await mod.post(`/gamification/challenges/${id}/claim`)).status).toBe(403)
      expect((await t.db.query(`select 1 from user_achievements`)).length).toBe(before)
    })
  })
})
