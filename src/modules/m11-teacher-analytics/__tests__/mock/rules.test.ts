/**
 * Pure rules of M11 (SRS M11 v1.10 §4: BR-M11-06, -10, -11, -12, -15, -18, -31) and the M16 reader port
 * (§6.1). No runtime is booted.
 */

import { afterEach, describe, expect, it } from 'vitest'

import {
  byName,
  levelLabelOf,
  periodFromMs,
  periodOf,
  percent,
  rangeOf,
  round1,
  statusOf,
  stripHtml,
  tahapOf,
  weekNumberOf,
  weeksUntil,
} from '../../mock/repository/rules'
import { m16Reads, registerM16Reads, resetM16Reads } from '../../mock/repository/ports'

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
  it('range is 7, 30 or 90, anything else 30', () => {
    expect([7, 30, 90, 999, 0, undefined].map(rangeOf)).toEqual([7, 30, 90, 30, 30, 30])
  })

  it('an unknown period is all time', () => {
    expect(['7d', '30d', '3m', '', 'x', undefined].map(periodOf)).toEqual([
      '7d',
      '30d',
      '3m',
      '',
      '',
      '',
    ])
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
})

describe('people and text', () => {
  it('names sort A→Z with Malay collation, case-insensitive (BR-M11-31)', () => {
    const names = ['nur Aina', 'Adam Haikal Demo', 'Ahmad Danial Demo', 'Afiqah Demo'].map(
      (name) => ({
        name,
      }),
    )
    expect(names.sort(byName).map((n) => n.name)).toEqual([
      'Adam Haikal Demo',
      'Afiqah Demo',
      'Ahmad Danial Demo',
      'nur Aina',
    ])
  })

  it('Tingkatan is one format (DV-M11-07)', () => {
    expect([10, 11].map(levelLabelOf)).toEqual(['T4', 'T5'])
  })

  it('status (BR-M11-18): answers win, then login', () => {
    expect(statusOf(3, null)).toBe('aktif')
    expect(statusOf(0, '2026-06-16T14:11:00+08:00')).toBe('login')
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
})

describe('M16 reader port (SRS M11 §6.1)', () => {
  afterEach(resetM16Reads)
  const range = { from: 0, to: NOW }

  it('reads 0 until M16 registers its reader', () => {
    expect(m16Reads.battles.countFor([1, 2], range).size).toBe(0)
    expect(m16Reads.gameResults.countFor([1, 2], range).size).toBe(0)
  })

  it('delegates to the registered reader (one call, counts per user) and resets', () => {
    registerM16Reads({
      battles: {
        countFor: (ids) =>
          new Map(ids.map((id) => [id, { count: id, correct: 3, answered: 4 }] as const)),
      },
      gameResults: {
        countFor: (ids) => new Map(ids.map((id) => [id, { count: id * 2 }] as const)),
      },
    })
    const b = m16Reads.battles.countFor([1, 2, 3], range)
    expect([...b.entries()]).toEqual([
      [1, { count: 1, correct: 3, answered: 4 }],
      [2, { count: 2, correct: 3, answered: 4 }],
      [3, { count: 3, correct: 3, answered: 4 }],
    ])
    expect(m16Reads.gameResults.countFor([1, 3], range).get(3)).toEqual({ count: 6 })
    resetM16Reads()
    expect(m16Reads.battles.countFor([1], range).size).toBe(0)
  })
})
