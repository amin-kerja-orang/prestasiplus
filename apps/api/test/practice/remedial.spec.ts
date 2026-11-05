import { PracticeReadRemedialSuggestionsSchema, envelopeOf } from '@pp/contract'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { PracticeAnalyticsReadsModule } from '../../src/modules/practice/reads/analytics'
import { expectError } from '../curriculum/helpers'
import {
  type Client,
  type PracticeTestApp,
  type World,
  bootPracticeApp,
  loadWorld,
  loginAs,
  resetPractice,
  START,
  startSession,
  userIdByEmail,
} from './helpers'

/** S5-T07 (R1-MUR-12): GET /practice/remedial-suggestions and the revision drill top-up (one shared selector). */

let t: PracticeTestApp
let w: World
let pelajar: Client
let guru: Client
let me: string
let topic: string

beforeAll(async () => {
  t = await bootPracticeApp({ modules: [PracticeAnalyticsReadsModule] })
  w = await loadWorld(t.db)
  pelajar = await loginAs(t, 'pelajar@demo.test')
  guru = await loginAs(t, 'guru@demo.test')
  me = await userIdByEmail(t.db, 'pelajar@demo.test')
  topic = (await t.db.query<{ id: string }>(`insert into topics (chapter_id, name) values ($1, 'Topik lemah') returning id::text`, [w.chapter.c1]))[0]?.id as string
}, 120_000)

afterAll(async () => {
  await t.close()
})

beforeEach(async () => {
  t.clock.set(START)
  await resetPractice(t.db)
  t.bank.reset()
})

interface Ans {
  q?: string | null
  subject?: string
  chapter?: string | null
  topic?: string | null
  correct: boolean
  at?: string
  isTest?: boolean
}

async function answer(a: Ans, user = me): Promise<void> {
  await t.db.query(
    `insert into practice_answers (user_id, question_id, subject_id, chapter_id, topic_id, is_correct, answered_at, is_test)
     values ($1, $2, $3, $4, $5, $6, $7::timestamptz, $8)`,
    [user, a.q ?? null, a.subject ?? w.subject.math, a.chapter ?? null, a.topic ?? null, a.correct, a.at ?? '2026-10-01T10:00:00+08:00', a.isTest ?? false],
  )
}

/** `n` anonymous answers of a subject with `correct` of them right. */
async function bulk(subject: string, n: number, correct: number, isTest = false): Promise<void> {
  await t.db.query(
    `insert into practice_answers (user_id, subject_id, is_correct, answered_at, is_test)
     select $1, $2, g <= $4, '2026-10-01T10:00:00+08:00'::timestamptz + (g || ' seconds')::interval, $5 from generate_series(1, $3::int) g`,
    [me, subject, n, correct, isTest],
  )
}

async function queue(q: string, minute: number, subject = w.subject.math): Promise<void> {
  await t.db.query(
    `insert into revision_queue (user_id, question_id, subject_id, wrong_times, last_wrong_at) values ($1, $2, $3, 1, '2026-10-01T00:00:00Z'::timestamptz + ($4 || ' minutes')::interval)`,
    [me, q, subject, String(minute)],
  )
}

async function revisionSet(subject: string, start: string, end: string, count: number, correct: number, extra: { isTest?: boolean; mode?: string } = {}): Promise<void> {
  await t.db.query(
    `insert into practice_sessions (user_id, mode, subject_id, question_count, correct_count, status, started_at, completed_at, is_test)
     values ($1, $2, $3, $4, $5, 'completed', $6::timestamptz, $7::timestamptz, $8)`,
    [me, extra.mode ?? 'revision', subject, count, correct, start, end, extra.isTest ?? false],
  )
}

const get = async (c: Client = pelajar) => {
  const res = await c.get('/api/practice/remedial-suggestions')
  expect(res.status, JSON.stringify(res.body)).toBe(200)
  return envelopeOf(PracticeReadRemedialSuggestionsSchema).parse(res.body).data
}

/** A servable MATH question with one wrong answer in the queue: the drill of the subject is then non-empty. */
async function weakMath(n: number, correct: number): Promise<string> {
  const q = t.bank.add({ subjectId: w.subject.math, levelId: w.level.d1 })
  await queue(q, 1)
  await bulk(w.subject.math, n, correct)
  return q
}

describe('auth and roles', () => {
  it('is 401 without a session', async () => {
    expectError(await t.http().get('/api/practice/remedial-suggestions'), 'UNAUTHORIZED')
  })

  it('a teacher gets empty arrays (R10)', async () => {
    await weakMath(10, 0)
    expect(await get(guru)).toEqual({ completed: [], needed: [] })
  })

  it('a pupil with no answers sees empty arrays and no error (FR-MUR-12-8)', async () => {
    expect(await get()).toEqual({ completed: [], needed: [] })
  })
})

