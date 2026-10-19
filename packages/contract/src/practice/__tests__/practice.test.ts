import { describe, expect, it } from 'vitest'

import { ErrorBodySchema } from '../../common/error'
import { buildOpenApiDocument } from '../../openapi'
import { PRACTICE_COMPONENT_SCHEMAS } from '../paths'
import {
  CheckAnswerRequestSchema,
  CheckAnswerResponseSchema,
  PRACTICE_ERRORS,
  PRACTICE_ERROR_CODES,
  PRACTICE_MODES,
  PRACTICE_START_MODES,
  SessionListResponseSchema,
  StartSessionRequestSchema,
  StartSessionResponseSchema,
  SubmitSessionRequestSchema,
  SubmitSessionResponseSchema,
} from '../schema'

const SESSION_ID = '0b5d2f6e-3c1a-4f7e-9a52-6d1c8e4b7a10'
const question = {
  id: '501',
  questionText: 'Berapakah 2 + 3?',
  textDirection: 'ltr',
  scriptType: 'rumi',
  wrongTimes: 0,
  hasDskp: true,
  contributor: null,
  options: [
    { id: 0, label: 'A', text: '4' },
    { id: 1, label: 'B', text: '5' },
  ],
}
const start = {
  sessionId: SESSION_ID,
  mode: 'random',
  subject: { code: 'MATH', name: 'Matematik', color: '#2563eb' },
  questions: [question],
}

/** All keys of a JSON value, recursively. */
const keysOf = (v: unknown): string[] =>
  Array.isArray(v)
    ? v.flatMap(keysOf)
    : v && typeof v === 'object'
      ? Object.entries(v).flatMap(([k, x]) => [k, ...keysOf(x)])
      : []

describe('start request', () => {
  it('accepts mock-shaped bodies for each mode', () => {
    expect(StartSessionRequestSchema.safeParse({ mode: 'random', subjectCode: 'MATH', levelId: '2', difficulty: null, count: 10 }).success).toBe(true)
    expect(StartSessionRequestSchema.safeParse({ mode: 'chapter', chapterId: '88', count: 5, clientUuid: SESSION_ID }).success).toBe(true)
    expect(StartSessionRequestSchema.safeParse({ mode: 'ramalan', subjectCode: 'BM', year: 2025, setNo: 1 }).success).toBe(true)
    expect(StartSessionRequestSchema.safeParse({ mode: 'latih_tubi', subjectCode: 'SEJ', targetQuestionId: '9', count: 1 }).success).toBe(true)
  })

  it('rejects pksk, unknown modes, bad ids and bad uuids', () => {
    expect(PRACTICE_START_MODES).not.toContain('pksk')
    for (const bad of [
      { mode: 'pksk' },
      { mode: 'battle' },
      { subjectCode: 'MATH' },
      { mode: 'random', count: 'ten' },
      { mode: 'random', difficulty: 6 },
      { mode: 'chapter', chapterId: 12 },
      { mode: 'random', clientUuid: 'not-a-uuid' },
    ]) {
      expect(StartSessionRequestSchema.safeParse(bad).success).toBe(false)
    }
  })
})

describe('start response', () => {
  it('parses a mock-shaped response, with the optional parts', () => {
    expect(StartSessionResponseSchema.safeParse(start).success).toBe(true)
    const full = {
      ...start,
      mode: 'question_set',
      chapter: { id: '88', number: null, name: null },
      revisionMeta: { selected: 20, totalWrong: 31 },
      timeLimitSec: 900,
    }
    expect(StartSessionResponseSchema.safeParse(full).success).toBe(true)
    expect(StartSessionResponseSchema.safeParse({ ...start, subject: null, timeLimitSec: null }).success).toBe(true)
  })

  it('never carries the key or the explanation: a leaked field is rejected', () => {
    for (const leak of ['correctAnswer', 'correctOptionId', 'explanation']) {
      const leaked = { ...start, questions: [{ ...question, [leak]: 1 }] }
      expect(StartSessionResponseSchema.safeParse(leaked).success).toBe(false)
    }
    expect(keysOf(start)).not.toEqual(expect.arrayContaining(['correctAnswer']))
  })

  it('rejects a non-uuid session id and a bad direction', () => {
    expect(StartSessionResponseSchema.safeParse({ ...start, sessionId: '12' }).success).toBe(false)
    expect(StartSessionResponseSchema.safeParse({ ...start, questions: [{ ...question, textDirection: 'up' }] }).success).toBe(false)
  })
})

