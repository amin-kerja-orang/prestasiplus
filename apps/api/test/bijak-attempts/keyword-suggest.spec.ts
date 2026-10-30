/**
 * R1-B13: the keyword suggestion (port of V2 `RubricKeywordMarker`) and R1-B12 `applySelfMarks`, as pure
 * unit tests (no database). Fixtures are table driven: BM answers against BM scheme points.
 */
import { describe, expect, it } from 'vitest'

import { assembleResult, gradeAttempt } from '../../src/modules/bijak/attempts/marking'
import { applySelfMarks, decorateResult } from '../../src/modules/bijak/attempts/self-mark'
import { suggestFromPoints, tokenize } from '../../src/modules/bijak/attempts/keyword-suggest'
import type { BijakQuestionBundle } from '../../src/modules/bijak/attempts/ports'
import type { SectionSnapshot } from '../../src/modules/bijak/attempts/exam-core.adapter'

const pts = (...items: [string, number][]) => items.map(([label, marks], i) => ({ id: `p${String(i + 1)}`, label, marks }))

describe('tokenize (V2 :138-145)', () => {
  it('lower-cases, strips tags, splits on punctuation and hyphens, drops stop-words', () => {
    expect(tokenize('<b>Undang-Undang</b> yang DAN dengan Perlembagaan!')).toEqual(['undang', 'undang', 'perlembagaan'])
    expect(tokenize('   ')).toEqual([])
  })
})

describe('suggestFromPoints (V2 RubricKeywordMarker)', () => {
  const cases: { name: string; points: [string, number][]; answer: string; max: number; mark: number; matched: number }[] = [
    { name: 'sums the marks of matched points', points: [['Rundingan dengan pihak British', 1], ['Pilihan raya umum pertama', 2], ['Perlembagaan digubal', 1]], answer: 'Terdapat rundingan dan pilihan raya', max: 4, mark: 3, matched: 2 },
    { name: 'one shared word of 5+ letters is enough (generous)', points: [['Kerjasama parti politik pelbagai kaum', 2]], answer: 'Parti-parti politik bekerjasama.', max: 2, mark: 2, matched: 1 },
    { name: 'case and spacing do not matter', points: [['Menyimpan air', 1]], answer: '   MENYIMPAN    AIR  ', max: 1, mark: 1, matched: 1 },
    { name: 'no keyword -> 0 (not stamped as a mark)', points: [['Menyimpan air', 1], ['Mengekalkan turgor', 1]], answer: 'tidak tahu langsung', max: 2, mark: 0, matched: 0 },
    { name: 'short alphabetic words never match', points: [['baik', 1]], answer: 'baik baik', max: 1, mark: 0, matched: 0 },
    { name: 'a short numeric point needs its digit tokens (mod = 7)', points: [['7', 1]], answer: 'Mod ialah 7', max: 1, mark: 1, matched: 1 },
    { name: 'a coordinate needs ALL its digits, not an incidental 1', points: [['(3,1)', 2]], answer: 'titik 1', max: 2, mark: 0, matched: 0 },
    { name: 'a coordinate with every digit matches', points: [['(3,1)', 2]], answer: 'titik (3, 1)', max: 2, mark: 2, matched: 1 },
    { name: 'points without marks: proportional share round(max * matched / total)', points: [['Fakta pertama dinyatakan', 0], ['Huraian kedua diberi', 0], ['Contoh ketiga disebut', 0]], answer: 'fakta dinyatakan dan contoh disebut', max: 10, mark: 7, matched: 2 },
    { name: 'clamped to the part marks', points: [['Fakta pertama', 5], ['Huraian kedua', 5]], answer: 'fakta pertama huraian kedua', max: 4, mark: 4, matched: 2 },
    { name: 'empty labels are skipped, not counted in the total', points: [['', 1], ['Perlembagaan', 1]], answer: 'perlembagaan', max: 1, mark: 1, matched: 1 },
  ]
  it.each(cases)('$name', ({ points, answer, max, mark, matched }) => {
    const s = suggestFromPoints(pts(...points), answer, max)
    expect(s.suggestedMark).toBe(mark)
    expect(s.matched).toBe(matched)
    expect(s.total).toBe(points.filter(([l]) => l !== '').length)
  })

  it('is deterministic: the same answer twice gives the same suggestion (AC-R1-07.4)', () => {
    const p = pts(['Menyimpan air', 1], ['Mengekalkan turgor', 1])
    expect(suggestFromPoints(p, 'Menyimpan AIR', 2)).toEqual(suggestFromPoints(p, 'menyimpan   air', 2))
  })
})

/* ------------------------------------------------------------------------ applySelfMarks */

const bundle = (qid: string, parts: { id: string; marks: number }[]): BijakQuestionBundle => ({
  question: {
    id: qid,
    curriculum: { subject: 'SEJ', unitLabel: 'u', formOrigin: 1 },
    stem: 's',
    parts: parts.map((p) => ({ id: p.id, label: '', prompt: 'p', marks: p.marks, answer: { kind: 'essay' as const } })),
  } as unknown as BijakQuestionBundle['question'],
  schemes: Object.fromEntries(
    parts.map((p) => [
      p.id,
      { kind: 'rubric' as const, marks: p.marks, criteria: [], bands: [{ name: 'Baik', range: [6, 8] as [number, number], descriptor: '' }] },
    ]),
  ),
})

