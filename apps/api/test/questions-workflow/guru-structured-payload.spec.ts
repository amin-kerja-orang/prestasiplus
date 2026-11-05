import { describe, expect, it } from 'vitest'

import { guruPayloadOf, guruStructuredPayloadOf, guruStructuredTotal, readGuruStructured, readGuruSubmission } from '../../src/modules/intake/files/guru-submissions'
import { StoredPayloadSchema } from '../../src/modules/intake/workflow/item-model'

const input = {
  subjectId: '3',
  educationLevelId: '14',
  chapterId: null,
  spIds: [],
  tp: null,
  cognitiveLevel: 'menganalisis' as const,
  difficultyLevel: 3,
  stimulusImageId: null,
  stimulus: 'Rangsangan sekali sahaja.',
  parts: [
    { text: 'Bahagian a', marks: 3, scheme: 'Skema a', cognitiveLevel: null },
    { text: 'Bahagian b', marks: 5, scheme: 'Skema b', cognitiveLevel: 'menilai' as const },
  ],
}
const codes = { subjectCode: 'MAT', levelCode: 'T4', spCodes: [] }

describe('S6-T17 the stored payload of a structured submission', () => {
  it('is a valid stored intake payload: stimulus once as the stem, parts as parts, total marks computed', () => {
    const payload = guruStructuredPayloadOf(input, codes, { label: '1', page: 1 })
    const stored = StoredPayloadSchema.parse(payload)
    expect(stored.stem).toBe('Rangsangan sekali sahaja.')
    expect(stored.marks).toBe(8)
    expect(guruStructuredTotal(input.parts)).toBe(8)
    expect(stored.parts.map((p) => [p.label, p.prompt, p.marks])).toEqual([
      ['(a)', 'Bahagian a', 3],
      ['(b)', 'Bahagian b', 5],
    ])
    // A part without its own Aras takes the question's.
    expect(stored.parts.map((p) => p.cognitiveLevel)).toEqual(['menganalisis', 'menilai'])
    expect(JSON.stringify(stored.parts)).not.toContain('Rangsangan sekali sahaja.')
  })

  it('round-trips through readGuruStructured and is invisible to the MCQ reader', () => {
    const payload = guruStructuredPayloadOf(input, codes)
    const r = readGuruStructured(payload)
    expect(r?.stimulus).toBe('Rangsangan sekali sahaja.')
    expect(r?.parts.map((p) => [p.text, p.marks, p.scheme])).toEqual([
      ['Bahagian a', 3, 'Skema a'],
      ['Bahagian b', 5, 'Skema b'],
    ])
    expect(readGuruSubmission(payload)).toBeNull()
    const mcq = guruPayloadOf(
      { subjectId: '3', educationLevelId: '14', chapterId: null, spIds: [], tp: null, cognitiveLevel: null, difficultyLevel: 2, correctIndex: 0, explanation: null, questionText: 'S?', options: ['a', 'b', 'c', 'd'] },
      codes,
    )
    expect(readGuruStructured(mcq)).toBeNull()
  })
})
