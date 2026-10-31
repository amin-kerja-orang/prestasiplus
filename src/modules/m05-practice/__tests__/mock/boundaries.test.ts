/**
 * M05-T1 boundary cases (G4 follow-up): BR-16 unlock at the 70 % bar, BR-14 / XL-19 eligibility,
 * BR-18 "Selepas", BR-19 window edge, the Monday–Sunday week (MYT) and BR-29 recent questions.
 * These tests write (hooks, `questions.deactivate`), so they own a runtime and use accounts the
 * other test files do not touch (3, 5, 6, 7, 9 and 10).
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import type { MockRuntime } from '@/mock/index'
import { questions } from '@/modules/m04-question-bank/mock'

import type {
  ChapterSubjectDetail,
  Corrections,
  Dashboard,
  Progress,
  RevisionOverview,
} from '../../api/types'
import { addAnswer, addSession, answerChapter } from '../../mock/hooks'
import { useOfferedLevels } from '../../mock/repository/rules'
import { GURU, MemoryStorage, PELAJAR2, bootAll, getAs } from './boot-all'

const PARENT = 6
const SPONSOR = 7
const PPD = 9
const JPN = 10

let runtime: MockRuntime

beforeAll(async () => {
  vi.stubGlobal('localStorage', new MemoryStorage())
  runtime = (await bootAll()).runtime
}, 120_000)

afterAll(() => {
  vi.unstubAllGlobals()
})

const data = async <T>(userId: number, url: string): Promise<T> => {
  const r = await getAs<{ data: T }>(runtime, userId, url)
  expect(r.status, url).toBe(200)
  return r.body.data
}

/** MATH D1 practice questions. */
const pick = (n: number) =>
  questions
    .practiceQuery({ subjectId: 3, educationLevelIds: [1], limit: n, seed: 'boundaries' })
    .map((q) => q.id)

describe('BR-16: the chapter unlock bar is a score of 70 %', () => {
  // D72: practice offers T4 / T5, but every chapter question of the dataset is Darjah (stored, hidden): the
  // unlock engine is exercised on that data with the Darjah levels offered.
  beforeEach(() => {
    useOfferedLevels([1, 2, 3, 4])
  })
  afterEach(() => {
    useOfferedLevels()
  })

  // BM D1 Bab 1 (chapter 35) has 320 questions: 224 correct is exactly 70.0 %, 223 is 69.7 %.
  it('exactly 70.0 % (224 of 320) opens the next chapter', async () => {
    expect(answerChapter(PELAJAR2, 35, { correctPct: 70 })).toEqual({ answered: 320, correct: 224 })
    const c = await data<ChapterSubjectDetail>(PELAJAR2, '/api/practice/chapter-subjects/BM')
    expect(c.chapters[0]).toMatchObject({ complete: true, scorePct: 70, state: 'open' })
    expect(c.chapters[1]?.state).toBe('open')
  }, 60_000)

  it('69.7 % (223 of 320) keeps it locked', async () => {
    expect(answerChapter(GURU, 35, { correctPct: 69.6875 })).toEqual({
      answered: 320,
      correct: 223,
    })
    const c = await data<ChapterSubjectDetail>(GURU, '/api/practice/chapter-subjects/BM')
    expect(c.chapters[0]).toMatchObject({ complete: true, scorePct: 69.7 })
    expect(c.chapters[1]?.state).toBe('locked')
  }, 60_000)
})

describe('BR-14 / XL-19: an ineligible queued question is not counted', () => {
  it('leaves the count when deactivated, and returns when reactivated', async () => {
    const [q] = pick(1) as [number]
    addAnswer({
      userId: PPD,
      questionId: q,
      isCorrect: false,
      answeredAt: '2026-09-25T09:00:00+08:00',
    })
    const total = async () => (await data<RevisionOverview>(PPD, '/api/practice/revision')).total
    const forSubject = async () =>
      (await data<{ count: number }>(PPD, '/api/practice/revision/MATH')).count
    expect(await total()).toBe(1)
    expect(await forSubject()).toBe(1)
    expect((await data<Dashboard>(PPD, '/api/dashboard')).revisionTotal).toBe(1)

    questions.deactivate(q)
    expect(await total()).toBe(0)
    expect(await forSubject()).toBe(0)
    expect((await data<Dashboard>(PPD, '/api/dashboard')).revisionTotal).toBe(0)

    questions.reactivate(q)
    expect(await total()).toBe(1)
  })
})

