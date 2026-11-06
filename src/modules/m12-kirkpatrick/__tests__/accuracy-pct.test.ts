import { describe, expect, it } from 'vitest'

import { accuracyPct } from '../components/kirkpatrick/common/kirkpatrick-format'

describe('accuracyPct (XS-5: whole number, half away from zero)', () => {
  it('rounds half away from zero', () => {
    expect(accuracyPct(66.5)).toBe('67%')
    expect(accuracyPct(53.7)).toBe('54%')
    expect(accuracyPct(33.3)).toBe('33%')
    expect(accuracyPct(0)).toBe('0%')
    expect(accuracyPct(100)).toBe('100%')
    expect(accuracyPct(-16.5, { signed: true })).toBe('-17%')
    expect(accuracyPct(-16.6, { signed: true })).toBe('-17%')
  })
  it('signed prints + for gains and a plain 0', () => {
    expect(accuracyPct(53.7, { signed: true })).toBe('+54%')
    expect(accuracyPct(0, { signed: true })).toBe('0%')
    expect(accuracyPct(-0.2, { signed: true })).toBe('0%')
  })
})
