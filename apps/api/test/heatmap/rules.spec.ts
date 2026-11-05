/** S10-T05 pure rules (no database): percent and state bands, tiles, grey tiles, listing, ordering, no minimum. */
import { heatmapAccuracy, heatmapBand, heatmapPercent } from '@pp/contract'
import { describe, expect, it } from 'vitest'

import {
  buildHeatmap,
  chapterTile,
  compareChapterRefs,
  compareIds,
  compareNames,
  compareSubjectRefs,
} from '../../src/modules/heatmap'
import type { HeatmapChapterRef, HeatmapSubjectRef } from '../../src/modules/heatmap/heatmap.rules'

/** Round half up of 100 x c / a by exact integer division (independent of the contract's formula). */
function halfUp(c: number, a: number): number {
  const q = Math.floor((100 * c) / a)
  const rem = 100 * c - q * a
  return 2 * rem >= a ? q + 1 : q
}

const chapter = (
  id: string,
  subjectId: string,
  number: number | null,
  name = `Bab ${id}`,
  levelOrder = 10,
): HeatmapChapterRef => ({
  id,
  subjectId,
  number,
  name,
  levelOrder,
})

describe('percent, accuracy and state', () => {
  it('whole percent matches round-half-up for every pair up to 20 attempts', () => {
    for (let a = 1; a <= 20; a++) {
      for (let c = 0; c <= a; c++)
        expect(heatmapPercent(c, a), `${String(c)}/${String(a)}`).toBe(halfUp(c, a))
    }
  })

  it('AC-MUR-14-1: 10 attempts, 4 correct is red with accuracy 40 and whole percent 40', () => {
    const tile = chapterTile(chapter('1', '1', 1), { attempts: 10, correct: 4 })
    expect(tile).toMatchObject({ attempts: 10, correct: 4, accuracy: 40, state: 'red' })
    expect(heatmapPercent(4, 10)).toBe(40)
  })

  it('AC-MUR-14-5: 7 attempts, 4 correct is amber with accuracy 57.1 and whole percent 57', () => {
    const tile = chapterTile(chapter('1', '1', 1), { attempts: 7, correct: 4 })
    expect(tile).toMatchObject({ attempts: 7, correct: 4, accuracy: 57.1, state: 'amber' })
    expect(heatmapPercent(4, 7)).toBe(57)
  })

  it('the state uses the WHOLE percent, not the one-decimal accuracy: 49.5 is amber (whole 50), 79.5 is green (whole 80)', () => {
    expect(chapterTile(chapter('1', '1', 1), { attempts: 200, correct: 99 })).toMatchObject({
      accuracy: 49.5,
      state: 'amber',
    })
    expect(chapterTile(chapter('1', '1', 1), { attempts: 200, correct: 159 })).toMatchObject({
      accuracy: 79.5,
      state: 'green',
    })
    // 49.45 would double-round to 49.5 at one decimal; the band takes the exact fraction (49) -> red
    expect(chapterTile(chapter('1', '1', 1), { attempts: 2000, correct: 989 })).toMatchObject({
      accuracy: 49.5,
      state: 'red',
    })
    expect([0, 49, 50, 79, 80, 100].map(heatmapBand)).toEqual([
      'red',
      'red',
      'amber',
      'amber',
      'green',
      'green',
    ])
  })

  it('accuracy has at most one decimal and no fraction when whole', () => {
    for (let a = 1; a <= 40; a++) {
      for (let c = 0; c <= a; c++) {
        const x = heatmapAccuracy(c, a) as number
        expect(Number(x.toFixed(1))).toBe(x)
      }
    }
    expect(heatmapAccuracy(1, 2)).toBe(50)
  })

  it('no minimum: one attempt is a tile with a band; no attempt is belum-cuba with null accuracy', () => {
    expect(chapterTile(chapter('1', '1', 1), { attempts: 1, correct: 0 })).toMatchObject({
      accuracy: 0,
      state: 'red',
    })
    expect(chapterTile(chapter('1', '1', 1), undefined)).toEqual({
      id: '1',
      number: 1,
      name: 'Bab 1',
      attempts: 0,
      correct: 0,
      accuracy: null,
      state: 'belum-cuba',
    })
  })
})

