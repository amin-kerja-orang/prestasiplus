import { QUESTION_LEAF_MODES, QuestionLeafPartV3Schema, QuestionWriteLeafPartSchema } from '@pp/contract'
import { describe, expect, it } from 'vitest'

import { hydrate, leafToPart, lossOf, toRequestBody, wordRangeOf, type WirePart, type WireQuestion } from '../../../lib/studio/draft'

/**
 * S2-T10 part B: a stored question -> draft -> save body keeps every field the contract carries (`prompt.en`, option
 * `body.en`, `modeConfig`, `stimulusId`, every key field incl. the scheme v2 keys). Fixtures are parsed with the contract
 * schemas first, so they are real contract content.
 */
const rt = (ms: string, en?: string) => (en === undefined ? { ms } : { ms, en })
const opts = (n: number, en = false) => 'ABCDEFGH'.slice(0, n).split('').map((label) => ({ label, body: rt(`Pilihan ${label}`, en ? `Option ${label}` : undefined) }))
const leaf = (over: Record<string, unknown>) => ({ label: 'a', prompt: rt('Soalan?'), marks: 2, ...over })

const pointsV2 = {
  kind: 'points',
  scheme_v: 2,
  marks: 3,
  points: [
    { id: 'p1', code: 'M', label: 'Gunakan F = ma', marks: 1, accept: ['F=ma'], seen: true, ecf: { fromPart: 'a', rule: { op: 'same' } } },
    { id: 'p2', code: 'N', label: 'Gantikan nilai', marks: 1, requires: ['p1'], unit: { value: 'N', mandatory: true } },
    { id: 'p3', code: 'B', label: 'Jawapan', marks: 1 },
  ],
  groups: [{ id: 'g1', pointIds: ['p1', 'p2'], type: 'pair' }],
  finalAnswer: { display: '12 N', accepted: ['12'], tol: 0.5, tolKind: 'abs', unit: 'N' },
  deductions: [{ code: 'unit', amount: 1, scope: 'part' }],
  guidance: rt('Hanya kakitangan'),
}
const rubricV2 = {
  kind: 'rubric',
  scheme_v: 2,
  marks: 10,
  scoring: 'overall',
  criteria: [{ id: 'c1', name: 'Isi' }],
  bands: [{ name: 'Cemerlang', range: [8, 10], descriptors: { c1: 'Lengkap' } }, { name: 'Baik', range: [0, 7] }],
}

const FIXTURES: Record<string, Record<string, unknown>> = {
  mcq: leaf({
    mode: 'mcq',
    marks: 1,
    prompt: rt('Pilih.', 'Choose.'),
    options: opts(4, true),
    key: { kind: 'option', correct: 'B', accepted: ['B', 'D'], note: 'D juga diterima' },
    stimulusId: '7',
    reveal: 'after_submit',
    difficultyTp: 2,
  }),
  mcq_multi: leaf({ mode: 'mcq', options: opts(5), key: { kind: 'options', correctOptionIds: ['A', 'C'], note: 'Dua jawapan' }, modeConfig: { multi: true } }),
  match_letter: leaf({ mode: 'match_letter', label: '33', key: { kind: 'mapping', map: { '33': 'C' }, bankUnique: true } }),
  short_text: leaf({
    mode: 'short_text',
    key: { kind: 'accepted', values: ['kuprum', 'tembaga'], caseSensitive: true, anyOrder: true },
    blankCount: 2,
    modeConfig: { maxWords: 3, preFill: 'Jawapan: ' },
  }),
  numeric: leaf({
    mode: 'numeric',
    key: { kind: 'accepted', values: [{ v: 9.8, tol: 0.1, tolKind: 'rel', unit: 'm/s2', unitAlt: ['m s-2'], sigFigs: 2, decimals: null }, { v: 10 }] },
    modeConfig: { dependsOnPart: 'a' },
  }),
  working: leaf({ mode: 'working', marks: 3, key: pointsV2, modeConfig: { dependsOnPart: 'a' } }),
  essay: leaf({
    mode: 'essay',
    marks: 10,
    key: rubricV2,
    wordRange: { min: 100, max: 200 },
    modeConfig: { wordRange: { min: 100, max: 200 }, hardLimit: true, answerSpace: 'long', preFill: 'Kepada:' },
  }),
  essay_choice: leaf({
    mode: 'essay_choice',
    marks: 10,
    key: rubricV2,
    topics: [{ id: 't1', label: 'Surat rasmi' }, { id: 't2', label: 'Ucapan' }],
    modeConfig: {
      wordRange: { min: 120, max: 180 },
      alternatives: [{ id: 't1', prompt: rt('Tulis surat.', 'Write a letter.'), stimulusId: '70' }, { id: 't2', prompt: rt('Tulis ucapan.') }],
    },
  }),
  example: leaf({ mode: 'short_text', marks: 0, key: { kind: 'accepted', values: ['contoh'] }, modeConfig: { example: { answer: 'contoh' } } }),
  drawing: leaf({ mode: 'drawing', key: pointsV2, modeConfig: { drawingKind: 'graf', answerTemplate: { imageId: '5' } } }),
  table_fill: leaf({
    mode: 'table_fill',
    key: { kind: 'mapping', cells: { r2c2: ['4'] } },
    modeConfig: { grid: { rows: 2, cols: 2, cells: [[{ type: 'tajuk', text: rt('A') }, { type: 'tajuk', text: rt('B') }], [{ type: 'diberi', text: rt('1') }, { type: 'kosong' }]] } },
  }),
  pksk_choice: leaf({ mode: 'pksk_choice', options: opts(3), key: { kind: 'options', correct: ['A'] } }),
}

