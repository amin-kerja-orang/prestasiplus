import { describe, expect, it } from 'vitest'

import { bandOf, grouped, parseId, parseRange, pctInt } from '../../components/laporan/format'
import { trendData, trendOptions } from '../../components/laporan/trend-chart'
import { clip80, discLabel, discNote, pctLabel } from '../../components/analisis-item/bands'

describe('S1 query helpers', () => {
  it('parseRange: only 7, 30 and 90 are kept (BR-M11-06)', () => {
    expect(parseRange('7')).toBe(7)
    expect(parseRange('30')).toBe(30)
    expect(parseRange('90')).toBe(90)
    for (const bad of ['999', '0', '', 'abc', undefined, null, '7.5', '-7', ['x']]) {
      expect(parseRange(bad)).toBe(30)
    }
    expect(parseRange(['7', '90'])).toBe(7)
  })

  it('parseId: positive integers only', () => {
    expect(parseId('2001')).toBe(2001)
    expect(parseId('')).toBeUndefined()
    expect(parseId('0')).toBeUndefined()
    expect(parseId('-3')).toBeUndefined()
    expect(parseId('1e3')).toBeUndefined()
    expect(parseId(undefined)).toBeUndefined()
  })

  it('pctInt: integer percent, 0% when the population is empty', () => {
    expect(pctInt(1708, 3152)).toBe('54%')
    expect(pctInt(0, 0)).toBe('0%')
    expect(pctInt(8, 8)).toBe('100%')
    expect(pctInt(5, 8)).toBe('63%')
  })

  it('grouped: thousands separators', () => {
    expect(grouped(4158)).toBe('4,158')
    expect(grouped(14)).toBe('14')
  })

  it('bandOf: ≥ 70 green, 50–69.9 amber, < 50 red (BR-M11-22)', () => {
    expect(bandOf(70)).toBe('green')
    expect(bandOf(69.9)).toBe('amber')
    expect(bandOf(50)).toBe('amber')
    expect(bandOf(49.9)).toBe('red')
    expect(bandOf(0)).toBe('red')
  })
})

describe('S1 trend chart config', () => {
  it('maps the trend to labels and counts', () => {
    const d = trendData([
      { date: '15/09', count: 4 },
      { date: '16/09', count: 0 },
    ])
    expect(d.labels).toEqual(['15/09', '16/09'])
    expect(d.datasets[0]!.data).toEqual([4, 0])
  })

  it('raises the tick fonts to 12 (DV-M11-23) and starts y at 0 with step 1', () => {
    expect(trendOptions.scales!.x).toMatchObject({
      ticks: { font: { size: 12 }, maxTicksLimit: 15 },
    })
    expect(trendOptions.scales!.y).toMatchObject({
      beginAtZero: true,
      ticks: { stepSize: 1, font: { size: 12 } },
    })
  })
})

describe('S6 table helpers', () => {
  it('pctLabel drops a trailing .0', () => {
    expect(pctLabel(75)).toBe('75%')
    expect(pctLabel(12.5)).toBe('12.5%')
    expect(pctLabel(33.333)).toBe('33.3%')
  })

  it('discLabel / discNote', () => {
    expect(discLabel(0.3333)).toBe('0.33')
    expect(discLabel(null)).toBe('-')
    expect(discNote(0.31)).toBe('baik')
    expect(discNote(0.3)).toBeNull()
    expect(discNote(0)).toBeNull()
    expect(discNote(-0.01)).toBe('semak semula')
    expect(discNote(null)).toBeNull()
  })

  it('clip80 keeps 80 characters and appends an ellipsis', () => {
    expect(clip80('abc')).toBe('abc')
    expect(clip80('a'.repeat(80))).toBe('a'.repeat(80))
    expect(clip80('a'.repeat(81))).toBe(`${'a'.repeat(80)}…`)
  })
})
