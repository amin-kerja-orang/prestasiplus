import { describe, expect, it } from 'vitest'

import type { HeadcountDashboardConfig, HeadcountSection } from '../../api/headcount-types'
import { dashboardChartData, segmentColor, studentChartData } from '../../lib/headcount/charts'
import {
  dashboardLevels,
  dashboardStats,
  gradeOfPercent,
  num1,
  onTrackTone,
  percentOf,
  selisihText,
  valueWithGrade,
} from '../../lib/headcount/format'

const cfg = (over: Partial<HeadcountDashboardConfig>): HeadcountDashboardConfig => ({
  id: 1,
  level: 10,
  levelName: 'Tingkatan 4',
  className: '4 A',
  subjectName: 'Sejarah',
  year: 2026,
  onTrack: 0,
  offTrack: 0,
  noData: 0,
  totalStudents: 0,
  chart: { labels: ['OTR1'], target: [60], actual: [null] },
  ...over,
})

describe('BR-M08-02 gradeOfPercent', () => {
  it.each([
    [100, 'A+'],
    [90, 'A+'],
    [89.99, 'A'],
    [80, 'A'],
    [70, 'A-'],
    [65, 'B+'],
    [60, 'B'],
    [55, 'C+'],
    [50, 'C'],
    [45, 'D'],
    [40, 'E'],
    [39.9, 'G'],
    [0, 'G'],
  ])('%s → %s', (value, grade) => {
    expect(gradeOfPercent(value)).toBe(grade)
  })
})

describe('number display', () => {
  it('drops a trailing ".0" and keeps one decimal', () => {
    expect(num1(73)).toBe('73')
    expect(num1(94.1)).toBe('94.1')
    expect(num1(62.14)).toBe('62.1')
    expect(valueWithGrade(75)).toBe('75% (A-)')
  })

  it('Selisih is signed with up to one decimal (FR-M08-127)', () => {
    expect(selisihText(0)).toBe('+0')
    expect(selisihText(0.4)).toBe('+0.4')
    expect(selisihText(-10)).toBe('-10')
    expect(selisihText(-29.9)).toBe('-29.9')
    expect(selisihText(3)).toBe('+3')
  })

  it('percentOf rounds and tolerates an empty total', () => {
    expect(percentOf(7, 15)).toBe(47)
    expect(percentOf(8, 15)).toBe(53)
    expect(percentOf(0, 0)).toBe(0)
  })

  it('"Keseluruhan On-Track" tone: ≥ 70 emerald, ≥ 50 amber, else red (FR-M08-85)', () => {
    expect(onTrackTone(70)).toBe('text-emerald-600')
    expect(onTrackTone(50)).toBe('text-amber-600')
    expect(onTrackTone(49)).toBe('text-red-500')
  })
})

describe('S13 stats and filter', () => {
  const configs = [
    cfg({
      id: 1,
      level: 11,
      levelName: 'Tingkatan 5',
      onTrack: 2,
      offTrack: 1,
      noData: 5,
      totalStudents: 8,
    }),
    cfg({ id: 2, level: 10, onTrack: 1, offTrack: 2, noData: 3, totalStudents: 6 }),
    cfg({ id: 3, level: 11, levelName: 'Tingkatan 5', totalStudents: 4, noData: 4 }),
  ]

  it('sums the filtered configs; the percentages are over tracked pairs (BR-M08-22)', () => {
    expect(dashboardStats(configs)).toMatchObject({
      configs: 3,
      students: 18,
      onTrack: 3,
      offTrack: 3,
      noData: 12,
      tracked: 6,
      onPct: 50,
      offPct: 50,
    })
  })

  it('no tracked pair gives 0%', () => {
    expect(dashboardStats([configs[2] as HeadcountDashboardConfig])).toMatchObject({
      tracked: 0,
      onPct: 0,
      offPct: 0,
    })
    expect(dashboardStats([]).configs).toBe(0)
  })

  it('lists the distinct levels sorted by level id', () => {
    expect(dashboardLevels(configs)).toEqual([
      { level: 10, name: 'Tingkatan 4' },
      { level: 11, name: 'Tingkatan 5' },
    ])
  })

  it('the chart has the Sasaran and Sebenar (AR) datasets (FR-M08-86)', () => {
    const data = dashboardChartData({
      labels: ['OTR1', 'OTR2'],
      target: [60, 65],
      actual: [58, null],
    })
    expect(data.datasets.map((d) => d.label)).toEqual(['Sasaran', 'Sebenar (AR)'])
    expect(data.datasets[0]).toMatchObject({ borderColor: '#94a3b8', borderDash: [5, 5] })
    expect(data.datasets[1]).toMatchObject({ borderColor: '#3b82f6' })
  })
})

describe('S15 chart (FR-M08-95)', () => {
  const base: HeadcountSection = {
    configId: 1,
    subject: 'Sejarah',
    school: null,
    levelName: 'Tingkatan 4',
    className: '4 A',
    year: 2026,
    status: 'on',
    tov: 58,
    etr: 60,
    rs: null,
    projection: null,
    rows: [],
    prediction: null,
    chart: {
      labels: ['TOV', 'OTR1', 'OTR2', 'ETR'],
      target: [58, 59, 60, 60],
      actual: [58, 62, null, null],
      projection: [null, null, null, null],
      rs: null,
    },
  }

  it('Target and AR only without a projection and an RS', () => {
    expect(studentChartData(base).datasets.map((d) => d.label)).toEqual([
      'Target (OTR)',
      'Markah Sebenar (AR)',
    ])
  })

  it('adds the Unjuran and RS datasets, the RS star at the "RS" label', () => {
    const section: HeadcountSection = {
      ...base,
      rs: { value: 61, recordedAt: null },
      projection: { value: 63, variant: 'green', trend: 'Meningkat', confidence: 'Rendah' },
      chart: {
        ...base.chart,
        labels: ['TOV', 'OTR1', 'OTR2', 'ETR', 'RS'],
        target: [58, 59, 60, 60, null],
        actual: [58, 62, null, null, null],
        projection: [null, 62, null, 63, null],
        rs: 61,
      },
    }
    const data = studentChartData(section)
    expect(data.datasets.map((d) => d.label)).toEqual([
      'Target (OTR)',
      'Markah Sebenar (AR)',
      'Unjuran (Trend)',
      'RS (SPM Sebenar)',
    ])
    expect(data.datasets[3]).toMatchObject({
      data: [null, null, null, null, 61],
      pointStyle: 'star',
      pointRadius: 10,
    })
  })

  it('AR segment colour: green at or above the target, red below, grey when missing', () => {
    const actual = [58, 62, 50, null]
    const target = [58, 59, 60, 60]
    expect(segmentColor(actual, target, 1)).toBe('#10b981')
    expect(segmentColor(actual, target, 2)).toBe('#ef4444')
    expect(segmentColor(actual, target, 3)).toBe('#9ca3af')
    expect(segmentColor([1], [null], 0)).toBe('#9ca3af')
  })
})
