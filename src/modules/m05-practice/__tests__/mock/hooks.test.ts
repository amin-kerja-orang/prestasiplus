/**
 * M05-T1: the test hooks (SRS M05 v1.17 §6.13, FR-M05-146, FR-M05-150): `addSession`, `addAnswer`,
 * `setSubjectiveCounts`, `setSpmProgress`, `answerChapter`. Booted like `read-handlers.test.ts`;
 * these tests write, so they own their runtime and use accounts the read tests do not.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { setUser } from '@/mock/core-data/set-user'
import type { MockRuntime } from '@/mock/index'
import { createTestHooks } from '@/mock/testing/hooks'
import { questions } from '@/modules/m04-question-bank/mock'

import type {
  ChapterSubjectDetail,
  Dashboard,
  Mastery,
  Progress,
  RevisionOverview,
  SubjectConfig,
} from '../../api/types'
import { practice, type AnswerRow, type SessionRow } from '../../mock'
import { fixtures } from '../../mock/hooks'
import {
  ADMIN_SEKOLAH,
  GURU,
  MemoryStorage,
  PELAJAR2,
  type ErrorBody,
  type ListBody,
  bootAll,
  getAs,
} from './boot-all'
import { request } from './helpers'

let runtime: MockRuntime
let hooks: Record<string, unknown>

beforeAll(async () => {
  vi.stubGlobal('localStorage', new MemoryStorage())
  runtime = (await bootAll()).runtime
  hooks = createTestHooks(runtime, { mode: 'test', target: {} })
}, 120_000)

afterAll(() => {
  vi.unstubAllGlobals()
})

const data = async <T>(userId: number, url: string): Promise<T> => {
  const r = await getAs<{ data: T }>(runtime, userId, url)
  expect(r.status, url).toBe(200)
  return r.body.data
}
const call = <T = unknown>(name: string, ...args: unknown[]): Promise<T> =>
  (hooks[name] as (...a: unknown[]) => Promise<T>)(...args)

/** MATH T4 practice questions (D54: practice levels are Tingkatan 4-5). */
const mathQuestions = () =>
  questions
    .practiceQuery({ subjectId: 3, educationLevelIds: [10], limit: 4, seed: 't1-hooks' })
    .map((q) => q.id)

describe('registration', () => {
  it('window.__mock carries the five M05 hooks, without a name collision', () => {
    const names = (hooks.names as () => string[])()
    for (const n of [
      'addSession',
      'addAnswer',
      'setSubjectiveCounts',
      'setSpmProgress',
      'answerChapter',
    ]) {
      expect(names, n).toContain(n)
    }
  })
})