describe('needed: pooled accuracy below 60 (R2) with a servable drill (FD-MUR-36)', () => {
  it('a weak subject at 0% over 120 answers is a card (AC-MUR-12-1)', async () => {
    await weakMath(120, 0)
    expect((await get()).needed).toEqual([{ subjectCode: 'MATH', subjectName: expect.any(String), answered: 120, accuracy: 0, target: 60 }])
  })

  it('exactly 60% is not listed', async () => {
    await weakMath(10, 6)
    expect((await get()).needed).toEqual([])
  })

  it('59.5% rounds half up to 60 and is not listed; 59% is listed as 59', async () => {
    await weakMath(200, 119)
    expect((await get()).needed).toEqual([])
    await t.db.query('delete from practice_answers')
    await bulk(w.subject.math, 200, 118)
    const needed = (await get()).needed
    expect(needed).toHaveLength(1)
    expect(needed[0]).toMatchObject({ answered: 200, accuracy: 59 })
  })

  it('a weak subject whose drill would be empty is not listed, and its start is 422', async () => {
    await bulk(w.subject.math, 20, 0)
    expect((await get()).needed).toEqual([])
    const res = await pelajar.post('/api/practice/sessions', { mode: 'revision', subjectCode: 'MATH' })
    expect(res.status).toBe(422)
    expect(res.body.error.code).toBe('NO_WRONG_QUESTIONS')
  })

  it('a deactivated wrong question leaves the card out (archived questions drop out)', async () => {
    const q = await weakMath(10, 0)
    expect((await get()).needed).toHaveLength(1)
    t.bank.deactivate(q)
    expect((await get()).needed).toEqual([])
  })

  it('is_test rows are ignored', async () => {
    await weakMath(10, 10)
    await bulk(w.subject.math, 40, 0, true)
    expect((await get()).needed).toEqual([])
    await t.db.query('delete from practice_answers')
    await bulk(w.subject.math, 40, 0, true)
    expect(await get()).toEqual({ completed: [], needed: [] })
  })

  it('lists subjects in M03 order and skips an inactive one', async () => {
    const q2 = t.bank.add({ subjectId: w.subject.bm, levelId: w.level.d1 })
    await queue(q2, 1, w.subject.bm)
    await bulk(w.subject.bm, 5, 1)
    await weakMath(4, 0)
    const codes = (await get()).needed.map((n) => n.subjectCode)
    expect(codes.sort()).toEqual(['BM', 'MATH'])
    await t.db.query(`update subjects set is_active = false where code = 'BM'`)
    try {
      expect((await get()).needed.map((n) => n.subjectCode)).toEqual(['MATH'])
    } finally {
      await t.db.query(`update subjects set is_active = true where code = 'BM'`)
    }
  })
})

describe('completed sets', () => {
  it('gives Sebelum, Selepas, delta and the per-subject Set n, newest first; test and non-revision sessions are left out', async () => {
    // Before set 1: 4 answers, 1 right (25). Before set 2: 10 answers, 6 right (60).
    await t.db.query(
      `insert into practice_answers (user_id, subject_id, is_correct, answered_at) values
       ($1, $2, true, '2026-10-01T10:00:00+08:00'), ($1, $2, false, '2026-10-01T10:01:00+08:00'), ($1, $2, false, '2026-10-01T10:02:00+08:00'), ($1, $2, false, '2026-10-01T10:03:00+08:00'),
       ($1, $2, true, '2026-10-05T10:00:00+08:00'), ($1, $2, true, '2026-10-05T10:01:00+08:00'), ($1, $2, true, '2026-10-05T10:02:00+08:00'),
       ($1, $2, true, '2026-10-05T10:03:00+08:00'), ($1, $2, true, '2026-10-05T10:04:00+08:00'), ($1, $2, false, '2026-10-05T10:05:00+08:00'),
       ($1, $2, true, '2026-10-02T10:30:00+08:00')`,
      [me, w.subject.math],
    )
    await revisionSet(w.subject.math, '2026-10-02T10:00:00+08:00', '2026-10-02T10:20:00+08:00', 20, 16) // set 1: before 1 of 4 = 25, after 80
    await revisionSet(w.subject.math, '2026-10-06T10:00:00+08:00', '2026-10-06T10:20:00+08:00', 10, 4) // set 2
    await revisionSet(w.subject.bm, '2026-10-07T10:00:00+08:00', '2026-10-07T10:20:00+08:00', 5, 5) // BM set 1: no earlier answers
    await revisionSet(w.subject.math, '2026-10-08T10:00:00+08:00', '2026-10-08T10:20:00+08:00', 10, 10, { isTest: true })
    await revisionSet(w.subject.math, '2026-10-09T10:00:00+08:00', '2026-10-09T10:20:00+08:00', 10, 10, { mode: 'random' })
    const { completed } = await get()
    expect(completed.map((c) => [c.subjectCode, c.setNo])).toEqual([['BM', 1], ['MATH', 2], ['MATH', 1]])
    const set1 = completed[2]
    expect(set1).toMatchObject({ questionCount: 20, before: 25, after: 80, delta: 55, at: '2026-10-02T10:20:00.000+08:00' })
    // Set 2 sees the 4 + the answer at 10-02 10:30 (inside set 1's window) + the 6 of 10-05: 11 answers, 7 right (64); after 40.
    expect(completed[1]).toMatchObject({ questionCount: 10, before: 64, after: 40, delta: -24 })
    expect(completed[0]).toMatchObject({ before: 0, after: 100, delta: 100 })
  })

  it('returns at most the newest 20 but keeps the ordinal of all', async () => {
    for (let i = 1; i <= 22; i++) {
      const day = String(i).padStart(2, '0')
      await revisionSet(w.subject.math, `2026-09-${day}T10:00:00+08:00`, `2026-09-${day}T10:10:00+08:00`, 10, 5)
    }
    const { completed } = await get()
    expect(completed).toHaveLength(20)
    expect(completed[0]?.setNo).toBe(22)
    expect(completed[19]?.setNo).toBe(3)
  })
})