const question = (part: Record<string, unknown>): WireQuestion => ({
  subjectId: '3',
  educationLevelId: '7',
  difficultyLevel: 3,
  questionText: 'Soalan yang cukup panjang.',
  questionImage: null,
  curriculumChapterId: null,
  parts: [part],
  tag: { unitId: null, spIds: [], tp: null },
})
const part0 = (body: Record<string, unknown>): Record<string, unknown> => (body.parts as Record<string, unknown>[])[0]!

describe('lossless draft round trip (S2-T10 part B)', () => {
  it('has a fixture for every leaf mode of the contract', () => {
    for (const m of QUESTION_LEAF_MODES) expect(Object.values(FIXTURES).some((f) => f.mode === m), m).toBe(true)
  })

  it.each(Object.entries(FIXTURES))('%s: the fixture is valid contract content', (_name, fx) => {
    const r = QuestionLeafPartV3Schema.safeParse(fx)
    expect(r.error?.issues ?? []).toEqual([])
  })

  it.each(Object.entries(FIXTURES))('%s: lossOf reports nothing lost', (_name, fx) => {
    expect(lossOf(fx as unknown as WirePart)).toEqual([])
  })

  const EDITABLE = Object.entries(FIXTURES).filter(([, f]) => !['drawing', 'table_fill', 'pksk_choice'].includes(f.mode as string))
  it.each(EDITABLE)('%s: stored -> draft -> save body is the same part', (_name, fx) => {
    const h = hydrate(question(fx))
    expect(h.unsupported).toEqual([])
    const saved = part0(toRequestBody(h.draft))
    expect(saved).toEqual(fx)
  })

  it.each(EDITABLE)('%s: a second round trip changes nothing', (_name, fx) => {
    const once = part0(toRequestBody(hydrate(question(fx)).draft))
    const twice = part0(toRequestBody(hydrate(question(once)).draft))
    expect(twice).toEqual(once)
  })

  it('keeps the modes the Studio cannot edit yet read-only instead of dropping them (part D)', () => {
    for (const name of ['drawing', 'table_fill', 'pksk_choice']) {
      const h = hydrate(question(FIXTURES[name]!))
      expect(h.unsupported, name).toHaveLength(1)
      expect(h.unsupported[0]).toContain('belum boleh disunting')
    }
  })

  it('keeps an unknown top-level leaf field (carried verbatim)', () => {
    const fx = { ...FIXTURES.short_text!, futureField: { a: 1 } }
    expect(part0(toRequestBody(hydrate(question(fx)).draft))).toEqual(fx)
  })

  it('still refuses a shape the form cannot hold (untrimmed accepted text, match map of another leaf)', () => {
    expect(lossOf({ ...(FIXTURES.short_text as unknown as WirePart), key: { kind: 'accepted', values: [' a '] } })).toContain('key.values')
    expect(lossOf({ ...(FIXTURES.match_letter as unknown as WirePart), key: { kind: 'mapping', map: { '34': 'C' } } })).toContain('key.map')
    expect(lossOf({ ...(FIXTURES.mcq as unknown as WirePart), key: { kind: 'accepted', values: ['x'] } })).toContain('key.kind')
  })

  it('an edit lands on top of the stored key: a changed correct option keeps the accepted list and the note', () => {
    const h = hydrate(question(FIXTURES.mcq!))
    h.draft.leaves[0]!.correct = 'C'
    const out = part0(toRequestBody(h.draft))
    expect(out.key).toEqual({ kind: 'option', correct: 'C', accepted: ['B', 'D'], note: 'D juga diterima' })
  })

  it('what a form writes for a new leaf of each new mode is valid contract content', () => {
    const h = hydrate(question(FIXTURES.working!))
    const w = h.draft.leaves[0]!
    expect(QuestionWriteLeafPartSchema.safeParse({ ...leafToPart({ ...w, keyBase: null, points: [{ id: 'p1', code: 'M', label: 'Kaedah', marks: 3, rest: {} }], final: { display: '12 N', accepted: '12', tolerance: '', unit: 'N' }, modeConfigRest: {} }) }).error?.issues ?? []).toEqual([])
  })

  it('wordRangeOf: none, valid, invalid', () => {
    expect(wordRangeOf({ words: { min: '', max: '' } })).toBeNull()
    expect(wordRangeOf({ words: { min: '10', max: '20' } })).toEqual({ min: 10, max: 20 })
    for (const [min, max] of [['30', '20'], ['10', ''], ['', '20'], ['0', '5001'], ['a', '2']]) expect(wordRangeOf({ words: { min: min!, max: max! } })).toBe('invalid')
  })
})
