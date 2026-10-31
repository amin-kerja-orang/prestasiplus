import { describe, expect, it } from 'vitest'

import {
  QUESTION_LEAF_MODES,
  QUESTION_STIMULUS_KINDS,
  QuestionPartSchema,
  QuestionPublicPartSchema,
  QuestionStimulusGroupSchema,
  QuestionStimulusSchema,
} from '../../index'

const rt = (ms: string) => ({ ms })
const topics = [
  { id: 'a', label: 'Kepentingan membaca' },
  { id: 'b', label: 'Cinta akan alam sekitar' },
]
const rubric = {
  kind: 'rubric',
  marks: 30,
  criteria: [{ id: 'c1', name: 'Isi' }],
  bands: [{ name: 'Cemerlang', range: [25, 30] }],
}
const leaf = (over: Record<string, unknown> = {}) => ({
  label: '',
  prompt: rt('Pilih satu tajuk dan tulis karangan.'),
  marks: 30,
  mode: 'essay_choice',
  key: rubric,
  topics,
  wordRange: { min: 150, max: 200 },
  ...over,
})

describe('essay_choice leaf (R1-T07, V2 31 approved parts)', () => {
  it('is a leaf mode', () => {
    expect(QUESTION_LEAF_MODES).toContain('essay_choice')
  })

  it('accepts 2 to 6 topics with a rubric or a points key and a word range', () => {
    expect(QuestionPartSchema.safeParse(leaf()).success).toBe(true)
    const six = Array.from({ length: 6 }, (_, i) => ({ id: `t${String(i)}`, label: `Tajuk ${String(i)}` }))
    expect(QuestionPartSchema.safeParse(leaf({ topics: six })).success).toBe(true)
    const points = { kind: 'points', marks: 10, points: [{ id: 'p1', code: 'K', label: 'K1', marks: 10 }] }
    expect(QuestionPartSchema.safeParse(leaf({ key: points, marks: 10 })).success).toBe(true)
  })

  it('rejects fewer than 2 or more than 6 topics, a blank label and duplicate topic ids', () => {
    expect(QuestionPartSchema.safeParse(leaf({ topics: topics.slice(0, 1) })).success).toBe(false)
    expect(QuestionPartSchema.safeParse(leaf({ topics: Array.from({ length: 7 }, (_, i) => ({ id: `t${String(i)}`, label: 'x' })) })).success).toBe(false)
    expect(QuestionPartSchema.safeParse(leaf({ topics: [{ id: 'a', label: '' }, topics[1]] })).success).toBe(false)
    const dup = QuestionPartSchema.safeParse(leaf({ topics: [topics[0], { ...topics[1], id: 'a' }] }))
    expect(dup.success).toBe(false)
    expect(JSON.stringify(dup.error?.issues)).toContain('Setiap tajuk mesti mempunyai id yang berbeza.')
  })

  it('requires topics and refuses a key of another kind (e.g. an option key)', () => {
    expect(QuestionPartSchema.safeParse(leaf({ topics: undefined })).success).toBe(false)
    expect(QuestionPartSchema.safeParse(leaf({ key: { kind: 'option', correct: 'A' } })).success).toBe(false)
  })

  it('the pupil-facing projection keeps the topics and drops the key', () => {
    const out = QuestionPublicPartSchema.parse(leaf()) as Record<string, unknown>
    expect('key' in out).toBe(false)
    expect(out.topics).toEqual(topics)
  })
})

describe('stimulus kinds, caption, source and table (R1-T07)', () => {
  const base = { id: '70', label: 'Rajah 1', body: null, imageId: null, alt: null }

  it('lists the seven V2 kinds and accepts each', () => {
    expect([...QUESTION_STIMULUS_KINDS]).toEqual(['passage', 'image', 'diagram', 'table', 'map', 'infographic', 'graph'])
    for (const kind of QUESTION_STIMULUS_KINDS) expect(QuestionStimulusSchema.safeParse({ ...base, kind }).success).toBe(true)
    expect(QuestionStimulusSchema.safeParse({ ...base, kind: 'audio' }).success).toBe(false)
  })

  it('carries caption, sourceCitation and tableData (all optional)', () => {
    const full = { ...base, kind: 'table', caption: 'Jadual 1', sourceCitation: 'Sumber: contoh', tableData: { head: ['A', 'B'], rows: [['1', '2']] } }
    expect(QuestionStimulusSchema.parse(full)).toEqual(full)
    expect(QuestionStimulusSchema.safeParse({ ...base, kind: 'table' }).success).toBe(true)
    expect(QuestionStimulusSchema.safeParse({ ...base, kind: 'table', tableData: { head: 'A', rows: [] } }).success).toBe(false)
  })

  it('a group holds 1 to 3 stimuli of any kind (D90: one group, members listed once)', () => {
    const group = (n: number) => ({
      id: '9',
      stimuli: Array.from({ length: n }, (_, i) => ({ ...base, id: String(70 + i), kind: QUESTION_STIMULUS_KINDS[i] })),
      questionIds: ['1', '2'],
    })
    expect(QuestionStimulusGroupSchema.safeParse(group(1)).success).toBe(true)
    expect(QuestionStimulusGroupSchema.safeParse(group(3)).success).toBe(true)
    expect(QuestionStimulusGroupSchema.safeParse(group(4)).success).toBe(false)
    expect(QuestionStimulusGroupSchema.safeParse(group(0)).success).toBe(false)
  })
})
