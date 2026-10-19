import { describe, expect, it } from 'vitest'

import { daysInMonth, fromMytParts, mytParts, toEpochMs, toIsoMyt } from '../zone'

const ANCHOR = Date.parse('2026-09-25T07:40:00Z') // 15:40 MYT

describe('toEpochMs', () => {
  it('accepts numbers, Dates and zoned ISO strings', () => {
    expect(toEpochMs(ANCHOR)).toBe(ANCHOR)
    expect(toEpochMs(new Date(ANCHOR))).toBe(ANCHOR)
    expect(toEpochMs('2026-09-25T15:40:00+08:00')).toBe(ANCHOR)
    expect(toEpochMs('2026-09-25T07:40:00Z')).toBe(ANCHOR)
    expect(toEpochMs('2026-09-25T07:40:00.000Z')).toBe(ANCHOR)
  })

  it('reads zone-less (Laravel) strings as Malaysian wall time, not browser time', () => {
    expect(toEpochMs('2026-09-25 15:40:00')).toBe(ANCHOR)
    expect(toEpochMs('2026-09-25 15:40')).toBe(ANCHOR)
    expect(toEpochMs('2026-09-25T15:40:00')).toBe(ANCHOR)
    expect(toEpochMs('2026-09-25')).toBe(Date.parse('2026-09-24T16:00:00Z'))
  })

  it('throws RangeError on invalid input', () => {
    expect(() => toEpochMs('not a date')).toThrow(RangeError)
    expect(() => toEpochMs('25/09/2026')).toThrow(RangeError)
    expect(() => toEpochMs(Number.NaN)).toThrow(RangeError)
    expect(() => toEpochMs(new Date('x'))).toThrow(RangeError)
  })

  it('rejects impossible calendar values instead of overflowing', () => {
    expect(() => toEpochMs('2026-02-31')).toThrow(RangeError)
    expect(() => toEpochMs('2026-02-29 10:00')).toThrow(RangeError) // 2026 is not a leap year
    expect(() => toEpochMs('2026-13-01')).toThrow(RangeError)
    expect(() => toEpochMs('2026-00-10')).toThrow(RangeError)
    expect(() => toEpochMs('2026-09-00')).toThrow(RangeError)
    expect(() => toEpochMs('2026-09-25 24:00')).toThrow(RangeError)
    expect(() => toEpochMs('2026-09-25 23:60')).toThrow(RangeError)
    expect(() => toEpochMs('2026-09-25 23:59:60')).toThrow(RangeError)
    expect(() => toEpochMs('2026-02-31T10:00:00+08:00')).toThrow(RangeError)
    expect(() => toEpochMs('2026-04-31T10:00:00Z')).toThrow(RangeError)
    // Valid edge values still parse.
    expect(toIsoMyt(toEpochMs('2028-02-29 23:59:59'))).toBe('2028-02-29T23:59:59+08:00')
    expect(toEpochMs('2026-12-31T23:59:59Z')).toBe(Date.parse('2026-12-31T23:59:59Z'))
  })
})

describe('mytParts', () => {
  it('gives UTC+8 wall-clock fields and ISO weekday (the anchor is a Friday)', () => {
    expect(mytParts(ANCHOR)).toEqual({
      year: 2026,
      month: 9,
      day: 25,
      hour: 15,
      minute: 40,
      second: 0,
      millisecond: 0,
      weekday: 5,
    })
  })

  it('rolls to the next Malaysian day at 16:00 UTC', () => {
    expect(mytParts('2026-09-24T15:59:59Z').day).toBe(24)
    const p = mytParts('2026-09-24T16:00:00Z')
    expect([p.day, p.hour]).toEqual([25, 0])
    expect(mytParts('2026-09-27T12:00:00+08:00').weekday).toBe(7) // Sunday
  })
})

describe('fromMytParts / toIsoMyt / daysInMonth', () => {
  it('round-trips wall time', () => {
    expect(fromMytParts({ year: 2026, month: 9, day: 25, hour: 15, minute: 40 })).toBe(ANCHOR)
    expect(toIsoMyt(ANCHOR)).toBe('2026-09-25T15:40:00+08:00')
    expect(toIsoMyt(ANCHOR + 5)).toBe('2026-09-25T15:40:00.005+08:00')
  })

  it('overflows fields like Date.UTC', () => {
    expect(toIsoMyt(fromMytParts({ year: 2026, month: 13, day: 1 }))).toBe(
      '2027-01-01T00:00:00+08:00',
    )
  })

  it('knows month lengths including leap years', () => {
    expect(daysInMonth(2026, 2)).toBe(28)
    expect(daysInMonth(2028, 2)).toBe(29)
    expect(daysInMonth(2026, 9)).toBe(30)
    expect(daysInMonth(2026, 12)).toBe(31)
  })
})