describe('addSession(userId, {mode, correct, total, timeSpentSec, at})  (FR-M05-150)', () => {
  it('inserts one completed session without answers; the pager test calls it n times (#12, 15 per page)', async () => {
    for (let i = 0; i < 16; i++) {
      const at = new Date(Date.parse('2026-09-21T09:00:00+08:00') + i * 60_000).toISOString()
      const row = await call<SessionRow>('addSession', PELAJAR2, {
        mode: 'random',
        correct: 3,
        total: 5,
        timeSpentSec: 120,
        at,
      })
      expect(row).toMatchObject({
        userId: PELAJAR2,
        status: 'completed',
        questionCount: 5,
        correctCount: 3,
      })
    }
    const p1 = await getAs<ListBody<unknown, object>>(runtime, PELAJAR2, '/api/practice/history')
    expect(p1.body.data).toHaveLength(15)
    expect(p1.body.meta).toMatchObject({
      page: 1,
      totalItems: 16,
      totalPages: 2,
      totals: { sessions: 16, answered: 80, avgAccuracyPct: 60, coins: 48 },
    })
    const p2 = await getAs<ListBody<unknown, object>>(
      runtime,
      PELAJAR2,
      '/api/practice/history?page=2',
    )
    expect(p2.body.data).toHaveLength(1)
    expect(p2.body.meta).toMatchObject({ page: 2, from: 16, to: 16 })
    // No answer rows: the answer log of the user is still empty (S8 counts answers).
    expect(practice.answers(PELAJAR2)).toEqual([])
  })

  it('the session counts in the dashboard week and in #23 for an SPM mode', async () => {
    const d = await data<Dashboard>(PELAJAR2, '/api/dashboard')
    // 21 Sep 09:00–09:15 falls in the week of 21–27 Sep.
    expect(d.week.sessions).toBe(16)
    await call('addSession', PELAJAR2, {
      mode: 'past_year',
      correct: 1,
      total: 2,
      timeSpentSec: 30,
      at: '2026-09-22T10:00:00+08:00',
    })
    const r = await request(
      runtime,
      'GET',
      '/api/practice/sessions?modes=past_year',
      setUser(PELAJAR2).token,
    )
    expect((r.body as ListBody<unknown, { stats: { sessions: number } }>).meta.stats.sessions).toBe(
      1,
    )
  })

  it('rejects a bad user, mode, count or time', async () => {
    const ok = {
      mode: 'random',
      correct: 1,
      total: 2,
      timeSpentSec: 10,
      at: '2026-09-22T10:00:00+08:00',
    }
    await expect(call('addSession', 0, ok)).rejects.toThrow(RangeError)
    await expect(call('addSession', PELAJAR2, { ...ok, mode: 'nope' })).rejects.toThrow(
      /unknown mode/,
    )
    await expect(call('addSession', PELAJAR2, { ...ok, correct: 3 })).rejects.toThrow(
      /correct ≤ total/,
    )
    await expect(call('addSession', PELAJAR2, { ...ok, at: 'never' })).rejects.toThrow(
      /invalid time/,
    )
    await expect(call('addSession', PELAJAR2, null)).rejects.toThrow(TypeError)
  })
})

describe('addAnswer({userId, questionId, isCorrect, answeredAt?})  (FR-M05-146)', () => {
  it('writes one sessionless answer (id ≥ 9,000,001) with the question facets, and moves the queue and mastery', async () => {
    const [q1, q2] = mathQuestions() as [number, number]
    const before = await data<Dashboard>(GURU, '/api/dashboard')
    const row = await call<AnswerRow>('addAnswer', {
      userId: GURU,
      questionId: q1,
      isCorrect: false,
      answeredAt: '2026-09-25T10:00:00+08:00',
    })
    expect(row.id).toBeGreaterThanOrEqual(9_000_001)
    expect(row).toMatchObject({
      userId: GURU,
      questionId: q1,
      sessionId: null,
      subjectId: 3,
      isCorrect: false,
      answeredAt: '2026-09-25T10:00:00+08:00',
    })
    expect(row.levelId).not.toBeNull()

    // BR-14 queue and BR-20 counters.
    expect((await data<RevisionOverview>(GURU, '/api/practice/revision')).total).toBe(1)
    const m = await data<Mastery>(GURU, '/api/practice/mastery')
    expect(m.subjects).toHaveLength(1)
    expect(m.subjects[0]).toMatchObject({ code: 'MATH', answered: 1, correct: 0, level: 0 })

    // S8 counts every answer, with or without a session.
    const p = await data<Progress>(GURU, '/api/practice/progress?period=7')
    expect(p).toMatchObject({ answered: 1, accuracyPct: 0, sessions: 0 })

    // A later correct answer clears the queue; a second question adds a counter.
    await call('addAnswer', {
      userId: GURU,
      questionId: q1,
      isCorrect: true,
      answeredAt: '2026-09-25T10:05:00+08:00',
    })
    await call('addAnswer', {
      userId: GURU,
      questionId: q2,
      isCorrect: true,
      answeredAt: '2026-09-25T10:06:00+08:00',
    })
    expect((await data<RevisionOverview>(GURU, '/api/practice/revision')).total).toBe(0)
    const m2 = await data<Mastery>(GURU, '/api/practice/mastery')
    expect(m2.subjects[0]).toMatchObject({ answered: 3, correct: 2 })

    // No wallet, streak or trial change (XR-M13-03b).
    const after = await data<Dashboard>(GURU, '/api/dashboard')
    expect(after.wallet).toEqual(before.wallet)
    expect(after.streak.count).toBe(before.streak.count)
    expect(after.trial).toEqual(before.trial)
    expect(after.week.sessions).toBe(0)
    expect(after.week.accuracyPct).toBe(67)
  })

  it('rejects an unknown user, question, flag or time', async () => {
    const [q] = mathQuestions() as [number]
    const base = { userId: GURU, questionId: q, isCorrect: true }
    await expect(call('addAnswer', { ...base, userId: 0 })).rejects.toThrow(RangeError)
    await expect(call('addAnswer', { ...base, questionId: 99_999_999 })).rejects.toThrow(
      /unknown question/,
    )
    await expect(call('addAnswer', { ...base, isCorrect: 'yes' })).rejects.toThrow(TypeError)
    await expect(call('addAnswer', { ...base, answeredAt: 'soon' })).rejects.toThrow(/invalid time/)
    await expect(call('addAnswer', 7)).rejects.toThrow(TypeError)
  })
})

