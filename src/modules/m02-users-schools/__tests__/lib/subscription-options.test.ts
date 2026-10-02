import { describe, expect, it } from 'vitest'

import { barClass, levelLabel, money } from '../../lib/subscription-options'

describe('subscription-options', () => {
  it('formats money as RM with thousands and 2 decimals, no space', () => {
    expect(money('30.00')).toBe('RM30.00')
    expect(money(15000)).toBe('RM15,000.00')
    expect(money('16860.00')).toBe('RM16,860.00')
  })

  it('colours the bar red at 100% and emerald below', () => {
    expect(barClass(15)).toBe('bg-emerald-500')
    expect(barClass(99)).toBe('bg-emerald-500')
    expect(barClass(100)).toBe('bg-red-500')
  })

  it('upper-cases the level badge', () => {
    expect(levelLabel('t5')).toBe('T5')
    expect(levelLabel('d1_d6')).toBe('D1_D6')
  })
})
