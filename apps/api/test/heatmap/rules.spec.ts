/** BE-48 pure rules (no database): AC3 percent table, bands, AC4 ordering and the grouping of `buildHeatmap`. */
import { HEATMAP_MIN_ATTEMPTS, heatmapBand, heatmapPercent, type HeatmapTopic } from '@pp/contract'
import { describe, expect, it } from 'vitest'

import { buildHeatmap, compareIds, compareNames, compareTopics } from '../../src/modules/heatmap'

/** Round half up of 100 x c / a by exact integer division (independent of the contract's formula). */
function halfUp(c: number, a: number): number {
  const q = Math.floor((100 * c) / a)
  const rem = 100 * c - q * a
  return 2 * rem >= a ? q + 1 : q
}

const topic = (chapterId: string, name: string, attempts: number, correct: number): HeatmapTopic => {
  const percent = heatmapPercent(correct, attempts)
  return { chapterId, name, attempts, correct, percent, band: heatmapBand(percent) }
}

describe('percent and band (AC3)', () => {
  it('matches round-half-up for every pair up to 20 attempts', () => {
    for (let a = 1; a <= 20; a++) {
      for (let c = 0; c <= a; c++) expect(heatmapPercent(c, a), `${String(c)}/${String(a)}`).toBe(halfUp(c, a))
    }
  })

  it('edges: 49.5 -> 50 amber, 79.5 -> 80 green, 0 -> red, 100 -> green, no attempts -> 0', () => {
    expect([heatmapPercent(99, 200), heatmapBand(heatmapPercent(99, 200))]).toEqual([50, 'amber'])
    expect([heatmapPercent(159, 200), heatmapBand(heatmapPercent(159, 200))]).toEqual([80, 'green'])
    expect([heatmapPercent(0, 5), heatmapBand(0)]).toEqual([0, 'red'])
    expect([heatmapPercent(5, 5), heatmapBand(100)]).toEqual([100, 'green'])
    expect(heatmapPercent(0, 0)).toBe(0)
    expect([49, 50, 79, 80].map(heatmapBand)).toEqual(['red', 'amber', 'amber', 'green'])
    // mock rules test
    expect(heatmapPercent(79, 100)).toBe(79)
    expect(heatmapPercent(12, 38)).toBe(32)
  })

  it('the minimum is the mock constant 5 (K-M25-01)', () => {
    expect(HEATMAP_MIN_ATTEMPTS).toBe(5)
  })
})

describe('ordering (AC4)', () => {
  it('ids compare numerically, names by code unit', () => {
    expect(compareIds('9', '10')).toBeLessThan(0)
    expect(compareIds('999999999', '1000000000')).toBeLessThan(0)
    expect(compareIds('7', '7')).toBe(0)
    // code-unit order: upper case before lower case, unlike ms-MY collation (card open question 2)
    expect(compareNames('Zebra', 'apel')).toBeLessThan(0)
  })

  it('accuracy by exact fraction, then name, then numeric id', () => {
    const list = [
      topic('10', 'Sama', 10, 4),
      topic('9', 'Sama', 5, 2),
      topic('3', 'B', 100, 33),
      topic('4', 'A', 6, 2),
      topic('5', 'A', 10, 4),
    ].sort(compareTopics)
    expect(list.map((x) => x.chapterId)).toEqual(['3', '4', '5', '9', '10'])
  })
})

describe('buildHeatmap', () => {
  const subjects = [
    { id: '2', name: 'Sejarah', sortOrder: 5 },
    { id: '1', name: 'Bahasa Melayu', sortOrder: 1 },
    { id: '10', name: 'Seri B', sortOrder: 7 },
    { id: '9', name: 'Seri A', sortOrder: 7 },
  ]
  const chapters = [
    { id: '100', name: 'BM satu', subjectId: '1' },
    { id: '101', name: 'BM dua', subjectId: '1' },
    { id: '200', name: 'Sej', subjectId: '2' },
    { id: '300', name: 'Yatim', subjectId: '404' },
    { id: '900', name: 'Seri B bab', subjectId: '10' },
    { id: '901', name: 'Seri A bab', subjectId: '9' },
  ]

  it('drops rows below the minimum, unknown chapters and subjects; orders subjects by sort order then id', () => {
    const out = buildHeatmap(
      [
        { chapterId: '100', attempts: 5, correct: 5 },
        { chapterId: '101', attempts: 4, correct: 0 },
        { chapterId: '200', attempts: 6, correct: 1 },
        { chapterId: '300', attempts: 9, correct: 1 },
        { chapterId: '555', attempts: 9, correct: 1 },
        { chapterId: '900', attempts: 5, correct: 1 },
        { chapterId: '901', attempts: 5, correct: 1 },
      ],
      chapters,
      subjects,
    )
    expect(out.map((s) => [s.subjectId, s.topics.map((x) => x.chapterId)])).toEqual([
      ['1', ['100']],
      ['2', ['200']],
      ['9', ['901']],
      ['10', ['900']],
    ])
  })

  it('no row at all, or none shown, gives no subject block', () => {
    expect(buildHeatmap([], chapters, subjects)).toEqual([])
    expect(buildHeatmap([{ chapterId: '100', attempts: 4, correct: 4 }], chapters, subjects)).toEqual([])
  })
})
