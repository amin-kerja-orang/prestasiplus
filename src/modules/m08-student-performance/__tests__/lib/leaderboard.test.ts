import { describe, expect, it } from 'vitest'

import {
  initialOf,
  percentText,
  pillClass,
  rankCircleClass,
  readPeriod,
} from '../../lib/leaderboard'

describe('S20 period (FR-M08-114)', () => {
  it('reads the three periods and falls back to the week', () => {
    expect(readPeriod('all')).toBe('all')
    expect(readPeriod('month')).toBe('month')
    expect(readPeriod('week')).toBe('week')
    expect(readPeriod(undefined)).toBe('week')
    expect(readPeriod('xyz')).toBe('week')
    expect(readPeriod(['month', 'all'])).toBe('month')
  })
})

describe('S20 accuracy pill (FR-M08-117)', () => {
  it('thresholds apply to the unrounded value', () => {
    expect(pillClass(80)).toBe('bg-success text-inverted')
    expect(pillClass(79.9)).toBe('bg-warning text-inverted')
    expect(pillClass(60)).toBe('bg-warning text-inverted')
    expect(pillClass(59.9)).toBe('bg-error text-inverted')
    // Both can display as "60%": the unrounded value decides.
    expect(percentText(59.6)).toBe('60%')
    expect(percentText(60.2)).toBe('60%')
  })

  it('colours the rank circles', () => {
    expect(rankCircleClass(1)).toContain('bg-highlight')
    expect(rankCircleClass(2)).toContain('bg-highlight')
    expect(rankCircleClass(3)).toContain('bg-highlight')
    expect(rankCircleClass(4)).toContain('bg-elevated')
  })

  it('takes the avatar initial', () => {
    expect(initialOf(' nur aina')).toBe('N')
    expect(initialOf('')).toBe('?')
  })
})
