/**
 * S7-T04 part 17 (FR-GM-25, AC-GM-25.1/25.4/25.6): the 26th badge and every trigger of the badge check
 * outside a practice session, on the M14 mock. A badge unlocks once and pays once ("Pencapaian: {name}",
 * source `achievement`), a teacher or admin unlocks nothing, and only the claim carries a notice.
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { vi } from 'vitest'

import { toEpochMs } from '@/lib/time'
import type { MockRuntime } from '@/mock/index'

import { achievements, challenges, coinLedger, gamification, referrals, streak, wallet } from '../../mock'
import { setBattleWinsForTests, setPracticeReadsForTests, type PracticeReads } from '../../mock/repository/reads'
import type { SessionCompletedInput } from '../../mock/repository/engine'
import { bootM14, stubStorage } from './helpers'

let runtime: MockRuntime

beforeAll(async () => {
  stubStorage()
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

beforeEach(async () => {
  await runtime.reset()
  runtime.clock.setNow('2026-09-26T09:00:00+08:00')
  setPracticeReadsForTests(EMPTY_READS)
})
afterEach(() => {
  setPracticeReadsForTests(null)
  setBattleWinsForTests(null)
})

const AT = toEpochMs('2026-09-26T09:00:00+08:00')

const achievementRows = (userId: number) =>
  coinLedger
    .forUser(userId)
    .filter((r) => r.source === 'achievement')
    .map((r) => [r.description, r.amount])

const unlockedIds = (userId: number) =>
  achievements
    .forUser(userId)
    .items.filter((i) => i.unlocked)
    .map((i) => i.id)

function session(userId: number): SessionCompletedInput {
  return {
    userId,
    sessionId: `bt-${String(Math.random()).slice(2)}`,
    mode: 'random',
    correct: 6,
    total: 10,
    timeSpent: 300,
    completedAt: '2026-09-26T09:00:00+08:00',
    pointsEarned: 60,
  }
}

describe('the catalogue: 26 badges, "Jarang" is exactly 4, 6, 8, 13, 15, 16, 17, 18, 26', () => {
  it('#26 Juara Battle: Jarang, 30 syiling, 20 XP, "Menang 10 battle"', () => {
    const a = achievements.catalogue()
    expect(a).toHaveLength(26)
    expect(a[25]).toMatchObject({
      id: 26,
      icon: '⚔️',
      name: 'Juara Battle',
      description: 'Menang 10 battle',
      rarity: 'rare',
      rewardSyiling: 30,
      rewardXp: 20,
      criterion: { kind: 'battleWins', min: 10 },
      progressTarget: null,
    })
  })

  it('the rarity filter gives the PRD 48 ids and the counter total stays the whole catalogue', () => {
    const rare = achievements.forUser(3, 'rare')
    expect(rare.items.map((i) => i.id)).toEqual([4, 6, 8, 13, 15, 16, 17, 18, 26])
    expect(rare.items.every((i) => i.rarityLabel === 'Jarang')).toBe(true)
    expect(rare.total).toBe(26)
    expect(achievements.forUser(3, 'zzz')).toMatchObject({ total: 26, items: [] })
    const labels = new Set(achievements.forUser(3).items.map((i) => i.rarityLabel))
    expect([...labels].sort()).toEqual(['Biasa', 'Epik', 'Jarang', 'Legenda'])
  })
})

describe('a challenge claim (AC-GM-25.1)', () => {
  it('the claim that reaches 20 claims unlocks #15 once: notice after the tier notice order, one ledger row, none on the next claim', () => {
    gamification.onSessionCompleted(session(3)) // completes two challenges, unlocks #1
    for (let i = 1; i <= 19; i++) {
      challenges.seedClaim(3, 1, `2026-08-${String(i).padStart(2, '0')}`)
    }
    const done = challenges.today(3).items.filter((c) => c.completed)
    expect(done.length).toBeGreaterThanOrEqual(2)
    const first = challenges.claim(3, done[0]!.id, null)
    expect(first.notices).toEqual(['Lencana baru: Cabaran Selesai!'])
    expect(achievementRows(3)).toContainEqual(['Pencapaian: Cabaran Selesai', 35])
    expect(unlockedIds(3)).toContain(15)
    const second = challenges.claim(3, done[1]!.id, null)
    expect(second.notices).toBeUndefined()
    expect(achievementRows(3).filter(([d]) => d === 'Pencapaian: Cabaran Selesai')).toHaveLength(1)
  })

  it('18 earlier claims plus this one is 19: #15 stays locked', () => {
    gamification.onSessionCompleted(session(3))
    for (let i = 1; i <= 18; i++) {
      challenges.seedClaim(3, 1, `2026-08-${String(i).padStart(2, '0')}`)
    }
    const done = challenges.today(3).items.find((c) => c.completed)!
    challenges.claim(3, done.id, null)
    expect(unlockedIds(3)).not.toContain(15)
  })

  it('the tier notice comes first, then the badge notice', () => {
    wallet.setFields(3, { syiling: 480, lifetime: 480, tierKey: 'bronze' })
    gamification.onSessionCompleted({ ...session(3), mode: 'past_year' })
    const done = challenges.today(3).items.find((c) => c.completed)!
    expect(challenges.claim(3, done.id, null).notices).toEqual([
      'Tahniah! Anda naik ke tier Perak.',
      'Lencana baru: Pengumpul Syiling!',
    ])
  })
})

describe('a won real battle (#26 Juara Battle)', () => {
  it('the 10th win unlocks #26 silently, pays 30 syiling and 20 XP once', () => {
    setBattleWinsForTests(() => 9)
    const xp0 = wallet.summary(3).xp
    gamification.onGameResult(3, { game: 'battle', event: 'win', coins: 0, xp: 0 })
    expect(unlockedIds(3)).toEqual([])
    setBattleWinsForTests(() => 10)
    gamification.onGameResult(3, { game: 'battle', event: 'win', coins: 0, xp: 0 })
    expect(unlockedIds(3)).toEqual([26])
    expect(achievementRows(3)).toEqual([['Pencapaian: Juara Battle', 30]])
    expect(wallet.summary(3)).toMatchObject({ currentSyiling: 30, xp: xp0 + 20 })
    setBattleWinsForTests(() => 11)
    gamification.onGameResult(3, { game: 'battle', event: 'win', coins: 0, xp: 0 })
    expect(achievementRows(3)).toEqual([['Pencapaian: Juara Battle', 30]])
  })

  it('only a win evaluates: a finished loss, a forfeit and another game do not', () => {
    setBattleWinsForTests(() => 10)
    for (const [game, event] of [
      ['battle', 'finish'],
      ['battle', 'forfeit'],
      ['battle', 'forfeit_win'],
      ['papan_bijak', 'win'],
    ] as const) {
      gamification.onGameResult(3, { game, event, coins: 0, xp: 0 })
    }
    expect(unlockedIds(3)).toEqual([])
  })
})

describe('a rewarded referral (#18 Sahabat Belajar)', () => {
  it('the referrer unlocks #18 on the 3rd rewarded referral, silently and once', () => {
    const code = referrals.codeOf(3)
    referrals.onRegistered(9101, code)
    referrals.onRegistered(9102, code)
    expect(unlockedIds(3)).not.toContain(18)
    referrals.onRegistered(9103, code)
    expect(unlockedIds(3)).toContain(18)
    expect(achievementRows(3)).toContainEqual(['Pencapaian: Sahabat Belajar', 50])
    referrals.onRegistered(9104, code)
    expect(achievementRows(3).filter(([d]) => d === 'Pencapaian: Sahabat Belajar')).toHaveLength(1)
  })
})

describe('the first login of the day (streak badges)', () => {
  it('a login that makes the streak 3 unlocks #3 once; the second login of the day writes nothing', () => {
    streak.set(3, { current: 2, best: 2, lastActivityDate: '2026-09-25' })
    expect(gamification.onLogin(3, AT)).toEqual({ credited: true, streakCount: 3 })
    expect(unlockedIds(3)).toEqual([3])
    expect(achievementRows(3)).toEqual([['Pencapaian: Streak 3 Hari', 10]])
    gamification.onLogin(3, AT + 3_600_000)
    expect(achievementRows(3)).toEqual([['Pencapaian: Streak 3 Hari', 10]])
  })

  it('a login of a coins-off student still unlocks the badge but pays no syiling', () => {
    streak.set(5901, { current: 2, best: 2, lastActivityDate: '2026-09-25' })
    expect(gamification.onLogin(5901, AT)).toEqual({ credited: false, streakCount: 3 })
    expect(unlockedIds(5901)).toEqual([3])
    expect(coinLedger.forUser(5901)).toHaveLength(0)
  })

  it('reads the streak only: the seeded pelajar with 370 syiling keeps #5 locked and reads 372', () => {
    gamification.onLogin(2, toEpochMs('2026-09-25T15:40:00+08:00'))
    expect(unlockedIds(2)).toEqual([])
    expect(wallet.summary(2).currentSyiling).toBe(372)
  })
})

describe('AC-GM-25.6: a teacher or admin never unlocks; unlock once, pay once', () => {
  it('the admin unlocks nothing on any trigger', () => {
    setBattleWinsForTests(() => 50)
    streak.set(1, { current: 40, best: 40, lastActivityDate: '2026-09-25' })
    gamification.onGameResult(1, { game: 'battle', event: 'win', coins: 0, xp: 0 })
    expect(gamification.awardBadges(1, AT)).toEqual([])
    expect(unlockedIds(1)).toEqual([])
  })

  it('awardBadges twice unlocks and pays each badge once', () => {
    streak.set(3, { current: 7, best: 7, lastActivityDate: '2026-09-26' })
    const first = gamification.awardBadges(3, AT)
    expect(first.map((b) => b.code)).toEqual(['3', '8', '9'])
    expect(first[0]).toEqual({ code: '3', name: 'Streak 3 Hari' })
    expect(gamification.awardBadges(3, AT)).toEqual([])
    expect(achievementRows(3)).toHaveLength(3)
  })
})
