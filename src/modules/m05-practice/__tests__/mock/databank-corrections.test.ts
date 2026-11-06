/**
 * S3-T07 part A: BR-18 in the mock. A completed `databank` session is left out of GET /api/practice/corrections like
 * `past_year`, while a normal practice session is counted. Own file: it writes sessions, so it must not share a store with
 * the read-only handler tests.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import type { MockRuntime } from '@/mock/index'
import { questions } from '@/modules/m04-question-bank/mock'

import { practice } from '../../mock'
import type { PracticeMode } from '../../mock/datasets/types'
import { MAJU, MemoryStorage, bootAll, getAs } from './boot-all'

let runtime: MockRuntime

beforeAll(async () => {
  vi.stubGlobal('localStorage', new MemoryStorage())
  runtime = (await bootAll()).runtime
}, 120_000)

afterAll(() => {
  vi.unstubAllGlobals()
})

interface Corr {
  summary: { questions: number } | null
}
const corrections = async (): Promise<Corr> => {
  const r = await getAs<{ data: Corr }>(runtime, MAJU, '/api/practice/corrections?month=2026-09')
  expect(r.status).toBe(200)
  return r.body.data
}

describe('corrections (BR-18) and the databank mode', () => {
  it('a databank session adds no question; a chapter session of the same questions adds them', async () => {
    const answered = new Set(practice.answers(MAJU).map((a) => a.questionId))
    const fresh = questions
      .practiceQuery({ subjectId: 3, educationLevelIds: [1], limit: 60, seed: 'bcorr' })
      .map((q) => q.id)
      .filter((id) => !answered.has(id))
      .slice(0, 2)
    expect(fresh).toHaveLength(2)
    const done = (mode: PracticeMode, hour: string) =>
      practice.completeSession({
        userId: MAJU,
        mode,
        subjectId: 3,
        answers: fresh.map((id) => ({ questionId: id, isCorrect: false, selected: null })),
        startedAt: `2026-09-20T${hour}:00:00+08:00`,
        completedAt: `2026-09-20T${hour}:10:00+08:00`,
      })
    const before = (await corrections()).summary?.questions ?? 0

    done('databank', '08')
    expect((await corrections()).summary?.questions ?? 0).toBe(before)

    done('chapter', '09')
    expect((await corrections()).summary?.questions ?? 0).toBe(before + 2)
  })
})
