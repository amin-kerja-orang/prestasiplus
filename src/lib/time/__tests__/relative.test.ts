import { afterEach, describe, expect, it, vi } from 'vitest'

import { CLOCK_ANCHOR_MS, clock } from '../clock'
import { calendarDiff, diffForHumans } from '../relative'
import { DAY_MS, HOUR_MS, MINUTE_MS, SECOND_MS } from '../zone'

const NOW = CLOCK_ANCHOR_MS // 2026-09-25 15:40 MYT
const ago = (ms: number) => diffForHumans(NOW - ms, NOW)

afterEach(() => {
  clock.reset()
  vi.useRealTimers()
})

describe('diffForHumans (Carbon, ms locale; M01 BR-20)', () => {
  it('zero difference reads as 1 second (Carbon NO_ZERO_DIFF)', () => {
    expect(ago(0)).toBe('1 saat yang lepas')
    expect(ago(999)).toBe('1 saat yang lepas')
  })

  it('seconds → minutes boundary', () => {
    expect(ago(59 * SECOND_MS)).toBe('59 saat yang lepas')
    expect(ago(60 * SECOND_MS)).toBe('1 minit yang lepas')
  })

  it('minutes → hours boundary', () => {
    expect(ago(59 * MINUTE_MS + 59 * SECOND_MS)).toBe('59 minit yang lepas')
    expect(ago(HOUR_MS)).toBe('1 jam yang lepas')
    expect(ago(3 * HOUR_MS + 59 * MINUTE_MS)).toBe('3 jam yang lepas')
  })

  it('hours → days boundary', () => {
    expect(ago(23 * HOUR_MS + 59 * MINUTE_MS)).toBe('23 jam yang lepas')
    expect(ago(DAY_MS)).toBe('1 hari yang lepas')
  })

  it('days → weeks boundary (7 days = 1 week, floored)', () => {
    expect(ago(6 * DAY_MS + 23 * HOUR_MS)).toBe('6 hari yang lepas')
    expect(ago(7 * DAY_MS)).toBe('1 minggu yang lepas')
    expect(ago(13 * DAY_MS)).toBe('1 minggu yang lepas')
    expect(ago(14 * DAY_MS)).toBe('2 minggu yang lepas')
  })

  it('weeks → months boundary is a calendar month', () => {
    // 26 Aug → 25 Sep = 30 days, less than one calendar month.
    expect(diffForHumans('2026-08-26 15:40', NOW)).toBe('4 minggu yang lepas')
    expect(diffForHumans('2026-08-25 15:41', NOW)).toBe('4 minggu yang lepas')
    expect(diffForHumans('2026-08-25 15:40', NOW)).toBe('1 bulan yang lepas')
  })

  it('months → years boundary', () => {
    expect(diffForHumans('2025-09-25 15:41', NOW)).toBe('11 bulan yang lepas')
    expect(diffForHumans('2025-09-25 15:40', NOW)).toBe('1 tahun yang lepas')
    expect(diffForHumans('2023-01-01', NOW)).toBe('3 tahun yang lepas')
  })

  it('observed samples', () => {
    // M09 BR-M09-09: 2025-12-24 → "9 bulan yang lepas" at 2026-09-25.
    expect(diffForHumans('2025-12-24', NOW)).toBe('9 bulan yang lepas')
    // M09 E2E card: "7 bulan yang lepas" (article of 2026-02-22).
    expect(diffForHumans('2026-02-22', NOW)).toBe('7 bulan yang lepas')
    // M05/M06: "4 bulan yang lepas" (sessions of 19 May 2026).
    expect(diffForHumans('2026-05-19 03:49', NOW)).toBe('4 bulan yang lepas')
    // M04 BR-M04-16: "2 minggu yang lepas".
    expect(diffForHumans('2026-09-10 09:00', NOW)).toBe('2 minggu yang lepas')
    // M01 BR-20: "{n} jam yang lepas".
    expect(diffForHumans('2026-09-25 13:15', NOW)).toBe('2 jam yang lepas')
  })

  it('future dates read "dari sekarang"', () => {
    expect(diffForHumans(NOW + 3 * HOUR_MS, NOW)).toBe('3 jam dari sekarang')
  })

  it('defaults `now` to the shared clock', () => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    expect(diffForHumans(NOW - 5 * MINUTE_MS)).toBe('5 minit yang lepas')
    clock.advance(DAY_MS)
    expect(diffForHumans(NOW - 5 * MINUTE_MS)).toBe('1 hari yang lepas')
  })
})

describe('calendarDiff', () => {
  it('borrows days from the earlier month (PHP DateTime::diff style)', () => {
    expect(calendarDiff('2026-01-31', '2026-03-01')).toMatchObject({ months: 1, days: 1 })
    expect(calendarDiff('2026-01-31', '2026-02-28')).toMatchObject({ months: 0, days: 28 })
  })

  it('borrows across units and flags inversion', () => {
    expect(calendarDiff('2026-09-24 23:59:59', '2026-09-25 00:00:00')).toEqual({
      years: 0,
      months: 0,
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 1,
      invert: false,
    })
    expect(calendarDiff('2027-01-01', '2026-12-31').invert).toBe(true)
    expect(calendarDiff('2027-01-01', '2026-12-31').days).toBe(1)
  })

  it('works in Malaysian wall time', () => {
    // 23:30 MYT on the 24th → 00:30 MYT on the 25th is 1 hour, same result as UTC input.
    expect(calendarDiff('2026-09-24T15:30:00Z', '2026-09-24T16:30:00Z')).toMatchObject({
      days: 0,
      hours: 1,
    })
  })
})
