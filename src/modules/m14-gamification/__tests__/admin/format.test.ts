/** Tier helpers of the M14 admin screens (T-C12): a tier colour becomes a design-system tone, a tier is found by key or id. */
import { describe, expect, it } from 'vitest'

import { tierText, tierTone } from '../../lib/admin/format'
import { TIERS } from './support'

describe('tierTone', () => {
  it.each([
    ['#cd7f32', 'warning'],
    ['#ffd700', 'warning'],
    ['#c0c0c0', 'neutral'],
    ['#e5e4e2', 'neutral'],
    ['#ef4444', 'error'],
    ['#22c55e', 'success'],
    ['#3b82f6', 'info'],
    ['#8b5cf6', 'primary'],
  ])('maps %s to %s', (color, tone) => {
    expect(tierTone(color)).toBe(tone)
  })

  it('is neutral for a missing or malformed colour', () => {
    expect(tierTone(undefined)).toBe('neutral')
    expect(tierTone('')).toBe('neutral')
    expect(tierTone('red')).toBe('neutral')
  })
})

describe('tierText', () => {
  it('finds a tier by key and by id', () => {
    expect(tierText(TIERS, 'silver')).toBe('🥈 Perak')
    expect(tierText(TIERS, '2')).toBe('🥈 Perak')
  })

  it('gives the key back for an unknown tier and a dash for none', () => {
    expect(tierText(TIERS, 'gold')).toBe('gold')
    expect(tierText(TIERS, '')).toBe('—')
  })
})
