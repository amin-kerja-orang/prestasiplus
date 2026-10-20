import {
  WalletGamificationSummarySchema,
  WalletSummarySchema,
  WalletTransactionsResponseSchema,
  type WalletLedgerEntry,
  type WalletSummary,
} from '@pp/contract'
import { identitySeed } from '../../prisma/seed/core/identity'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { ADMIN, STUDENT, STUDENT_EMPTY, STUDENT_MAJU, TEACHER, apiOf, bareUser, bootWalletApp, expectError, login, userIdOf, type Api, type WalletTestApp } from './helpers'

/** The field names of the mock `GamificationWallet` (handlers/student.ts `walletBody`). */
const WALLET_KEYS = [
  'currentSyiling',
  'earnedThisWeek',
  'earnedToday',
  'level',
  'levelProgressPct',
  'nextTier',
  'nextTitle',
  'streak',
  'tier',
  'title',
  'tokenBalance',
  'totalSyilingEarned',
  'userId',
  'xp',
  'xpNeeded',
]
const TIER_KEYS = ['color', 'conversionRate', 'icon', 'key', 'labelMs', 'minSyiling']
const LEDGER_KEYS = ['amount', 'balanceAfter', 'createdAt', 'description', 'id', 'source', 'type']

const BRONZE = { key: 'bronze', labelMs: 'Gangsa', icon: '🥉', color: '#cd7f32', minSyiling: 0, conversionRate: 50 }
const SILVER = { key: 'silver', labelMs: 'Perak', icon: '🥈', color: '#c0c0c0', minSyiling: 500, conversionRate: 40 }

