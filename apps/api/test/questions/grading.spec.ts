import type { QuestionPart } from '@pp/contract'
import { describe, expect, it } from 'vitest'

import { gradeCells, gradeLeaf, gradeMapping, gradeMcq, gradeNumeric, gradeQuestion, gradeShortText } from '../../src/modules/questions'
import { mockStatusToV2 } from '../../src/modules/questions'

const rich = (ms: string) => ({ ms })
const graded = (correct: boolean, marks: number, maxMarks: number) => ({ kind: 'graded', correct, marks, maxMarks })

describe('pure grading (no database)', () => {
  it('mcq: the label decides, case and spaces ignored, wrong label scores 0', () => {
    expect(gradeMcq({ kind: 'option', correct: 'B' }, 'B', 2)).toEqual(graded(true, 2, 2))
    expect(gradeMcq({ kind: 'option', correct: 'B' }, ' b ', 2)).toEqual(graded(true, 2, 2))
    expect(gradeMcq({ kind: 'option', correct: 'B' }, 'C', 2)).toEqual(graded(false, 0, 2))
  })

  it('short_text: trim, collapse spaces, case-insensitive by default, any accepted value', () => {
    const key = { kind: 'accepted' as const, values: ['Kuala Lumpur', 'KL'] }
    expect(gradeShortText(key, '  kuala   lumpur ', 1)).toMatchObject({ correct: true })
    expect(gradeShortText(key, 'kl', 1)).toMatchObject({ correct: true })
    expect(gradeShortText(key, 'Johor', 1)).toMatchObject({ correct: false, marks: 0 })
  })

  it('short_text: caseSensitive keeps case; anyOrder matches the set of tokens', () => {
    expect(gradeShortText({ kind: 'accepted', values: ['NaCl'], caseSensitive: true }, 'nacl', 1)).toMatchObject({ correct: false })
    expect(gradeShortText({ kind: 'accepted', values: ['NaCl'], caseSensitive: true }, 'NaCl', 1)).toMatchObject({ correct: true })
    const key = { kind: 'accepted' as const, values: ['merah', 'biru'], anyOrder: true }
    expect(gradeShortText(key, 'Biru; Merah', 2)).toMatchObject({ correct: true, marks: 2 })
    expect(gradeShortText(key, 'merah', 2)).toMatchObject({ correct: false })
    expect(gradeShortText(key, 'merah, biru, hijau', 2)).toMatchObject({ correct: false })
  })

  it('numeric: absolute and relative tolerance, unit check with alternatives', () => {
    const abs = { kind: 'accepted' as const, values: [{ v: 3.14, tol: 0.01, tolKind: 'abs' as const }] }
    expect(gradeNumeric(abs, 3.145, undefined, 1)).toMatchObject({ correct: true })
    expect(gradeNumeric(abs, 3.2, undefined, 1)).toMatchObject({ correct: false })
    const rel = { kind: 'accepted' as const, values: [{ v: 100, tol: 0.05, tolKind: 'rel' as const }] }
    expect(gradeNumeric(rel, 104, undefined, 1)).toMatchObject({ correct: true })
    expect(gradeNumeric(rel, 106, undefined, 1)).toMatchObject({ correct: false })
    const unit = { kind: 'accepted' as const, values: [{ v: 5, unit: 'm', unitAlt: ['meter'] }] }
    expect(gradeNumeric(unit, 5, 'm', 2)).toMatchObject({ correct: true })
    expect(gradeNumeric(unit, 5, 'Meter', 2)).toMatchObject({ correct: true })
    expect(gradeNumeric(unit, 5, 'cm', 2)).toMatchObject({ correct: false })
    expect(gradeNumeric(unit, 5, undefined, 2)).toMatchObject({ correct: false })
    expect(gradeNumeric(abs, Number.NaN, undefined, 1)).toMatchObject({ correct: false })
  })

  it('match_letter and table_fill are all or nothing', () => {
    const map = { kind: 'mapping' as const, map: { '1': 'A', '2': 'C' } }
    expect(gradeMapping(map, { '1': 'a', '2': 'C' }, 2)).toMatchObject({ correct: true, marks: 2 })
    expect(gradeMapping(map, { '1': 'A', '2': 'B' }, 2)).toMatchObject({ correct: false, marks: 0 })
    expect(gradeMapping(map, { '1': 'A' }, 2)).toMatchObject({ correct: false })
    const cells = { kind: 'mapping' as const, cells: { r1c1: ['10', 'sepuluh'], r1c2: ['20'] } }
    expect(gradeCells(cells, { r1c1: 'Sepuluh', r1c2: '20' }, 2)).toMatchObject({ correct: true })
    expect(gradeCells(cells, { r1c1: '10' }, 2)).toMatchObject({ correct: false })
  })

  it('subjective modes return needs_review, never a score', () => {
    const points = { kind: 'points' as const, marks: 3, points: [{ id: 'p1', code: 'K' as const, label: 'Kaedah', marks: 3 }] }
    for (const mode of ['working', 'essay', 'drawing'] as const) {
      const leaf = { label: 'a', prompt: rich('x'), mode, marks: 3, key: points } as unknown as Extract<QuestionPart, { mode: string }>
      expect(gradeLeaf(leaf, { kind: 'text', text: 'jawapan' })).toEqual({ kind: 'needs_review', maxMarks: 3 })
    }
  })

  it('a value of the wrong kind for the mode is graded wrong, not thrown', () => {
    const leaf = { label: 'a', prompt: rich('x'), mode: 'mcq', marks: 1, options: [], key: { kind: 'option', correct: 'A' } } as unknown as Extract<QuestionPart, { mode: string }>
    expect(gradeLeaf(leaf, { kind: 'text', text: 'A' })).toMatchObject({ correct: false, marks: 0 })
  })

  it('gradeQuestion walks the tree by path, sums marks and flags review', () => {
    const parts = [
      {
        label: 'a',
        prompt: rich('Bahagian a'),
        children: [
          { label: 'i', prompt: rich('i'), mode: 'short_text', marks: 2, key: { kind: 'accepted', values: ['x'] } },
          { label: 'ii', prompt: rich('ii'), mode: 'short_text', marks: 3, key: { kind: 'accepted', values: ['y'] } },
        ],
      },
      { label: 'b', prompt: rich('b'), mode: 'essay', marks: 5, key: { kind: 'points', marks: 5, points: [{ id: 'p', code: 'K', label: 'k', marks: 5 }] } },
    ] as unknown as QuestionPart[]
    const res = gradeQuestion('1', parts, [
      { path: 'a.i', value: { kind: 'text', text: 'X' } },
      { path: 'a.ii', value: { kind: 'text', text: 'z' } },
    ])
    expect(res.parts.map((p) => p.path)).toEqual(['a.i', 'a.ii', 'b'])
    expect(res.marks).toBe(2)
    expect(res.maxMarks).toBe(10)
    expect(res.needsReview).toBe(true)
  })

  it('a single-leaf question accepts an answer without a path; a missing answer scores 0', () => {
    const parts = [{ label: '1', prompt: rich('q'), mode: 'mcq', marks: 1, options: [], key: { kind: 'option', correct: 'C' } }] as unknown as QuestionPart[]
    expect(gradeQuestion('9', parts, [{ value: { kind: 'option', label: 'C' } }]).marks).toBe(1)
    const none = gradeQuestion('9', parts, [])
    expect(none).toMatchObject({ marks: 0, maxMarks: 1, needsReview: false })
  })

  it('the mock status values map to the v2 codes (AC 11 table)', () => {
    expect(mockStatusToV2('draft')).toBe('draft')
    expect(mockStatusToV2('pending_review')).toBe('review')
    expect(mockStatusToV2('approved')).toBe('approved')
    expect(mockStatusToV2('archived')).toBe('archived')
    expect(mockStatusToV2('rejected')).toBeUndefined()
    expect(mockStatusToV2('constructor')).toBeUndefined()
  })
})
