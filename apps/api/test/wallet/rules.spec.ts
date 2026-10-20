import { describe, expect, it } from 'vitest'

import {
  EMPTY_STREAK,
  activeTiers,
  defaultTier,
  levelProgressPct,
  nextTierOf,
  nextTierProgress,
  nextTitleOf,
  previousDay,
  stepStreak,
  titleOf,
  upgradedTierId,
  xpNeeded,
  type StreakState,
  type TierLike,
} from '../../src/modules/wallet/rules'

const tier = (id: string, tierName: string, minSyiling: number, isActive = true, sortOrder = Number(id)): TierLike => ({ id, tierName, minSyiling, sortOrder, isActive })
const TIERS = [tier('1', 'bronze', 0), tier('2', 'silver', 500), tier('3', 'gold', 2000), tier('4', 'platinum', 5000)]

describe('wallet rules (pure, mock rules.ts)', () => {
  it('xpNeeded and levelProgressPct follow BR-M14-05', () => {
    expect(xpNeeded(1)).toBe(100)
    expect(xpNeeded(3)).toBe(120)
    expect(xpNeeded(0)).toBe(100)
    expect(levelProgressPct(0, 1)).toBe(0)
    expect(levelProgressPct(50, 1)).toBe(50)
    expect(levelProgressPct(916, 1)).toBe(100) // capped
    expect(levelProgressPct(432, 3)).toBe(100)
    expect(levelProgressPct(8, 2)).toBe(7) // round(8 / 110 x 100)
  })

  it('titles follow BR-M14-09 and the next title says what is missing', () => {
    expect(titleOf(0)).toEqual({ name: 'Permulaan', emoji: '📚' })
    expect(titleOf(299).name).toBe('Permulaan')
    expect(titleOf(300).name).toBe('Pelajar')
    expect(titleOf(9999).name).toBe('Legenda')
    expect(titleOf(10_000).name).toBe('Mitos')
    expect(nextTitleOf(370)).toEqual({ name: 'Master', emoji: '', threshold: 2000, need: 1630 })
    expect(nextTitleOf(10_000)).toBeNull()
  })

  it('the default tier is the active tier with the lowest minSyiling', () => {
    expect(defaultTier(TIERS)?.tierName).toBe('bronze')
    expect(defaultTier([tier('1', 'bronze', 0, false), tier('2', 'silver', 500)])?.tierName).toBe('silver')
    expect(defaultTier([tier('1', 'bronze', 0, false)])?.tierName).toBe('bronze') // none active: any tier
    expect(defaultTier([])).toBeUndefined()
    expect(activeTiers([tier('9', 'x', 5), tier('3', 'y', 5)]).map((t) => t.id)).toEqual(['3', '9']) // ties by sortOrder, then id
  })

  it('upgradedTierId: highest active tier whose minSyiling is at most the current syiling, only if higher, never down', () => {
    expect(upgradedTierId(TIERS, '1', 499)).toBe('1')
    expect(upgradedTierId(TIERS, '1', 500)).toBe('2')
    expect(upgradedTierId(TIERS, '1', 2500)).toBe('3') // skips silver
    expect(upgradedTierId(TIERS, '1', 99_999)).toBe('4')
    expect(upgradedTierId(TIERS, '3', 10)).toBe('3') // a low balance never lowers the tier
    expect(upgradedTierId(TIERS, '4', 2500)).toBe('4')
    expect(upgradedTierId(TIERS, null, 600)).toBe('2') // a wallet with no tier takes the best one it reaches
    expect(upgradedTierId(TIERS, null, 0)).toBe('1')
    // An inactive tier is never a target.
    expect(upgradedTierId([...TIERS.slice(0, 1), tier('2', 'silver', 500, false), TIERS[2]!], '1', 600)).toBe('1')
  })

  it('nextTierOf and nextTierProgress (BR-M14-06): 1 decimal, capped at 100, null at the top', () => {
    expect(nextTierOf(TIERS, '1')?.tierName).toBe('silver')
    expect(nextTierOf(TIERS, '4')).toBeNull()
    expect(nextTierProgress(370, TIERS[1]!)).toEqual({ pct: 74, need: 130 })
    expect(nextTierProgress(1, TIERS[3]!)).toEqual({ pct: 0, need: 4999 })
    expect(nextTierProgress(333, TIERS[2]!)).toEqual({ pct: 16.7, need: 1667 })
    expect(nextTierProgress(900, TIERS[1]!)).toEqual({ pct: 100, need: 0 })
    expect(nextTierProgress(5, { minSyiling: 0 })).toEqual({ pct: 100, need: 0 })
  })

  it('previousDay handles month, year and leap-year edges', () => {
    expect(previousDay('2026-10-19')).toBe('2026-10-18')
    expect(previousDay('2026-03-01')).toBe('2026-02-28')
    expect(previousDay('2028-03-01')).toBe('2028-02-29')
    expect(previousDay('2027-01-01')).toBe('2026-12-31')
    expect(() => previousDay('nope')).toThrow(RangeError)
  })

  describe('stepStreak (BR-M14-14, mock stepStreak)', () => {
    const at = (current: number, best: number, last: string | null, totalDays = 0): StreakState => ({ current, best, lastActivityDate: last, totalDays })

    it('the first activity starts at 1', () => {
      expect(stepStreak({ ...EMPTY_STREAK }, '2026-10-19')).toEqual({ current: 1, best: 1, lastActivityDate: '2026-10-19', totalDays: 1 })
    })
    it('the same day changes nothing (the same object comes back)', () => {
      const s = at(4, 6, '2026-10-19', 9)
      expect(stepStreak(s, '2026-10-19')).toBe(s)
    })
    it('the next day adds 1; best is the maximum; totalDays grows on each new day', () => {
      expect(stepStreak(at(4, 4, '2026-10-18', 9), '2026-10-19')).toEqual({ current: 5, best: 5, lastActivityDate: '2026-10-19', totalDays: 10 })
      expect(stepStreak(at(4, 9, '2026-10-18', 9), '2026-10-19').best).toBe(9)
    })
    it('a gap restarts at 1 and keeps best', () => {
      expect(stepStreak(at(7, 7, '2026-10-17', 20), '2026-10-19')).toEqual({ current: 1, best: 7, lastActivityDate: '2026-10-19', totalDays: 21 })
    })
    it('month and year boundaries count as consecutive days', () => {
      expect(stepStreak(at(2, 2, '2026-09-30'), '2026-10-01').current).toBe(3)
      expect(stepStreak(at(2, 2, '2026-12-31'), '2027-01-01').current).toBe(3)
    })
    it('an activity dated before the last one changes nothing (the streak never rewinds; the mock restarted at 1)', () => {
      const s = at(5, 5, '2026-10-19', 12)
      expect(stepStreak(s, '2026-10-10')).toBe(s)
      expect(stepStreak(s, '2026-10-18')).toBe(s)
    })
  })
})
