import { describe, expect, it } from 'vitest'

import {
  GURU_QUESTION_MESSAGES,
  QUESTION_MESSAGES,
  guruDskpFields,
  guruKeyIndex,
  guruOptionTexts,
  QuestionCreateRequestSchema,
  QuestionGuruCreateRequestSchema,
  QuestionGuruUpdateRequestSchema,
  QuestionListQuerySchema,
  QuestionUpdateRequestSchema,
} from '../../index'

type Res = { error?: { issues: { path: PropertyKey[]; message: string }[] } }
const keyed = (r: Res) => Object.fromEntries((r.error?.issues ?? []).map((i) => [String(i.path[0]), i.message]))
const pathsOf = (r: Res) => (r.error?.issues ?? []).map((i) => i.path.join('.'))
const m = QUESTION_MESSAGES
const good = { subjectId: '3', educationLevelId: '10', difficultyLevel: 3, questionText: 'Soalan contoh fiksyen.' }

describe('admin options key and status copy', () => {
  const mcq = { ...good, questionType: 'mcq', correctAnswer: 1 }
  it('reports a blank option under fields.options, never options.1', () => {
    const r = QuestionCreateRequestSchema.safeParse({ ...mcq, options: ['a', '', 'c', 'd'] })
    expect(pathsOf(r)).toEqual(['options'])
    expect(keyed(r).options).toBe(m.options)
  })
  it('keeps one key for a non-string element and a non-array', () => {
    expect(pathsOf(QuestionCreateRequestSchema.safeParse({ ...mcq, options: ['a', 2, 'c', 'd'] }))).toEqual(['options'])
    expect(keyed(QuestionCreateRequestSchema.safeParse({ ...mcq, options: 'abcd' })).options).toBe(m.options)
  })
  it('gives the BM status message on create and on the list filter', () => {
    expect(keyed(QuestionCreateRequestSchema.safeParse({ ...good, questionType: 'essay', status: 'rejected' })).status).toBe(m.status)
    expect(keyed(QuestionListQuerySchema.safeParse({ status: 'pending_review' })).status).toBe('Status tidak sah.')
  })
  it('accepts a blank or null dskpSpId (clears the tag, as the mock)', () => {
    expect(QuestionUpdateRequestSchema.safeParse({ ...good, dskpSpId: '' }).success).toBe(true)
    expect(QuestionUpdateRequestSchema.safeParse({ ...good, dskpSpId: null }).success).toBe(true)
  })
})

describe('Guru submission body (S6-T06, API-GUR-18): field key and exact copy', () => {
  const base = { subjectId: '3', educationLevelId: '10', difficultyLevel: 3, questionType: 'mcq', questionText: 'Soalan?', options: ['a', 'b', 'c', 'd'], correctAnswer: 'B' }
  const probe = (patch: Record<string, unknown>) => keyed(QuestionGuruCreateRequestSchema.safeParse({ ...base, ...patch }))
  it('accepts a valid MCQ (create and update share the body)', () => {
    expect(QuestionGuruCreateRequestSchema.safeParse(base).success).toBe(true)
    expect(QuestionGuruUpdateRequestSchema.safeParse({ ...base, options: [0, 1, 2, 3].map((id) => ({ id, optionText: `o${String(id)}` })), correctOptionId: 2 }).success).toBe(true)
  })
  it('level, subject, difficulty and type', () => {
    expect(probe({ educationLevelId: '' }).educationLevelId).toBe(GURU_QUESTION_MESSAGES.level)
    expect(probe({ subjectId: undefined }).subjectId).toBe(GURU_QUESTION_MESSAGES.subject)
    for (const d of ['medium', 'easy', 0, 6, undefined]) expect(probe({ difficultyLevel: d }).difficultyLevel).toBe(GURU_QUESTION_MESSAGES.difficulty)
    for (const q of ['true_false', 'essay', 'short_answer']) expect(probe({ questionType: q }).questionType).toBe(GURU_QUESTION_MESSAGES.type)
  })
  it('text, options, key, explanation, tp, aras', () => {
    expect(probe({ questionText: ' ' }).questionText).toBe(GURU_QUESTION_MESSAGES.text)
    expect(probe({ questionText: 'x'.repeat(2001) }).questionText).toBe(GURU_QUESTION_MESSAGES.textLong)
    expect(probe({ options: ['a', '', 'c', 'd'] }).options).toBe('Sila isi pilihan B.')
    expect(probe({ options: ['a', 'b', 'c', 'x'.repeat(501)] }).options).toBe('Pilihan D tidak boleh melebihi 500 aksara.')
    expect(probe({ options: ['a', 'b'] }).options).toBe(GURU_QUESTION_MESSAGES.options)
    expect(probe({ correctAnswer: 'E' }).correctAnswer).toBe(GURU_QUESTION_MESSAGES.correct)
    expect(probe({ correctAnswer: undefined }).correctAnswer).toBe(GURU_QUESTION_MESSAGES.correct)
    expect(probe({ explanation: 'x'.repeat(2001) }).explanation).toBe(GURU_QUESTION_MESSAGES.explanationLong)
    expect(probe({ tp: 7 }).tp).toBe(GURU_QUESTION_MESSAGES.tpRange)
    expect(probe({ cognitiveLevel: 'x' }).cognitiveLevel).toBe(GURU_QUESTION_MESSAGES.cognitive)
    expect(probe({ spIds: ['1', '2', '3', '4'] }).spIds).toBe(GURU_QUESTION_MESSAGES.spMax)
  })
  it('key letters, digits and the correctOptionId alias; options placed by id', () => {
    expect(guruKeyIndex('c')).toBe(2)
    expect(guruKeyIndex('3')).toBe(3)
    expect(guruKeyIndex(4)).toBeUndefined()
    expect(guruOptionTexts([{ id: 1, optionText: 'b' }, { id: 0, optionText: 'a' }, { id: 3, optionText: 'd' }, { id: 2, optionText: 'c' }])).toEqual(['a', 'b', 'c', 'd'])
  })
})

describe('guruDskpFields (D112): Bab, SP, TP, Aras only where they exist', () => {
  const M = GURU_QUESTION_MESSAGES
  it('nothing is required where the Subjek + Tingkatan has neither chapters nor DSKP nodes', () => {
    expect(guruDskpFields({}, { hasChapters: false, hasDskpNodes: false })).toEqual({})
  })
  it('chapters only: Bab is required, the rest is not', () => {
    expect(guruDskpFields({}, { hasChapters: true, hasDskpNodes: false })).toEqual({ chapterId: M.chapter })
  })
  it('DSKP nodes: SP, TP and Aras are required', () => {
    expect(guruDskpFields({}, { hasChapters: false, hasDskpNodes: true })).toEqual({ spIds: M.sp, tp: M.tp, cognitiveLevel: M.cognitive })
    expect(guruDskpFields({ spIds: ['1'], tp: 3, cognitiveLevel: 'memahami' }, { hasChapters: false, hasDskpNodes: true })).toEqual({})
  })
  it('a TP outside 1 to 6 is refused even where optional', () => {
    expect(guruDskpFields({ tp: 9 }, { hasChapters: false, hasDskpNodes: false })).toEqual({ tp: M.tpRange })
  })
})
