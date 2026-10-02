/**
 * M14-T1: the endpoints #2–#43 (SRS M14 v1.8 §7) through the mock transport, booted with the real
 * core, M01 (users), M02 (schools) and M14 at the project clock. The M05 reads are replaced by the
 * seam (`setPracticeReadsForTests`) with the admin's observed figures; the real M05 is exercised by
 * `integration.test.ts`.
 *
 * Order matters in this file: the read-only blocks run first (they assert the seeded totals), the
 * blocks that write come after and restore what they change.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { setUser } from '@/mock/core-data/set-user'
import type { MockRuntime } from '@/mock/index'

import { coinLedger, teacherRewards, teacherWallet, wallet, settings } from '../../mock'
import { setPracticeReadsForTests, type PracticeReads } from '../../mock/repository/reads'
import { bootM14, dataOf, send, stubStorage } from './helpers'

let runtime: MockRuntime
let admin: string
let guru: string
let pelajar: string
let pelajarmaju: string
let pelajar2: string
let gold: string

beforeAll(async () => {
  stubStorage()
  runtime = (await bootM14()).runtime
  admin = setUser(1).token
  pelajar = setUser(2).token
  pelajar2 = setUser(3).token
  pelajarmaju = setUser(4).token
  guru = setUser(5).token
  gold = setUser(4034).token
  setPracticeReadsForTests(READS)
}, 60_000)

afterAll(() => {
  setPracticeReadsForTests(null)
  vi.unstubAllGlobals()
})

// The admin's observed M05 figures: S12 BM 46/94 and SEJ 14/40 (L2 "Aktif", L1 "Mula Belajar"),
// S8 `all` 119 answers / 46 correct / 4 sessions.
const READS: PracticeReads = {
  sessionsOn: () => [],
  practiceSessions: () => [],
  answersOn: () => [],
  mastery: (u) =>
    u === 1
      ? [
          { subjectId: 1, correct: 46, answered: 94 },
          { subjectId: 2, correct: 14, answered: 40 },
        ]
      : [],
  allSessions: (u) =>
    u === 1
      ? ['a', 'b', 'c', 'd'].map((id) => ({
          id,
          mode: 'past_year',
          correct: 1,
          total: 10,
          timeSpent: 60,
          completedAt: '2026-05-19T03:26:00+08:00',
        }))
      : [],
  allAnswers: (u) => (u === 1 ? { total: 119, correct: 46 } : { total: 0, correct: 0 }),
}

const get = (url: string, token?: string, query?: Record<string, string | number>) =>
  send(runtime, 'GET', url, { ...(token ? { token } : {}), ...(query ? { query } : {}) })

// ---------------------------------------------------------------------------------------------
// Guards (BR-M14-01): guest 401, other roles 403
// ---------------------------------------------------------------------------------------------

const STUDENT_ROUTES = [
  '/api/gamification/wallet',
  '/api/gamification/dashboard',
  '/api/gamification/transactions',
  '/api/gamification/convert',
  '/api/gamification/challenges',
  '/api/gamification/leaderboard',
  '/api/gamification/achievements',
  '/api/gamification/share-cards',
  '/api/gamification/referral',
]
const TEACHER_ROUTES = [
  '/api/guru/gamification',
  '/api/guru/gamification/cash',
  '/api/guru/gamification/shop',
  '/api/guru/gamification/leaderboard',
]
const ADMIN_ROUTES = [
  '/api/admin/gamification/overview',
  '/api/admin/gamification/tiers',
  '/api/admin/gamification/challenges',
  '/api/admin/gamification/students',
  '/api/admin/gamification/transactions',
  '/api/admin/gamification/guru',
  '/api/admin/gamification/guru/redemptions',
  '/api/admin/gamification/guru/cash',
  '/api/admin/gamification/settings',
  '/api/admin/reward-control',
]

describe('guards', () => {
  it('every GET answers 401 to a guest', async () => {
    for (const url of [...STUDENT_ROUTES, ...TEACHER_ROUTES, ...ADMIN_ROUTES]) {
      expect((await get(url)).status, url).toBe(401)
    }
  })

  it('S routes accept every logged-in role; T routes refuse a student; AD routes refuse student and teacher', async () => {
    for (const url of STUDENT_ROUTES) {
      expect((await get(url, pelajar)).status, url).toBe(200)
      expect((await get(url, guru)).status, url).toBe(200)
    }
    for (const url of TEACHER_ROUTES) {
      expect((await get(url, pelajar)).status, url).toBe(403)
      expect((await get(url, guru)).status, url).toBe(200)
      expect((await get(url, admin)).status, url).toBe(200)
    }
    for (const url of ADMIN_ROUTES) {
      expect((await get(url, pelajar)).status, url).toBe(403)
      expect((await get(url, guru)).status, url).toBe(403)
      expect((await get(url, admin)).status, url).toBe(200)
    }
  })

  it('the writes are guarded too', async () => {
    const calls: [Parameters<typeof send>[1], string][] = [
      ['POST', '/api/gamification/convert'],
      ['POST', '/api/guru/gamification/cash'],
      ['POST', '/api/guru/gamification/shop/1/redeem'],
      ['PUT', '/api/admin/gamification/tiers/1'],
      ['POST', '/api/admin/gamification/tiers/1/toggle'],
      ['POST', '/api/admin/gamification/tiers'],
      ['PUT', '/api/admin/gamification/challenges/1'],
      ['POST', '/api/admin/gamification/challenges/1/toggle'],
      ['DELETE', '/api/admin/gamification/challenges/1'],
      ['POST', '/api/admin/gamification/challenges'],
      ['POST', '/api/admin/gamification/award'],
      ['PUT', '/api/admin/gamification/guru/badges/1'],
      ['POST', '/api/admin/gamification/guru/rewards'],
      ['PATCH', '/api/admin/gamification/guru/redemptions/1'],
      ['PATCH', '/api/admin/gamification/guru/cash/1'],
      ['PUT', '/api/admin/gamification/settings'],
      ['PUT', '/api/admin/reward-control/settings'],
      ['PUT', '/api/admin/reward-control/rewards/1/cost'],
      ['POST', '/api/admin/reward-control/draws'],
    ]
    for (const [method, url] of calls) {
      expect((await send(runtime, method, url)).status, `${method} ${url}`).toBe(401)
      if (url.startsWith('/api/admin')) {
        expect((await send(runtime, method, url, { token: pelajar })).status, url).toBe(403)
        expect((await send(runtime, method, url, { token: guru })).status, url).toBe(403)
      }
    }
    for (const url of ['/api/guru/gamification/cash', '/api/guru/gamification/shop/1/redeem']) {
      expect((await send(runtime, 'POST', url, { token: pelajar })).status, url).toBe(403)
    }
  })
})

// ---------------------------------------------------------------------------------------------
// Student endpoints #2–#11 (reads)
// ---------------------------------------------------------------------------------------------

describe('#2 wallet', () => {
  it('admin: 256 / 0 / 8 / level 2, Gangsa, next tier Perak (244 more), title Permulaan then Pelajar (44)', async () => {
    const res = await get('/api/gamification/wallet', admin)
    const d = dataOf<Record<string, unknown>>(res)
    expect(d).toMatchObject({
      userId: 1,
      currentSyiling: 256,
      totalSyilingEarned: 256,
      tokenBalance: 0,
      xp: 8,
      level: 2,
      xpNeeded: 110,
      levelProgressPct: 7,
      earnedToday: 0,
      earnedThisWeek: 0,
      streak: { current: 1, best: 5, multiplier: 1 },
      tier: { key: 'bronze', labelMs: 'Gangsa', icon: '🥉', conversionRate: 50, minSyiling: 0 },
      nextTier: { key: 'silver', need: 244, pct: 51.2 },
      title: { name: 'Permulaan' },
      nextTitle: { name: 'Pelajar', need: 44, threshold: 300 },
    })
    expect(d).not.toHaveProperty('hasWallet')
  })

  it('designed accounts: pelajar 370 / 916 XP, pelajarmaju 267 / 432 XP; a user without a row reads the defaults', async () => {
    expect(dataOf(await get('/api/gamification/wallet', pelajar))).toMatchObject({
      currentSyiling: 370,
      totalSyilingEarned: 370,
      xp: 916,
      level: 1,
      levelProgressPct: 100,
      title: { name: 'Pelajar' },
      streak: { current: 2, best: 2 },
    })
    expect(dataOf(await get('/api/gamification/wallet', pelajarmaju))).toMatchObject({
      currentSyiling: 267,
      xp: 432,
      level: 3,
      streak: { current: 3, best: 3 },
    })
    expect(dataOf(await get('/api/gamification/wallet', pelajar2))).toMatchObject({
      currentSyiling: 0,
      tokenBalance: 0,
      xp: 0,
      level: 1,
      tier: { key: 'bronze' },
    })
  })
})

describe('#3 dashboard', () => {
  it('admin: 4 challenges, 6 newest ledger rows, mastery in the FN-M14-2.1.8 format, 4 active tiers', async () => {
    const d = dataOf<{
      wallet: { currentSyiling: number }
      challenges: { id: number; title: string }[]
      recent: { description: string; amount: number }[]
      mastery: Record<string, unknown>[]
      tiers: { key: string; isMine: boolean }[]
    }>(await get('/api/gamification/dashboard', admin))
    expect(d.wallet.currentSyiling).toBe(256)
    expect(d.challenges).toHaveLength(4)
    expect(d.challenges.map((c) => c.id)).toEqual([1, 2, 3, 4])
    expect(d.recent).toHaveLength(6)
    expect(d.recent[0]).toMatchObject({
      description: 'Cabaran selesai: Penjelajah Topik',
      amount: 25,
    })
    expect(d.mastery).toMatchObject([
      {
        level: 2,
        stage: 'Aktif',
        correct: 46,
        nextTarget: 50,
        accuracy: 48.94,
        multiplier: 1.05,
      },
      { level: 1, stage: 'Mula Belajar', correct: 14, nextTarget: 25, accuracy: 35, multiplier: 1 },
    ])
    expect(d.tiers.map((t) => t.key)).toEqual(['bronze', 'silver', 'gold', 'platinum'])
    expect(d.tiers.filter((t) => t.isMine).map((t) => t.key)).toEqual(['bronze'])
  })
})

describe('#4 transactions', () => {
  it('admin: all 14 rows newest first, with the signed amount and the running balance', async () => {
    const res = await get('/api/gamification/transactions', admin)
    const rows =
      dataOf<{ description: string; amount: number; balanceAfter: number; type: string }[]>(res)
    expect(rows).toHaveLength(14)
    expect(rows[0]).toMatchObject({
      description: 'Cabaran selesai: Penjelajah Topik',
      amount: 25,
      balanceAfter: 256,
    })
    expect(rows[13]).toMatchObject({
      description: 'Cabaran Kilat: 3 betul, combo 2x',
      balanceAfter: 4,
    })
    expect(rows[0]).not.toHaveProperty('userId')
    expect((res.body as { meta: unknown }).meta).toEqual({ currentSyiling: 256, type: '' })
  })

  it('filters by type; an unknown type answers no rows (FR-M14-08)', async () => {
    expect(
      dataOf<unknown[]>(await get('/api/gamification/transactions', admin, { type: 'earn' })),
    ).toHaveLength(14)
    expect(
      dataOf<unknown[]>(await get('/api/gamification/transactions', admin, { type: 'spend' })),
    ).toHaveLength(0)
    const none = await get('/api/gamification/transactions', admin, { type: 'zzz' })
    expect(dataOf<unknown[]>(none)).toEqual([])
    expect((none.body as { meta: { type: string } }).meta.type).toBe('zzz')
  })

  it('pelajar sees only the 20 designed rows (140101–140120), not the admin ones', async () => {
    const rows = dataOf<{ description: string }[]>(
      await get('/api/gamification/transactions', pelajar),
    )
    expect(rows).toHaveLength(20)
    expect(rows.every((r) => !r.description.includes('Penjelajah Topik'))).toBe(true)
  })
})

describe('#5 convert view', () => {
  it('admin: rate 50, quick buttons 50 / 250 / 256, the tier grid marks the viewer', async () => {
    const d = dataOf<{
      quick: number[]
      rate: number
      tierLabel: string
      tiers: { key: string; isMine: boolean }[]
    }>(await get('/api/gamification/convert', admin))
    expect(d).toMatchObject({
      currentSyiling: 256,
      tokenBalance: 0,
      rate: 50,
      tierLabel: 'Gangsa',
      quick: [50, 250, 256],
    })
    expect(d.tiers.map((t) => [t.key, t.isMine])).toEqual([
      ['bronze', true],
      ['silver', false],
      ['gold', false],
      ['platinum', false],
    ])
  })
})

describe('#7 challenges', () => {
  it('admin: 10 active, none completed, the streak challenge reads the M14 streak', async () => {
    const res = await get('/api/gamification/challenges', admin)
    const items =
      dataOf<{ id: number; target: number; progress: number; pct: number; completed: boolean }[]>(
        res,
      )
    expect((res.body as { meta: unknown }).meta).toEqual({ completed: 0, active: 10 })
    expect(items).toHaveLength(10)
    const kombo = items.find((c) => c.id === 8)
    expect(kombo).toMatchObject({ target: 2, progress: 1, pct: 50, completed: false })
  })

  it('designed completions at the clock: pelajar 7/10, pelajarmaju 4/10 (Q-DAILY-FINISHERS 0)', async () => {
    const a = await get('/api/gamification/challenges', pelajar)
    expect((a.body as { meta: unknown }).meta).toEqual({ completed: 7, active: 10 })
    const done = dataOf<{ id: number; completed: boolean; progress: number; target: number }[]>(a)
    expect(done.filter((c) => c.completed).map((c) => c.id)).toEqual([2, 4, 5, 6, 7, 8, 10])
    expect(done.filter((c) => c.completed).every((c) => c.progress === c.target)).toBe(true)
    const b = await get('/api/gamification/challenges', pelajarmaju)
    expect((b.body as { meta: unknown }).meta).toEqual({ completed: 4, active: 10 })
  })
})

describe('#8 leaderboard', () => {
  it('podium ranks 1–3 and rows 4–50 by lifetime syiling', async () => {
    const d = dataOf<{
      podium: {
        rank: number
        userId: number
        name: string
        initials: string
        totalSyilingEarned: number
        tier: { key: string; icon: string }
      }[]
      rows: {
        rank: number
        userId: number
        title: string
        level: number
        totalSyilingEarned: number
        tierIcon: string
      }[]
    }>(await get('/api/gamification/leaderboard', pelajar))
    expect(d.podium.map((p) => p.rank)).toEqual([1, 2, 3])
    expect(d.podium[0]).toMatchObject({
      userId: 4001,
      totalSyilingEarned: 1_018_083,
      tier: { key: 'platinum', icon: '💎' },
    })
    expect(d.podium[0]?.name).not.toBe('')
    expect(d.podium[0]?.initials.length).toBeGreaterThan(0)
    expect(d.rows).toHaveLength(47)
    expect(d.rows[0]).toMatchObject({
      rank: 4,
      userId: 4004,
      totalSyilingEarned: 65_129,
      title: 'Mitos',
      level: 39,
    })
    expect(d.rows.at(-1)).toMatchObject({ rank: 50, totalSyilingEarned: 2930 })
    const all = [...d.podium, ...d.rows].map((r) => r.totalSyilingEarned)
    expect(all).toEqual([...all].sort((a, b) => b - a))
  })

  it('ignores ?period= and every other query', async () => {
    const plain = await get('/api/gamification/leaderboard', pelajar)
    const withPeriod = await get('/api/gamification/leaderboard', pelajar, { period: 'week', x: 1 })
    expect(withPeriod.body).toEqual(plain.body)
  })
})

describe('#9 achievements', () => {
  it('admin: 0/25, streak card from the single store, 25 cards in catalogue order', async () => {
    const d = dataOf<{
      unlocked: number
      total: number
      streak: unknown
      items: { id: number; unlocked: boolean; progress: unknown }[]
    }>(await get('/api/gamification/achievements', admin))
    expect(d).toMatchObject({
      unlocked: 0,
      total: 25,
      streak: { current: 1, best: 5, multiplier: 1 },
    })
    expect(d.items.map((i) => i.id)).toEqual(Array.from({ length: 25 }, (_, i) => i + 1))
    expect(d.items.filter((i) => i.progress !== null).map((i) => i.id)).toEqual([1, 2, 4, 10, 12])
  })

  it('filters by rarity (6 / 8 / 6 / 5); an unknown rarity answers no card', async () => {
    const n = async (rarity: string) =>
      dataOf<{ items: unknown[] }>(await get('/api/gamification/achievements', admin, { rarity }))
        .items.length
    expect([await n('common'), await n('rare'), await n('epic'), await n('legendary')]).toEqual([
      6, 8, 6, 5,
    ])
    expect(await n('zzz')).toBe(0)
  })

  it('pelajarmaju: the designed unlocks 1, 3 and 5', async () => {
    const d = dataOf<{
      unlocked: number
      items: { id: number; unlocked: boolean; unlockedAt: string | null }[]
    }>(await get('/api/gamification/achievements', pelajarmaju))
    expect(d.unlocked).toBe(3)
    expect(d.items.filter((i) => i.unlocked).map((i) => i.id)).toEqual([1, 3, 5])
    expect(d.items.find((i) => i.id === 1)?.unlockedAt).toBe('2026-09-23T16:10:00+08:00')
  })
})

describe('#10 share cards', () => {
  it('admin: profile 119 / 38.7% / 4, Kombo 1 / 5, mastery cards, ranking 46/119, own profile link', async () => {
    const d = dataOf<Record<string, unknown>>(await get('/api/gamification/share-cards', admin))
    expect(d).toMatchObject({
      profileUrl: 'https://prestasiplus.my/pelajar/1',
      profile: {
        answered: 119,
        accuracy: 38.7,
        sessions: 4,
        tierKey: 'bronze',
        tierIcon: '🥉',
        level: 2,
        currentSyiling: 256,
      },
      kombo: { current: 1, best: 5, multiplier: 1 },
      ranking: { accuracy: 38.7, correct: 46, answered: 119 },
    })
    expect(d.mastery).toMatchObject([
      { level: 2, stage: 'Aktif', accuracy: 48.9, correct: 46 },
      { level: 1, stage: 'Mula Belajar', accuracy: 35, correct: 14 },
    ])
    expect(String(d.initial)).toHaveLength(1)
    expect(d.name).not.toBe('')
  })

  it('a user without answers reads zeros (no division by zero)', async () => {
    const d = dataOf<{ profile: { accuracy: number }; ranking: { accuracy: number } }>(
      await get('/api/gamification/share-cards', pelajar2),
    )
    expect(d.profile.accuracy).toBe(0)
    expect(d.ranking.accuracy).toBe(0)
  })
})

describe('#11 referral', () => {
  it('admin: the observed code 4JURJTT, 50 / 25, share links, statistics 0 / 0 / 0', async () => {
    const d = dataOf<{
      code: string
      whatsappUrl: string
      telegramUrl: string
      registerUrl: string
    }>(await get('/api/gamification/referral', admin))
    expect(d).toMatchObject({
      code: '4JURJTT',
      rewardReferrer: 50,
      rewardReferee: 25,
      registerUrl: 'https://prestasiplus.my/register?ref=4JURJTT',
      stats: { referrals: 0, rewarded: 0, syilingEarned: 0 },
    })
    expect(decodeURIComponent(d.whatsappUrl)).toBe(
      'https://wa.me/?text=Jom belajar matematik di PRESTASIPLUS! Guna kod 4JURJTT untuk dapat 25 syiling PERCUMA! https://prestasiplus.my/register?ref=4JURJTT',
    )
    expect(d.telegramUrl.startsWith('https://t.me/share/url?url=')).toBe(true)
  })

  it('every other user gets a stable 7-character code', async () => {
    const a = dataOf<{ code: string }>(await get('/api/gamification/referral', pelajar)).code
    const b = dataOf<{ code: string }>(await get('/api/gamification/referral', pelajar)).code
    expect(a).toMatch(/^[A-Z0-9]{7}$/)
    expect(b).toBe(a)
    expect(a).not.toBe('4JURJTT')
  })
})

// ---------------------------------------------------------------------------------------------
// Teacher endpoints #12–#17 (reads)
// ---------------------------------------------------------------------------------------------

describe('#12 teacher dashboard', () => {
  it('admin: 92,683 / 20,719 questions, 7 of 8 badges, next badge needs 29,281, 18 rows newest first', async () => {
    const d = dataOf<{
      balance: number
      totalEarned: number
      questionsCount: number
      coinsPerQuestion: number
      badges: { earned: boolean }[]
      badgesEarned: number
      badgesActive: number
      nextBadge: { name: string; need: number } | null
      catalogue: unknown[]
      transactions: { description: string; amount: number }[]
    }>(await get('/api/guru/gamification', admin))
    expect(d).toMatchObject({
      balance: 92_683,
      totalEarned: 92_683,
      questionsCount: 20_719,
      coinsPerQuestion: 10,
      badgesEarned: 7,
      badgesActive: 8,
    })
    expect(d.badges.filter((b) => b.earned)).toHaveLength(7)
    expect(d.nextBadge).toMatchObject({ name: 'Legenda Terulung', need: 29_281 })
    expect(d.catalogue).toEqual([])
    expect(d.transactions).toHaveLength(18)
    expect(d.transactions[0]).toMatchObject({
      description: 'SPM Tahun Lepas - 0% ketepatan',
      amount: 0,
    })
    expect(d.transactions.reduce((s, t) => s + t.amount, 0)).toBe(92_683)
  })

  it('guru: 1 contribution, balance 0', async () => {
    expect(dataOf(await get('/api/guru/gamification', guru))).toMatchObject({
      questionsCount: 1,
      balance: 0,
      badgesEarned: 0,
    })
  })
})

describe('#13 / #15 teacher cash and shop (reads)', () => {
  it('admin cash view: min 100, rate 10 / 8, 25 banks, no request yet', async () => {
    const d = dataOf<{ banks: string[]; history: unknown[] }>(
      await get('/api/guru/gamification/cash', admin),
    )
    expect(d).toMatchObject({
      balance: 92_683,
      available: 92_683,
      held: 0,
      minWithdrawal: 100,
      maxWithdrawal: 92_683,
      rateCoins: 10,
      rateSen: 8,
      enabled: true,
      cashValue: 741.46,
    })
    expect(d.banks).toHaveLength(25)
    expect(d.banks[0]).toBe('-- Pilih Bank --')
    expect(d.history).toEqual([])
  })

  it('admin shop: balance and no active reward', async () => {
    expect(dataOf(await get('/api/guru/gamification/shop', admin))).toEqual({
      balance: 92_683,
      available: 92_683,
      rewards: [],
    })
  })
})

describe('#17 teacher leaderboard', () => {
  type Lb = {
    tab: string
    rows: {
      rank: number
      userId: number
      questions: number
      syiling: number
      schoolName?: string | null
    }[]
  }

  it('admin "sekolah" lists every teacher by questions: 4201 first (3,906 / 20,720), 50 rows, no school column', async () => {
    const d = dataOf<Lb>(await get('/api/guru/gamification/leaderboard', admin))
    expect(d.tab).toBe('sekolah')
    expect(d.rows).toHaveLength(50)
    expect(d.rows[0]).toMatchObject({ rank: 1, userId: 4201, questions: 3906, syiling: 20_720 })
    expect(d.rows[1]).toMatchObject({ userId: 4202, questions: 1559, syiling: 0 })
    expect(d.rows[0]).not.toHaveProperty('schoolName')
    const q = d.rows.map((r) => r.questions)
    expect(q).toEqual([...q].sort((a, b) => b - a))
  })

  it('"global" carries the school column; an unknown tab is "sekolah"', async () => {
    const g = dataOf<Lb>(await get('/api/guru/gamification/leaderboard', admin, { tab: 'global' }))
    expect(g.tab).toBe('global')
    expect(g.rows[0]).toHaveProperty('schoolName')
    const u = dataOf<Lb>(await get('/api/guru/gamification/leaderboard', admin, { tab: 'zzz' }))
    expect(u.tab).toBe('sekolah')
    expect(u.rows[0]).not.toHaveProperty('schoolName')
  })

  it('a teacher sees her own school only (BR-M14-28)', async () => {
    const d = dataOf<Lb>(await get('/api/guru/gamification/leaderboard', guru))
    expect(d.rows.some((r) => r.userId === 5)).toBe(true)
    expect(d.rows.some((r) => r.userId === 4201)).toBe(false)
  })
})

// ---------------------------------------------------------------------------------------------
// Admin reads #18–#19, #23, #28, #30, #31, #36, #38, #40
// ---------------------------------------------------------------------------------------------

describe('#18 overview', () => {
  it('the six cards are the named queries of §6.10', async () => {
    const d = dataOf<{
      cards: Record<string, number>
      tierDistribution: {
        key: string
        count: number
        pct: number
        widthPct: number
        color: string
      }[]
      top10: { rank: number; totalSyilingEarned: number; name: string }[]
      recent: { name: string; type: string; source: string }[]
    }>(await get('/api/admin/gamification/overview', admin))
    expect(d.cards).toEqual({
      activeStudents: 2255,
      syilingGenerated: 3_124_192,
      tokensConverted: 7801,
      conversions: 534,
      activeChallenges: 10,
      completedToday: 0,
    })
    expect(d.tierDistribution.map((t) => [t.key, t.count])).toEqual([
      ['bronze', 1889],
      ['gold', 41],
      ['platinum', 33],
      ['silver', 292],
    ])
    expect(d.tierDistribution.map((t) => t.pct)).toEqual([84, 2, 1, 13])
    expect(d.tierDistribution[0]?.widthPct).toBeCloseTo((1889 / 2255) * 100, 1)
    expect(d.top10).toHaveLength(10)
    expect(d.top10[0]).toMatchObject({ rank: 1, totalSyilingEarned: 1_018_083 })
    expect(d.recent).toHaveLength(10)
    expect(d.recent.every((r) => r.name !== '')).toBe(true)
  })
})

describe('#19 / #23 catalogues', () => {
  it('4 tiers as seeded; 10 challenges by (sortOrder, id) without the internal metric', async () => {
    const tiers = dataOf<
      {
        id: number
        tierName: string
        minSyiling: number
        conversionRate: number
        isActive: boolean
      }[]
    >(await get('/api/admin/gamification/tiers', admin))
    expect(tiers.map((t) => [t.tierName, t.minSyiling, t.conversionRate, t.isActive])).toEqual([
      ['bronze', 0, 50, true],
      ['silver', 500, 40, true],
      ['gold', 2000, 30, true],
      ['platinum', 5000, 20, true],
    ])
    const ch = dataOf<{ id: number; title: string }[]>(
      await get('/api/admin/gamification/challenges', admin),
    )
    expect(ch).toHaveLength(10)
    expect(ch[0]).not.toHaveProperty('metric')
    expect(ch.map((c) => c.id)).toContain(10)
  })
})

describe('#28 students', () => {
  type Page = {
    data: {
      userId: number
      name: string
      email: string
      tierKey: string
      tierColor: string
      level: number
      totalSyilingEarned: number
      tokenBalance: number
    }[]
    meta: {
      page: number
      pageSize: number
      totalItems: number
      totalPages: number
      from: number | null
      to: number | null
    }
  }
  const page = async (query: Record<string, string | number> = {}) =>
    (await get('/api/admin/gamification/students', admin, query)).body as Page

  it('page 1: 20 rows by lifetime, "of 2255", 113 pages', async () => {
    const p = await page()
    expect(p.meta).toMatchObject({
      page: 1,
      pageSize: 20,
      totalItems: 2255,
      totalPages: 113,
      from: 1,
      to: 20,
    })
    expect(p.data).toHaveLength(20)
    expect(p.data[0]).toMatchObject({
      userId: 4001,
      tierKey: 'platinum',
      tierColor: '#e5e4e2',
      totalSyilingEarned: 1_018_083,
    })
    expect(p.data[0]?.email).toContain('@')
  })

  it('page 113 holds the last 15 rows ending with 4108 (S4 row 2255)', async () => {
    const p = await page({ page: 113 })
    expect(p.data).toHaveLength(15)
    expect(p.data.at(-1)?.userId).toBe(4108)
    expect(p.meta).toMatchObject({ from: 2241, to: 2255 })
    const beyond = await page({ page: 999 })
    expect(beyond.data).toEqual([])
    expect(beyond.meta.page).toBe(999)
  })

  it('tier filter counts, name search, empty search, and the DV-M14-14 sorts', async () => {
    expect((await page({ tier: 'gold' })).meta.totalItems).toBe(41)
    expect((await page({ tier: 'platinum' })).meta.totalItems).toBe(33)
    expect((await page({ tier: 'zzz' })).meta.totalItems).toBe(0)
    const name = (await page()).data[0]?.name as string
    const found = await page({ search: name })
    expect(found.data.map((r) => r.userId)).toContain(4001)
    const none = await page({ search: 'zzzzzzzzzz' })
    expect(none.data).toEqual([])
    expect(none.meta.totalItems).toBe(0)
    const byLevel = (await page({ sort: 'level' })).data.map((r) => r.level)
    expect(byLevel).toEqual([...byLevel].sort((a, b) => b - a))
    const byTokens = (await page({ sort: 'token_balance' })).data.map((r) => r.tokenBalance)
    expect(byTokens).toEqual([...byTokens].sort((a, b) => b - a))
    expect((await page({ sort: 'zzz' })).data[0]?.userId).toBe(4001)
  })
})

describe('#30 transactions', () => {
  type Page = {
    data: {
      id: number
      userId: number
      name: string
      type: string
      amount: number
      description: string
      createdAt: string
    }[]
    meta: {
      pageSize: number
      totalItems: number
      totalPages: number
      from: number | null
      to: number | null
      page: number
    }
  }
  const page = async (query: Record<string, string | number> = {}) =>
    (await get('/api/admin/gamification/transactions', admin, query)).body as Page

  it('52,964 rows, 25 a page, newest first from #53668', async () => {
    const p = await page()
    expect(p.meta).toMatchObject({ pageSize: 25, totalItems: 52_964, totalPages: 2119 })
    expect(p.data[0]).toMatchObject({ id: 53_668 })
    expect(p.data[0]?.name).not.toBe('')
    expect((await page({ page: 2119 })).data).toHaveLength(14)
  })

  it('type totals: convert 535, spend 1, bonus 2, refund 0; an unknown type lists nothing', async () => {
    expect((await page({ type: 'convert' })).meta.totalItems).toBe(535)
    expect((await page({ type: 'spend' })).meta.totalItems).toBe(1)
    expect((await page({ type: 'bonus' })).meta.totalItems).toBe(2)
    expect((await page({ type: 'refund' })).meta.totalItems).toBe(0)
    expect((await page({ type: 'zzz' })).data).toEqual([])
  })

  it('dates are inclusive; a malformed date is ignored', async () => {
    const day = await page({ dateFrom: '2026-05-19', dateTo: '2026-05-19' })
    expect(day.meta.totalItems).toBeGreaterThanOrEqual(3)
    expect(day.data.every((r) => r.createdAt.startsWith('2026-05-19'))).toBe(true)
    // the first admin row (11/02/2026 05:23) is inside an inclusive "to" of that day, not of the day before
    expect((await page({ dateTo: '2026-02-10' })).meta.totalItems).toBe(0)
    expect((await page({ dateTo: '2026-02-11' })).meta.totalItems).toBeGreaterThanOrEqual(1)
    expect((await page({ dateFrom: 'nope' })).meta.totalItems).toBe(52_964)
  })
})

describe('#31 / #36 / #38 / #40 admin reads', () => {
  it('#31: 8 badges, no reward yet, 2 pending cash requests', async () => {
    const d = dataOf<{
      cards: Record<string, number>
      pendingCash: number
      badges: unknown[]
      rewards: unknown[]
    }>(await get('/api/admin/gamification/guru', admin))
    expect(d.cards).toEqual({ rewards: 0, activeRewards: 0, badges: 8, pendingRedemptions: 0 })
    expect(d.pendingCash).toBe(2)
    expect(d.badges).toHaveLength(8)
    expect(d.rewards).toEqual([])
  })

  it('#36: the two PENDING requests, newest first, bank data masked everywhere', async () => {
    const res = await get('/api/admin/gamification/guru/cash', admin)
    const d = dataOf<{ cards: Record<string, number>; rows: Record<string, unknown>[] }>(res)
    expect(d.cards).toEqual({ pending: 2, approved: 0, paid: 0, paidTotal: 0 })
    expect(d.rows.map((r) => r.id)).toEqual([2, 1])
    expect(d.rows[0]).toMatchObject({
      userId: 4207,
      coins: 18_140,
      cash: 145.12,
      bankName: 'Bank Rakyat',
      bankAccountMasked: '•••100',
      status: 'PENDING',
    })
    expect(d.rows[1]).toMatchObject({
      userId: 4208,
      coins: 163_445,
      cash: 1307.56,
      bankAccountMasked: '•••819',
    })
    const text = JSON.stringify(res.body)
    expect(text).not.toContain('2201 7788')
    expect(text).not.toContain('5140 2233')
    expect(text).not.toContain('Tunai Satu')
    expect(text).not.toContain('Tunai Dua')
    expect(
      dataOf<{ rows: unknown[] }>(
        await get('/api/admin/gamification/guru/cash', admin, { status: 'all' }),
      ).rows,
    ).toHaveLength(2)
    expect(
      dataOf<{ rows: unknown[] }>(
        await get('/api/admin/gamification/guru/cash', admin, { status: 'PAID' }),
      ).rows,
    ).toHaveLength(0)
  })

  it('#38: the 10 settings in the S9 order with their kinds (DV-M14-05 label)', async () => {
    const rows = dataOf<{ key: string; label: string; value: number; kind: string }[]>(
      await get('/api/admin/gamification/settings', admin),
    )
    expect(rows.map((r) => [r.key, r.value, r.kind])).toEqual([
      ['coins_per_question', 10, 'number'],
      ['cash_rate_coins', 10, 'number'],
      ['cash_rate_sen', 8, 'number'],
      ['min_cash_withdrawal', 100, 'number'],
      ['cash_withdrawal_enabled', 1, 'toggle'],
      ['reward_budget_sen_session', 1000, 'number'],
      ['reward_budget_sen_month', 300, 'number'],
      ['current_session_year', 2026, 'number'],
      ['flat_quiz_reward', 1, 'number'],
      ['games_award_syiling', 0, 'toggle'],
    ])
    expect(rows[2]?.label).toBe('Nilai sen bagi setiap unit syiling (cth: 10 syiling = 8 sen)')
  })

  it('#40: RM0.00 / 0 / 0 tiles, the five shared settings, 11 rewards with the RM equivalent, no draw', async () => {
    const d = dataOf<{
      tiles: unknown
      settings: unknown
      rewards: { id: number; costValueSen: number; costRm: number }[]
      draws: unknown[]
    }>(await get('/api/admin/reward-control', admin))
    expect(d.tiles).toEqual({ sessionYear: 2026, liabilityRm: 0, students: 0, claims: 0 })
    expect(d.settings).toEqual({
      rewardBudgetSenSession: 1000,
      rewardBudgetSenMonth: 300,
      flatQuizReward: 1,
      currentSessionYear: 2026,
      gamesAwardSyiling: 0,
    })
    expect(d.rewards).toHaveLength(11)
    expect(d.rewards[0]).toMatchObject({ id: 1, costValueSen: 1000, costRm: 10 })
    expect(d.draws).toEqual([])
  })
})

// ---------------------------------------------------------------------------------------------
// Writes: student
// ---------------------------------------------------------------------------------------------

describe('#6 convert', () => {
  it('converts 100 syiling at the gold rate 30: 3 tokens, the remainder is not refunded, lifetime unchanged', async () => {
    const before = wallet.summary(4034)
    expect(before.tier.key).toBe('gold')
    const res = await send(runtime, 'POST', '/api/gamification/convert', {
      token: gold,
      body: { syilingAmount: 100 },
    })
    expect(res.status).toBe(200)
    const d = dataOf<{
      syilingDebited: number
      tokensCredited: number
      currentSyiling: number
      tokenBalance: number
      transactionId: number
    }>(res)
    expect(d).toMatchObject({
      syilingDebited: 100,
      tokensCredited: 3,
      currentSyiling: before.currentSyiling - 100,
      tokenBalance: before.tokenBalance + 3,
    })
    const after = wallet.summary(4034)
    expect(after.totalSyilingEarned).toBe(before.totalSyilingEarned)
    expect(after.tier.key).toBe('gold')
    const row = coinLedger.get(d.transactionId)
    expect(row).toMatchObject({
      type: 'convert',
      source: 'token_conversion',
      amount: -100,
      tokens: 3,
      description: 'Tukar 100 syiling → 3 token',
      balanceAfter: after.currentSyiling,
    })
  })

  it('refuses a bad amount with 422 and changes nothing', async () => {
    const before = wallet.summary(4034)
    const rowsBefore = coinLedger.forUser(4034).length
    for (const body of [
      { syilingAmount: 10 },
      { syilingAmount: 9_999_999 },
      { syilingAmount: 31.5 },
      { syilingAmount: 'abc' },
      { syilingAmount: -30 },
      {},
    ]) {
      const res = await send(runtime, 'POST', '/api/gamification/convert', { token: gold, body })
      expect(res.status, JSON.stringify(body)).toBe(422)
      const err = (res.body as { error: { code: string; message: string } }).error
      expect(err.code).toBe('VALIDATION_ERROR')
      expect(err.message).toBe('Jumlah syiling tidak sah.')
    }
    expect(wallet.summary(4034).currentSyiling).toBe(before.currentSyiling)
    expect(coinLedger.forUser(4034)).toHaveLength(rowsBefore)
  })

  it('accepts a numeric string and the exact balance', async () => {
    const balance = wallet.summary(4034).currentSyiling
    const res = await send(runtime, 'POST', '/api/gamification/convert', {
      token: gold,
      body: { syilingAmount: String(balance) },
    })
    expect(res.status).toBe(200)
    expect(wallet.summary(4034).currentSyiling).toBe(0)
  })

  it('a refusal inside a failed request leaves the whole step undone (failNext fault)', async () => {
    wallet.setFields(4034, { syiling: 500 })
    const rows = coinLedger.forUser(4034).length
    const res = await send(runtime, 'POST', '/api/gamification/convert', {
      token: gold,
      body: { syilingAmount: 600 },
    })
    expect(res.status).toBe(422)
    expect(coinLedger.forUser(4034)).toHaveLength(rows)
    expect(wallet.summary(4034).currentSyiling).toBe(500)
  })
})

// ---------------------------------------------------------------------------------------------
// Writes: teacher
// ---------------------------------------------------------------------------------------------

describe('#14 cash request', () => {
  const body = {
    coinsAmount: 500,
    bankName: 'Maybank',
    bankAccount: '1234567890',
    accountHolder: 'Cikgu Contoh',
  }

  it('refuses a teacher without coins (422, field coinsAmount)', async () => {
    const res = await send(runtime, 'POST', '/api/guru/gamification/cash', { token: guru, body })
    expect(res.status).toBe(422)
    expect((res.body as { error: { fields: Record<string, string> } }).error.fields).toHaveProperty(
      'coinsAmount',
    )
  })

  it('creates a PENDING request: RM4.00 for 500, the account masked, the hold shown on #13', async () => {
    teacherWallet.setFields(5, { balance: 600 })
    const res = await send(runtime, 'POST', '/api/guru/gamification/cash', { token: guru, body })
    expect(res.status).toBe(201)
    const d = dataOf<Record<string, unknown>>(res)
    expect(d).toMatchObject({
      id: 3,
      coins: 500,
      cash: 4,
      bankName: 'Maybank',
      bankAccountMasked: '•••890',
      status: 'PENDING',
    })
    expect(JSON.stringify(res.body)).not.toContain('1234567890')
    expect(JSON.stringify(res.body)).not.toContain('Cikgu Contoh')
    const view = dataOf<{
      held: number
      available: number
      history: { id: number; status: string }[]
    }>(await get('/api/guru/gamification/cash', guru))
    expect(view).toMatchObject({ held: 500, available: 100 })
    expect(view.history.map((h) => [h.id, h.status])).toEqual([[3, 'PENDING']])
  })

  it('refuses below the minimum, above the available coins, and a missing or unknown bank field', async () => {
    const post = (b: object) =>
      send(runtime, 'POST', '/api/guru/gamification/cash', { token: guru, body: b })
    expect((await post({ ...body, coinsAmount: 50 })).status).toBe(422)
    expect((await post({ ...body, coinsAmount: 200 })).status).toBe(422)
    const noBank = await post({ ...body, bankName: '' })
    expect(
      (noBank.body as { error: { fields: Record<string, string> } }).error.fields,
    ).toHaveProperty('bankName')
    expect((await post({ ...body, bankName: '-- Pilih Bank --' })).status).toBe(422)
    expect((await post({ ...body, bankName: 'Bank Rekaan' })).status).toBe(422)
    const noHolder = await post({ ...body, accountHolder: '  ' })
    expect(
      (noHolder.body as { error: { fields: Record<string, string> } }).error.fields,
    ).toHaveProperty('accountHolder')
    expect((await post({ ...body, coinsAmount: 100.5 })).status).toBe(422)
  })

  it('403 CASH_DISABLED while the setting is off', async () => {
    settings.update([{ key: 'cash_withdrawal_enabled', value: 0 }])
    const res = await send(runtime, 'POST', '/api/guru/gamification/cash', {
      token: guru,
      body: { ...body, coinsAmount: 100 },
    })
    expect(res.status).toBe(403)
    expect((res.body as { error: { code: string } }).error.code).toBe('CASH_DISABLED')
    settings.update([{ key: 'cash_withdrawal_enabled', value: 1 }])
  })
})

// ---------------------------------------------------------------------------------------------
// Writes: admin economy (S2, S3, S4)
// ---------------------------------------------------------------------------------------------

const TIER_BODY = {
  labelMs: 'Gangsa',
  icon: '🥉',
  color: '#cd7f32',
  minSyiling: 0,
  conversionRate: 50,
  sortOrder: 1,
  quizRewardL1: 1,
  quizRewardL2: 2,
  quizRewardL3: 3,
  quizRewardL4: 4,
  quizRewardL5: 5,
  pkskRewardCorrect: 5,
  boardGameRewardCorrect: 5,
  boardGameRewardWin: 25,
}

describe('#20 – #22 tiers', () => {
  const put = (id: number, body: unknown, token = admin) =>
    send(runtime, 'PUT', `/api/admin/gamification/tiers/${String(id)}`, { token, body })

  it('#20 saves a tier, keeps the perks when none are posted, and restores', async () => {
    const res = await put(1, { ...TIER_BODY, labelMs: 'Gangsa Baru', quizRewardL1: 2 })
    expect(res.status).toBe(200)
    expect(dataOf(res)).toMatchObject({
      id: 1,
      labelMs: 'Gangsa Baru',
      quizRewardL1: 2,
      perks: ['Akses asas hadiah', 'Ganjaran kuiz standard', 'Profil asas'],
    })
    const withPerks = await put(1, { ...TIER_BODY, perks: JSON.stringify(['Satu']) })
    expect(dataOf<{ perks: string[] }>(withPerks).perks).toEqual(['Satu'])
    await put(1, {
      ...TIER_BODY,
      perks: ['Akses asas hadiah', 'Ganjaran kuiz standard', 'Profil asas'],
    })
  })

  it('#20 validates every field (V-M14-02) and answers 404 for an unknown tier', async () => {
    const bad = await put(1, {
      ...TIER_BODY,
      quizRewardL1: undefined,
      labelMs: '',
      conversionRate: 0,
      color: 'red',
      boardGameRewardWin: -1,
    })
    expect(bad.status).toBe(422)
    const fields = (bad.body as { error: { fields: Record<string, string> } }).error.fields
    expect(Object.keys(fields).sort()).toEqual([
      'boardGameRewardWin',
      'color',
      'conversionRate',
      'labelMs',
      'quizRewardL1',
    ])
    expect((await put(999, TIER_BODY)).status).toBe(404)
    expect(
      (
        await send(runtime, 'PUT', '/api/admin/gamification/tiers/abc', {
          token: admin,
          body: TIER_BODY,
        })
      ).status,
    ).toBe(404)
  })

  it('#21 toggles a tier; the holders keep their tier; the student grids lose it', async () => {
    const off = await send(runtime, 'POST', '/api/admin/gamification/tiers/4/toggle', {
      token: admin,
    })
    expect(dataOf(off)).toEqual({ isActive: false })
    expect(wallet.summary(4001).tier.key).toBe('platinum')
    const grid = dataOf<{ tiers: unknown[] }>(await get('/api/gamification/convert', admin)).tiers
    expect(grid).toHaveLength(3)
    const on = await send(runtime, 'POST', '/api/admin/gamification/tiers/4/toggle', {
      token: admin,
    })
    expect(dataOf(on)).toEqual({ isActive: true })
    expect(
      (await send(runtime, 'POST', '/api/admin/gamification/tiers/99/toggle', { token: admin }))
        .status,
    ).toBe(404)
  })

  it('#22 creates a tier (lower-case key, perks as one text), refuses a duplicate name, then it is switched off', async () => {
    const body = {
      ...TIER_BODY,
      tierName: 'Diamond',
      labelMs: 'Berlian',
      icon: '💎',
      color: undefined,
      minSyiling: 10_000,
      conversionRate: 15,
      sortOrder: 5,
      perks: 'Bonus 2x XP',
    }
    const res = await send(runtime, 'POST', '/api/admin/gamification/tiers', { token: admin, body })
    expect(res.status).toBe(201)
    const tier = dataOf<{
      id: number
      tierName: string
      perks: string[]
      color: string
      isActive: boolean
    }>(res)
    expect(tier).toMatchObject({
      tierName: 'diamond',
      perks: ['Bonus 2x XP'],
      color: '#3b82f6',
      isActive: true,
    })
    const dup = await send(runtime, 'POST', '/api/admin/gamification/tiers', { token: admin, body })
    expect(dup.status).toBe(422)
    expect((dup.body as { error: { fields: Record<string, string> } }).error.fields.tierName).toBe(
      'Nama tier sudah wujud.',
    )
    const noName = await send(runtime, 'POST', '/api/admin/gamification/tiers', {
      token: admin,
      body: { ...body, tierName: 'bad name!' },
    })
    expect(noName.status).toBe(422)
    await send(runtime, 'POST', `/api/admin/gamification/tiers/${String(tier.id)}/toggle`, {
      token: admin,
    })
  })
})

const CHALLENGE_BODY = {
  title: 'Cabaran Uji',
  description: 'Selesaikan 2 kuiz',
  icon: '📝',
  challengeType: 'quiz_count',
  targetValue: 2,
  rewardSyiling: 10,
  rewardXp: 5,
  difficulty: 'easy',
  sortOrder: 10,
}

describe('#24 – #27 challenges', () => {
  it('#27 creates (defaults of the add form), #24 edits, #25 toggles (S13 denominator), #26 deletes', async () => {
    const created = await send(runtime, 'POST', '/api/admin/gamification/challenges', {
      token: admin,
      body: CHALLENGE_BODY,
    })
    expect(created.status).toBe(201)
    const c = dataOf<{ id: number; isActive: boolean }>(created)
    expect(c).toMatchObject({ id: 11, isActive: true, title: 'Cabaran Uji' })
    expect(c).not.toHaveProperty('metric')
    expect(dataOf<unknown[]>(await get('/api/admin/gamification/challenges', admin))).toHaveLength(
      11,
    )
    expect(
      await get('/api/gamification/challenges', admin).then(
        (r) => (r.body as { meta: { active: number } }).meta.active,
      ),
    ).toBe(11)

    const edited = await send(runtime, 'PUT', '/api/admin/gamification/challenges/11', {
      token: admin,
      body: {
        ...CHALLENGE_BODY,
        title: 'Cabaran Ubah',
        challengeType: 'accuracy',
        targetValue: 90,
      },
    })
    expect(dataOf(edited)).toMatchObject({
      title: 'Cabaran Ubah',
      challengeType: 'accuracy',
      targetValue: 90,
    })

    const off = await send(runtime, 'POST', '/api/admin/gamification/challenges/11/toggle', {
      token: admin,
    })
    expect(dataOf(off)).toEqual({ isActive: false })
    expect(
      await get('/api/gamification/challenges', admin).then(
        (r) => (r.body as { meta: { active: number } }).meta.active,
      ),
    ).toBe(10)

    const del = await send(runtime, 'DELETE', '/api/admin/gamification/challenges/11', {
      token: admin,
    })
    expect(dataOf(del)).toEqual({ deleted: 1 })
    expect(
      (await send(runtime, 'DELETE', '/api/admin/gamification/challenges/11', { token: admin }))
        .status,
    ).toBe(404)
    expect(dataOf<unknown[]>(await get('/api/admin/gamification/challenges', admin))).toHaveLength(
      10,
    )
  })

  it('every field is required (V-M14-04); an unknown type or difficulty and a zero target are refused', async () => {
    const post = (b: object) =>
      send(runtime, 'POST', '/api/admin/gamification/challenges', { token: admin, body: b })
    const empty = await post({})
    expect(Object.keys((empty.body as { error: { fields: object } }).error.fields)).toHaveLength(9)
    expect((await post({ ...CHALLENGE_BODY, challengeType: 'zzz' })).status).toBe(422)
    expect((await post({ ...CHALLENGE_BODY, difficulty: 'sukar' })).status).toBe(422)
    expect((await post({ ...CHALLENGE_BODY, targetValue: 0 })).status).toBe(422)
    expect(
      (
        await send(runtime, 'PUT', '/api/admin/gamification/challenges/999', {
          token: admin,
          body: CHALLENGE_BODY,
        })
      ).status,
    ).toBe(404)
    expect(
      (
        await send(runtime, 'POST', '/api/admin/gamification/challenges/999/toggle', {
          token: admin,
        })
      ).status,
    ).toBe(404)
  })
})

describe('#29 award', () => {
  const award = (body: unknown) =>
    send(runtime, 'POST', '/api/admin/gamification/award', { token: admin, body })

  it('credits a `bonus` row `admin_award` with the reason as the description; the tier follows', async () => {
    const before = wallet.summary(4093)
    const res = await award({ userId: 4093, amount: 2000, reason: 'Bonus khas' })
    expect(res.status).toBe(200)
    const d = dataOf<{ userId: number; currentSyiling: number; transactionId: number }>(res)
    expect(d).toMatchObject({ userId: 4093, currentSyiling: before.currentSyiling + 2000 })
    expect(coinLedger.get(d.transactionId)).toMatchObject({
      type: 'bonus',
      source: 'admin_award',
      description: 'Bonus khas',
      amount: 2000,
    })
    expect(wallet.summary(4093)).toMatchObject({
      totalSyilingEarned: before.totalSyilingEarned + 2000,
      tier: { key: 'gold' },
    })
  })

  it('refuses a range, reason or id problem with 422 and an unknown user with 404', async () => {
    for (const body of [
      { userId: 4093, amount: 0, reason: 'x' },
      { userId: 4093, amount: 10_001, reason: 'x' },
      { userId: 4093, amount: 1.5, reason: 'x' },
      { userId: 4093, amount: 5, reason: '   ' },
      { userId: 4093, amount: 5, reason: 'x'.repeat(256) },
      { amount: 5, reason: 'x' },
      { userId: 'abc', amount: 5, reason: 'x' },
    ]) {
      expect((await award(body)).status, JSON.stringify(body)).toBe(422)
    }
    const none = await award({ userId: 99_999_999, amount: 5, reason: 'x' })
    expect(none.status).toBe(404)
    expect((none.body as { error: { message: string } }).error.message).toBe(
      'Pengguna tidak dijumpai.',
    )
    expect((await award({ userId: 4093, amount: 10_000, reason: 'Had atas' })).status).toBe(200)
  })
})

// ---------------------------------------------------------------------------------------------
// Writes: admin teacher side (S6, S7, S8), settings (S9), reward control (S10)
// ---------------------------------------------------------------------------------------------

describe('#32 badge edit', () => {
  it('saves, validates (name, threshold ≥ 1, bonus ≥ 0), 404 for an unknown badge, then restores', async () => {
    const put = (id: number, body: unknown) =>
      send(runtime, 'PUT', `/api/admin/gamification/guru/badges/${String(id)}`, {
        token: admin,
        body,
      })
    const badges = dataOf<{
      badges: { id: number; name: string; icon: string; threshold: number; bonusCoins: number }[]
    }>(await get('/api/admin/gamification/guru', admin)).badges
    const last = badges.at(-1) as (typeof badges)[number]
    const ok = await put(last.id, {
      name: 'Legenda Baru',
      icon: last.icon,
      threshold: 60_000,
      bonusCoins: 300_000,
      isActive: false,
    })
    expect(dataOf(ok)).toMatchObject({
      name: 'Legenda Baru',
      threshold: 60_000,
      bonusCoins: 300_000,
      isActive: false,
    })
    expect((await put(last.id, { name: '', threshold: 0, bonusCoins: -1 })).status).toBe(422)
    expect((await put(999, { name: 'x', threshold: 1, bonusCoins: 0 })).status).toBe(404)
    await put(last.id, {
      name: last.name,
      icon: last.icon,
      threshold: last.threshold,
      bonusCoins: last.bonusCoins,
      isActive: true,
    })
  })
})

describe('#33 – #35 teacher rewards and redemptions', () => {
  it('#33 creates a reward from multipart-style fields; the image stays a mock reference', async () => {
    const res = await send(runtime, 'POST', '/api/admin/gamification/guru/rewards', {
      token: admin,
      body: {
        name: 'Baucar Buku RM20',
        category: 'voucher',
        costCoins: '200',
        stock: '5',
        maxPerUser: '1',
        description: 'Baucar',
        isActive: '1',
        image: { name: 'baucar.png', size: 1000, type: 'image/png' },
      },
    })
    expect(res.status).toBe(201)
    expect(dataOf(res)).toMatchObject({
      id: 1,
      name: 'Baucar Buku RM20',
      category: 'voucher',
      costCoins: 200,
      stock: 5,
      maxPerUser: 1,
      maxPerMonth: null,
      imageUrl: 'blob:mock/m14-teacher-rewards/baucar.png',
      isActive: true,
    })
    expect(teacherRewards.list({ activeOnly: true })).toHaveLength(1)
  })

  it('#33 refuses a bad category, cost, stock or a non-image file', async () => {
    const post = (b: object) =>
      send(runtime, 'POST', '/api/admin/gamification/guru/rewards', { token: admin, body: b })
    const ok = { name: 'Hadiah', category: 'general', costCoins: 10 }
    expect((await post({ ...ok, category: 'zzz' })).status).toBe(422)
    expect((await post({ ...ok, costCoins: 0 })).status).toBe(422)
    expect((await post({ ...ok, stock: -1 })).status).toBe(422)
    expect((await post({ ...ok, maxPerUser: 0 })).status).toBe(422)
    expect((await post({ ...ok, name: '' })).status).toBe(422)
    const bad = await post({ ...ok, image: { name: 'x.txt', size: 5, type: 'text/plain' } })
    expect(bad.status).toBe(422)
    expect((bad.body as { error: { fields: Record<string, string> } }).error.fields).toHaveProperty(
      'image',
    )
    expect(teacherRewards.list()).toHaveLength(1)
  })

  it('S19 / S21 list the active reward; #16 redeems it once (PENDING, holds the cost) and refuses the rest', async () => {
    expect(
      dataOf<{ catalogue: unknown[] }>(await get('/api/guru/gamification', admin)).catalogue,
    ).toHaveLength(1)
    expect(
      dataOf<{ rewards: unknown[] }>(await get('/api/guru/gamification/shop', admin)).rewards,
    ).toHaveLength(1)
    const res = await send(runtime, 'POST', '/api/guru/gamification/shop/1/redeem', {
      token: admin,
    })
    expect(res.status).toBe(201)
    expect(dataOf(res)).toMatchObject({
      id: 1,
      rewardId: 1,
      costCoins: 200,
      status: 'PENDING',
      rewardName: 'Baucar Buku RM20',
    })
    const again = await send(runtime, 'POST', '/api/guru/gamification/shop/1/redeem', {
      token: admin,
    })
    expect(again.status).toBe(409)
    expect((again.body as { error: { code: string } }).error.code).toBe('LIMIT_REACHED')
    expect(
      (await send(runtime, 'POST', '/api/guru/gamification/shop/999/redeem', { token: admin }))
        .status,
    ).toBe(404)
    const broke = await send(runtime, 'POST', '/api/guru/gamification/shop/1/redeem', {
      token: guru,
    })
    expect(broke.status).toBe(409)
    expect((broke.body as { error: { code: string } }).error.code).toBe('INSUFFICIENT_BALANCE')
    expect(
      dataOf<{ available: number }>(await get('/api/guru/gamification/shop', admin)).available,
    ).toBe(92_683 - 200)
  })

  it('#34 lists by status (default PENDING), #35 delivers: debit "Tebusan: …", stock 5 → 4; a bad status is 422', async () => {
    const pending = dataOf<{ id: number; userName: string; rewardName: string }[]>(
      await get('/api/admin/gamification/guru/redemptions', admin),
    )
    expect(pending.map((r) => r.id)).toEqual([1])
    expect(pending[0]?.userName).not.toBe('')
    expect(
      dataOf<unknown[]>(
        await get('/api/admin/gamification/guru/redemptions', admin, { status: 'DELIVERED' }),
      ),
    ).toHaveLength(0)
    expect(
      dataOf<unknown[]>(
        await get('/api/admin/gamification/guru/redemptions', admin, { status: 'all' }),
      ),
    ).toHaveLength(1)
    expect(
      dataOf<unknown[]>(
        await get('/api/admin/gamification/guru/redemptions', admin, { status: 'zzz' }),
      ),
    ).toHaveLength(0)

    const done = await send(runtime, 'PATCH', '/api/admin/gamification/guru/redemptions/1', {
      token: admin,
      body: { status: 'DELIVERED' },
    })
    expect(dataOf(done)).toMatchObject({ id: 1, status: 'DELIVERED' })
    const s = teacherWallet.summary(1)
    expect(s.balance).toBe(92_683 - 200)
    expect(s.transactions[0]).toMatchObject({
      description: 'Tebusan: Baucar Buku RM20',
      amount: -200,
    })
    expect(teacherRewards.list()[0]?.stock).toBe(4)
    expect(
      (
        await send(runtime, 'PATCH', '/api/admin/gamification/guru/redemptions/1', {
          token: admin,
          body: { status: 'NOPE' },
        })
      ).status,
    ).toBe(422)
    expect(
      (
        await send(runtime, 'PATCH', '/api/admin/gamification/guru/redemptions/99', {
          token: admin,
          body: { status: 'CANCELLED' },
        })
      ).status,
    ).toBe(404)
    expect(
      dataOf<{ cards: { pendingRedemptions: number; rewards: number } }>(
        await get('/api/admin/gamification/guru', admin),
      ).cards,
    ).toMatchObject({ rewards: 1, pendingRedemptions: 0 })
  })
})

describe('#37 cash status', () => {
  const patch = (id: number, body: unknown) =>
    send(runtime, 'PATCH', `/api/admin/gamification/guru/cash/${String(id)}`, {
      token: admin,
      body,
    })

  it('PAID debits the teacher once, a second PAID writes nothing, leaving PAID credits back (REJECTED)', async () => {
    const start = teacherWallet.summary(4207).balance
    expect(start).toBe(18_140)
    const paid = await patch(2, { status: 'PAID', adminNote: 'Dibayar 25/09' })
    expect(dataOf(paid)).toMatchObject({
      id: 2,
      status: 'PAID',
      adminNote: 'Dibayar 25/09',
      name: expect.any(String),
    })
    expect(teacherWallet.summary(4207)).toMatchObject({ balance: 0 })
    expect(teacherWallet.summary(4207).transactions[0]).toMatchObject({
      description: 'Tebus Tunai #2',
      amount: -18_140,
    })
    await patch(2, { status: 'PAID' })
    expect(
      teacherWallet.summary(4207).transactions.filter((t) => t.description === 'Tebus Tunai #2'),
    ).toHaveLength(1)
    const cards = dataOf<{ cards: { paid: number; paidTotal: number; pending: number } }>(
      await get('/api/admin/gamification/guru/cash', admin),
    ).cards
    expect(cards).toMatchObject({ paid: 1, paidTotal: 145.12, pending: 2 })
    const rejected = await patch(2, { status: 'REJECTED', adminNote: '' })
    expect(dataOf(rejected)).toMatchObject({ status: 'REJECTED', adminNote: null })
    expect(teacherWallet.summary(4207).balance).toBe(18_140)
    expect(teacherWallet.summary(4207).transactions[0]).toMatchObject({
      description: 'Tebus Tunai #2 dibatalkan',
      amount: 18_140,
    })
    await patch(2, { status: 'PENDING' })
  })

  it('refuses an unknown status (422) and an unknown request (404)', async () => {
    expect((await patch(1, { status: 'DONE' })).status).toBe(422)
    expect((await patch(1, {})).status).toBe(422)
    expect((await patch(99, { status: 'PAID' })).status).toBe(404)
  })

  it('cash requests of the teacher mirror (#14, id 3) are listed by #36 with their name', async () => {
    const rows = dataOf<{ rows: { id: number; name: string }[] }>(
      await get('/api/admin/gamification/guru/cash', admin, { status: 'all' }),
    ).rows
    expect(rows.map((r) => r.id)).toEqual([3, 2, 1])
    expect(rows.every((r) => r.name !== '')).toBe(true)
  })
})

describe('#39 / #41 settings', () => {
  const putS = (body: unknown) =>
    send(runtime, 'PUT', '/api/admin/gamification/settings', { token: admin, body })
  const value = (key: string) => settings.get(key as Parameters<typeof settings.get>[0])

  it('#39 changes only the posted keys; a bad save changes nothing at all', async () => {
    const ok = await putS({ settings: [{ key: 'coins_per_question', value: 12 }] })
    expect(ok.status).toBe(200)
    expect(
      dataOf<{ key: string; value: number }[]>(ok).find((r) => r.key === 'coins_per_question')
        ?.value,
    ).toBe(12)
    expect(value('cash_rate_sen')).toBe(8)
    for (const body of [
      {
        settings: [
          { key: 'coins_per_question', value: 99 },
          { key: 'no_such_key', value: 1 },
        ],
      },
      {
        settings: [
          { key: 'coins_per_question', value: 99 },
          { key: 'cash_rate_sen', value: -1 },
        ],
      },
      { settings: [{ key: 'cash_withdrawal_enabled', value: 2 }] },
      { settings: [{ key: 'coins_per_question', value: 'abc' }] },
      { settings: [{ value: 1 }] },
      { settings: [] },
      {},
    ]) {
      expect((await putS(body)).status, JSON.stringify(body)).toBe(422)
    }
    expect(value('coins_per_question')).toBe(12)
    await putS({ settings: [{ key: 'coins_per_question', value: 10 }] })
  })

  it('#41 saves the five shared keys (camelCase or snake_case); S9 sees them; bad values are 422', async () => {
    const put = (body: unknown) =>
      send(runtime, 'PUT', '/api/admin/reward-control/settings', { token: admin, body })
    const res = await put({ flatQuizReward: 2, gamesAwardSyiling: 1 })
    expect(dataOf(res)).toMatchObject({
      flatQuizReward: 2,
      gamesAwardSyiling: 1,
      rewardBudgetSenSession: 1000,
    })
    expect(value('flat_quiz_reward')).toBe(2)
    expect(value('games_award_syiling')).toBe(1)
    expect((await put({ reward_budget_sen_month: 400 })).status).toBe(200)
    expect(value('reward_budget_sen_month')).toBe(400)
    expect((await put({ flatQuizReward: -1 })).status).toBe(422)
    expect((await put({ gamesAwardSyiling: 5 })).status).toBe(422)
    expect((await put({})).status).toBe(422)
    expect(value('flat_quiz_reward')).toBe(2)
    await put({ flatQuizReward: 1, gamesAwardSyiling: 0, rewardBudgetSenMonth: 300 })
    expect(
      dataOf<{ settings: unknown }>(await get('/api/admin/reward-control', admin)).settings,
    ).toMatchObject({ flatQuizReward: 1, gamesAwardSyiling: 0, rewardBudgetSenMonth: 300 })
  })
})

describe('#42 reward cost / #43 draw', () => {
  it('#42 saves the real cost; RM follows; negative is 422; unknown is 404', async () => {
    const put = (id: number, body: unknown) =>
      send(runtime, 'PUT', `/api/admin/reward-control/rewards/${String(id)}/cost`, {
        token: admin,
        body,
      })
    expect(dataOf(await put(7, { costValueSen: 250 }))).toMatchObject({
      id: 7,
      costValueSen: 250,
      costRm: 2.5,
    })
    expect((await put(7, { costValueSen: -1 })).status).toBe(422)
    expect((await put(7, { costValueSen: 'x' })).status).toBe(422)
    expect((await put(99, { costValueSen: 1 })).status).toBe(404)
    await put(7, { costValueSen: 0 })
  })

  it('#43 creates an open draw ("Buka serta-merta") or a draft; invalid JSON, a missing title and a bad date are 422', async () => {
    const post = (b: object) =>
      send(runtime, 'POST', '/api/admin/reward-control/draws', { token: admin, body: b })
    const base = { title: 'Cabutan Uji', ticketCostSyiling: 50, maxTicketsPerStudent: 10 }
    const open = await post({
      ...base,
      prizePool: '[{"label":"Baucar RM5","value_sen":500,"qty":10}]',
      closesAt: '2026-09-30',
      openNow: true,
    })
    expect(open.status).toBe(201)
    expect(dataOf(open)).toMatchObject({
      id: 1,
      title: 'Cabutan Uji',
      status: 'open',
      ticketsSold: 0,
      closesAt: '2026-09-30',
      prizePool: [{ label: 'Baucar RM5', valueSen: 500, qty: 10 }],
    })
    const draft = await post({
      ...base,
      title: 'Draf',
      prizePool: [{ label: 'A', valueSen: 100, qty: 1 }],
    })
    expect(dataOf(draft)).toMatchObject({
      id: 2,
      status: 'draft',
      prizePool: [{ label: 'A', valueSen: 100, qty: 1 }],
      closesAt: null,
    })
    const bad = await post({ ...base, prizePool: '[not json' })
    expect(bad.status).toBe(422)
    expect((bad.body as { error: { fields: Record<string, string> } }).error.fields.prizePool).toBe(
      'Format JSON kolam hadiah tidak sah.',
    )
    expect((await post({ ...base, prizePool: '{"a":1}' })).status).toBe(422)
    expect((await post({ ...base, prizePool: 5 })).status).toBe(422)
    expect((await post({ ...base, title: '' })).status).toBe(422)
    expect((await post({ ...base, closesAt: '30/09/2026' })).status).toBe(422)
    expect((await post({ ...base, ticketCostSyiling: 0 })).status).toBe(422)
    const list = dataOf<{ draws: { id: number }[] }>(
      await get('/api/admin/reward-control', admin),
    ).draws
    expect(list.map((d) => d.id)).toEqual([2, 1])
  })
})
