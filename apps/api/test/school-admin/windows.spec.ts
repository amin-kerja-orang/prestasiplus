import { describe, expect, it } from 'vitest'

import {
  accuracyOf,
  activityWindow,
  chunk,
  currentMonth,
  dskpStatusOf,
  lastTwelve,
  modeLabelOf,
  monthEnd,
  monthKey,
  monthLabel,
  monthOf,
  monthStart,
  pageOf,
  participationOf,
  pooledPct,
  shiftMonth,
  tingkatanOf,
  usagePeriodOf,
  usageWindow,
} from '../../src/modules/school-admin/reports/windows'

const DAY = 86_400_000
/** 2026-10-19 09:00 MYT. */
const NOW = Date.parse('2026-10-19T09:00:00+08:00')
const TODAY_START = Date.parse('2026-10-19T00:00:00+08:00')

describe('usage window', () => {
  it('an unknown or absent period is 30days', () => {
    expect(usagePeriodOf(undefined)).toBe('30days')
    expect(usagePeriodOf('year')).toBe('30days')
    expect(usagePeriodOf('today')).toBe('today')
    expect(usagePeriodOf('7days')).toBe('7days')
  })
  it('today starts at 00:00 MYT; 7days and 30days are the last N x 24 hours', () => {
    expect(usageWindow('today', NOW)).toEqual({ from: TODAY_START, to: NOW })
    expect(usageWindow('7days', NOW)).toEqual({ from: NOW - 7 * DAY, to: NOW })
    expect(usageWindow('30days', NOW)).toEqual({ from: NOW - 30 * DAY, to: NOW })
  })
  it('just after midnight MYT (still the previous UTC day) the day starts at that MYT midnight', () => {
    const t = Date.parse('2026-10-19T00:30:00+08:00')
    expect(usageWindow('today', t).from).toBe(TODAY_START)
  })
  it('mode labels: Bab, Ulang Kaji, Tracking A, PKSK; every other mode is Latihan', () => {
    expect(['chapter', 'revision', 'ramalan', 'pksk', 'random', 'past_year', 'latih_tubi', 'mission', 'zzz'].map(modeLabelOf)).toEqual([
      'Bab',
      'Ulang Kaji',
      'Tracking A',
      'PKSK',
      'Latihan',
      'Latihan',
      'Latihan',
      'Latihan',
      'Latihan',
    ])
  })
})

describe('activity window', () => {
  it('starts at 00:00 MYT of (today - range + 1) and ends now', () => {
    expect(activityWindow(7, NOW)).toEqual({ from: TODAY_START - 6 * DAY, to: NOW, today: TODAY_START })
    expect(activityWindow(30, NOW).from).toBe(TODAY_START - 29 * DAY)
    expect(activityWindow(90, NOW).from).toBe(TODAY_START - 89 * DAY)
  })
})

