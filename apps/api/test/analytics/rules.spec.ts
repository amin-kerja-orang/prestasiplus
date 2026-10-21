import { describe, expect, it } from 'vitest'

import {
  badgeOf,
  bandOf,
  byName,
  compareIds,
  ddmm,
  levelLabelOf,
  percent,
  periodFromMs,
  periodOf,
  rangeOf,
  reportTypeOfMode,
  round1,
  severityOf,
  statusOf,
  stripHtml,
  tahapOf,
  weekNumberOf,
  weeksUntil,
} from '../../src/modules/reports/analytics/domain/rules'
import { scopeOf } from '../../src/modules/reports/analytics/services/scope'

// Replay of the pure cases of the mock test src/modules/m11-teacher-analytics/__tests__/mock/rules.test.ts.
const NOW = Date.parse('2026-09-25T15:40:00+08:00')

describe('tahap (BR-M11-12)', () => {
  it.each([
    [100, 'Cemerlang'],
    [60.1, 'Cemerlang'],
    [60, 'Sederhana'],
    [20, 'Sederhana'],
    [19.99, 'Rendah'],
    [5, 'Rendah'],
    [4.99, 'Kritikal'],
    [0.1, 'Kritikal'],
    [0, 'Tiada Langsung'],
  ] as const)('%s%% is %s', (p, tahap) => {
    expect(tahapOf(p)).toBe(tahap)
  })
})

describe('filters (BR-M11-06, BR-M11-10)', () => {
  it('range is 7, 30 or 90, anything else (also a non-number) 30', () => {
    expect(['7', '30', '90', '999', '0', undefined, 'abc', '7.5', ' 90 ', '-7', ''].map(rangeOf)).toEqual([7, 30, 90, 30, 30, 30, 30, 30, 90, 30, 30])
  })

  it('an unknown period is all time', () => {
    expect(['7d', '30d', '3m', '', 'x', undefined, '7D'].map(periodOf)).toEqual(['7d', '30d', '3m', '', '', '', ''])
  })

  it('period windows: 7 days, 30 days, 3 calendar months back', () => {
    expect(periodFromMs('', NOW)).toBeNull()
    expect(periodFromMs('7d', NOW)).toBe(Date.parse('2026-09-18T15:40:00+08:00'))
    expect(periodFromMs('30d', NOW)).toBe(Date.parse('2026-08-26T15:40:00+08:00'))
    expect(periodFromMs('3m', NOW)).toBe(Date.parse('2026-06-25T15:40:00+08:00'))
  })
})

describe('weeks (BR-M11-15)', () => {
  it('M1 starts Monday 16/02 and M32 is the week of the clock, ending today', () => {
    const weeks = weeksUntil(NOW)
    expect(weeks).toHaveLength(32)
    expect(weeks[0]).toEqual({ k: 1, from: '16/02', to: '22/02' })
    expect(weeks[31]).toEqual({ k: 32, from: '21/09', to: '25/09' })
    expect(weeks[30]).toEqual({ k: 31, from: '14/09', to: '20/09' })
  })

  it('week numbers: 0 before M1, 18 for 16 June', () => {
    expect(weekNumberOf(Date.parse('2026-02-15T23:59:59+08:00'))).toBe(0)
    expect(weekNumberOf(Date.parse('2026-02-16T00:00:00+08:00'))).toBe(1)
    expect(weekNumberOf(Date.parse('2026-06-16T14:19:57+08:00'))).toBe(18)
    expect(weekNumberOf(NOW)).toBe(32)
  })

  it('labels are dd/mm in Malaysia time', () => {
    expect(ddmm(Date.parse('2026-09-30T23:30:00Z'))).toBe('01/10')
  })
})

describe('people and text', () => {
  it('names sort A to Z with Malay collation, case-insensitive (BR-M11-31)', () => {
    const names = ['nur Aina', 'Adam Haikal Demo', 'Ahmad Danial Demo', 'Afiqah Demo'].map((name) => ({ name }))
    expect(names.sort(byName).map((n) => n.name)).toEqual(['Adam Haikal Demo', 'Afiqah Demo', 'Ahmad Danial Demo', 'nur Aina'])
  })

  it('Tingkatan is one format and ids compare numerically', () => {
    expect([10, 11].map(levelLabelOf)).toEqual(['T4', 'T5'])
    expect(['10', '9', '100'].sort(compareIds)).toEqual(['9', '10', '100'])
  })

  it('status (BR-M11-18): answers win, then login', () => {
    expect(statusOf(3, null)).toBe('aktif')
    expect(statusOf(0, new Date('2026-06-16T14:11:00+08:00'))).toBe('login')
    expect(statusOf(0, null)).toBe('never')
  })

  it('rounding and percentages (BR-M11-11)', () => {
    expect(round1(94.5652)).toBe(94.6)
    expect(percent(1, 0)).toBe(0)
    expect(round1(percent(1708, 3152))).toBe(54.2)
  })

  it('strips question HTML', () => {
    expect(stripHtml('<p>Apakah <b>ciri</b>?&nbsp;&amp; lain</p>')).toBe('Apakah ciri ? & lain')
  })

  it('bands: p > 70 mudah, 40 to 70 sederhana, p < 40 sukar', () => {
    expect([100, 70.1, 70, 40, 39.9, 0].map(bandOf)).toEqual(['mudah', 'mudah', 'sederhana', 'sederhana', 'sukar', 'sukar'])
  })

  it('topic badges and gap severities', () => {
    expect([80, 79.9, 50, 49.9].map(badgeOf)).toEqual(['Kuat', 'Sederhana', 'Sederhana', 'Lemah'])
    expect([29.9, 30, 49.9, 50, 59.9].map(severityOf)).toEqual(['Kritikal', 'Lemah', 'Lemah', 'Perlu Perhatian', 'Perlu Perhatian'])
  })

  it('practice modes map to the S1 types (BR-M11-04)', () => {
    expect(['random', 'chapter', 'revision', 'past_year', 'mission', 'remedial', 'question_set', 'pksk'].map(reportTypeOfMode)).toEqual(Array(8).fill('kuiz'))
    expect(reportTypeOfMode('latih_tubi')).toBe('latihTubi')
    expect(reportTypeOfMode('ramalan')).toBe('trackingA')
  })
})

describe('monitoring scope', () => {
  it('admin sees every school, teacher and school_admin only the own one, and none without a school (never all)', () => {
    expect(scopeOf({ userId: '1', role: 'admin', schoolId: null })).toBeNull()
    expect(scopeOf({ userId: '1', role: 'teacher', schoolId: '7' })).toEqual(['7'])
    expect(scopeOf({ userId: '1', role: 'school_admin', schoolId: '7' })).toEqual(['7'])
    expect(scopeOf({ userId: '1', role: 'school_admin', schoolId: null })).toEqual([])
    expect(scopeOf({ userId: '1', role: 'teacher', schoolId: null })).toEqual([])
  })
})
