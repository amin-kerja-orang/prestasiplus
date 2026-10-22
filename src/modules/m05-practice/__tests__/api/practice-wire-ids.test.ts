import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createHttpTransport, installTransport } from '@/api'

import { checkAnswer, startSession, submitSession } from '../../api/practice'

/**
 * DEMO-FIX-1 D-02: `POST /api/practice/sessions` sends every id field as a string on the wire
 * (`StartSessionRequestSchema`, `levelId: IdSchema`); a numeric `levelId` was 422 "Nilai tidak sah.".
 */

let sent: { url: string; body: Record<string, unknown> }[] = []

beforeEach(() => {
  sent = []
  installTransport(
    createHttpTransport({
      fetch: (input, init) => {
        sent.push({
          url: input as string,
          body: JSON.parse((init?.body as string | undefined) ?? 'null'),
        })
        return Promise.resolve(
          new Response(JSON.stringify({ data: {} }), {
            status: 201,
            headers: { 'content-type': 'application/json' },
          }),
        )
      },
    }),
  )
})
afterEach(() => {
  vi.unstubAllEnvs()
})

describe('startSession wire ids', () => {
  it('http mode: levelId is a string (the D-02 request)', async () => {
    vi.stubEnv('VITE_API_MODE', 'http')
    await startSession({ mode: 'random', subjectCode: 'MATH', levelId: 4, count: 10 })
    expect(sent[0]?.url).toBe('/api/practice/sessions')
    expect(sent[0]?.body).toEqual({ mode: 'random', subjectCode: 'MATH', levelId: '4', count: 10 })
  })

  it('http mode: every IdSchema field is a string; numbers that are not ids stay numbers', async () => {
    vi.stubEnv('VITE_API_MODE', 'http')
    await startSession({
      mode: 'latih_tubi',
      levelId: 1,
      difficulty: 3,
      count: 1,
      chapterId: 2,
      year: 2024,
      setNo: 1,
      targetQuestionId: 781,
      missionId: 5,
      remedialTestId: 6,
      questionSetId: 7,
    })
    expect(sent[0]?.body).toEqual({
      mode: 'latih_tubi',
      levelId: '1',
      difficulty: 3,
      count: 1,
      chapterId: '2',
      year: 2024,
      setNo: 1,
      targetQuestionId: '781',
      missionId: '5',
      remedialTestId: '6',
      questionSetId: '7',
    })
  })

  it('http mode: null stays null and absent fields stay absent ("Semua Tahap")', async () => {
    vi.stubEnv('VITE_API_MODE', 'http')
    await startSession({ mode: 'random', subjectCode: 'BM', levelId: null, count: 5 })
    expect(sent[0]?.body).toEqual({ mode: 'random', subjectCode: 'BM', levelId: null, count: 5 })
    await startSession({ mode: 'random', subjectCode: 'BM', count: 5 })
    expect(sent[1]?.body).toEqual({ mode: 'random', subjectCode: 'BM', count: 5 })
  })

  it('mock mode: the numbers are unchanged', async () => {
    vi.stubEnv('VITE_API_MODE', 'mock')
    await startSession({ mode: 'random', subjectCode: 'MATH', levelId: 4, count: 10 })
    expect(sent[0]?.body).toEqual({ mode: 'random', subjectCode: 'MATH', levelId: 4, count: 10 })
  })
})

describe('check / submit wire ids', () => {
  it('http mode: questionId is a string; selectedOptionId stays a number', async () => {
    vi.stubEnv('VITE_API_MODE', 'http')
    await checkAnswer('s-1', { questionId: 781, selectedOptionId: 2 })
    expect(sent[0]?.body).toEqual({ questionId: '781', selectedOptionId: 2 })
    await submitSession('s-1', {
      answers: [{ questionId: 781, selectedOptionId: 2 }],
      timeSpent: 40,
    })
    expect(sent[1]?.body).toEqual({
      answers: [{ questionId: '781', selectedOptionId: 2 }],
      timeSpent: 40,
    })
    await submitSession('s-1', { timeSpent: 40 })
    expect(sent[2]?.body).toEqual({ timeSpent: 40 })
  })

  it('mock mode: questionId stays a number', async () => {
    vi.stubEnv('VITE_API_MODE', 'mock')
    await checkAnswer('s-1', { questionId: 781, selectedOptionId: 2 })
    expect(sent[0]?.body).toEqual({ questionId: 781, selectedOptionId: 2 })
  })
})
