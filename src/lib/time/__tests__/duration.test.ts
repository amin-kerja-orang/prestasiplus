import { describe, expect, it } from 'vitest'

import { formatMinSec, formatMmSs, formatWholeMinutes } from '../duration'

describe('durations', () => {
  it('MM:SS (M05 quiz timer, "Masa diambil")', () => {
    expect(formatMmSs(0)).toBe('00:00')
    expect(formatMmSs(59)).toBe('00:59')
    expect(formatMmSs(247)).toBe('04:07')
    expect(formatMmSs(7503)).toBe('125:03')
    expect(formatMmSs(61.9)).toBe('01:01')
  })

  it('{m}m {s}s (M06 history)', () => {
    expect(formatMinSec(247)).toBe('4m 7s')
    expect(formatMinSec(0)).toBe('0m 0s')
  })

  it('{m}m whole minutes (M05 S8 "Masa Berlatih")', () => {
    expect(formatWholeMinutes(239)).toBe('3m')
    expect(formatWholeMinutes(240)).toBe('4m')
    expect(formatWholeMinutes(0)).toBe('0m')
  })

  it('clamps negatives and rejects non-finite input', () => {
    expect(formatMmSs(-5)).toBe('00:00')
    expect(() => formatMmSs(Number.POSITIVE_INFINITY)).toThrow(RangeError)
  })
})