describe('setSubjectiveCounts(code, {levelId: n})', () => {
  it('shows in #3 `subjectiveCounts` and replaces the previous counts', async () => {
    await call('setSubjectiveCounts', 'BM', { '1': 12 })
    expect(
      (await data<SubjectConfig>(PELAJAR2, '/api/practice/subjects/BM')).subjectiveCounts,
    ).toEqual({ '1': 12 })
    await call('setSubjectiveCounts', 'bm', { '2': 3 })
    expect(
      (await data<SubjectConfig>(PELAJAR2, '/api/practice/subjects/BM')).subjectiveCounts,
    ).toEqual({ '2': 3 })
    // Other subjects are unaffected.
    expect(
      (await data<SubjectConfig>(PELAJAR2, '/api/practice/subjects/MATH')).subjectiveCounts,
    ).toEqual({})
  })

  it('rejects an unknown subject and a bad entry', async () => {
    await expect(call('setSubjectiveCounts', 'ZZZ', {})).rejects.toThrow(/unknown subject/)
    await expect(call('setSubjectiveCounts', 'BM', { one: 1 })).rejects.toThrow(RangeError)
    await expect(call('setSubjectiveCounts', 'BM', { '1': -1 })).rejects.toThrow(RangeError)
  })
})

describe('setSpmProgress(userId, subjectId, {answered, correct})  (BR-27)', () => {
  it('stores the S15 provisional progress that #18 reads (`fixtures.spmProgress`)', async () => {
    expect(fixtures.spmProgress(PELAJAR2, 1)).toBeUndefined()
    await call('setSpmProgress', PELAJAR2, 1, { answered: 20, correct: 15 })
    expect(fixtures.spmProgress(PELAJAR2, 1)).toMatchObject({ answered: 20, correct: 15 })
    await call('setSpmProgress', PELAJAR2, 1, { answered: 30, correct: 15 })
    expect(fixtures.spmProgress(PELAJAR2, 1)).toMatchObject({ answered: 30, correct: 15 })
    expect(fixtures.spmProgressOf(PELAJAR2)).toHaveLength(1)
    expect(fixtures.spmProgress(PELAJAR2, 3)).toBeUndefined()
  })

  it('rejects an unknown subject and impossible counts', async () => {
    await expect(
      call('setSpmProgress', PELAJAR2, 9999, { answered: 1, correct: 1 }),
    ).rejects.toThrow(/unknown subject/)
    await expect(call('setSpmProgress', PELAJAR2, 1, { answered: 1, correct: 2 })).rejects.toThrow(
      RangeError,
    )
    await expect(call('setSpmProgress', PELAJAR2, 1, undefined)).rejects.toThrow(RangeError)
  })
})