describe('applySelfMarks (V2 recomputeScore with best-N)', () => {
  const composition: SectionSnapshot[] = [{ id: 's1', label: 'B', rule: { type: 'choose', n: 1 }, questionIds: ['q1', 'q2'] }]
  const bundles = new Map([
    ['q1', bundle('q1', [{ id: 'q1-a', marks: 10 }])],
    ['q2', bundle('q2', [{ id: 'q2-a', marks: 10 }])],
  ])
  const answers = new Map([
    ['q1-a', { text: 'jawapan satu' }],
    ['q2-a', { text: 'jawapan dua' }],
  ])
  const base = gradeAttempt(composition, bundles, answers)

  it('the automatic grading leaves written parts waiting', () => {
    expect(base.provisional).toBe(true)
    expect(base.score).toBe(0)
    expect(base.sections[0]!.counted).toEqual(['q1']) // tie: the lower position
  })

  it('a self-mark counts, flips the best-N choice, and clears provisional', () => {
    const r = applySelfMarks(base, composition, { 'q2-a': { mark: 7 } })
    expect(r.sections[0]).toMatchObject({ counted: ['q2'], awarded: 7 })
    expect(r.score).toBe(7)
    expect(r.max).toBe(10)
    expect(r.questions[1]!.parts[0]).toMatchObject({ awarded: 7, status: 'separa', selfMarked: true })
    // q1 is not counted any more, so its waiting part no longer holds the total back
    expect(r.provisional).toBe(false)
    expect(r.pendingReview).toBe(0)
    expect(r.coins).toBe(14)
    expect(r.points).toBe(70)
  })

  it('is pure and repeatable: base untouched, same marks give the same totals', () => {
    const marks = { 'q2-a': { mark: 10, band: 'Cemerlang' } }
    const a = applySelfMarks(base, composition, marks)
    const b = applySelfMarks(base, composition, marks)
    expect(a).toEqual(b)
    expect(a.questions[1]!.parts[0]).toMatchObject({ status: 'betul', band: 'Cemerlang' })
    expect(base.score).toBe(0)
    expect(base.questions[1]!.parts[0]!.selfMarked).toBeUndefined()
  })

  it('never exceeds the part marks even if a stored mark were larger', () => {
    expect(applySelfMarks(base, composition, { 'q1-a': { mark: 99 } }).score).toBe(10)
  })

  it('a self-mark of 0 on a written answer is "salah", not pending; on a blank part it stays "kosong"', () => {
    expect(applySelfMarks(base, composition, { 'q1-a': { mark: 0 } }).questions[0]!.parts[0]!.status).toBe('salah')
    const blankBase = gradeAttempt(composition, bundles, new Map())
    expect(applySelfMarks(blankBase, composition, { 'q1-a': { mark: 0 } }).questions[0]!.parts[0]!.status).toBe('kosong')
  })

  it('a self-mark makes its question "attempted" for best-N, like a V2 response row (ExamBestNScorer.php:75,114)', () => {
    const onlyQ1 = gradeAttempt(composition, bundles, new Map([['q1-a', { text: 'jawapan satu' }]]))
    expect(onlyQ1.questions[1]!.attempted).toBe(false)
    const r = applySelfMarks(onlyQ1, composition, { 'q2-a': { mark: 6 } })
    expect(r.questions[1]!.attempted).toBe(true)
    expect(r.sections[0]).toMatchObject({ counted: ['q2'], awarded: 6 })
    expect(onlyQ1.questions[1]!.attempted).toBe(false) // base untouched
  })

  it('no marks returns the base result as it is', () => {
    expect(applySelfMarks(base, composition, {})).toBe(base)
  })

  it('assembleResult of an unchanged result equals the first grading (refactor guard)', () => {
    const again = assembleResult(composition, structuredClone(base.questions) as never)
    expect(again).toEqual(base)
  })
})

describe('decorateResult', () => {
  it('flags selfMarkable parts and adds no suggestion to a rubric part (AC-R1-07.3)', () => {
    const composition: SectionSnapshot[] = [{ id: 's1', label: 'B', rule: { type: 'all' }, questionIds: ['q1'] }]
    const bundles = new Map([['q1', bundle('q1', [{ id: 'q1-a', marks: 10 }])]])
    const answers = new Map([['q1-a', { text: 'perlembagaan menjadi asas undang-undang' }]])
    const d = decorateResult(gradeAttempt(composition, bundles, answers), bundles, answers)
    expect(d.questions[0]!.parts[0]!.selfMarkable).toBe(true)
    expect(d.questions[0]!.parts[0]!.suggestion).toBeUndefined()
    expect(d.score).toBe(0)
  })
})
