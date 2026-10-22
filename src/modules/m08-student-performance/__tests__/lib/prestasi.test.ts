import { describe, expect, it, vi } from 'vitest'

import type { ItemAnalysis } from '../../api/types'
import {
  accuracyTone,
  bandOf,
  capPct,
  dec2,
  gapText,
  grouped,
  pct1,
  pctTrim,
  plain,
  ratioPct,
} from '../../lib/prestasi/format'
import { sparklineSeries, trendSeries } from '../../lib/prestasi/gps-chart'
import {
  filterRows,
  indexClass,
  sortRows,
  topicLine,
  type DifficultyRow,
} from '../../lib/prestasi/item-analysis'
import { analisaItemTarget } from '../../routes/analisa-item'

describe('format', () => {
  it('formats counts, percentages and gaps as the live screens do', () => {
    expect(plain(4533)).toBe('4533')
    expect(grouped(478499)).toBe('478,499')
    expect(pct1(79.8)).toBe('79.8%')
    expect(pct1(80)).toBe('80.0%')
    expect(pctTrim(64)).toBe('64%')
    expect(pctTrim(93.3)).toBe('93.3%')
    expect(dec2(3.4)).toBe('3.40')
    expect(gapText(-26)).toBe('-26')
    expect(gapText(-33.3)).toBe('-33.3')
    expect(capPct(126.7)).toBe(100)
  })

  it('bands the GPS (BR-M08-03) and the accuracy (BR-M08-05)', () => {
    expect(bandOf(2)).toBe('Cemerlang')
    expect(bandOf(3.45)).toBe('Baik')
    expect(bandOf(4.54)).toBe('Sederhana')
    expect(bandOf(7.15)).toBe('Perlu Perhatian')
    expect(accuracyTone(49.9)).toBe('low')
    expect(accuracyTone(50)).toBe('mid')
    expect(accuracyTone(70)).toBe('high')
  })

  it('never divides by zero for a bar', () => {
    expect(ratioPct(0, 0)).toBe(0)
    expect(ratioPct(5, 10)).toBe(50)
  })
})

describe('gps chart', () => {
  it('plots the overall line and the subjects that have a value for every plotted year', () => {
    const input = trendSeries({
      labels: [2022, 2023, 2024],
      overall: [5.2, 4.1, null],
      subjects: [
        { name: 'Sains', color: '#fbbf24', data: [5.8, 2.9, null] },
        { name: 'Kimia', color: '#10b981', data: [null, 3.3, null] },
      ],
    })
    expect(input.labels).toEqual(['2022', '2023'])
    expect(input.series.map((x) => x.label)).toEqual(['GPS Keseluruhan', 'Sains'])
    expect(input.series[0]?.data).toEqual([5.2, 4.1])
    expect(input.series[1]?.data).toEqual([5.8, 2.9])
  })

  it('builds the one-line sparkline of S9', () => {
    const input = sparklineSeries([
      { year: 2024, gps: 3.2 },
      { year: 2025, gps: 2.9 },
    ])
    expect(input.labels).toEqual(['2024', '2025'])
    expect(input.series[0]?.data).toEqual([3.2, 2.9])
  })
})

const row = (
  id: number,
  index: number,
  accuracy: number,
  attempts: number,
  text = `Soalan ${String(id)}`,
): DifficultyRow =>
  ({
    questionId: id,
    text,
    subject: 'Kimia',
    topic: null,
    subtopic: null,
    attempts,
    students: 3,
    accuracy,
    index,
    level: 'Sederhana',
    wrongStudents: [],
    correctOption: { letter: 'A', text: 'x' },
    popularWrong: null,
  }) satisfies ItemAnalysis['difficulty'][number]

describe('item analysis helpers', () => {
  const rows = [row(3, 0.5, 50, 8), row(1, 0.5, 50, 4), row(2, 0.9, 10, 8)]

  it('sorts as chosen and breaks ties by question id (DV-M08-17)', () => {
    expect(sortRows(rows, 'difficulty_desc').map((r) => r.questionId)).toEqual([2, 1, 3])
    expect(sortRows(rows, 'difficulty_asc').map((r) => r.questionId)).toEqual([1, 3, 2])
    expect(sortRows(rows, 'accuracy_asc').map((r) => r.questionId)).toEqual([2, 1, 3])
    expect(sortRows(rows, 'accuracy_desc').map((r) => r.questionId)).toEqual([1, 3, 2])
    expect(sortRows(rows, 'attempts_desc').map((r) => r.questionId)).toEqual([2, 3, 1])
  })

  it('filters by a case-insensitive substring and shows no message when nothing matches', () => {
    expect(filterRows(rows, 'SOALAN 2').map((r) => r.questionId)).toEqual([2])
    expect(filterRows(rows, 'zzz')).toEqual([])
    expect(filterRows(rows, '  ')).toHaveLength(3)
  })

  it('colours the discrimination index and joins the topic line without empty parts', () => {
    expect(indexClass(0.4)).toBe('text-success')
    expect(indexClass(0.25)).toBe('text-warning')
    expect(indexClass(-0.5)).toBe('text-error')
    expect(topicLine({ subject: 'Kimia', topic: 'Sel', subtopic: null })).toBe('Kimia — Sel')
  })
})

describe('/analisa-item redirect (OD-R4)', () => {
  it('sends each role to its target', () => {
    expect(analisaItemTarget('admin')).toBe('/analisa-item/kelas')
    expect(analisaItemTarget('teacher')).toBe('/analisa-item/kelas')
    expect(analisaItemTarget('school_admin')).toBe('/analisa-item/sekolah')
    expect(analisaItemTarget('student')).toBe('/dashboard')
    expect(analisaItemTarget('parent')).toBe('/dashboard')
    expect(analisaItemTarget(null)).toBe('/login')
  })

  it('sends a pelajar to the role home, not a fixed /dashboard (D6, 23 Oct sweep)', () => {
    vi.stubEnv('VITE_API_MODE', 'http')
    try {
      expect(analisaItemTarget('student')).toBe('/spm/bijak')
    } finally {
      vi.unstubAllEnvs()
    }
  })
})