describe('answerChapter(userId, chapterId, {correctPct})  (BR-16 unlock)', () => {
  // D54: MATH T4 Bab 1 = chapter 91, Bab 2 = chapter 92 (Darjah 1 chapters 1 / 143 before).
  const n91 = () => questions.count('Q-CHAPTER', 91)

  it('100 % of MATH T4 Bab 1 completes it at 100 % and opens Bab 2 (#8); a start of Bab 2 then succeeds', async () => {
    const r = await call('answerChapter', ADMIN_SEKOLAH, 91, { correctPct: 100 })
    expect(r).toEqual({ answered: n91(), correct: n91() })
    const c = await data<ChapterSubjectDetail>(ADMIN_SEKOLAH, '/api/practice/chapter-subjects/MATH')
    expect(c.chapters[0]).toMatchObject({
      total: n91(),
      answered: n91(),
      correct: n91(),
      scorePct: 100,
      remaining: 0,
      complete: true,
      state: 'open',
    })
    expect(c.chapters[1]).toMatchObject({ number: 2, state: 'open' })
    expect(c.chapters[2]).toMatchObject({ number: 3, state: 'locked' })
    const start = await request(
      runtime,
      'POST',
      '/api/practice/sessions',
      setUser(ADMIN_SEKOLAH).token,
      {
        mode: 'chapter',
        chapterId: 92,
        count: 5,
      },
    )
    expect(start.status).toBe(201)
  }, 60_000)

  it('60 % completes the chapter below the 70 % bar: Bab 2 stays locked and a start answers 409 CHAPTER_LOCKED', async () => {
    const r = await call('answerChapter', PELAJAR2, 91, { correctPct: 60 })
    const correct = Math.round((n91() * 60) / 100)
    expect(r).toEqual({ answered: n91(), correct })
    const c = await data<ChapterSubjectDetail>(PELAJAR2, '/api/practice/chapter-subjects/MATH')
    expect(c.chapters[0]).toMatchObject({ complete: true })
    expect(c.chapters[0]?.scorePct).toBeCloseTo((correct / n91()) * 100, 1)
    expect(c.chapters[1]?.state).toBe('locked')
    const start = await request(
      runtime,
      'POST',
      '/api/practice/sessions',
      setUser(PELAJAR2).token,
      {
        mode: 'chapter',
        chapterId: 92,
        count: 5,
      },
    )
    expect(start.status).toBe(409)
    expect((start.body as ErrorBody).error.code).toBe('CHAPTER_LOCKED')
  }, 60_000)

  it('rejects an unknown chapter and a bad percentage', async () => {
    await expect(call('answerChapter', PELAJAR2, 999_999, { correctPct: 50 })).rejects.toThrow(
      /unknown chapter/,
    )
    await expect(call('answerChapter', PELAJAR2, 1, { correctPct: 101 })).rejects.toThrow(
      RangeError,
    )
    await expect(call('answerChapter', PELAJAR2, 1, undefined)).rejects.toThrow(RangeError)
  })
})

describe('G4 follow-ups', () => {
  it('addSession accepts a numeric `at` (epoch ms) and stores that time, not NaN', async () => {
    const at = Date.parse('2026-09-23T11:00:00+08:00')
    const row = await call<SessionRow>('addSession', 9, {
      mode: 'random',
      correct: 1,
      total: 2,
      timeSpentSec: 30,
      at,
    })
    expect(row.completedAtMs).toBe(at)
    expect(row.completedAt).toBe('2026-09-23T11:00:00+08:00')
  })

  it('every hook that names a user rejects an unknown one', async () => {
    const [q] = mathQuestions() as [number]
    const ghost = 8_999_999
    await expect(
      call('addSession', ghost, {
        mode: 'random',
        correct: 1,
        total: 2,
        timeSpentSec: 1,
        at: '2026-09-22T10:00:00+08:00',
      }),
    ).rejects.toThrow(/unknown user/)
    await expect(
      call('addAnswer', { userId: ghost, questionId: q, isCorrect: true }),
    ).rejects.toThrow(/unknown user/)
    await expect(call('setSpmProgress', ghost, 1, { answered: 1, correct: 1 })).rejects.toThrow(
      /unknown user/,
    )
    await expect(call('answerChapter', ghost, 1, { correctPct: 50 })).rejects.toThrow(
      /unknown user/,
    )
    await expect(call('answerChapter', ghost, 1, { correctPct: 50 })).rejects.toBeInstanceOf(
      RangeError,
    )
  })
})
