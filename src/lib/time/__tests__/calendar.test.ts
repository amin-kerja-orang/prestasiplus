import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  addDays,
  dayRange,
  inRange,
  isSameDay,
  isToday,
  monthRange,
  startOfDay,
  weekRange,
  wholeDaysBetween,
  yearRange,
} from '../calendar'
import { CLOCK_ANCHOR_MS, clock } from '../clock'
import { toIsoMyt } from '../zone'

const NOW = CLOCK_ANCHOR_MS // Friday 2026-09-25 15:40 MYT
const iso = (r: { start: number; end: number }) => [toIsoMyt(r.start), toIsoMyt(r.end)]

afterEach(() => {
  clock.reset()
  vi.useRealTimers()
})

describe('day', () => {
  it('startOfDay / dayRange are Malaysian midnight', () => {
    expect(toIsoMyt(startOfDay(NOW))).toBe('2026-09-25T00:00:00+08:00')
    expect(iso(dayRange(NOW))).toEqual(['2026-09-25T00:00:00+08:00', '2026-09-26T00:00:00+08:00'])
  })

  it('isToday switches at 00:00 MYT (16:00 UTC)', () => {
    expect(isToday('2026-09-25 00:00:00', NOW)).toBe(true)
    expect(isToday('2026-09-25 23:59:59', NOW)).toBe(true)
    expect(isToday('2026-09-24 23:59:59', NOW)).toBe(false)
    expect(isToday('2026-09-24T16:00:00Z', NOW)).toBe(true)
    expect(isSameDay('2026-09-24T15:59:59Z', '2026-09-24T16:00:00Z')).toBe(false)
  })

  it('isToday defaults to the shared clock', () => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    expect(isToday('2026-09-25')).toBe(true)
    clock.setNow('2026-09-26T00:00:00+08:00')
    expect(isToday('2026-09-25')).toBe(false)
  })

  it('an expiry date is valid through the end of that day (M07 BR-M07-16)', () => {
    const expiresAt = '2026-09-25'
    expect(NOW < dayRange(expiresAt).end).toBe(true)
    expect(addDays(NOW, 1) < dayRange(expiresAt).end).toBe(false)
  })
})

describe('week (Monday start)', () => {
  it('anchor week is 21–27 Sep 2026 (M05 §6.12)', () => {
    expect(iso(weekRange(NOW))).toEqual(['2026-09-21T00:00:00+08:00', '2026-09-28T00:00:00+08:00'])
  })

  it('Sunday belongs to the week that started on Monday', () => {
    const sunday = weekRange('2026-09-27 23:59:59')
    expect(toIsoMyt(sunday.start)).toBe('2026-09-21T00:00:00+08:00')
    expect(toIsoMyt(weekRange('2026-09-28 00:00').start)).toBe('2026-09-28T00:00:00+08:00')
    expect(inRange('2026-09-28 00:00', weekRange(NOW))).toBe(false)
    expect(inRange('2026-09-21 00:00', weekRange(NOW))).toBe(true)
  })

  it('crosses month and year boundaries', () => {
    expect(toIsoMyt(weekRange('2027-01-01').start)).toBe('2026-12-28T00:00:00+08:00')
  })
})

describe('month and year', () => {
  it('monthRange', () => {
    expect(iso(monthRange(NOW))).toEqual(['2026-09-01T00:00:00+08:00', '2026-10-01T00:00:00+08:00'])
    expect(iso(monthRange('2026-12-31 23:59'))).toEqual([
      '2026-12-01T00:00:00+08:00',
      '2027-01-01T00:00:00+08:00',
    ])
  })

  it('yearRange', () => {
    expect(iso(yearRange(NOW))).toEqual(['2026-01-01T00:00:00+08:00', '2027-01-01T00:00:00+08:00'])
  })

  it('month range uses MYT, so 1 Oct 00:30 MYT (30 Sep UTC) is October', () => {
    expect(inRange('2026-09-30T16:30:00Z', monthRange(NOW))).toBe(false)
  })
})

describe('day arithmetic', () => {
  it('addDays and "{n} hari bersama" (M08 BR-M08-25, floor)', () => {
    expect(toIsoMyt(addDays(NOW, -7))).toBe('2026-09-18T15:40:00+08:00')
    expect(wholeDaysBetween('2026-09-18 15:40', NOW)).toBe(7)
    expect(wholeDaysBetween('2026-09-18 15:41', NOW)).toBe(6)
    expect(wholeDaysBetween(NOW, NOW)).toBe(0)
  })
})