describe('check-answer', () => {
  it('parses request and response', () => {
    expect(CheckAnswerRequestSchema.safeParse({ questionId: '501', selectedOptionId: 1 }).success).toBe(true)
    const res = { isCorrect: false, correctOptionId: 1, feedback: 'Salah', explanation: null }
    expect(CheckAnswerResponseSchema.safeParse(res).success).toBe(true)
    expect(CheckAnswerResponseSchema.safeParse({ ...res, explanation: 'Kerana 2 + 3 = 5.' }).success).toBe(true)
  })

  it('rejects missing or non-integer fields', () => {
    for (const bad of [{ questionId: '501' }, { questionId: '501', selectedOptionId: -1 }, { questionId: '501', selectedOptionId: 'B' }, { selectedOptionId: 0 }]) {
      expect(CheckAnswerRequestSchema.safeParse(bad).success).toBe(false)
    }
    expect(CheckAnswerResponseSchema.safeParse({ isCorrect: true, correctOptionId: 0, feedback: 'Betul!' }).success).toBe(false)
  })
})

describe('submit', () => {
  it('parses request and response', () => {
    expect(SubmitSessionRequestSchema.safeParse({}).success).toBe(true)
    expect(SubmitSessionRequestSchema.safeParse({ timeSpent: 42.5 }).success).toBe(true)
    const res = { results: { score: 8, total: 10, gamification: { coinsEarned: 8, streakCount: 3, pointsEarned: 80, totalBalance: 120 } } }
    expect(SubmitSessionResponseSchema.safeParse(res).success).toBe(true)
  })

  it('does not reject timeSpent (the server coerces and clamps it, like the mock)', () => {
    for (const timeSpent of [-1, 'x', null, 99999]) {
      expect(SubmitSessionRequestSchema.safeParse({ timeSpent }).success).toBe(true)
    }
  })

  it('rejects an incomplete result', () => {
    expect(SubmitSessionResponseSchema.safeParse({ results: { score: 1, total: 2 } }).success).toBe(false)
  })
})

describe('history list', () => {
  const item = {
    id: SESSION_ID,
    mode: 'random',
    subjectId: '4',
    subjectCode: 'UMUM',
    questionCount: 10,
    correctCount: 7,
    percent: 70,
    coinsEarned: 7,
    timeSpent: 300,
    completedAt: '2026-10-16T09:30:00+08:00',
  }
  const meta = {
    page: 1,
    pageSize: 15,
    totalItems: 1,
    totalPages: 1,
    from: 1,
    to: 1,
    activeType: null,
    stats: { sessions: 1, avgAccuracyPct: 70, coins: 7, answered: 10 },
  }

  it('parses items with meta.activeType and meta.stats', () => {
    expect(SessionListResponseSchema.safeParse({ data: [item], meta }).success).toBe(true)
    expect(SessionListResponseSchema.safeParse({ data: [{ ...item, subjectId: null, completedAt: null }], meta: { ...meta, activeType: 'random' } }).success).toBe(true)
  })

  it('rejects a UTC timestamp, a bad mode and missing stats', () => {
    expect(SessionListResponseSchema.safeParse({ data: [{ ...item, completedAt: '2026-10-16T01:30:00Z' }], meta }).success).toBe(false)
    expect(SessionListResponseSchema.safeParse({ data: [{ ...item, mode: 'battle' }], meta }).success).toBe(false)
    const noStats: Partial<typeof meta> = { ...meta }
    delete noStats.stats
    expect(SessionListResponseSchema.safeParse({ data: [item], meta: noStats }).success).toBe(false)
  })
})

describe('errors', () => {
  it('has a status and exact BM message for every module code', () => {
    expect(Object.keys(PRACTICE_ERRORS).sort()).toEqual([...PRACTICE_ERROR_CODES].sort())
    expect(PRACTICE_ERRORS.TRIAL_EXHAUSTED).toEqual({ status: 402, messages: ['Baki percubaan percuma anda telah habis.'] })
    expect(PRACTICE_ERRORS.ALREADY_SUBMITTED.status).toBe(409)
    for (const code of PRACTICE_ERROR_CODES) {
      const { status, messages } = PRACTICE_ERRORS[code]
      for (const message of messages) {
        expect(ErrorBodySchema.safeParse({ error: { code, message } }).success).toBe(true)
        expect([402, 409, 422]).toContain(status)
      }
    }
  })

  it('carries VALIDATION_ERROR fields', () => {
    const body = { error: { code: 'VALIDATION_ERROR', message: 'Nilai tidak sah.', fields: { count: 'Nilai tidak sah.' } } }
    expect(ErrorBodySchema.safeParse(body).success).toBe(true)
  })
})

describe('openapi registration', () => {
  const doc = buildOpenApiDocument() as {
    paths: Record<string, Record<string, unknown>>
    components: { schemas: Record<string, unknown> }
  }

  it('contains the four paths', () => {
    expect(Object.keys(doc.paths['/practice/sessions'] ?? {}).sort()).toEqual(['get', 'post'])
    expect(doc.paths['/practice/sessions/{id}/check-answer']).toHaveProperty('post')
    expect(doc.paths['/practice/sessions/{id}/submit']).toHaveProperty('post')
  })

  it('contains every practice component', () => {
    for (const name of Object.keys(PRACTICE_COMPONENT_SCHEMAS)) expect(doc.components.schemas).toHaveProperty(name)
    expect(PRACTICE_MODES).toContain('pksk')
  })
})