describe('ordering', () => {
  it('ids compare numerically, names by code unit', () => {
    expect(compareIds('9', '10')).toBeLessThan(0)
    expect(compareIds('7', '7')).toBe(0)
    expect(compareNames('Zebra', 'apel')).toBeLessThan(0)
  })

  it('chapters: Bab number ascending (not text order), no number last, then Tingkatan, then numeric id', () => {
    const list = [
      chapter('30', '1', 10),
      chapter('29', '1', null),
      chapter('28', '1', 2),
      chapter('27', '1', 2, 'T2 dua', 11),
      chapter('26', '1', 2, 'T1 dua', 10),
      chapter('9', '1', 1),
      chapter('10', '1', 1),
    ].sort(compareChapterRefs)
    expect(list.map((c) => c.id)).toEqual(['9', '10', '26', '28', '27', '30', '29'])
  })

  it('subjects: Subjek Teras first, then name ascending, then numeric id', () => {
    const subjects: HeatmapSubjectRef[] = [
      { id: '3', name: 'Biologi', isCore: false },
      { id: '2', name: 'Sejarah', isCore: true },
      { id: '1', name: 'Bahasa Melayu', isCore: true },
      { id: '11', name: 'Kimia', isCore: false },
      { id: '10', name: 'Kimia', isCore: false },
    ]
    expect(subjects.sort(compareSubjectRefs).map((s) => s.id)).toEqual(['1', '2', '3', '10', '11'])
  })
})

describe('buildHeatmap', () => {
  const subjects: HeatmapSubjectRef[] = [
    { id: '1', name: 'Matematik', isCore: true },
    { id: '2', name: 'Biologi', isCore: false },
    { id: '3', name: 'Sains', isCore: false },
  ]
  const chapters = [
    chapter('12', '1', 2),
    chapter('11', '1', 1),
    chapter('13', '1', 3),
    chapter('21', '2', 1),
    chapter('31', '3', 1),
  ]

  it('lists every chapter of a practised subject; unattempted ones are grey; Bab number ascending', () => {
    const out = buildHeatmap(
      [{ chapterId: '12', attempts: 10, correct: 4 }],
      [{ id: '12', subjectId: '1' }],
      chapters,
      subjects,
    )
    expect(out).toHaveLength(1)
    expect(out[0]?.chapters.map((c) => [c.id, c.attempts, c.accuracy, c.state])).toEqual([
      ['11', 0, null, 'belum-cuba'],
      ['12', 10, 40, 'red'],
      ['13', 0, null, 'belum-cuba'],
    ])
  })

  it('a subject without an attempt on a Bab-linked question is not listed', () => {
    const out = buildHeatmap(
      [{ chapterId: '21', attempts: 1, correct: 1 }],
      [{ id: '21', subjectId: '2' }],
      chapters,
      subjects,
    )
    expect(out.map((s) => s.id)).toEqual(['2'])
  })

  it('orders the subjects Subjek Teras first, then by name', () => {
    const out = buildHeatmap(
      [
        { chapterId: '31', attempts: 2, correct: 2 },
        { chapterId: '21', attempts: 2, correct: 1 },
        { chapterId: '11', attempts: 3, correct: 1 },
      ],
      [
        { id: '31', subjectId: '3' },
        { id: '21', subjectId: '2' },
        { id: '11', subjectId: '1' },
      ],
      chapters,
      subjects,
    )
    expect(out.map((s) => s.name)).toEqual(['Matematik', 'Biologi', 'Sains'])
  })

  it('no minimum: a single answer lists its subject', () => {
    const out = buildHeatmap(
      [{ chapterId: '31', attempts: 1, correct: 0 }],
      [{ id: '31', subjectId: '3' }],
      chapters,
      subjects,
    )
    expect(out[0]?.chapters[0]).toMatchObject({ id: '31', attempts: 1, accuracy: 0, state: 'red' })
  })

  it('skips unknown chapters and subjects; no row gives an empty list; a practised subject with no listable chapter has no block', () => {
    expect(buildHeatmap([], [], chapters, subjects)).toEqual([])
    expect(
      buildHeatmap(
        [{ chapterId: '999', attempts: 5, correct: 5 }],
        [{ id: '999', subjectId: '404' }],
        chapters,
        subjects,
      ),
    ).toEqual([])
    expect(
      buildHeatmap(
        [{ chapterId: '55', attempts: 5, correct: 5 }],
        [{ id: '55', subjectId: '2' }],
        [chapter('99', '3', 1)],
        subjects,
      ),
    ).toEqual([])
  })

  it('an attempt on a chapter that is not listable (Darjah or inactive) still makes the subject practised, but adds no tile', () => {
    const out = buildHeatmap(
      [{ chapterId: '55', attempts: 4, correct: 4 }],
      [{ id: '55', subjectId: '1' }],
      chapters,
      subjects,
    )
    expect(out[0]?.chapters.map((c) => c.id)).toEqual(['11', '12', '13'])
    expect(out[0]?.chapters.every((c) => c.state === 'belum-cuba')).toBe(true)
  })
})