describe('BR-18: a later wrong answer does not lower "Selepas"', () => {
  it('counts first-correct and later-corrected questions; a first answer in another month is excluded', async () => {
    const [q1, q2, q3] = pick(3) as [number, number, number]
    const at = (iso: string) => ({ userId: JPN, answeredAt: iso })
    // q1: first correct, later wrong. q2: first wrong, later correct.
    addAnswer({ ...at('2026-09-10T10:00:00+08:00'), questionId: q1, isCorrect: true })
    addAnswer({ ...at('2026-09-11T10:00:00+08:00'), questionId: q1, isCorrect: false })
    addAnswer({ ...at('2026-09-10T10:05:00+08:00'), questionId: q2, isCorrect: false })
    addAnswer({ ...at('2026-09-12T10:00:00+08:00'), questionId: q2, isCorrect: true })
    // q3: first answered on 31 Aug (MYT), so it belongs to August, not September.
    addAnswer({ ...at('2026-08-31T23:30:00+08:00'), questionId: q3, isCorrect: false })
    addAnswer({ ...at('2026-09-13T10:00:00+08:00'), questionId: q3, isCorrect: true })

    const sep = await data<Corrections>(JPN, '/api/practice/corrections?month=2026-09')
    expect(sep.summary).toEqual({ before: 50, after: 100, delta: 50, questions: 2 })
    const aug = await data<Corrections>(JPN, '/api/practice/corrections?month=2026-08')
    expect(aug.summary).toEqual({ before: 0, after: 100, delta: 100, questions: 1 })
  })
})

describe('BR-19: the S8 window includes today and the day 6 days earlier', () => {
  it('7 days at 25 Sep 15:40 starts at 19 Sep 00:00 MYT: an answer at the edge counts, one second earlier does not', async () => {
    const [q1, q2] = pick(2) as [number, number]
    addAnswer({
      userId: PARENT,
      questionId: q1,
      isCorrect: true,
      answeredAt: '2026-09-19T00:00:00+08:00',
    })
    addAnswer({
      userId: PARENT,
      questionId: q2,
      isCorrect: true,
      answeredAt: '2026-09-18T23:59:59+08:00',
    })
    const p7 = await data<Progress>(PARENT, '/api/practice/progress?period=7')
    expect(p7.answered).toBe(1)
    expect(p7.chart.labels).toEqual(['19/09'])
    const p30 = await data<Progress>(PARENT, '/api/practice/progress?period=30')
    expect(p30.answered).toBe(2)
  })
})

describe('the week is Monday–Sunday in MYT (BR-25)', () => {
  it('Sunday 23:59 belongs to the previous week and Monday 00:00 to this one; the next Monday is outside', async () => {
    const s = (at: string) =>
      addSession(SPONSOR, { mode: 'random', correct: 1, total: 2, timeSpentSec: 30, at })
    s('2026-09-20T23:59:00+08:00') // Sunday, week of 14 Sep
    s('2026-09-21T00:00:00+08:00') // Monday, this week
    s('2026-09-27T23:59:00+08:00') // Sunday, this week
    s('2026-09-28T00:00:00+08:00') // next Monday
    const d = await data<Dashboard>(SPONSOR, '/api/dashboard')
    expect(d.week.sessions).toBe(2)
  })
})

describe('BR-29: recent questions are approved objective questions', () => {
  it('each of the 5 is approved and not a PKSK row, newest first', async () => {
    const d = await data<Dashboard>(GURU, '/api/dashboard')
    expect(d.recentQuestions).toHaveLength(5)
    for (const r of d.recentQuestions) {
      const q = questions.get(Number(r.id)) // the mock sends numeric ids (EntityId)
      expect(q?.status).toBe('approved')
      expect(q?.pkskDomainId).toBeNull()
    }
    const created = d.recentQuestions.map((r) => r.createdAt)
    expect([...created].sort().reverse()).toEqual(created)
  })
})