describe('months', () => {
  it('a future or invalid bulan is the current month', () => {
    const cur = monthKey(currentMonth(NOW))
    expect(cur).toBe('2026-10')
    expect(monthKey(monthOf(undefined, NOW))).toBe(cur)
    expect(monthKey(monthOf('2026-11', NOW))).toBe(cur)
    expect(monthKey(monthOf('2099-01', NOW))).toBe(cur)
    expect(monthKey(monthOf('2026-13', NOW))).toBe(cur)
    expect(monthKey(monthOf('abc', NOW))).toBe(cur)
    expect(monthKey(monthOf('2026-9', NOW))).toBe(cur)
    expect(monthKey(monthOf('2026-09', NOW))).toBe('2026-09')
    expect(monthKey(monthOf('2026-10', NOW))).toBe('2026-10')
  })
  it('shifts across a year end in both directions', () => {
    expect(monthKey(shiftMonth({ year: 2026, month: 1 }, -1))).toBe('2025-12')
    expect(monthKey(shiftMonth({ year: 2025, month: 12 }, 1))).toBe('2026-01')
    expect(monthKey(shiftMonth({ year: 2026, month: 10 }, -11))).toBe('2025-11')
  })
  it('the 12 months end with the shown month, ascending', () => {
    const keys = lastTwelve({ year: 2026, month: 3 }).map(monthKey)
    expect(keys).toHaveLength(12)
    expect(keys[0]).toBe('2025-04')
    expect(keys[11]).toBe('2026-03')
  })
  it('BM labels', () => {
    expect(monthLabel({ year: 2026, month: 9 })).toBe('September 2026')
    expect(monthLabel({ year: 2026, month: 3 })).toBe('Mac 2026')
    expect(monthLabel({ year: 2026, month: 8 })).toBe('Ogos 2026')
    expect(monthLabel({ year: 2026, month: 12 })).toBe('Disember 2026')
  })
  it('a month runs from 00:00 MYT of day 1 to the last millisecond of its last day', () => {
    expect(monthStart({ year: 2026, month: 10 })).toBe(Date.parse('2026-10-01T00:00:00+08:00'))
    expect(monthEnd({ year: 2026, month: 10 })).toBe(Date.parse('2026-10-31T23:59:59.999+08:00'))
    expect(monthEnd({ year: 2026, month: 2 })).toBe(Date.parse('2026-02-28T23:59:59.999+08:00'))
    expect(monthEnd({ year: 2028, month: 2 })).toBe(Date.parse('2028-02-29T23:59:59.999+08:00'))
  })
})

describe('numbers', () => {
  it('accuracy has 1 decimal, never above 100, and is null without answers', () => {
    expect(accuracyOf(2, 3)).toBe(66.7)
    expect(accuracyOf(5, 5)).toBe(100)
    expect(accuracyOf(7, 5)).toBe(100)
    expect(accuracyOf(0, 0)).toBeNull()
  })
  it('participation is rounded and 0 without pupils', () => {
    expect(participationOf(1, 3)).toBe(33)
    expect(participationOf(2, 3)).toBe(67)
    expect(participationOf(1, 0)).toBe(0)
  })
  it('chunks lists at the given size', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
    expect(chunk([], 2)).toEqual([])
    expect(chunk(Array.from({ length: 2500 }, (_, i) => i)).map((c) => c.length)).toEqual([1000, 1000, 500])
  })
})

describe('DSKP heatmap rules', () => {
  it('pooled percent is floor(100 x correct / answered + 0.5); null when unanswered', () => {
    expect(pooledPct(0, 0)).toBeNull()
    expect(pooledPct(1, 2)).toBe(50)
    expect(pooledPct(1, 3)).toBe(33)
    expect(pooledPct(2, 3)).toBe(67)
    expect(pooledPct(1, 8)).toBe(13)
  })
  it('status thresholds: mahir >= 75, sederhana >= 50, lemah < 50, belum = null', () => {
    expect(dskpStatusOf(null)).toBe('belum')
    expect(dskpStatusOf(0)).toBe('lemah')
    expect(dskpStatusOf(49)).toBe('lemah')
    expect(dskpStatusOf(50)).toBe('sederhana')
    expect(dskpStatusOf(74)).toBe('sederhana')
    expect(dskpStatusOf(75)).toBe('mahir')
    expect(dskpStatusOf(100)).toBe('mahir')
  })
  it('tingkatan is T4 or T5 (case-insensitive); anything else is T4', () => {
    expect(['T5', 't5', ' T5 ', 'T4', 't6', '', undefined].map(tingkatanOf)).toEqual(['t5', 't5', 't5', 't4', 't4', 't4', 't4'])
  })
})

describe('page', () => {
  it('invalid is 1, beyond the last page is the last page', () => {
    expect(pageOf(undefined, 3)).toBe(1)
    expect(pageOf('abc', 3)).toBe(1)
    expect(pageOf('0', 3)).toBe(1)
    expect(pageOf('-2', 3)).toBe(1)
    expect(pageOf('2', 3)).toBe(2)
    expect(pageOf('9', 3)).toBe(3)
    expect(pageOf('5', 0)).toBe(1)
  })
})
