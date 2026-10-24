/**
 * F-26b: the M14 gamification store (SRS M14 v1.7 §6.10, §6.11, §7.1; build plan v1.8 F-26b
 * "Accept"). Booted with the real core, M01 (users), M02 (schools) and M14, at the project clock.
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { vi } from 'vitest'

import { toEpochMs } from '@/lib/time'
import type { MockRuntime } from '@/mock/index'
import { setUser } from '@/mock/core-data/set-user'
import { users } from '@/modules/m01-authentication/mock'

import {
  achievements,
  challenges,
  coinLedger,
  draws,
  gamification,
  learnerBadges,
  rewardControl,
  referrals,
  settings,
  streak,
  teacherCash,
  teacherGamification,
  teacherRewards,
  teacherWallet,
  wallet,
  M14Error,
} from '../../mock'
import {
  ANCHOR_4001_LIFETIME_SUM,
  isOtherModuleAnchor,
  WALLET_ANCHORS_4001,
} from '../../mock/data/wallet-anchors'
import { LEDGER_PINNED_OWNER, LIVE_LEDGER_ANCHORS } from '../../mock/data/ledger-anchors'
import { GAME_SOURCES } from '../../mock/datasets/ledger-spec'
import { GENERATED_CURVES, GENERATED_LIFETIMES } from '../../mock/datasets/wallets-spec'
import { walletsDataset } from '../../mock/datasets/wallets'
import { setPracticeReadsForTests, type PracticeReads } from '../../mock/repository/reads'
import type { SessionCompletedInput } from '../../mock/repository/engine'
import { bootM14, get, NOW, stubStorage } from './helpers'

let runtime: MockRuntime

beforeAll(async () => {
  runtime = (await bootM14()).runtime
}, 60_000)

afterAll(() => {
  vi.unstubAllGlobals()
})

const EMPTY_READS: PracticeReads = {
  sessionsOn: () => [],
  practiceSessions: () => [],
  answersOn: () => [],
  mastery: () => [],
}

function session(userId: number, over: Partial<SessionCompletedInput> = {}): SessionCompletedInput {
  const correct = over.correct ?? 6
  return {
    userId,
    sessionId: `t-${String(Math.random()).slice(2)}`,
    mode: 'random',
    correct,
    total: 10,
    timeSpent: 300,
    completedAt: '2026-09-26T09:00:00+08:00',
    pointsEarned: 10 * correct,
    ...over,
  }
}

const rowsOf = (userId: number) => coinLedger.forUser(userId).map((r) => [r.description, r.amount])

// ---------------------------------------------------------------------------------------------
// §6.10 named queries and §6.11 dataset arithmetic
// ---------------------------------------------------------------------------------------------

describe('wallets dataset (§6.11.1, §6.11.4)', () => {
  it('Q-WALLETS 2,255 and Q-TIER 1,889 / 292 / 41 / 33', () => {
    expect(wallet.count('Q-WALLETS')).toBe(2_255)
    expect(wallet.count('Q-TIER', 'bronze')).toBe(1_889)
    expect(wallet.count('Q-TIER', 'silver')).toBe(292)
    expect(wallet.count('Q-TIER', 'gold')).toBe(41)
    expect(wallet.count('Q-TIER', 'platinum')).toBe(33)
  })

  it('Q-SYILING-DIJANA = 3,124,192 (anchors 2,565,737 + generated 558,455)', () => {
    expect(wallet.syilingGenerated()).toBe(3_124_192)
    const anchors = WALLET_ANCHORS_4001.reduce((s, w) => s + w.totalSyilingEarned, 0)
    expect(WALLET_ANCHORS_4001).toHaveLength(108)
    expect(anchors).toBe(ANCHOR_4001_LIFETIME_SUM)
    expect(anchors).toBe(2_564_844)
    expect(anchors + 256 + 370 + 267).toBe(2_565_737)
    const generated = Object.values(GENERATED_LIFETIMES).flat()
    expect(generated).toHaveLength(2_144)
    expect(generated.reduce((a, b) => a + b, 0)).toBe(558_455)
  })

  it('the 108 anchors sit at their user ids with their observed values', () => {
    for (const a of WALLET_ANCHORS_4001) expect(wallet.get(a.userId)).toEqual(a)
    expect(wallet.get(4001)).toMatchObject({
      tierKey: 'platinum',
      level: 66,
      currentSyiling: 1_018_033,
      tokenBalance: 1,
      totalSyilingEarned: 1_018_083,
      xp: 19_794,
    })
    expect(wallet.get(4076)).toMatchObject({ tokenBalance: -2, totalSyilingEarned: 567 })
  })

  it('generated rows stay in their tier bounds and never reach an observed top page', () => {
    const bounds = GENERATED_CURVES
    const rows = walletsDataset.query({}).rows.filter((w) => !walletsDataset.isAnchor(w.id))
    expect(rows).toHaveLength(2_144)
    for (const w of rows) {
      const b = bounds[w.tierKey as 'gold' | 'silver' | 'bronze']
      expect(b).not.toBeNull()
      expect(w.totalSyilingEarned).toBeGreaterThanOrEqual(b?.lo ?? 0)
      expect(w.totalSyilingEarned).toBeLessThanOrEqual(b?.hi ?? 0)
      expect(w.currentSyiling).toBeGreaterThanOrEqual(0)
      expect(w.currentSyiling).toBeLessThanOrEqual(w.totalSyilingEarned)
      expect(w.tokenBalance).toBeGreaterThanOrEqual(0)
      expect(w.tokenBalance).toBeLessThanOrEqual(50)
      expect(w.createdAt >= '2025-10-01' && w.createdAt < '2026-09-21').toBe(true)
    }
    // S4 page 1 of each tier = the anchors of §6.11.4.
    const page1 = (tier?: string) => wallet.adminList({ tier }).rows.map((w) => w.userId)
    expect(page1()).toEqual(Array.from({ length: 20 }, (_, i) => 4001 + i))
    expect(page1('platinum')).toEqual(Array.from({ length: 20 }, (_, i) => 4001 + i))
    expect(page1('gold')).toEqual(Array.from({ length: 20 }, (_, i) => 4034 + i))
    expect(page1('silver')).toEqual(Array.from({ length: 20 }, (_, i) => 4054 + i))
    expect(page1('bronze')).toEqual(Array.from({ length: 20 }, (_, i) => 4074 + i))
    // S4 page 113 = 4094–4108; S14 top 50 = anchors, #50 2,930.
    const last = wallet.adminList({ page: 113 })
    expect(last.total).toBe(2_255)
    expect(last.rows.map((w) => w.userId)).toEqual(Array.from({ length: 15 }, (_, i) => 4094 + i))
    const lb = wallet.leaderboard()
    expect(lb).toHaveLength(50)
    expect(lb[0]?.totalSyilingEarned).toBe(1_018_083)
    expect(lb[49]?.totalSyilingEarned).toBe(2_930)
    expect(lb.every((w) => walletsDataset.isAnchor(w.id))).toBe(true)
  })

  it('generated wallets belong to distinct generated M02 students (never another anchor)', () => {
    const ids = walletsDataset
      .query({})
      .rows.filter((w) => !walletsDataset.isAnchor(w.id))
      .map((w) => w.userId)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) {
      const u = users.get(id)
      expect(u?.role).toBe('student')
      expect(u?.email).toBe(`pelajar${String(id).padStart(6, '0')}@demo.test`)
    }
    for (const id of [3, 5, 11, 2008, 3001, 3201, 4201, 4301, 5001])
      expect(wallet.get(id)).toBeUndefined()
  })

  it('S4 sorts (DV-M14-14) and search', () => {
    expect(wallet.adminList({ sort: 'token_balance' }).rows[0]?.tokenBalance).toBe(1_764)
    expect(wallet.adminList({ sort: 'current_syiling' }).rows[0]?.currentSyiling).toBe(1_018_033)
    expect(wallet.adminList({ sort: 'level' }).rows[0]?.level).toBe(66)
    expect(wallet.adminList({ search: 'zzzq' }).total).toBe(0)
    expect(wallet.adminList({ search: 'murid4001@' }).rows.map((w) => w.userId)).toEqual([4001])
  })
})

describe('designed wallets (§6.11.2, §6.11.3)', () => {
  it('admin 256 / 8 / level 2 / 7 % / streak 1 (best 5)', () => {
    const s = wallet.summary(1)
    expect(s).toMatchObject({
      currentSyiling: 256,
      totalSyilingEarned: 256,
      tokenBalance: 0,
      xp: 8,
      level: 2,
      xpNeeded: 110,
      levelProgressPct: 7,
    })
    expect(s.tier.key).toBe('bronze')
    expect(s.nextTier).toMatchObject({ key: 'silver', pct: 51.2, need: 244 })
    expect(s.title).toEqual({ name: 'Permulaan', emoji: '📚' })
    expect(s.nextTitle).toMatchObject({ name: 'Pelajar', need: 44 })
    expect(s.earnedToday).toBe(0)
    expect(s.earnedThisWeek).toBe(0)
    expect(s.streak).toEqual({ current: 1, best: 5, multiplier: 1 })
    const rows = coinLedger.forUser(1)
    expect(rows).toHaveLength(14)
    expect(rows[0]).toMatchObject({
      description: 'Cabaran selesai: Penjelajah Topik',
      amount: 25,
      balanceAfter: 256,
    })
    expect(rows.at(-1)).toMatchObject({
      description: 'Cabaran Kilat: 3 betul, combo 2x',
      balanceAfter: 4,
    })
  })

  it('pelajar (2) 370 / 916 / level 1 / title Pelajar / streak 2; +198 today, +370 this week', () => {
    const s = wallet.summary(2)
    expect(s).toMatchObject({
      currentSyiling: 370,
      totalSyilingEarned: 370,
      xp: 916,
      level: 1,
      levelProgressPct: 100,
      earnedToday: 198,
      earnedThisWeek: 370,
    })
    expect(s.title.name).toBe('Pelajar')
    expect(streak.get(2)).toMatchObject({ current: 2, best: 2, lastActivityDate: '2026-09-25' })
    const rows = coinLedger.forUser(2)
    expect(rows).toHaveLength(20)
    expect(rows.map((r) => r.id).sort()).toEqual(Array.from({ length: 20 }, (_, i) => 140_101 + i))
    expect(rows[0]).toMatchObject({
      description: 'Cabaran selesai: Cabaran Kilat',
      amount: 40,
      balanceAfter: 370,
    })
    expect(rows.at(-1)).toMatchObject({
      description: 'SPM Tahun Lepas: 4 betul — 40%',
      amount: 4,
      balanceAfter: 4,
    })
    // S13 at the clock: 7/10 completed today.
    expect(challenges.today(2).completed).toBe(7)
  })

  it('pelajarmaju (4) 267 / 432 / level 3 / Permulaan / streak 3; 3 achievements', () => {
    expect(wallet.summary(4)).toMatchObject({
      currentSyiling: 267,
      totalSyilingEarned: 267,
      xp: 432,
      level: 3,
      levelProgressPct: 100,
    })
    expect(wallet.summary(4).title.name).toBe('Permulaan')
    expect(streak.get(4)).toMatchObject({ current: 3, best: 3 })
    const rows = coinLedger.forUser(4)
    expect(rows).toHaveLength(19)
    expect(
      rows
        .filter((r) => r.source === 'achievement')
        .map((r) => r.description)
        .reverse(),
    ).toEqual([
      'Pencapaian: Langkah Pertama',
      'Pencapaian: Pengumpul Syiling',
      'Pencapaian: Streak 3 Hari',
    ])
    const a = achievements.forUser(4)
    expect(a.unlocked).toBe(3)
    expect(a.items.filter((i) => i.unlocked).map((i) => i.id)).toEqual([1, 3, 5])
    expect(challenges.today(4).completed).toBe(4)
  })

  it('users without a row read the BR-M14-02 defaults and no row is created', () => {
    expect(wallet.summary(3)).toMatchObject({
      currentSyiling: 0,
      xp: 0,
      level: 1,
      levelProgressPct: 0,
      hasWallet: false,
    })
    expect(wallet.summary(3).tier.labelMs).toBe('Gangsa')
    expect(wallet.summary(3).nextTier).toMatchObject({ need: 500 })
    expect(wallet.count('Q-WALLETS')).toBe(2_255)
  })
})

describe('coinLedger dataset (§6.11.1)', () => {
  it('Q-TX 52,964 / earn 52,426 / convert 535 / spend 1 / bonus 2 / refund 0; Q-CONVERSIONS 534; tokens 7,801', () => {
    expect(coinLedger.count('Q-TX')).toBe(52_964)
    expect(coinLedger.count('Q-TX', 'earn')).toBe(52_426)
    expect(coinLedger.count('Q-TX', 'convert')).toBe(535)
    expect(coinLedger.count('Q-TX', 'spend')).toBe(1)
    expect(coinLedger.count('Q-TX', 'bonus')).toBe(2)
    expect(coinLedger.count('Q-TX', 'refund')).toBe(0)
    expect(coinLedger.count('Q-CONVERSIONS')).toBe(534)
    expect(coinLedger.tokensConverted()).toBe(7_801)
  })

  it('live-id anchors at their ids; 757 unused ids in 1–53,668; nothing after the clock', () => {
    for (const a of LIVE_LEDGER_ANCHORS) expect(coinLedger.get(a.id)).toEqual(a)
    const all = coinLedger.adminList({ pageSize: 60_000 }).rows
    const live = all.filter((r) => r.id <= 53_668)
    expect(live).toHaveLength(52_911)
    expect(53_668 - live.length).toBe(757)
    expect(all.filter((r) => r.id >= 140_001 && r.id <= 140_299)).toHaveLength(53)
    expect(all.every((r) => r.createdAt <= '2026-09-25T15:40:00+08:00')).toBe(true)
    for (const id of [53_669, 53_678]) expect(coinLedger.get(id)).toBeUndefined()
  })

  it('S5 page 1 starts #53668 … #53654; S1 recent #53668 … #53659; page 2118 and 2119', () => {
    const page1 = coinLedger.adminList({}).rows
    expect(page1.slice(0, 15).map((r) => r.id)).toEqual(
      Array.from({ length: 15 }, (_, i) => 53_668 - i),
    )
    expect(coinLedger.recent(10).map((r) => r.id)).toEqual(
      Array.from({ length: 10 }, (_, i) => 53_668 - i),
    )
    expect(page1[0]).toMatchObject({
      description: 'Streak activity (daily_login)',
      createdAt: '2026-09-25T15:29:00+08:00',
    })
    const p2118 = coinLedger.adminList({ page: 2118 }).rows.map((r) => r.id)
    expect(p2118).toEqual([
      44, 39, 38, 37, 36, 35, 34, 33, 32, 31, 30, 29, 28, 27, 26, 25, 24, 23, 22, 20, 21, 18, 19,
      17, 15,
    ])
    const p2119 = coinLedger.adminList({ page: 2119 }).rows
    expect(p2119).toHaveLength(14)
    expect(p2119.filter((r) => r.userId === 1)).toHaveLength(3)
    // Filters: spend #42; convert page 1 starts #53663; bonus #51, #44.
    expect(coinLedger.adminList({ type: 'spend' }).rows.map((r) => r.id)).toEqual([42])
    expect(coinLedger.adminList({ type: 'convert' }).rows[0]?.id).toBe(53_663)
    expect(coinLedger.adminList({ type: 'bonus' }).rows.map((r) => r.id)).toEqual([51, 44])
    expect(coinLedger.adminList({ type: 'refund' }).total).toBe(0)
  })

  it('generated attributes: game sources ≤ 2026-05-25, the legacy token_convert row on 27/02/2026, conversion amounts', () => {
    const all = coinLedger.adminList({ pageSize: 60_000 }).rows
    const games = all.filter((r) => GAME_SOURCES.includes(r.source))
    expect(games.length).toBeGreaterThan(0)
    expect(games.every((r) => r.createdAt < '2026-05-26')).toBe(true)
    const legacy = all.filter((r) => r.source === 'token_convert')
    expect(legacy).toHaveLength(1)
    expect(legacy[0]?.createdAt.slice(0, 10)).toBe('2026-02-27')
    expect(legacy[0]).toMatchObject({
      amount: -500,
      tokens: 10,
      description: 'Tukar 500 syiling → 10 token',
    })
    for (const r of all.filter((x) => x.source === 'token_conversion')) {
      const rate = -r.amount / (r.tokens ?? 1)
      expect([20, 30, 40, 50]).toContain(rate)
      expect(r.description).toBe(`Tukar ${String(-r.amount)} syiling → ${String(r.tokens)} token`)
    }
    expect(all.every((r) => r.balanceAfter >= 0)).toBe(true)
    // Generated rows never belong to 1, 2 or 4 (their ledgers reconcile).
    expect(all.filter((r) => [1, 2, 4].includes(r.userId) && r.id < 140_000)).toHaveLength(0)
  })
})

describe('owners of the observed ledger rows (review MINOR-7)', () => {
  it('a row later than the newest generated row (12:19) matches its owner balance at the clock', () => {
    const newestGenerated = '2026-09-25T12:19:00+08:00'
    const lastByUser = new Map<number, (typeof LIVE_LEDGER_ANCHORS)[number]>()
    for (const r of LIVE_LEDGER_ANCHORS) {
      const prev = lastByUser.get(r.userId)
      if (!prev || r.createdAt > prev.createdAt) lastByUser.set(r.userId, r)
    }
    const late = [...lastByUser.values()].filter((r) => r.createdAt > newestGenerated)
    expect(late.length).toBeGreaterThan(8)
    for (const r of late) {
      expect(
        wallet.get(r.userId)?.currentSyiling,
        `#${String(r.id)} (user ${String(r.userId)})`,
      ).toBe(r.balanceAfter)
      // Their ledger (observed + generated) has nothing newer than the observed row.
      expect(coinLedger.forUser(r.userId)[0]?.id).toBe(r.id)
    }
  })

  it('the bronze conversion chain #53662 / #53663 belongs to a generated bronze student (balance 1)', () => {
    const owner = coinLedger.get(53_663)?.userId as number
    expect(owner).toBe(LEDGER_PINNED_OWNER)
    expect(walletsDataset.isAnchor(owner)).toBe(false)
    expect(users.get(owner)).toMatchObject({ role: 'student' })
    expect(wallet.get(owner)).toMatchObject({ tierKey: 'bronze', currentSyiling: 1 })
    expect(wallet.get(owner)?.totalSyilingEarned).toBeGreaterThanOrEqual(401)
    expect(coinLedger.forUser(owner).map((r) => r.id)).toEqual([53_663, 53_662])
  })
})

describe('other §6.10 queries and §6.11.5 / §6.11.7 seeds', () => {
  it('challenges, finishers, achievements, referrals', () => {
    expect(challenges.count('Q-CHALLENGES-ACTIVE')).toBe(10)
    expect(gamification.dailyFinishers()).toBe(0)
    expect(achievements.count('Q-ACH-UNLOCKED', 1)).toBe(0)
    expect(achievements.forUser(1)).toMatchObject({ unlocked: 0, total: 25 })
    expect(referrals.count('Q-REFERRALS', 1)).toBe(0)
    expect(referrals.codeOf(1)).toBe('4JURJTT')
    expect(referrals.codeOf(2)).toMatch(/^[A-Z0-9]{7}$/)
    expect(referrals.stats(1)).toEqual({ referrals: 0, rewarded: 0, syilingEarned: 0 })
    expect(settings.get('flat_quiz_reward')).toBe(1)
    expect(settings.get('games_award_syiling')).toBe(0)
  })

  it('teacher side: badges 8 / 8, cash PENDING 2, rewards 0, admin S19 figures', () => {
    expect(teacherGamification.count('Q-TEACHER-BADGES')).toBe(8)
    expect(teacherGamification.count('Q-TEACHER-BADGES-ACTIVE')).toBe(8)
    expect(teacherCash.count('Q-CASH', 'PENDING')).toBe(2)
    expect(teacherCash.count('Q-CASH', 'PAID')).toBe(0)
    expect(teacherRewards.count('Q-TEACHER-REWARDS')).toBe(0)
    expect(teacherRewards.redemptionCount('PENDING')).toBe(0)
    const s = teacherWallet.summary(1)
    expect(s).toMatchObject({
      balance: 92_683,
      totalEarned: 92_683,
      questionsCount: 20_719,
      badgesEarned: 7,
      badgesActive: 8,
    })
    expect(s.nextBadge).toMatchObject({ name: 'Legenda Terulung', need: 29_281 })
    expect(s.transactions).toHaveLength(18)
    expect(s.transactions.reduce((a, t) => a + t.amount, 0)).toBe(92_683)
    expect(teacherWallet.summary(5)).toMatchObject({
      balance: 0,
      questionsCount: 1,
      badgesEarned: 0,
    })
    const cash = teacherCash.adminList('all')
    expect(cash.cards).toEqual({ pending: 2, approved: 0, paid: 0, paidTotal: 0 })
    expect(cash.rows.map((r) => r.id)).toEqual([2, 1])
    expect(cash.rows[1]).toMatchObject({
      coins: 163_445,
      cash: 1_307.56,
      bankAccountMasked: '•••819',
    })
    expect(teacherCash.view(4208)).toMatchObject({ available: 0, held: 163_445 })
    expect(teacherCash.view(1)).toMatchObject({
      balance: 92_683,
      available: 92_683,
      cashValue: 741.46,
    })
  })

  it('§6.11.5 v1.7: 5316 → 42,600, two generated teachers → 9 / 8; Σ = 63,459; S22 first rows', () => {
    const teachers = users.query('U-ROLE', { sort: 'id' }, 'teacher').rows
    const sum = teachers
      .filter(
        (t) =>
          t.isActive && !(t.schoolId !== null && t.schoolId >= 900_001 && t.schoolId <= 900_099),
      )
      .reduce((s, t) => s + (teacherWallet.get(t.id)?.balance ?? 0), 0)
    expect(sum).toBe(63_459)
    const lb = teacherWallet.leaderboard('sekolah', 1)
    expect(lb.rows).toHaveLength(50)
    expect(lb.rows.slice(0, 3).map((r) => [r.questions, r.syiling])).toEqual([
      [3_906, 20_720],
      [1_559, 0],
      [256, 0],
    ])
    // The three designed zero-question wallets (v1.7).
    expect(teacherWallet.get(5316)).toMatchObject({
      balance: 42_600,
      totalEarned: 42_600,
      questionsCount: 0,
    })
    const designed = teachers
      .filter(
        (t) =>
          t.id !== 5316 &&
          teacherWallet.get(t.id) &&
          [9, 8].includes(teacherWallet.get(t.id)?.balance ?? -1),
      )
      .map((t) => t.id)
      .sort((a, b) => b - a)
    expect(designed).toHaveLength(2)
    expect(designed.map((id) => teacherWallet.get(id)?.balance)).toEqual([9, 8])
    for (const id of designed) {
      const u = users.get(id)
      expect(u).toMatchObject({
        role: 'teacher',
        isActive: true,
        email: 'guru' + String(id).padStart(4, '0') + '@demo.test',
      })
      expect(teacherWallet.get(id)?.questionsCount).toBe(0)
    }
    // They are the two highest-id generated active teachers outside the fixture schools.
    const higher = teachers.filter(
      (t) =>
        t.isActive &&
        t.id > (designed[1] as number) &&
        !isOtherModuleAnchor(t.id) &&
        t.email === 'guru' + String(t.id).padStart(4, '0') + '@demo.test' &&
        !(t.schoolId !== null && t.schoolId >= 900_001 && t.schoolId <= 900_099),
    )
    expect(higher.map((t) => t.id)).toEqual([designed[0]])
    // 4202 stays 1,559 / 0 (<teacher:137>).
    expect(teacherWallet.get(4202)).toMatchObject({ questionsCount: 1_559, balance: 0 })
    // None of the three enters S22's 50 rows (either tab).
    for (const tab of ['sekolah', 'global']) {
      const ids = teacherWallet.leaderboard(tab, 1).rows.map((r) => r.userId)
      for (const id of [5316, ...designed]) expect(ids).not.toContain(id)
    }
  })

  it('streak anchors: KLUANG 81, BATANG PADANG 29, 2710 totalDays 13 and 4, pupil 2022 = 1', () => {
    const active = (schoolIds: number[]) =>
      streak
        .forUsers(
          schoolIds.flatMap((id) =>
            users.query('U-SCHOOL', { sort: 'id' }, id).rows.map((u) => u.id),
          ),
        )
        .filter((s) => s.current > 0)
    expect(active([8765, 8880, 2700, 3160, 8767, 8772, 2710])).toHaveLength(81)
    expect(active([7780, 1])).toHaveLength(29)
    expect(
      active([2710])
        .map((s) => s.totalDays)
        .sort((a, b) => b - a),
    ).toEqual([13, 4, 0, 0])
    expect(
      active([2710])
        .map((s) => s.current)
        .sort((a, b) => b - a),
    ).toEqual([10, 9, 7, 4])
    expect(
      active([8880])
        .slice(0, 10)
        .map((s) => `${String(s.current)}/${String(s.best)}`),
    ).toEqual(['13/16', '13/13', '12/20', '11/16', '8/14', '8/10', '7/16', '6/16', '6/12', '4/8'])
    expect(streak.get(2022).current).toBe(1)
  })

  it('learner badges (DATA-M14-20)', () => {
    expect(learnerBadges.catalogue().map((b) => b.name)).toEqual([
      'Pemula Rajin',
      'Pelajar Aktif',
      'Pengumpul',
    ])
    expect(learnerBadges.forUser(3201).map((b) => b.icon)).toEqual([
      'fa-seedling',
      'fa-running',
      'fa-coins',
    ])
    expect(learnerBadges.forUser(2)).toEqual([])
  })
})

describe('GET /api/me/gamification-summary (M14 #1)', () => {
  beforeEach(() => stubStorage())
  afterEach(() => vi.unstubAllGlobals())

  it('returns 370 / 916 / 2 for account 2 and 256 / 8 / 1 for the admin', async () => {
    const res = await get(runtime, '/api/me/gamification-summary', setUser(2).token)
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ data: { coins: 370, points: 916, streakDays: 2 } })
    const admin = await get(runtime, '/api/me/gamification-summary', setUser(1).token)
    expect(admin.body).toEqual({ data: { coins: 256, points: 8, streakDays: 1 } })
    const none = await get(runtime, '/api/me/gamification-summary', setUser(3).token)
    expect(none.body).toEqual({ data: { coins: 0, points: 0, streakDays: 0 } })
    expect((await get(runtime, '/api/me/gamification-summary')).status).toBe(401)
  })
})

// ---------------------------------------------------------------------------------------------
// Runtime rules
// ---------------------------------------------------------------------------------------------

describe('gamification.onSessionCompleted (BR-M14-03/04/05/08/12/13/14/16/24)', () => {
  beforeEach(async () => {
    await runtime.reset()
    runtime.clock.setNow('2026-09-26T09:00:00+08:00')
    setPracticeReadsForTests(EMPTY_READS)
  })
  afterEach(() => setPracticeReadsForTests(null))

  it('random (practice mode): session credit, challenges in order, achievement, XP, wallet created', () => {
    const r = gamification.onSessionCompleted(session(3))
    expect(r).toEqual({ coinsEarned: 6, pointsEarned: 60, streakCount: 1, totalBalance: 33 })
    expect(rowsOf(3).reverse()).toEqual([
      ['Latih Tubi: 6 betul — 60%', 6],
      ['Cabaran selesai: Mula Hari Ini', 10],
      ['Cabaran selesai: Jawab 5 Betul', 12],
      ['Pencapaian: Langkah Pertama', 5],
    ])
    expect(wallet.summary(3)).toMatchObject({
      currentSyiling: 33,
      totalSyilingEarned: 33,
      xp: 60 + 5 + 8 + 3,
      level: 1,
      hasWallet: true,
    })
    expect(wallet.count('Q-WALLETS')).toBe(2_256)
    expect(achievements.forUser(3).unlocked).toBe(1)
    expect(coinLedger.forUser(3).every((row) => row.id >= 9_000_001)).toBe(true)
  })

  it('a second session the same day reads M05 (merged by id): Kilat Matematik once, Mula not repeated', () => {
    const first = session(3)
    gamification.onSessionCompleted(first)
    setPracticeReadsForTests({
      ...EMPTY_READS,
      sessionsOn: () => [
        {
          id: first.sessionId,
          mode: 'random',
          correct: 6,
          total: 10,
          timeSpent: 300,
          completedAt: '2026-09-26T09:00:00+08:00',
        },
      ],
      practiceSessions: () => [
        {
          id: first.sessionId,
          mode: 'random',
          correct: 6,
          total: 10,
          timeSpent: 300,
          completedAt: '2026-09-26T09:00:00+08:00',
        },
      ],
    })
    gamification.onSessionCompleted(
      session(3, { correct: 5, timeSpent: 120, completedAt: '2026-09-26T09:20:00+08:00' }),
    )
    expect(rowsOf(3).slice(0, 2)).toEqual([
      ['Cabaran selesai: Kilat Matematik', 30],
      ['Latih Tubi: 5 betul — 50%', 5],
    ])
    expect(wallet.summary(3).currentSyiling).toBe(33 + 5 + 30)
  })

  it('past_year: SPM row, then "Streak activity (spm)" +7 once a day; 0 correct → no session row', () => {
    gamification.onSessionCompleted(session(3, { mode: 'past_year', correct: 4 }))
    expect(rowsOf(3).reverse()).toEqual([
      ['SPM Tahun Lepas: 4 betul — 40%', 4],
      ['Streak activity (spm)', 7],
      ['Cabaran selesai: Mula Hari Ini', 10],
    ])
    gamification.onSessionCompleted(
      session(3, { mode: 'past_year', correct: 0, completedAt: '2026-09-26T09:30:00+08:00' }),
    )
    expect(coinLedger.forUser(3)).toHaveLength(3)
    expect(coinLedger.forUser(3).every((r) => r.source !== 'quiz_practice')).toBe(true)
    // No achievement for SPM modes.
    expect(achievements.forUser(3).unlocked).toBe(0)
  })

  it('latih_tubi / ramalan: quiz_spm wording; the XP bar text (E2E-M14-44)', () => {
    gamification.onSessionCompleted(session(3, { mode: 'past_year', correct: 6 }))
    expect(wallet.summary(3)).toMatchObject({ xp: 73, xpNeeded: 100, level: 1 })
    gamification.onSessionCompleted(
      session(3, {
        mode: 'latih_tubi',
        correct: 25,
        total: 34,
        completedAt: '2026-09-26T10:00:00+08:00',
      }),
    )
    gamification.onSessionCompleted(
      session(3, {
        mode: 'ramalan',
        correct: 34,
        total: 40,
        completedAt: '2026-09-26T11:00:00+08:00',
      }),
    )
    const descs = coinLedger.forUser(3).map((r) => r.description)
    expect(descs).toContain('Latih Tubi SPM: 25 betul — 73.53%')
    expect(descs).toContain('Ramalan SPM: 34 betul — 85%')
    expect(coinLedger.forUser(3).filter((r) => r.source === 'spm')).toHaveLength(1)
    expect(coinLedger.forUser(3).filter((r) => r.source === 'quiz_spm')).toHaveLength(3)
  })

  it('chapter / revision: quiz_practice; the chapters metric comes from M05 answers', () => {
    setPracticeReadsForTests({
      ...EMPTY_READS,
      answersOn: () =>
        [1, 143, 136].map((chapterId) => ({
          subjectId: 3,
          chapterId,
          isCorrect: true,
          answeredAt: '2026-09-26T08:55:00+08:00',
        })),
    })
    gamification.onSessionCompleted(session(3, { mode: 'chapter', correct: 3 }))
    expect(rowsOf(3).reverse()).toEqual([
      ['Latih Tubi: 3 betul — 30%', 3],
      ['Cabaran selesai: Penjelajah Topik', 25],
      ['Cabaran selesai: Mula Hari Ini', 10],
      ['Pencapaian: Langkah Pertama', 5],
    ])
    gamification.onSessionCompleted(
      session(3, {
        mode: 'revision',
        correct: 2,
        total: 7,
        completedAt: '2026-09-26T10:00:00+08:00',
      }),
    )
    expect(rowsOf(3)[0]).toEqual(['Latih Tubi: 2 betul — 28.57%', 2])
  })

  it('mission: the passed coinsPerCorrect (3) wins over the flat reward', () => {
    const r = gamification.onSessionCompleted(
      session(3, { mode: 'mission', correct: 5, coinsPerCorrect: 3 }),
    )
    expect(r.coinsEarned).toBe(15)
    expect(rowsOf(3).at(-1)).toEqual(['Latih Tubi: 5 betul — 50%', 15])
  })

  it('remedial / question_set: the practice wording (INFERRED: BR-M14-03 names neither), no achievement', () => {
    gamification.onSessionCompleted(session(3, { mode: 'remedial', correct: 4 }))
    gamification.onSessionCompleted(
      session(3, { mode: 'question_set', correct: 3, completedAt: '2026-09-26T10:00:00+08:00' }),
    )
    const rows = coinLedger.forUser(3).filter((r) => r.source === 'quiz_practice')
    expect(rows.map((r) => r.description)).toEqual([
      'Latih Tubi: 3 betul — 30%',
      'Latih Tubi: 4 betul — 40%',
    ])
    expect(achievements.forUser(3).unlocked).toBe(0)
  })

  it('pksk: flat reward first (1 per correct), else the tier pksk_reward_correct (5)', () => {
    gamification.onSessionCompleted(session(3, { mode: 'pksk', correct: 5 }))
    expect(coinLedger.forUser(3).at(-1)).toMatchObject({
      source: 'quiz_pksk',
      description: 'PKSK: 5 betul — 50%',
      amount: 5,
    })
    settings.update([{ key: 'flat_quiz_reward', value: 0 }])
    const r = gamification.onSessionCompleted(
      session(3, { mode: 'pksk', correct: 4, completedAt: '2026-09-26T10:00:00+08:00' }),
    )
    expect(r.coinsEarned).toBe(20)
    // Flat 0, practice mode: the tier level rates (L1 without a breakdown; per level with one).
    const r2 = gamification.onSessionCompleted(
      session(3, {
        correct: 4,
        correctByLevel: { 1: 1, 3: 3 },
        completedAt: '2026-09-26T11:00:00+08:00',
      }),
    )
    expect(r2.coinsEarned).toBe(1 * 1 + 3 * 3)
  })

  it('flat reward 2 pays 2 per correct (E2E-M14-88)', () => {
    settings.update([{ key: 'flat_quiz_reward', value: 2 }])
    expect(gamification.onSessionCompleted(session(3, { correct: 5 })).coinsEarned).toBe(10)
  })

  it('complimentary student (coinsEnabled false): no syiling and no row, XP added', () => {
    const r = gamification.onSessionCompleted(session(5901, { correct: 8 }))
    expect(r.coinsEarned).toBe(0)
    expect(coinLedger.forUser(5901)).toHaveLength(0)
    expect(wallet.summary(5901)).toMatchObject({ currentSyiling: 0, xp: 80 + 15 + 5 + 8 + 3 }) // Si Tepat, Mula, Jawab 5, Langkah Pertama
    expect(streak.get(5901).current).toBe(1)
  })

  it('admin latih_tubi 11/34: student rows and the teacher mirror (BR-M14-24)', () => {
    gamification.onSessionCompleted(session(1, { mode: 'latih_tubi', correct: 11, total: 34 }))
    expect(rowsOf(1).some(([d, a]) => d === 'Latih Tubi SPM: 11 betul — 32.35%' && a === 11)).toBe(
      true,
    )
    const t = teacherWallet.summary(1).transactions
    expect(t.slice(0, 2).map((x) => [x.description, x.amount])).toEqual([
      ['Aktiviti harian: spm', 7],
      ['Latih Tubi SPM - 32.35% ketepatan', 11],
    ])
    expect(teacherWallet.summary(1).balance).toBe(92_683 + 18)
  })

  it('streak (BR-M14-14): pelajarmaju 26/09 → 4 / 4; pelajar 27/09 → 1, best 2; challenges restart daily', () => {
    gamification.onSessionCompleted(session(4))
    expect(streak.get(4)).toMatchObject({ current: 4, best: 4, lastActivityDate: '2026-09-26' })
    runtime.clock.setNow('2026-09-27T08:00:00+08:00')
    gamification.onSessionCompleted(
      session(2, { mode: 'past_year', correct: 3, completedAt: '2026-09-27T08:00:00+08:00' }),
    )
    expect(streak.get(2)).toMatchObject({ current: 1, best: 2 })
    expect(challenges.today(2).completed).toBe(1)
    expect(coinLedger.forUser(4).some((r) => r.source === 'streak_bonus')).toBe(false)
  })

  it('tier upgrade after a credit, never down (BR-M14-08; E2E-M14-49)', () => {
    wallet.award(1, 250, 'Pertandingan')
    expect(wallet.summary(1)).toMatchObject({
      currentSyiling: 506,
      tier: { key: 'silver' },
      nextTier: { key: 'gold' },
    })
    expect(wallet.summary(1).title.name).toBe('Pelajar')
    const conv = wallet.convert(1, 400)
    expect(conv).toMatchObject({
      syilingDebited: 400,
      tokensCredited: 10,
      currentSyiling: 106,
      tokenBalance: 10,
    })
    expect(wallet.summary(1).tier.key).toBe('silver')
    expect(coinLedger.forUser(1)[0]).toMatchObject({
      type: 'convert',
      source: 'token_conversion',
      amount: -400,
      tokens: 10,
      description: 'Tukar 400 syiling → 10 token',
      balanceAfter: 106,
    })
    expect(coinLedger.count('Q-CONVERSIONS')).toBe(535)
    expect(coinLedger.tokensConverted()).toBe(7_811)
  })

  it('atomic: a failure after the call rolls every M14 write back (NFR-M14-03)', () => {
    const before = wallet.count('Q-WALLETS')
    expect(() =>
      runtime.db.transaction(() => {
        gamification.onSessionCompleted(session(3))
        throw new Error('injected')
      }),
    ).toThrow('injected')
    expect(wallet.count('Q-WALLETS')).toBe(before)
    expect(wallet.get(3)).toBeUndefined()
    expect(coinLedger.forUser(3)).toHaveLength(0)
    expect(streak.get(3).current).toBe(0)
    expect(challenges.today(3).completed).toBe(0)
  })
})

describe('gamification.onLogin (BR-M14-14)', () => {
  beforeEach(async () => {
    await runtime.reset()
    setPracticeReadsForTests(EMPTY_READS)
  })
  afterEach(() => setPracticeReadsForTests(null))

  it('writes the daily_login row once per day for a student; none for the admin', () => {
    const at = toEpochMs('2026-09-26T08:00:00+08:00')
    expect(gamification.onLogin(3, at)).toEqual({ credited: true, streakCount: 1 })
    expect(gamification.onLogin(3, at + 3_600_000)).toEqual({ credited: false, streakCount: 1 })
    expect(rowsOf(3)).toEqual([['Streak activity (daily_login)', 2]])
    expect(gamification.onLogin(1, at).credited).toBe(false)
    expect(coinLedger.forUser(1)).toHaveLength(14)
    // At the clock a form login as pelajar reads 372 (XL3-30).
    expect(gamification.onLogin(2, NOW).credited).toBe(true)
    expect(wallet.summary(2).currentSyiling).toBe(372)
    expect(streak.get(2).current).toBe(2)
    // Next day: another row, streak +1.
    gamification.onLogin(3, at + 86_400_000)
    expect(rowsOf(3)).toHaveLength(2)
    expect(streak.get(3).current).toBe(2)
  })
})

describe('games, tokens, draws, referrals, teacher events (BR-M14-19/21/22/23/26/29)', () => {
  beforeEach(async () => {
    await runtime.reset()
  })

  it('onGameResult: XP only while games_award_syiling = 0; Papan Bijak +5 with 1', () => {
    expect(gamification.canEarnSyiling(3)).toBe(false)
    expect(gamification.onGameResult(3, { game: 'papan_bijak', event: 'correct', xp: 4 })).toEqual({
      coinsCredited: 0,
      xpAdded: 4,
    })
    expect(coinLedger.forUser(3)).toHaveLength(0)
    settings.update([{ key: 'games_award_syiling', value: 1 }])
    expect(gamification.canEarnSyiling(3)).toBe(true)
    expect(gamification.canEarnSyiling(5901)).toBe(false)
    expect(gamification.onGameResult(3, { game: 'papan_bijak', event: 'correct', xp: 0 })).toEqual({
      coinsCredited: 5,
      xpAdded: 0,
    })
    expect(rowsOf(3)).toEqual([['Jawab betul dalam Papan Bijak 🎲', 5]])
  })

  it('tokens: refused below the balance, nothing written; mystery box credit', () => {
    expect(() => wallet.debitTokens(2, 1, { source: 'mystery_box' })).toThrow(M14Error)
    wallet.convert(1, 250)
    expect(wallet.debitTokens(1, 2, { source: 'mystery_box', refId: 'box:1' })).toEqual({
      tokenBalance: 3,
    })
    wallet.creditSyiling(1, 12, {
      source: 'mystery_box',
      description: 'Kotak Misteri: Kotak Gangsa',
    })
    wallet.addXp(1, 5, { source: 'mystery_box' })
    expect(wallet.summary(1)).toMatchObject({ currentSyiling: 18, tokenBalance: 3, xp: 13 })
    expect(coinLedger.forUser(1)[0]).toMatchObject({
      type: 'earn',
      source: 'mystery_box',
      description: 'Kotak Misteri: Kotak Gangsa',
      amount: 12,
      balanceAfter: 18,
    })
    expect(() => wallet.convert(1, 10)).toThrow('Jumlah syiling tidak sah.')
  })

  it('draws: buyTicket debits, refuses when closed, at the cap or short of syiling', () => {
    const d = draws.create({
      title: 'Cabutan Demo',
      ticketCostSyiling: 50,
      maxTicketsPerStudent: 2,
      closesAt: '2026-09-30',
      openNow: true,
    })
    expect(d).toMatchObject({ id: 1, status: 'open' })
    expect(draws.listOpenDraws('2026-09-25').map((x) => x.id)).toEqual([1])
    draws.buyTicket(1, 1)
    draws.buyTicket(1, 1)
    expect(coinLedger.forUser(1)[0]).toMatchObject({
      type: 'spend',
      source: 'cabutan_ticket',
      amount: -50,
      description: 'Tiket Cabutan: Cabutan Demo',
    })
    expect(() => draws.buyTicket(1, 1)).toThrow(expect.objectContaining({ code: 'TICKET_LIMIT' }))
    expect(() => draws.buyTicket(1, 3)).toThrow(
      expect.objectContaining({ code: 'INSUFFICIENT_BALANCE' }),
    )
    const draft = draws.create({ title: 'Draf' })
    expect(() => draws.buyTicket(draft.id, 1)).toThrow(
      expect.objectContaining({ code: 'DRAW_CLOSED' }),
    )
    expect(() => draws.create({ title: 'X', prizePool: 'not json' })).toThrow(
      'Format JSON kolam hadiah tidak sah.',
    )
  })

  it('referrals.onRegistered: +25 / +50 once; unknown or own code → nothing', () => {
    expect(referrals.onRegistered(3, '4JURJTT')).toMatchObject({
      referrerId: 1,
      refereeId: 3,
      rewarded: true,
    })
    expect(wallet.summary(3).currentSyiling).toBe(25)
    expect(wallet.summary(1).currentSyiling).toBe(306)
    expect(referrals.stats(1)).toEqual({ referrals: 1, rewarded: 1, syilingEarned: 50 })
    expect(referrals.onRegistered(3, '4JURJTT')).toBeNull()
    expect(referrals.onRegistered(11, 'ZZZZZZZ')).toBeNull()
    expect(referrals.onRegistered(1, '4JURJTT')).toBeNull()
  })

  it('teacherGamification.onQuestionContributed: +10 per question; a badge bonus once', () => {
    teacherGamification.onQuestionContributed(5, 9_000_123)
    expect(teacherWallet.summary(5)).toMatchObject({ questionsCount: 2, balance: 10 })
    expect(teacherWallet.summary(5).transactions[0]).toMatchObject({
      description: 'Sumbang Soalan #9000123',
      amount: 10,
    })
    teacherWallet.setFields(5, { questionsCount: 9 })
    teacherGamification.onQuestionContributed(5, 9_000_124)
    const s = teacherWallet.summary(5)
    expect(s.transactions[0]).toMatchObject({
      description: 'Lencana: Penyumbang Baru (10 soalan)',
      amount: 100,
    })
    expect(s.balance).toBe(120)
    teacherGamification.onQuestionContributed(5, 9_000_125)
    expect(
      teacherWallet.summary(5).transactions.filter((t) => t.description.startsWith('Lencana:')),
    ).toHaveLength(1)
  })

  it('cash requests: hold, PAID debit once, release on REJECTED; CASH_DISABLED', () => {
    const req = teacherCash.request(1, {
      coinsAmount: 500,
      bankName: 'Maybank',
      bankAccount: '1234567890',
      accountHolder: 'Admin Demo',
    })
    expect(req).toMatchObject({ id: 3, status: 'PENDING', cash: 4, bankAccountMasked: '•••890' })
    expect(teacherCash.view(1)).toMatchObject({ available: 92_183, held: 500 })
    teacherCash.setStatus(3, 'PAID')
    expect(teacherWallet.summary(1)).toMatchObject({ balance: 92_183 })
    expect(teacherWallet.summary(1).transactions[0]).toMatchObject({
      description: 'Tebus Tunai #3',
      amount: -500,
    })
    teacherCash.setStatus(3, 'PAID')
    expect(teacherWallet.summary(1).balance).toBe(92_183)
    teacherCash.setStatus(2, 'REJECTED', 'Semak akaun')
    expect(teacherCash.view(4207)).toMatchObject({ available: 18_140, held: 0 })
    settings.update([{ key: 'cash_withdrawal_enabled', value: 0 }])
    expect(() =>
      teacherCash.request(1, {
        coinsAmount: 500,
        bankName: 'Maybank',
        bankAccount: '1',
        accountHolder: 'A',
      }),
    ).toThrow(expect.objectContaining({ code: 'CASH_DISABLED' }))
  })
})

describe('review follow-ups (idempotency, validation, shim, claims, complimentary login, upgrade)', () => {
  beforeEach(async () => {
    await runtime.reset()
    runtime.clock.setNow('2026-09-26T09:00:00+08:00')
    setPracticeReadsForTests(EMPTY_READS)
  })
  afterEach(() => setPracticeReadsForTests(null))

  it('onSessionCompleted is idempotent per sessionId: the stored result, nothing written', () => {
    const input = session(3, { sessionId: 'dup-1' })
    const first = gamification.onSessionCompleted(input)
    const rows = coinLedger.forUser(3).length
    const before = wallet.summary(3)
    const again = gamification.onSessionCompleted({ ...input, correct: 9 })
    expect(again).toEqual(first)
    expect(coinLedger.forUser(3)).toHaveLength(rows)
    expect(wallet.summary(3)).toEqual(before)
    // The designed M05 sessions are already credited: a replayed P4 pays nothing.
    const p4 = gamification.onSessionCompleted(
      session(2, {
        sessionId: 'P4',
        mode: 'ramalan',
        correct: 34,
        total: 40,
        timeSpent: 900,
        completedAt: '2026-09-25T08:30:00+08:00',
      }),
    )
    expect(p4).toEqual({ coinsEarned: 34, pointsEarned: 340, streakCount: 2, totalBalance: 370 })
    expect(wallet.summary(2).currentSyiling).toBe(370)
  })

  it('invalid input → VALIDATION_ERROR and nothing written', () => {
    const bad: Partial<SessionCompletedInput>[] = [
      { correct: 11, total: 10 },
      { correct: -1 },
      { timeSpent: 1.5 },
      { pointsEarned: Number.NaN },
      { coinsPerCorrect: -3 },
      { completedAt: 'not a date' },
    ]
    for (const over of bad) {
      expect(() => gamification.onSessionCompleted(session(3, over))).toThrow(
        expect.objectContaining({ code: 'VALIDATION_ERROR' }),
      )
    }
    expect(wallet.get(3)).toBeUndefined()
    expect(coinLedger.forUser(3)).toHaveLength(0)
  })

  it('wallet.credit shim: a session reason maps points → pointsEarned; other reasons credit syiling + XP', () => {
    const r = wallet.credit(
      3,
      { coins: 999, points: 60 },
      {
        kind: 'session',
        sessionId: 'shim-1',
        mode: 'random',
        correct: 6,
        total: 10,
        timeSpent: 300,
        completedAt: '2026-09-26T09:00:00+08:00',
      },
    )
    expect(r).toEqual({ coinsEarned: 6, pointsEarned: 60, streakCount: 1, totalBalance: 33 })
    expect(wallet.summary(3).xp).toBe(60 + 5 + 8 + 3)
    wallet.credit(11, { coins: 7, points: 4 }, { source: 'legacy', description: 'Pindahan' })
    expect(wallet.summary(11)).toMatchObject({ currentSyiling: 7, xp: 4 })
    expect(rowsOf(11)).toEqual([['Pindahan', 7]])
  })

  it('Q-RC-CLAIMS: RM0.00 / 0 / 0 in the session year (BR-M14-31)', () => {
    expect(rewardControl.claimTiles()).toEqual({
      sessionYear: 2026,
      liabilityRm: 0,
      students: 0,
      claims: 0,
    })
    settings.update([{ key: 'current_session_year', value: 2027 }])
    expect(rewardControl.claimTiles().sessionYear).toBe(2027)
    expect(rewardControl.rewards()).toHaveLength(11)
  })

  it('complimentary onLogin: streak step, no daily_login row', () => {
    expect(gamification.onLogin(5901, '2026-09-26T08:00:00+08:00')).toEqual({
      credited: false,
      streakCount: 1,
    })
    expect(coinLedger.forUser(5901)).toHaveLength(0)
    expect(wallet.get(5901)).toBeUndefined()
  })

  it('tier upgrade through onSessionCompleted (BR-M14-08): 495 + credits ≥ 500 → silver', () => {
    wallet.setFields(3, { syiling: 495, tierKey: 'bronze' })
    gamification.onSessionCompleted(session(3, { mode: 'past_year', correct: 6 }))
    expect(wallet.summary(3)).toMatchObject({
      currentSyiling: 495 + 6 + 7 + 10 + 12,
      tier: { key: 'silver' },
    })
  })
})
