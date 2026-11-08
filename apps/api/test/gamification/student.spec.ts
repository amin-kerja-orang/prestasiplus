import {
  GamificationAchievementsSchema,
  GamificationChallengesResponseSchema,
  GamificationConvertViewSchema,
  GamificationDashboardSchema,
  GamificationLeaderboardSchema,
  GamificationReferralSchema,
  GamificationShareCardsSchema,
} from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { ADMIN, STUDENT, STUDENT_EMPTY, STUDENT_MAJU, TEACHER, bareStudent, bareUser, bootGamificationApp, challengeIdByTitle, dataOf, fail, signIn, userIdOf, type Client, type GamificationTestApp } from './helpers'

const GET_ROUTES = ['dashboard', 'challenges', 'achievements', 'leaderboard', 'referral', 'share-cards', 'convert']

describe('M14 student reads (BE-23, AC4, AC6, AC7)', () => {
  let t: GamificationTestApp
  let student: Client
  let maju: Client
  let empty: Client
  let teacher: Client
  let admin: Client

  beforeAll(async () => {
    t = await bootGamificationApp()
    student = await signIn(t, STUDENT)
    maju = await signIn(t, STUDENT_MAJU)
    empty = await signIn(t, STUDENT_EMPTY)
    teacher = await signIn(t, TEACHER)
    admin = await signIn(t, ADMIN)
  }, 120_000)
  afterAll(async () => {
    await t.close()
  })

  describe('guards', () => {
    it('401 for an anonymous caller on every route, including the write', async () => {
      for (const r of GET_ROUTES) fail(await t.http().get(`/api/gamification/${r}`), 401, 'UNAUTHORIZED')
      fail(await t.http().post('/api/gamification/convert').send({ syilingAmount: 50 }), 401, 'UNAUTHORIZED')
    })

    it('any logged-in role reads its OWN data (the mock `anySession`): a teacher and an admin get 200, never somebody else wallet', async () => {
      for (const who of [teacher, admin]) for (const r of GET_ROUTES) expect((await who.get(`/gamification/${r}`)).status, r).toBe(200)
    })

    it('every answer is no-store and a user id in the query changes nothing', async () => {
      const res = await student.get(`/gamification/dashboard?userId=${await userIdOf(t.db, ADMIN)}`)
      expect(res.headers['cache-control']).toMatch(/no-store/)
      expect(dataOf<{ wallet: { currentSyiling: number } }>(res).wallet.currentSyiling).toBe(370)
    })
  })

  describe('AC7: the teacher economy is not built', () => {
    const PATHS = ['/api/guru/gamification', '/api/guru/gamification/cash', '/api/guru/gamification/leaderboard', '/api/guru/gamification/shop', '/api/guru/gamification/shop/1/redeem', '/api/admin/gamification/guru', '/api/admin/gamification/guru/cash', '/api/admin/gamification/guru/redemptions', '/api/admin/gamification/guru/cash/1', '/api/admin/gamification/guru/redemptions/1', '/api/admin/gamification/guru/rewards', '/api/admin/gamification/guru/badges/1']

    it('answers 404 to anonymous, student, teacher and admin on every guru path and verb', async () => {
      for (const path of PATHS) {
        const short = path.replace('/api', '')
        for (const verb of ['get', 'post', 'put', 'patch', 'delete'] as const) expect((await t.http()[verb](path)).status, `anon ${verb} ${path}`).toBe(404)
        for (const who of [student, teacher, admin]) {
          expect((await who.get(short)).status, `get ${path}`).toBe(404)
          expect((await who.post(short)).status, `post ${path}`).toBe(404)
          expect((await who.put(short)).status, `put ${path}`).toBe(404)
          expect((await who.del(short)).status, `delete ${path}`).toBe(404)
        }
      }
    })
  })

  describe('GET /api/gamification/dashboard', () => {
    it('pelajar: the contract shape and the seeded wallet (370 syiling, 916 XP, Gangsa), 4 challenges, 4 active tiers by threshold', async () => {
      const d = GamificationDashboardSchema.parse(dataOf(await student.get('/gamification/dashboard')))
      expect(d.wallet).toMatchObject({ currentSyiling: 370, xp: 916, tier: { key: 'bronze', labelMs: 'Gangsa', conversionRate: 50 } })
      expect(d.wallet.nextTier).toMatchObject({ key: 'silver', need: 130 })
      expect(d.challenges.map((c) => c.title)).toEqual(['Rajin Berlatih', 'Si Tepat', 'Penjelajah Topik', 'Kilat Matematik'])
      expect(d.tiers.map((x) => [x.key, x.isMine])).toEqual([['bronze', true], ['silver', false], ['gold', false], ['platinum', false]])
      expect(d.recent.length).toBe(6)
      const times = d.recent.map((r) => Date.parse(r.createdAt))
      expect(times.every((x, i) => i === 0 || (times[i - 1] as number) >= x)).toBe(true)
      expect(d.recent[0]!.balanceAfter).toBe(370)
      expect(d.mastery).toEqual([]) // no practice data yet (the port answers nothing)
    })

    it('a user without a wallet reads the defaults and nothing is created', async () => {
      const d = GamificationDashboardSchema.parse(dataOf(await empty.get('/gamification/dashboard')))
      expect(d.wallet).toMatchObject({ currentSyiling: 0, totalSyilingEarned: 0, level: 1, tier: { key: 'bronze' } })
      expect(d.recent).toEqual([])
      const rows = await t.db.query(`select 1 from wallets where user_id = $1`, [await userIdOf(t.db, STUDENT_EMPTY)])
      expect(rows).toHaveLength(0)
    })

    it('mastery rows come from the practice port: only subjects with answers, curriculum order, stage and multiplier by level', async () => {
      t.facts.masteryRows = [
        { subjectId: '2', subjectName: 'Sains', subjectOrder: 2, correct: 14, answered: 40 },
        { subjectId: '1', subjectName: 'Bahasa Melayu', subjectOrder: 1, correct: 46, answered: 94 },
        { subjectId: '9', subjectName: 'Tiada', subjectOrder: 3, correct: 0, answered: 0 },
      ]
      const d = GamificationDashboardSchema.parse(dataOf(await student.get('/gamification/dashboard')))
      expect(d.mastery.map((m) => [m.subjectName, m.level, m.stage, m.nextTarget, m.accuracy, m.multiplier])).toEqual([
        ['Bahasa Melayu', 2, 'Aktif', 50, 48.94, 1.05],
        ['Sains', 1, 'Mula Belajar', 25, 35, 1],
      ])
      t.facts.masteryRows = []
    })
  })

  describe('GET /api/gamification/challenges (S13)', () => {
    it('14 active in (sortOrder, id) order, nothing done: meta {completed 0, active 14}', async () => {
      const res = await student.get('/gamification/challenges')
      const body = GamificationChallengesResponseSchema.parse(res.body)
      expect(body.meta).toEqual({ completed: 0, active: 14, claimed: 0 })
      expect(body.data).toHaveLength(14)
      expect(body.data.map((c) => c.title).slice(0, 5)).toEqual(['Rajin Berlatih', 'Si Tepat', 'Penjelajah Topik', 'Kilat Matematik', 'Selesai 5 Kuiz'])
      expect(body.data.every((c) => c.progress === 0 && c.pct === 0 && !c.completed)).toBe(true)
    })

    it('progress is min(target, metric) from the day facts; the streak counts only when the last activity is today', async () => {
      t.facts.day = { sessions: [{ sessionId: 's1', mode: 'random', correct: 4, total: 5, timeSpent: 700 }], chapterIds: ['1', '1', '2'] }
      await t.db.query(`insert into streaks (user_id, current, best, last_activity_date) values ($1, 2, 2, '2026-10-18') on conflict (user_id) do update set current = 2, best = 2, last_activity_date = '2026-10-18'`, [await userIdOf(t.db, STUDENT_MAJU)])
      const byTitle = async (who: Client) => Object.fromEntries(GamificationChallengesResponseSchema.parse((await who.get('/gamification/challenges')).body).data.map((c) => [c.title, c]))
      const c = await byTitle(maju)
      expect(c['Mula Hari Ini']).toMatchObject({ progress: 1, target: 1, pct: 100 })
      expect(c['Si Tepat']).toMatchObject({ progress: 80, target: 80, pct: 100 })
      expect(c['Penjelajah Topik']).toMatchObject({ progress: 2, target: 3, pct: 67 })
      expect(c['Jawab 5 Betul']).toMatchObject({ progress: 4, target: 5, pct: 80 })
      expect(c['Latihan 10 Minit']).toMatchObject({ progress: 10, target: 10 })
      expect(c['Kombo 2 Hari']).toMatchObject({ progress: 0 }) // last activity was yesterday
      await t.db.query(`update streaks set last_activity_date = '2026-10-19' where user_id = $1`, [await userIdOf(t.db, STUDENT_MAJU)])
      expect((await byTitle(maju))['Kombo 2 Hari']).toMatchObject({ progress: 2, pct: 100 })
      t.facts.day = { sessions: [], chapterIds: [] }
    })
  })

  describe('GET /api/gamification/leaderboard (S14)', () => {
    it('podium 1-3 and rows by lifetime syiling; ignores query; names and initials', async () => {
      // The seed has two pupil wallets; a third pupil fills the podium (the admin wallet is no longer ranked).
      await t.wallet.credit({ userId: await bareStudent(t, 'Papan Podium'), amount: 5, source: 'quiz_practice', sourceId: 'lb-podium', description: 'Latih Tubi: 5 betul', isTest: false })
      const res = await student.get('/gamification/leaderboard?period=week')
      const d = GamificationLeaderboardSchema.parse(dataOf(res))
      expect(d.podium.map((p) => p.rank)).toEqual([1, 2, 3])
      const totals = [...d.podium.map((p) => p.totalSyilingEarned), ...d.rows.map((r) => r.totalSyilingEarned)]
      expect(totals).toEqual([...totals].sort((a, b) => b - a))
      expect(d.podium[0]!.initials).toMatch(/^[A-Z]{1,2}$/)
      expect(d.podium[0]!.tier.key).toBeTruthy()
    })

    it('MOD PELAJAR rule: test credits are not counted and a test-only actor is not shown', async () => {
      const real = await bareStudent(t, 'Papan Satu')
      const testOnly = await bareStudent(t, 'Papan Ujian')
      await t.wallet.credit({ userId: real, amount: 40, source: 'quiz_practice', sourceId: 'lb-real', description: 'Latih Tubi: 40 betul', isTest: false })
      await t.wallet.credit({ userId: real, amount: 7000, source: 'admin_award', sourceId: 'lb-test', description: 'Ujian', isTest: true })
      await t.wallet.credit({ userId: testOnly, amount: 9000, source: 'admin_award', sourceId: 'lb-only', description: 'Ujian', isTest: true })
      // The admin sees every id (#76: other viewers get redacted ids outside their scope).
      const d = GamificationLeaderboardSchema.parse(dataOf(await admin.get('/gamification/leaderboard')))
      const all = [...d.podium, ...d.rows]
      expect(all.find((x) => x.userId === testOnly)).toBeUndefined()
      expect(all.find((x) => x.userId === real)?.totalSyilingEarned).toBe(40)
      expect(all[0]!.totalSyilingEarned).toBeLessThan(7000)
    })
  })

  describe('GET /api/gamification/achievements (S15)', () => {
    it('26 cards in catalogue order, 0 unlocked, progress only on the 5 "kuiz" badges', async () => {
      const d = GamificationAchievementsSchema.parse(dataOf(await student.get('/gamification/achievements')))
      expect(d).toMatchObject({ unlocked: 0, total: 26 })
      expect(d.items).toHaveLength(26)
      expect(d.items[0]).toMatchObject({ name: 'Langkah Pertama', rarityLabel: 'Biasa', rarityColor: '#9ca3af', progress: { value: 0, target: 1 }, unlocked: false, unlockedAt: null })
      expect(d.items.filter((i) => i.progress !== null)).toHaveLength(5)
    })

    it('filters by rarity (6 / 9 / 6 / 5) while total stays 26; an unknown rarity answers no card', async () => {
      const count = async (r: string) => GamificationAchievementsSchema.parse(dataOf(await student.get(`/gamification/achievements?rarity=${r}`))).items.length
      expect([await count('common'), await count('rare'), await count('epic'), await count('legendary')]).toEqual([6, 9, 6, 5])
      const none = GamificationAchievementsSchema.parse(dataOf(await student.get('/gamification/achievements?rarity=mythic')))
      expect(none).toMatchObject({ items: [], total: 26 })
    })

    it('an unlock shows with its time and progress caps at the target; the progress value follows the practice count', async () => {
      const id = (await t.db.query<{ id: string }>(`select id::text from achievements where name = 'Pelajar Rajin'`))[0]!.id
      t.facts.counts = { all: 4, practice: 4 }
      const before = GamificationAchievementsSchema.parse(dataOf(await maju.get('/gamification/achievements'))).items.find((i) => i.id === id)!
      expect(before.progress).toEqual({ value: 4, target: 10 })
      await t.gamification.unlockAchievement(await userIdOf(t.db, STUDENT_MAJU), id, { isTest: false })
      const d = GamificationAchievementsSchema.parse(dataOf(await maju.get('/gamification/achievements')))
      const after = d.items.find((i) => i.id === id)!
      expect(d.unlocked).toBe(1)
      expect(after).toMatchObject({ unlocked: true, progress: { value: 10, target: 10 } })
      expect(after.unlockedAt).toMatch(/\+08:00$/)
      t.facts.counts = { all: 0, practice: 0 }
    })
  })

  describe('GET /api/gamification/share-cards (S18)', () => {
    it('a user without answers reads zeros (no division by zero); the profile link is the caller own', async () => {
      const d = GamificationShareCardsSchema.parse(dataOf(await empty.get('/gamification/share-cards')))
      expect(d.profile).toMatchObject({ answered: 0, accuracy: 0, sessions: 0, tierKey: 'bronze', level: 1, currentSyiling: 0 })
      expect(d.ranking).toEqual({ accuracy: 0, correct: 0, answered: 0 })
      expect(d.profileUrl).toBe(`https://app.example.test/pelajar/${await userIdOf(t.db, STUDENT_EMPTY)}`)
      expect(d.initial).toBe(d.name.trim()[0]!.toUpperCase())
    })

    it('answers, accuracy (1 decimal) and mastery cards come from the practice facts', async () => {
      t.facts.masteryRows = [
        { subjectId: '1', subjectName: 'Bahasa Melayu', subjectOrder: 1, correct: 46, answered: 94 },
        { subjectId: '2', subjectName: 'Sains', subjectOrder: 2, correct: 0, answered: 25 },
      ]
      t.facts.counts = { all: 4, practice: 3 }
      const d = GamificationShareCardsSchema.parse(dataOf(await student.get('/gamification/share-cards')))
      expect(d.profile).toMatchObject({ answered: 119, accuracy: 38.7, sessions: 4, currentSyiling: 370 })
      expect(d.ranking).toEqual({ accuracy: 38.7, correct: 46, answered: 119 })
      expect(d.mastery[0]).toEqual({ subjectName: 'Bahasa Melayu', level: 2, stage: 'Aktif', accuracy: 48.9, correct: 46 })
      expect(d.kombo).toMatchObject({ current: 2, best: 2, multiplier: 1 })
      t.facts.masteryRows = []
      t.facts.counts = { all: 0, practice: 0 }
    })
  })

  describe('GET /api/gamification/referral (S16)', () => {
    const walletOf2 = async (userId: string) => (await t.db.query<{ current_syiling: number }>(`select current_syiling from wallets where user_id = $1`, [userId]))[0]
    const referralRow = async (refereeId: string) =>
      (await t.db.query<{ referrer_id: string; rewarded: boolean }>(`select referrer_id::text, rewarded from referrals where referee_id = $1::bigint`, [refereeId]))[0]
    const ledgerOf = (userId: string) => t.db.query<{ amount: number; source_id: string }>(`select amount, source_id from coin_ledger where user_id = $1::bigint and source = 'referral'`, [userId])
    /** A setting row for the test; the reader answers the 48 section 2 default for a key with no row. */
    const setSetting = (key: string, value: number) =>
      t.db.query(`insert into gamification_settings (key, value, label) values ($1, $2, 'ujian') on conflict (key) do update set value = excluded.value`, [key, value])
    const unsetSetting = (key: string) => t.db.query(`delete from gamification_settings where key = $1`, [key])
    /** A fresh referrer pupil with a code. */
    const pupilWithCode = async (label: string) => {
      const id = await bareStudent(t, label)
      return { id, code: (await t.gamification.referral(id)).code }
    }

    it('FR-GM-24.3, AC-GM-24.5, AC-MUR-36-5: the first read creates a stable 8-character code; rewards and cap are the settings (100 / 0 / 20); links as the live site; stats 0 / 0 / 0', async () => {
      const a = GamificationReferralSchema.parse(dataOf(await student.get('/gamification/referral')))
      const again = GamificationReferralSchema.parse(dataOf(await student.get('/gamification/referral')))
      const other = GamificationReferralSchema.parse(dataOf(await maju.get('/gamification/referral')))
      expect(a.code).toMatch(/^[A-Z0-9]{8}$/)
      expect(again.code).toBe(a.code)
      expect(other.code).not.toBe(a.code)
      expect(a).toMatchObject({ rewardReferrer: 100, rewardReferee: 0, maxRewarded: 20, registerUrl: `https://app.example.test/register?ref=${a.code}`, stats: { referrals: 0, rewarded: 0, syilingEarned: 0 } })
      expect(a.whatsappUrl).toBe(`https://wa.me/?text=Jom%20belajar%20matematik%20di%20PRESTASIPLUS!%20Guna%20kod%20${a.code}!%20https://app.example.test/register?ref=${a.code}`)
      expect(a.telegramUrl).toBe(`https://t.me/share/url?url=${encodeURIComponent(a.registerUrl)}&text=Jom%20belajar%20matematik%20di%20PRESTASIPLUS!%20Guna%20kod%20${a.code}`)
      expect(await t.db.query(`select 1 from referral_codes where user_id = $1`, [await userIdOf(t.db, STUDENT)])).toHaveLength(1)
    })

    it('a code stored before (7 characters) is kept and still applies', async () => {
      const id = await bareStudent(t, 'Kod Lama')
      await t.db.query(`insert into referral_codes (user_id, code) values ($1::bigint, 'OLD7CHR')`, [id])
      expect((await t.gamification.referral(id)).code).toBe('OLD7CHR')
      const friend = await bareStudent(t, 'Kawan Kod Lama')
      expect(await t.gamification.applyReferral(friend, 'old7chr', { isTest: false })).toEqual({ applied: true })
    })

    it('parallel first reads of one user store ONE code', async () => {
      const id = await bareUser(t, 'Rujuk Selari')
      const codes = await Promise.all([1, 2, 3, 4].map(() => t.gamification.referral(id)))
      expect(new Set(codes.map((c) => c.code)).size).toBe(1)
      expect(await t.db.query(`select 1 from referral_codes where user_id = $1`, [id])).toHaveLength(1)
    })

    it('FR-GM-24.1, FR-GM-24.2, AC-GM-24.1, AC-GM-24.2, AC-MUR-36-1, AC-MUR-36-2: a new pupil with a pupil code pays the referrer 100 once and the friend nothing (0 writes no ledger row)', async () => {
      const referrer = await userIdOf(t.db, STUDENT)
      const code = GamificationReferralSchema.parse(dataOf(await student.get('/gamification/referral'))).code
      const friend = await bareStudent(t, 'Kawan Baru')
      expect(await t.gamification.applyReferral(friend, ` ${code.toLowerCase()} `, { isTest: false })).toEqual({ applied: true })
      expect(await t.gamification.applyReferral(friend, code, { isTest: false })).toEqual({ applied: false }) // referred once
      expect(await t.gamification.applyReferral(await bareStudent(t, 'Diri'), 'NOSUCH12', { isTest: false })).toEqual({ applied: false })
      expect(await t.gamification.applyReferral(referrer, code, { isTest: false })).toEqual({ applied: false }) // not your own code
      expect(await walletOf2(friend)).toBeUndefined()
      expect(await ledgerOf(friend)).toEqual([])
      expect((await walletOf2(referrer))!.current_syiling).toBe(470)
      expect(await ledgerOf(referrer)).toEqual([{ amount: 100, source_id: `referral:${friend}` }])
      const r = GamificationReferralSchema.parse(dataOf(await student.get('/gamification/referral')))
      expect(r.stats).toEqual({ referrals: 1, rewarded: 1, syilingEarned: 100 })
    })

    it('AC-GM-24.5, AC-MUR-36-5: a changed setting is read on the next call (80 for the referrer, 10 for the friend) and shown on the page', async () => {
      const { id: referrer, code } = await pupilWithCode('Rujuk Tetapan')
      await setSetting('referral_referrer_syiling', 80)
      await setSetting('referral_referee_syiling', 10)
      try {
        const view = await t.gamification.referral(referrer)
        expect(view).toMatchObject({ rewardReferrer: 80, rewardReferee: 10 })
        expect(decodeURIComponent(view.whatsappUrl)).toContain(`Guna kod ${code} untuk dapat 10 syiling PERCUMA!`)
        const friend = await bareStudent(t, 'Kawan Tetapan')
        expect(await t.gamification.applyReferral(friend, code, { isTest: false })).toEqual({ applied: true })
        expect((await walletOf2(referrer))!.current_syiling).toBe(80)
        expect((await walletOf2(friend))!.current_syiling).toBe(10)
        expect(await ledgerOf(friend)).toEqual([{ amount: 10, source_id: `referral:${friend}` }])
        expect((await t.gamification.referral(referrer)).stats).toEqual({ referrals: 1, rewarded: 1, syilingEarned: 80 })
      } finally {
        await unsetSetting('referral_referrer_syiling')
        await unsetSetting('referral_referee_syiling')
      }
    })

    it('FR-GM-24.2, AC-GM-24.3, AC-MUR-36-5: beyond referral_max_rewarded the referral is stored with rewarded = false and nothing is paid', async () => {
      const { id: referrer, code } = await pupilWithCode('Rujuk Had')
      await setSetting('referral_max_rewarded', 2)
      try {
        const friends = await Promise.all([1, 2, 3].map((n) => bareStudent(t, `Kawan Had ${String(n)}`)))
        for (const f of friends) expect(await t.gamification.applyReferral(f, code, { isTest: false })).toEqual({ applied: true })
        expect((await Promise.all(friends.map((f) => referralRow(f)))).map((r) => r?.rewarded)).toEqual([true, true, false])
        expect(await ledgerOf(friends[2]!)).toEqual([])
        expect((await walletOf2(referrer))!.current_syiling).toBe(200)
        const view = await t.gamification.referral(referrer)
        expect(view.maxRewarded).toBe(2)
        expect(view.stats).toEqual({ referrals: 3, rewarded: 2, syilingEarned: 200 })
        expect(await t.gamification.applyReferral(friends[2]!, code, { isTest: false })).toEqual({ applied: false }) // once per friend, still
      } finally {
        await unsetSetting('referral_max_rewarded')
      }
    })

    it('FR-GM-24.2: the cap holds when sign-ups arrive at the same time (the referrer row is locked before the count)', async () => {
      const { id: referrer, code } = await pupilWithCode('Rujuk Serentak')
      await setSetting('referral_max_rewarded', 3)
      try {
        const friends = await Promise.all(Array.from({ length: 8 }, (_, n) => bareStudent(t, `Kawan Serentak ${String(n)}`)))
        const out = await Promise.all(friends.map((f) => t.gamification.applyReferral(f, code, { isTest: false })))
        expect(out.every((o) => o.applied)).toBe(true)
        const rows = await Promise.all(friends.map((f) => referralRow(f)))
        expect(rows.every((r) => r !== undefined)).toBe(true) // every unrewarded referral is still stored
        expect(rows.filter((r) => r?.rewarded)).toHaveLength(3)
        expect(rows.filter((r) => r && !r.rewarded)).toHaveLength(5)
        expect((await walletOf2(referrer))!.current_syiling).toBe(3 * 100)
        expect(await ledgerOf(referrer)).toHaveLength(3)
      } finally {
        await unsetSetting('referral_max_rewarded')
      }
    })

    it('referralSyilingEarned counts only the referrer\'s own referral rows (2 rewarded, 1 unrewarded; a referee bonus and a non-referral row are ignored)', async () => {
      const { id: referrer, code } = await pupilWithCode('Rujuk Jumlah')
      await setSetting('referral_max_rewarded', 2)
      await setSetting('referral_referee_syiling', 7)
      try {
        const friends = await Promise.all([1, 2, 3].map((n) => bareStudent(t, `Kawan Jumlah ${String(n)}`)))
        for (const f of friends) await t.gamification.applyReferral(f, code, { isTest: false })
        // The referrer is a referee of somebody else too: that bonus has the same source but is not theirs to count.
        const up = await pupilWithCode('Rujuk Atas')
        await t.gamification.applyReferral(referrer, up.code, { isTest: false })
        await t.wallet.credit({ userId: referrer, amount: 40, source: 'quiz_practice', sourceId: 'sum-other', description: 'Latih Tubi: 40 betul', isTest: false })
        expect((await ledgerOf(referrer)).map((r) => r.amount).sort((x, y) => x - y)).toEqual([7, 100, 100])
        expect((await t.gamification.referral(referrer)).stats).toEqual({ referrals: 3, rewarded: 2, syilingEarned: 200 })
      } finally {
        await unsetSetting('referral_max_rewarded')
        await unsetSetting('referral_referee_syiling')
      }
    })

    it('share text: a friend reward above 0 keeps the live clause; at 0 the clause is dropped', async () => {
      const { id, code } = await pupilWithCode('Rujuk Teks')
      expect(decodeURIComponent((await t.gamification.referral(id)).whatsappUrl)).not.toContain('syiling PERCUMA')
      await setSetting('referral_referee_syiling', 5)
      try {
        expect(decodeURIComponent((await t.gamification.referral(id)).whatsappUrl)).toContain(`Guna kod ${code} untuk dapat 5 syiling PERCUMA!`)
      } finally {
        await unsetSetting('referral_referee_syiling')
      }
    })

    it('FR-GM-24.2: new pupils only, referred by pupils only (R6): a referee, a teacher referrer or an admin referrer that is not a pupil earns nothing and no referral is stored', async () => {
      const { id: referrer, code } = await pupilWithCode('Rujuk Murid')
      const notPupil = await bareUser(t, 'Bukan Murid')
      expect(await t.gamification.applyReferral(notPupil, code, { isTest: false })).toEqual({ applied: false })
      expect(await referralRow(notPupil)).toBeUndefined()

      const teacherId = await userIdOf(t.db, TEACHER)
      const teacherCode = (await t.gamification.referral(teacherId)).code
      const friend = await bareStudent(t, 'Kawan Guru')
      expect(await t.gamification.applyReferral(friend, teacherCode, { isTest: false })).toEqual({ applied: false })
      expect(await referralRow(friend)).toBeUndefined()
      expect(await ledgerOf(friend)).toEqual([])
      expect(await ledgerOf(referrer)).toEqual([])

      // An ADMIN referrer (also what a Mod Pelajar test actor is): no referral stored, nothing paid to either side.
      const adminId = await userIdOf(t.db, ADMIN)
      const adminCode = (await t.gamification.referral(adminId)).code
      const adminBefore = (await walletOf2(adminId))?.current_syiling
      const friend2 = await bareStudent(t, 'Kawan Admin')
      expect(await t.gamification.applyReferral(friend2, adminCode, { isTest: false })).toEqual({ applied: false })
      expect(await referralRow(friend2)).toBeUndefined()
      expect(await ledgerOf(friend2)).toEqual([])
      expect(await ledgerOf(adminId)).toEqual([])
      expect((await walletOf2(adminId))?.current_syiling).toBe(adminBefore)
    })
  })

  describe('GET /api/gamification/convert (S12)', () => {
    it('pelajar: rate 50, quick [50, 250, balance], the tier grid marks the viewer', async () => {
      const v = GamificationConvertViewSchema.parse(dataOf(await student.get('/gamification/convert')))
      expect(v).toMatchObject({ rate: 50, tierLabel: 'Gangsa', tokenBalance: 0, quick: [50, 250, v.currentSyiling] })
      expect(v.tiers.map((x) => [x.key, x.isMine])).toEqual([['bronze', true], ['silver', false], ['gold', false], ['platinum', false]])
    })
  })

  it('a challenge title seeded by the mock exists with its observed reward (seed fidelity)', async () => {
    const id = await challengeIdByTitle(t, 'Cabaran Kilat')
    expect(id).toBeTruthy()
  })
})
