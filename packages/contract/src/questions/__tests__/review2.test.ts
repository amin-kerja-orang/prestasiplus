import { describe, expect, it } from 'vitest'

import {
  QUESTION_MESSAGES,
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

describe('Guru create: one test per mock rule (field key and exact copy)', () => {
  const base = { educationLevelId: '10', subjectId: '3', questionType: 'essay', difficultyLevel: 'medium', questionText: 'Soalan?' }
  const probe = (patch: Record<string, unknown>) => keyed(QuestionGuruCreateRequestSchema.safeParse({ ...base, ...patch }))
  it('accepts a valid essay', () => expect(QuestionGuruCreateRequestSchema.safeParse(base).success).toBe(true))
  it('level, subject, difficulty, type, text', () => {
    expect(probe({ educationLevelId: undefined }).educationLevelId).toBe(m.level)
    expect(probe({ subjectId: undefined }).subjectId).toBe(m.subject)
    expect(probe({ difficultyLevel: undefined }).difficultyLevel).toBe(m.difficulty)
    expect(probe({ difficultyLevel: 'extreme' }).difficultyLevel).toBe(m.difficulty)
    expect(probe({ questionType: undefined }).questionType).toBe(m.type)
    expect(probe({ questionText: undefined }).questionText).toBe(m.guruText)
    expect(probe({ questionText: '   ' }).questionText).toBe(m.guruText)
    expect(probe({ questionText: 'x'.repeat(2001) }).questionText).toBe(m.guruTextLong)
  })
  it('mcq without options or key', () => {
    const r = probe({ questionType: 'mcq' })
    expect(r.options).toBe(m.options)
    expect(r.correctAnswer).toBe(m.correctAnswer)
  })
  it('mcq blank and over-500 options sit under the single key options', () => {
    const mcq = { questionType: 'mcq', correctAnswer: 'A' }
    expect(probe({ ...mcq, options: ['a', { text: '' }, 'c', 'd'] }).options).toBe(m.options)
    expect(probe({ ...mcq, options: ['a', { optionText: 'x'.repeat(501) }, 'c', 'd'] }).options).toBe(m.guruOptionLong)
    expect(pathsOf(QuestionGuruCreateRequestSchema.safeParse({ ...base, ...mcq, options: ['a', '', 'c', 'd'] }))).toEqual(['options'])
  })
  it('mcq key: letter, digit and index accepted; others refused', () => {
    const mcq = { questionType: 'mcq', options: ['a', 'b', 'c', 'd'] }
    for (const k of ['B', 'd', '2', 0, 3]) expect(QuestionGuruCreateRequestSchema.safeParse({ ...base, ...mcq, correctAnswer: k }).success).toBe(true)
    for (const k of ['E', '4', 4, -1]) expect(probe({ ...mcq, correctAnswer: k }).correctAnswer).toBe(m.correctAnswer)
  })
  it('true_false needs a boolean-like tfAnswer', () => {
    expect(probe({ questionType: 'true_false' }).tfAnswer).toBe(m.guruTf)
    expect(probe({ questionType: 'true_false', tfAnswer: 'maybe' }).tfAnswer).toBe(m.guruTf)
    for (const v of [true, false, 'true', '0', 1]) expect(QuestionGuruCreateRequestSchema.safeParse({ ...base, questionType: 'true_false', tfAnswer: v }).success).toBe(true)
  })
  it('short_answer and fill_blank: answer text is keyed on correctAnswer', () => {
    for (const questionType of ['short_answer', 'fill_blank']) {
      expect(probe({ questionType }).correctAnswer).toBe(m.answerText)
      expect(probe({ questionType, correctAnswerText: '  ' }).correctAnswer).toBe(m.answerText)
      expect(probe({ questionType, correctAnswerText: 'x'.repeat(501) }).correctAnswer).toBe(m.guruAnswerLong)
      expect(QuestionGuruCreateRequestSchema.safeParse({ ...base, questionType, correctAnswer: 'jawapan' }).success).toBe(true)
    }
  })
  it('chapter, topic, SP and script type copy', () => {
    expect(probe({ curriculumChapterId: 5 }).curriculumChapterId).toBe(m.guruChapter)
    expect(probe({ curriculumTopicId: 5 }).curriculumTopicId).toBe(m.guruTopic)
    expect(probe({ dskpSpId: 5 }).dskpSpId).toBe(m.sp)
    expect(probe({ scriptType: 'tulisan' }).scriptType).toBe(m.guruScript)
    expect(QuestionGuruCreateRequestSchema.safeParse({ ...base, curriculumChapterId: '', curriculumTopicId: null, scriptType: 'jawi' }).success).toBe(true)
  })
})

describe('Guru update: one test per mock rule (field key and exact copy)', () => {
  const opts = [0, 1, 2, 3].map((id) => ({ id, optionText: `Pilihan ${String(id)}` }))
  const probe = (v: unknown) => keyed(QuestionGuruUpdateRequestSchema.safeParse(v))
  it('accepts a text-only and a full MCQ edit', () => {
    expect(QuestionGuruUpdateRequestSchema.safeParse({ questionText: 'Baru' }).success).toBe(true)
    expect(QuestionGuruUpdateRequestSchema.safeParse({ questionText: 'Baru', options: opts, correctOptionId: 'C' }).success).toBe(true)
  })
  it('questionText missing, blank, over 2000', () => {
    expect(probe({}).questionText).toBe(m.guruText)
    expect(probe({ questionText: '' }).questionText).toBe(m.guruText)
    expect(probe({ questionText: 'x'.repeat(2001) }).questionText).toBe(m.guruTextLong)
  })
  it('difficulty', () => expect(probe({ questionText: 'a', difficultyLevel: 9 }).difficultyLevel).toBe(m.difficulty))
  it('an empty option text is reported once under options', () => {
    const bad = opts.map((o, i) => (i === 1 ? { ...o, optionText: '' } : o))
    const r = QuestionGuruUpdateRequestSchema.safeParse({ questionText: 'a', options: bad, correctOptionId: 0 })
    expect(pathsOf(r)).toEqual(['options'])
    expect(keyed(r).options).toBe(m.options)
  })
  it('an option over 500 characters', () => {
    const bad = opts.map((o, i) => (i === 0 ? { ...o, optionText: 'x'.repeat(501) } : o))
    expect(probe({ questionText: 'a', options: bad, correctOptionId: 0 }).options).toBe(m.guruOptionLong)
  })
  it('four unique ids 0 to 3 are required', () => {
    const dup = opts.map((o, i) => (i === 3 ? { ...o, id: 2 } : o))
    expect(probe({ questionText: 'a', options: dup, correctOptionId: 0 }).options).toBe(m.options)
    expect(probe({ questionText: 'a', options: opts.slice(0, 3), correctOptionId: 0 }).options).toBe(m.options)
    expect(probe({ questionText: 'a', options: opts.map((o) => ({ ...o, id: o.id + 1 })), correctOptionId: 0 }).options).toBe(m.options)
  })
  it('correctOptionId is required with options, and options with correctOptionId', () => {
    expect(probe({ questionText: 'a', options: opts }).correctOptionId).toBe(m.correctAnswer)
    expect(probe({ questionText: 'a', options: opts, correctOptionId: 5 }).correctOptionId).toBe(m.correctAnswer)
    expect(probe({ questionText: 'a', correctOptionId: 'B' }).options).toBe(m.options)
  })
})