describe('wallet read endpoints (AC6, AC8)', () => {
  let t: WalletTestApp
  let student: Api
  let maju: Api
  let empty: Api
  let admin: Api
  let teacher: Api

  const wallet = async (who: Api): Promise<WalletSummary> => {
    const res = await who.get('/gamification/wallet')
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    return WalletSummarySchema.parse((res.body as { data: unknown }).data)
  }

  beforeAll(async () => {
    t = await bootWalletApp()
    student = apiOf(await login(t, STUDENT))
    maju = apiOf(await login(t, STUDENT_MAJU))
    empty = apiOf(await login(t, STUDENT_EMPTY))
    admin = apiOf(await login(t, ADMIN))
    teacher = apiOf(await login(t, TEACHER))
  }, 120_000)
  afterAll(async () => {
    await t.close()
  })

  it('401 without a session on all three routes', async () => {
    for (const path of ['/api/gamification/wallet', '/api/gamification/transactions', '/api/me/gamification-summary']) {
      expectError(await t.http().get(path), 'UNAUTHORIZED')
    }
  })

  describe('GET /api/gamification/wallet', () => {
    it('the seeded student reads the mock wallet (pelajar: 370 syiling, 916 XP, bronze, streak 2/2), field names as the mock', async () => {
      const res = await student.get('/gamification/wallet')
      expect(res.status).toBe(200)
      expect(res.headers['cache-control']).toMatch(/no-store/)
      const data = (res.body as { data: Record<string, unknown> }).data
      expect(Object.keys(data).sort()).toEqual(WALLET_KEYS)
      const w = WalletSummarySchema.parse(data)
      expect(Object.keys(w.tier).sort()).toEqual(TIER_KEYS)
      expect(w).toEqual({
        userId: await userIdOf(t.db, STUDENT),
        currentSyiling: 370,
        totalSyilingEarned: 370,
        tokenBalance: 0,
        xp: 916,
        level: 1,
        xpNeeded: 100,
        levelProgressPct: 100,
        tier: BRONZE,
        nextTier: { ...SILVER, pct: 74, need: 130 },
        title: { name: 'Pelajar', emoji: '🎓' },
        nextTitle: { name: 'Master', emoji: '', threshold: 2000, need: 1630 },
        earnedToday: 0,
        earnedThisWeek: 0,
        streak: { current: 2, best: 2, multiplier: 1 },
      })
    })

    it('pelajarmaju: 267 syiling, 432 XP, level 3, streak 3/3', async () => {
      expect(await wallet(maju)).toMatchObject({
        currentSyiling: 267,
        totalSyilingEarned: 267,
        xp: 432,
        level: 3,
        xpNeeded: 120,
        levelProgressPct: 100,
        tier: BRONZE,
        nextTier: { ...SILVER, pct: 53.4, need: 233 },
        title: { name: 'Permulaan' },
        nextTitle: { name: 'Pelajar', emoji: '🎓', threshold: 300, need: 33 },
        streak: { current: 3, best: 3, multiplier: 1 },
      })
    })

    it('the observed admin wallet (256 syiling, 8 XP, level 2, streak 1 / best 5)', async () => {
      expect(await wallet(admin)).toMatchObject({ currentSyiling: 256, totalSyilingEarned: 256, xp: 8, level: 2, xpNeeded: 110, levelProgressPct: 7, earnedToday: 0, earnedThisWeek: 0, streak: { current: 1, best: 5, multiplier: 1 } })
    })

    it('earnedToday and earnedThisWeek count positive amounts of the Malaysia day and Monday-to-Sunday week (BR-M14-07)', async () => {
      const previous = t.clock.now()
      try {
        t.clock.set('2026-09-25T15:40:00+08:00') // SEED_NOW, a Friday
        const w = await wallet(student)
        expect(w.earnedToday).toBe(198) // the P4 session rows of 25/09
        expect(w.earnedThisWeek).toBe(370) // Monday 21/09 to Sunday 27/09: every row
        t.clock.set('2026-09-27T23:59:59+08:00') // Sunday night, still that week
        expect((await wallet(student)).earnedThisWeek).toBe(370)
        t.clock.set('2026-09-28T00:00:00+08:00') // Monday
        expect(await wallet(student)).toMatchObject({ earnedToday: 0, earnedThisWeek: 0 })
        t.clock.set('2026-09-24T23:59:59+08:00')
        expect(await wallet(student)).toMatchObject({ earnedToday: 151, earnedThisWeek: 370 }) // 24/09: P2 (26+7+30+10+12+40) and P3 (6+20)
        t.clock.set('2026-09-22T00:00:00+08:00')
        expect(await wallet(student)).toMatchObject({ earnedToday: 21 }) // 22/09: P1 (4+7+10)
      } finally {
        t.clock.set(previous)
      }
    })

    it('a user without a wallet reads the BR-M14-02 defaults and a read creates no row', async () => {
      const w = await wallet(empty)
      expect(w).toEqual({
        userId: await userIdOf(t.db, STUDENT_EMPTY),
        currentSyiling: 0,
        totalSyilingEarned: 0,
        tokenBalance: 0,
        xp: 0,
        level: 1,
        xpNeeded: 100,
        levelProgressPct: 0,
        tier: BRONZE,
        nextTier: { ...SILVER, pct: 0, need: 500 },
        title: { name: 'Permulaan', emoji: '📚' },
        nextTitle: { name: 'Pelajar', emoji: '🎓', threshold: 300, need: 300 },
        earnedToday: 0,
        earnedThisWeek: 0,
        streak: { current: 0, best: 0, multiplier: 1 },
      })
      expect(await t.db.query(`select 1 from wallets where user_id = $1`, [w.userId])).toHaveLength(0)
      expect(await t.db.query(`select 1 from streaks where user_id = $1`, [w.userId])).toHaveLength(0)
    })

    it('any role may read its own wallet (a teacher without a wallet reads the defaults)', async () => {
      const w = await wallet(teacher)
      expect(w.userId).toBe(await userIdOf(t.db, TEACHER))
      expect(w.currentSyiling).toBe(0)
    })

    it('there is no id parameter: another user id in the query or the path changes nothing', async () => {
      const otherId = await userIdOf(t.db, STUDENT_MAJU)
      const mine = await userIdOf(t.db, STUDENT)
      for (const path of [`/gamification/wallet?userId=${otherId}`, `/gamification/wallet?user_id=${otherId}&id=${otherId}`]) {
        const res = await student.get(path)
        expect(res.status).toBe(200)
        expect(WalletSummarySchema.parse((res.body as { data: unknown }).data).userId).toBe(mine)
      }
      expect((await student.get(`/gamification/wallet/${otherId}`)).status).toBe(404)
    })

    it('the highest tier has no next tier, and a stored negative token balance is shown as is', async () => {
      const u = await userIdOf(t.db, STUDENT_MAJU)
      await t.db.query(`update wallets set current_syiling = 5200, tier_id = (select id from tiers where tier_name = 'platinum'), token_balance = -3 where user_id = $1`, [u])
      try {
        const w = await wallet(maju)
        expect(w.tier.key).toBe('platinum')
        expect(w.nextTier).toBeNull()
        expect(w.tokenBalance).toBe(-3)
      } finally {
        await t.db.query(`update wallets set current_syiling = 267, tier_id = (select id from tiers where tier_name = 'bronze'), token_balance = 0 where user_id = $1`, [u])
      }
    })
  })

  describe('GET /api/gamification/transactions', () => {
    const list = async (who: Api, query = ''): Promise<{ data: WalletLedgerEntry[]; meta: { currentSyiling: number; type: string } }> => {
      const res = await who.get(`/gamification/transactions${query}`)
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      return WalletTransactionsResponseSchema.parse(res.body)
    }

    it('lists every row of the caller, newest first (created_at desc, id desc), with meta { currentSyiling, type }', async () => {
      const res = await student.get('/gamification/transactions')
      expect(res.headers['cache-control']).toMatch(/no-store/)
      const body = WalletTransactionsResponseSchema.parse(res.body)
      expect(Object.keys((res.body as { meta: object }).meta).sort()).toEqual(['currentSyiling', 'type']) // no page keys
      expect(body.meta).toEqual({ currentSyiling: 370, type: '' })
      expect(body.data).toHaveLength(20)
      expect(Object.keys(body.data[0]!).sort()).toEqual(LEDGER_KEYS)
      expect(body.data[0]).toMatchObject({ type: 'earn', source: 'daily_challenge', amount: 40, balanceAfter: 370, description: 'Cabaran selesai: Cabaran Kilat', createdAt: '2026-09-25T08:30:00.000+08:00' })
      expect(body.data.at(-1)).toMatchObject({ source: 'quiz_spm', amount: 4, balanceAfter: 4, description: 'SPM Tahun Lepas: 4 betul — 40%', createdAt: '2026-09-22T19:00:00.000+08:00' })
      const times = body.data.map((r) => r.createdAt)
      expect([...times].sort().reverse()).toEqual(times) // newest first
      // Within one instant the higher id comes first.
      const sameInstant = body.data.filter((r) => r.createdAt === '2026-09-25T08:30:00.000+08:00').map((r) => BigInt(r.id))
      expect(sameInstant.length).toBeGreaterThan(1)
      expect([...sameInstant].sort((a, b) => (a < b ? 1 : -1))).toEqual(sameInstant)
      // balanceAfter is the running balance read oldest first.
      let running = 0
      for (const r of [...body.data].reverse()) {
        running += r.amount
        expect(r.balanceAfter).toBe(running)
      }
    })

    it('a user sees only own rows; another user ledger never appears', async () => {
      const mine = await list(student)
      const theirs = await list(maju)
      expect(theirs.data).toHaveLength(19)
      expect(theirs.meta.currentSyiling).toBe(267)
      const ids = new Set(mine.data.map((r) => r.id))
      expect(theirs.data.filter((r) => ids.has(r.id))).toEqual([])
      expect((await list(empty)).data).toEqual([])
      expect((await list(empty)).meta).toEqual({ currentSyiling: 0, type: '' })
      // The query cannot name another user.
      const spoof = await list(student, `?userId=${await userIdOf(t.db, STUDENT_MAJU)}`)
      expect(spoof.data.map((r) => r.id)).toEqual(mine.data.map((r) => r.id))
    })

    it('filters by type; an unknown type is not an error and gives no rows; meta.type echoes the query', async () => {
      expect((await list(student, '?type=earn')).data).toHaveLength(20)
      expect((await list(student, '?type=earn')).meta.type).toBe('earn')
      for (const type of ['spend', 'convert', 'bonus', 'refund']) expect((await list(student, `?type=${type}`)).data).toEqual([])
      const unknown = await list(student, '?type=gift')
      expect(unknown.data).toEqual([])
      expect(unknown.meta).toEqual({ currentSyiling: 370, type: 'gift' })
      expect((await list(student, '?type=')).data).toHaveLength(20) // empty = all
      expect((await list(student, '?type=EARN')).data).toEqual([]) // codes are lower case
      expect((await list(student, '?type=earn&type=spend')).meta.type).toBe('earn') // the first of a repeated key
      expect((await list(student, '?type[]=earn')).meta.type).toBe('') // not a string: read as empty
    })

    it('rows of every type are returned with the contract types (spend, convert, bonus, refund)', async () => {
      const u = await bareUser(t, 'tipe')
      await t.wallet.credit({ userId: u, amount: 100, source: 'a', sourceId: '1', description: 'd' })
      await t.wallet.credit({ userId: u, amount: 10, source: 'admin_award', sourceId: '2', description: 'Hadiah', type: 'bonus' })
      await t.wallet.debit({ userId: u, amount: 20, source: 'shop', sourceId: '3', description: 'Beli' })
      await t.wallet.debit({ userId: u, amount: 50, type: 'convert', tokens: 1, source: 'token_conversion', sourceId: '4', description: 'Tukar 50 syiling → 1 token' })
      await t.wallet.credit({ userId: u, amount: 20, source: 'shop', sourceId: '5', description: 'Pulangan', type: 'refund' })
      const res = WalletTransactionsResponseSchema.parse(await t.wallet.transactions(u, ''))
      expect(res.data.map((r) => [r.type, r.amount, r.balanceAfter])).toEqual([
        ['refund', 20, 60],
        ['convert', -50, 40],
        ['spend', -20, 90],
        ['bonus', 10, 110],
        ['earn', 100, 100],
      ]) // newest first: within one instant the ids descend
      expect((await t.wallet.transactions(u, 'convert')).data).toHaveLength(1)
    })
  })

  describe('GET /api/me/gamification-summary', () => {
    const chips = async (who: Api) => {
      const res = await who.get('/me/gamification-summary')
      expect(res.status).toBe(200)
      expect(res.headers['cache-control']).toMatch(/no-store/)
      return WalletGamificationSummarySchema.parse((res.body as { data: unknown }).data)
    }

    it('coins = currentSyiling, points = xp, streakDays = streak.current', async () => {
      expect(await chips(student)).toEqual({ coins: 370, points: 916, streakDays: 2 })
      expect(await chips(maju)).toEqual({ coins: 267, points: 432, streakDays: 3 })
      expect(await chips(admin)).toEqual({ coins: 256, points: 8, streakDays: 1 })
    })

    it('a user without wallet or streak rows reads 0 / 0 / 0', async () => {
      expect(await chips(empty)).toEqual({ coins: 0, points: 0, streakDays: 0 })
    })

    it('agrees with the wallet endpoint after a credit', async () => {
      const u = await userIdOf(t.db, STUDENT_EMPTY)
      await t.wallet.credit({ userId: u, amount: 7, source: 'quiz_practice', sourceId: 'chip', description: 'd' })
      await t.wallet.addXp({ userId: u, amount: 70 })
      await t.streak.touch(u)
      expect(await chips(empty)).toEqual({ coins: 7, points: 70, streakDays: 1 })
      const w = await wallet(empty)
      expect([w.currentSyiling, w.xp, w.streak.current]).toEqual([7, 70, 1])
      expect(w.earnedToday).toBe(7)
      expect(w.earnedThisWeek).toBe(7)
    })
  })
})

