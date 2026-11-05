import type { IntakeQuestion, IntakeStimulus } from '@pp/contract'
import { describe, expect, it } from 'vitest'

import { guruPayloadOf, guruStimulusImageOf, guruStructuredPayloadOf, guruStructuredTotal, readGuruStructured, readGuruSubmission } from '../../src/modules/intake/files/guru-submissions'
import { itemIssues } from '../../src/modules/intake/workflow/gate'
import { StoredPayloadSchema } from '../../src/modules/intake/workflow/item-model'
import { toQuestionInput } from '../../src/modules/intake/workflow/to-question'

const input = {
  subjectId: '3',
  educationLevelId: '14',
  chapterId: null,
  spIds: [],
  tp: null,
  cognitiveLevel: 'menganalisis' as const,
  difficultyLevel: 3,
  stimulusImageId: 'TOKEN-IMG-0123456789ab',
  stimulus: 'Rangsangan sekali sahaja.',
  parts: [
    { text: 'Bahagian a', marks: 3, scheme: 'Skema a', cognitiveLevel: null },
    { text: 'Bahagian b', marks: 5, scheme: 'Skema b', cognitiveLevel: 'menilai' as const },
  ],
}
const codes = { subjectCode: 'MAT', levelCode: 'T4', spCodes: ['1.1.1'] }
const facts = { subjectKnown: true, levelKnown: true, unitKnown: true, unknownSp: [] }

/** The item as the review service reads it (`questionOf`): the stored payload without `guru`/`origin`, plus the columns. */
function questionOf(payload: Record<string, unknown>, over: { unit?: string | null; stimulusId?: string } = {}): IntakeQuestion {
  const { origin: _o, guru: _g, ...p } = StoredPayloadSchema.parse(payload)
  void _o
  void _g
  return { id: '5', label: '1', type: 'structured', ...p, tag: { ...p.tag, unit: over.unit === undefined ? p.tag.unit : over.unit }, ...(over.stimulusId ? { stimulusId: over.stimulusId } : {}), page: 1, lowFields: [], confirmed: [] }
}

describe('S6-T17 the stored payload of a structured submission', () => {
  it('is a valid stored intake payload: parts carry marks and the model answer; the stem is empty (the stimulus is the batch stimulus)', () => {
    const stored = StoredPayloadSchema.parse(guruStructuredPayloadOf(input, codes, { label: '1', page: 1 }))
    expect(stored.stem).toBe('')
    expect(guruStructuredTotal(input.parts)).toBe(8)
    expect(stored.parts.map((p) => [p.label, p.prompt, p.marks, p.mode])).toEqual([
      ['(a)', 'Bahagian a', 3, 'essay'],
      ['(b)', 'Bahagian b', 5, 'essay'],
    ])
    // A part without its own Aras takes the question's.
    expect(stored.parts.map((p) => p.cognitiveLevel)).toEqual(['menganalisis', 'menilai'])
    expect(JSON.stringify(stored)).not.toContain('Rangsangan sekali sahaja.')
    expect(guruStimulusImageOf(guruStructuredPayloadOf(input, codes))).toBe('TOKEN-IMG-0123456789ab')
  })

  it('passes the accept conversion (gate + toQuestionInput) once the admin completed the tag: a structured Draf with the stimulus group', () => {
    const q = questionOf(guruStructuredPayloadOf(input, codes), { unit: 'U1', stimulusId: '9' })
    const stimulus: IntakeStimulus = { id: '9', kind: 'passage', label: 'Rangsangan', alt: 'Rangsangan', text: 'Rangsangan sekali sahaja.' }
    expect(itemIssues(q, stimulus, facts)).toEqual([])
    const out = toQuestionInput(q, { subjectId: '3', educationLevelId: '14', unitId: '7', spIds: ['8'], tp: 3 }, 'GROUP-1')
    expect(out).toMatchObject({ questionType: 'short_answer', stimulusGroupId: 'GROUP-1', status: 'draft' })
    const parts = out.parts as { label: string; marks: number; mode: string; key: { kind: string; marks: number; points: { label: string; marks: number }[] } }[]
    expect(parts.map((p) => [p.label, p.marks, p.mode, p.key.kind])).toEqual([
      ['(a)', 3, 'essay', 'points'],
      ['(b)', 5, 'essay', 'points'],
    ])
    // The teacher's model answer survives as the one mark point worth the part marks.
    expect(parts.map((p) => [p.key.points[0]?.label, p.key.points[0]?.marks])).toEqual([
      ['Skema a', 3],
      ['Skema b', 5],
    ])
  })

  it('a fresh submission is stopped only by the tag the admin still has to complete (unit), never by its scheme or stimulus', () => {
    const q = questionOf(guruStructuredPayloadOf(input, codes), { stimulusId: '9' })
    const stimulus: IntakeStimulus = { id: '9', kind: 'passage', label: 'Rangsangan', alt: 'Rangsangan' }
    const messages = itemIssues(q, stimulus, facts).map((i) => i.message)
    expect(messages).toEqual(['Unit DSKP belum dipilih.'])
  })

  it('round-trips through readGuruStructured and is invisible to the MCQ reader', () => {
    const payload = guruStructuredPayloadOf(input, codes)
    const r = readGuruStructured(payload, 'Rangsangan sekali sahaja.')
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
    expect(readGuruStructured(mcq, null)).toBeNull()
    expect(guruStimulusImageOf(mcq)).toBeNull()
  })
})