describe('the revision drill: wrong first, then a top-up from the weakest topics (AC-MUR-12-5)', () => {
  it('3 wrong questions and a weak topic: the 3 first, then never-correct, then the oldest answered, 20 in all', async () => {
    const add = () => t.bank.add({ subjectId: w.subject.math, levelId: w.level.d1, chapterId: w.chapter.c1, topicId: topic })
    const wrong = [add(), add(), add()]
    const never = Array.from({ length: 10 }, add)
    const right = Array.from({ length: 12 }, add)
    for (const [i, q] of wrong.entries()) {
      await queue(q, i)
      await answer({ q, topic, chapter: w.chapter.c1, correct: false, at: `2026-10-03T10:0${i}:00+08:00` })
    }
    // Never-correct questions: the oldest last answer first (never[0] oldest).
    for (const [i, q] of never.entries()) await answer({ q, topic, chapter: w.chapter.c1, correct: false, at: `2026-10-02T10:${String(i).padStart(2, '0')}:00+08:00` })
    for (const [i, q] of right.entries()) await answer({ q, topic, chapter: w.chapter.c1, correct: true, at: `2026-10-01T10:${String(i).padStart(2, '0')}:00+08:00` })

    const card = (await get()).needed
    expect(card).toHaveLength(1)
    const started = await startSession(pelajar, { mode: 'revision', subjectCode: 'MATH' })
    const ids = started.questions.map((q) => q.id)
    expect(ids).toHaveLength(20)
    expect(new Set(ids).size).toBe(20)
    expect(new Set(ids.slice(0, 3))).toEqual(new Set(wrong))
    expect(ids.slice(3, 13)).toEqual(never)
    expect(ids.slice(13)).toEqual(right.slice(0, 7))
    expect(started.body.revisionMeta).toEqual({ selected: 20, totalWrong: 3 })
  })

  it('a topic of one answer is not a weak topic (at least 2 attempts); a chapter stands in for a missing topic', async () => {
    const wrong = t.bank.add({ subjectId: w.subject.math, levelId: w.level.d1, chapterId: w.chapter.c2 })
    const lone = t.bank.add({ subjectId: w.subject.math, levelId: w.level.d1, chapterId: w.chapter.c3 })
    const same = t.bank.add({ subjectId: w.subject.math, levelId: w.level.d1, chapterId: w.chapter.c2 })
    await queue(wrong, 1)
    await answer({ q: wrong, chapter: w.chapter.c2, correct: false })
    await answer({ q: same, chapter: w.chapter.c2, correct: true })
    await answer({ q: lone, chapter: w.chapter.c3, correct: false })
    const started = await startSession(pelajar, { mode: 'revision', subjectCode: 'MATH' })
    expect(started.questions.map((q) => q.id)).toEqual([wrong, same])
  })

  it('serves only the top-up when no wrong question is servable, and 422 only when both lists are empty', async () => {
    const a = t.bank.add({ subjectId: w.subject.math, levelId: w.level.d1, chapterId: w.chapter.c1 })
    const b = t.bank.add({ subjectId: w.subject.math, levelId: w.level.d1, chapterId: w.chapter.c1 })
    await answer({ q: a, chapter: w.chapter.c1, correct: false })
    await answer({ q: b, chapter: w.chapter.c1, correct: false })
    const started = await startSession(pelajar, { mode: 'revision', subjectCode: 'MATH' })
    expect(started.questions.map((q) => q.id)).toEqual([a, b])
    expect(started.body.revisionMeta).toEqual({ selected: 2, totalWrong: 0 })
    t.bank.deactivate(a)
    t.bank.deactivate(b)
    expect((await pelajar.post('/api/practice/sessions', { mode: 'revision', subjectCode: 'MATH' })).status).toBe(422)
  })
})