describe('wallet routes under a low read limit and without tiers', () => {
  it('429 RATE_LIMITED with Retry-After once the per-user read limit is used up', async () => {
    const t = await bootWalletApp({ env: { THROTTLE_WALLET_READ_PER_MINUTE: '3' } })
    try {
      const api = apiOf(await login(t, STUDENT))
      for (let i = 0; i < 3; i++) expect((await api.get('/me/gamification-summary')).status).toBe(200)
      const limited = await api.get('/gamification/wallet') // the three routes share one counter per user
      expectError(limited, 'RATE_LIMITED', 'Too Many Attempts.')
      expect(limited.headers['retry-after']).toBeTruthy()
    } finally {
      await t.close()
    }
  })

  it('a database with no tier row: credits still work (wallet tier null), the wallet read says so instead of inventing a tier', async () => {
    const t = await bootWalletApp({ seeds: [identitySeed] })
    try {
      const u = await bareUser(t, 'tanpa tier')
      expect(await t.wallet.credit({ userId: u, amount: 5, source: 'a', sourceId: '1', description: 'd' })).toMatchObject({ currentSyiling: 5, tierKey: null })
      await expect(t.wallet.summary(u)).rejects.toThrow('no tier is defined')
      expect(await t.wallet.gamificationSummary(u)).toEqual({ coins: 5, points: 0, streakDays: 0 }) // the chips need no tier
    } finally {
      await t.close()
    }
  })
})
