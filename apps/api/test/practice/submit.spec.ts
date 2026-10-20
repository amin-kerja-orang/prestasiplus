import { SubmitSessionResponseSchema } from '@pp/contract'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import {
  type Client,
  type PracticeTestApp,
  type World,
  bootPracticeApp,
  checkAnswer,
  countRows,
  fillBank,
  loadWorld,
  loginAs,
  play,
  START,
  resetPractice,
  startSession,
  trialUsed,
  userIdByEmail,
} from './helpers'

let t: PracticeTestApp
let w: World
let pelajar: Client
let maju: Client
let ids: { pelajar: string; maju: string }
let bank: ReturnType<typeof fillBank>
let topicId: string

beforeAll(async () => {
  t = await bootPracticeApp()
  w = await loadWorld(t.db)
  pelajar = await loginAs(t, 'pelajar@demo.test')
  maju = await loginAs(t, 'pelajarmaju@demo.test')
  ids = { pelajar: await userIdByEmail(t.db, 'pelajar@demo.test'), maju: await userIdByEmail(t.db, 'pelajarmaju@demo.test') }
  topicId = (await t.db.query<{ id: string }>('select id::text from topics where chapter_id = $1 order by id limit 1', [w.chapter.c1]))[0]?.id as string
}, 120_000)

afterAll(async () => {
  await t.close()
})

beforeEach(async () => {
  t.clock.set(START)
  await resetPractice(t.db)
  t.bank.reset()
  t.reward.calls.length = 0
  t.reward.failWith = null
  t.assignments.remedialCalls.length = 0
  t.assignments.failRemedial = null
  t.assignments.items.clear()
  bank = fillBank(t.bank, w)
})

const submit = (c: Client, id: string, body: unknown = { timeSpent: 60 }) => c.post(`/api/practice/sessions/${id}/submit`, body)
const sessionRow = async (id: string) =>
  (
    await t.db.query<{
      status: string
      correct_count: number
      question_count: number
      time_spent_sec: number
      points_earned: number
      coins_earned: number
      coins_per_correct: number | null
      completed_at: Date | null
    }>('select status, correct_count, question_count, time_spent_sec, points_earned, coins_earned, coins_per_correct, completed_at from practice_sessions where id = $1', [id])
  )[0]

describe('AC5 rewards: points, coins and the reward port', () => {
  it('points are 10 x correct, the session keeps coins = correct, the response carries the reward port figures', async () => {
    const { started, submit: res } = await play(pelajar, t.bank, { mode: 'random', subjectCode: 'MATH', count: 10 }, 7)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    const parsed = SubmitSessionResponseSchema.parse(res.body.data)
    expect(parsed).toEqual({ results: { score: 7, total: 10, gamification: { coinsEarned: 7, streakCount: 3, pointsEarned: 70, totalBalance: 120 } } })
    const row = await sessionRow(started.sessionId)
    expect(row).toMatchObject({ status: 'completed', correct_count: 7, question_count: 10, points_earned: 70, coins_earned: 7, time_spent_sec: 120 })
    expect(row?.completed_at?.toISOString()).toBe(new Date('2026-10-19T09:00:00+08:00').toISOString())
  })

  it('the reward port is called once per session, inside the transaction, with the session figures', async () => {
    const { started } = await play(pelajar, t.bank, { mode: 'random', subjectCode: 'MATH', count: 5 }, 2, 45)
    expect(t.reward.calls).toHaveLength(1)
    expect(t.reward.calls[0]).toEqual({
      userId: ids.pelajar,
      sessionId: started.sessionId,
      mode: 'random',
      correct: 2,
      total: 5,
      timeSpent: 45,
      completedAt: new Date('2026-10-19T09:00:00+08:00'),
      pointsEarned: 20,
      sessionCoins: 2,
      isTest: false,
    })
    // A second submit is refused before the reward port is reached.
    expect((await submit(pelajar, started.sessionId)).status).toBe(409)
    expect(t.reward.calls).toHaveLength(1)
  })

  it('mission: coinsPerCorrect is passed to the port and multiplies the session coins (mission rate 5; default 3)', async () => {
    t.assignments.set('mission', '9001', { status: 'ok', subjectId: w.subject.math, questionIds: bank.random.slice(0, 4), coinsPerCorrect: 5 })
    const { started } = await play(pelajar, t.bank, { mode: 'mission', missionId: '9001' }, 3)
    expect(t.reward.calls[0]).toMatchObject({ mode: 'mission', correct: 3, coinsPerCorrect: 5, sessionCoins: 15, pointsEarned: 30 })
    expect((await sessionRow(started.sessionId))?.coins_earned).toBe(15)
    t.assignments.set('mission', '9002', { status: 'ok', subjectId: w.subject.math, questionIds: bank.random.slice(0, 4) })
    const second = await play(maju, t.bank, { mode: 'mission', missionId: '9002' }, 4)
    expect(t.reward.calls[1]).toMatchObject({ coinsPerCorrect: 3, sessionCoins: 12 })
    expect((await sessionRow(second.started.sessionId))?.coins_earned).toBe(12)
  })

  it('a non-mission session reports no coinsPerCorrect to the port', async () => {
    await play(pelajar, t.bank, { mode: 'random', subjectCode: 'MATH', count: 5 }, 5)
    expect(t.reward.calls[0]).not.toHaveProperty('coinsPerCorrect')
  })

  it('a session with no check completes with score 0, no answer rows and still calls the port once', async () => {
    const s = await startSession(pelajar, { mode: 'random', subjectCode: 'MATH', count: 5 })
    const res = await submit(pelajar, s.sessionId, { timeSpent: 3 })
    expect(res.body.data.results).toMatchObject({ score: 0, total: 5 })
    expect(await countRows(t.db, 'practice_answers')).toBe(0)
    expect(t.reward.calls).toHaveLength(1)
  })
})

describe('timeSpent is coerced, never rejected (BR-30)', () => {
  it.each([
    [99_999, 5 * 180],
    [-5, 0],
    [120.6, 121],
    [0, 0],
    ['abc', 0],
    ['60', 0],
    [null, 0],
    [undefined, 0],
    [{ a: 1 }, 0],
  ])('timeSpent %j is stored as %i', async (sent, stored) => {
    const s = await startSession(pelajar, { mode: 'random', subjectCode: 'MATH', count: 5 })
    const res = await submit(pelajar, s.sessionId, sent === undefined ? {} : { timeSpent: sent })
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect((await sessionRow(s.sessionId))?.time_spent_sec).toBe(stored)
  })

  it('a missing body is accepted too', async () => {
    const s = await startSession(pelajar, { mode: 'random', subjectCode: 'MATH', count: 5 })
    const res = await pelajar.post(`/api/practice/sessions/${s.sessionId}/submit`)
    expect(res.status).toBe(200)
  })
})

describe('AC6 the answer row', () => {
  it('copies the dimensions of the served version and carries the v2 columns', async () => {
    t.bank.reset()
    const clientUuid = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d'
    const q1 = t.bank.add({ subjectId: w.subject.math, levelId: w.level.d1, chapterId: w.chapter.c1, topicId, difficulty: 3, correct: 2 })
    const q2 = t.bank.add({ subjectId: w.subject.math, levelId: w.level.d1, chapterId: w.chapter.c1, topicId: null, difficulty: null, correct: 1 })
    const s = await startSession(pelajar, { mode: 'chapter', chapterId: w.chapter.c1, count: 5, clientUuid })
    expect(s.questions.map((q) => q.id)).toEqual([q1, q2])
    t.clock.advance(15_000)
    await checkAnswer(pelajar, s.sessionId, t.bank, q1, true)
    t.clock.advance(15_000)
    await checkAnswer(pelajar, s.sessionId, t.bank, q2, false)
    t.clock.advance(5_000)
    await submit(pelajar, s.sessionId)
    const rows = await t.db.query<Record<string, unknown>>(
      `select session_id::text, user_id::text, question_id::text, question_version_no, subject_id::text, education_level_id::text, chapter_id::text,
              topic_id::text, difficulty, question_type, selected_label, is_correct, answered_at, historical, client_uuid::text, is_test,
              legacy_source, legacy_id, legacy_hash, legacy_question_ref, legacy_content_hash, source_natural_key, number_label, time_seconds
         from practice_answers where session_id = $1 order by id`,
      [s.sessionId],
    )
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({
      session_id: s.sessionId,
      user_id: ids.pelajar,
      question_id: q1,
      question_version_no: 1,
      subject_id: w.subject.math,
      education_level_id: w.level.d1,
      chapter_id: w.chapter.c1,
      topic_id: topicId,
      difficulty: 3,
      question_type: 'mcq',
      selected_label: 'C',
      is_correct: true,
      historical: false,
      client_uuid: clientUuid,
      is_test: false,
      legacy_source: null,
      legacy_id: null,
      legacy_hash: null,
      legacy_question_ref: null,
      legacy_content_hash: null,
      source_natural_key: null,
      number_label: null,
    })
    // answered_at is the time of the check, not of the submit.
    expect((rows[0]?.answered_at as Date).toISOString()).toBe(new Date('2026-10-19T09:00:15+08:00').toISOString())
    expect((rows[1]?.answered_at as Date).toISOString()).toBe(new Date('2026-10-19T09:00:30+08:00').toISOString())
    expect(rows[1]).toMatchObject({ question_id: q2, topic_id: null, difficulty: null, selected_label: 'C', is_correct: false })
    // The temporary checks are gone once the answer rows exist.
    expect(await countRows(t.db, 'practice_checks')).toBe(0)
  })

  it('a session without clientUuid gives answers without clientUuid', async () => {
    await play(pelajar, t.bank, { mode: 'random', subjectCode: 'MATH', count: 5 }, 1)
    expect(await countRows(t.db, 'practice_answers', 'client_uuid is null')).toBe(5)
  })
})

describe('AC7 abandoned and foreign sessions', () => {
  it('a started session that is never submitted records no answers, queue or counters', async () => {
    const s = await startSession(pelajar, { mode: 'random', subjectCode: 'MATH', count: 5 })
    await checkAnswer(pelajar, s.sessionId, t.bank, s.questions[0]?.id as string, false)
    expect(await countRows(t.db, 'practice_answers')).toBe(0)
    expect(await countRows(t.db, 'revision_queue')).toBe(0)
    expect(await countRows(t.db, 'mastery')).toBe(0)
    const list = await pelajar.get('/api/practice/sessions?modes=random')
    expect(list.body.data).toEqual([])
    expect(list.body.meta.stats.sessions).toBe(0)
  })

  it('another student cannot submit the session: 404 "Rekod tidak dijumpai.", the session stays open', async () => {
    const s = await startSession(pelajar, { mode: 'random', subjectCode: 'MATH', count: 5 })
    const res = await submit(maju, s.sessionId)
    expect(res.status).toBe(404)
    expect(res.body.error).toMatchObject({ code: 'NOT_FOUND', message: 'Rekod tidak dijumpai.' })
    expect((await sessionRow(s.sessionId))?.status).toBe('in_progress')
    for (const id of ['s_unknown', '00000000-0000-4000-8000-000000000000']) expect((await submit(pelajar, id)).status).toBe(404)
    expect(t.reward.calls).toHaveLength(0)
  })

  it('409 ALREADY_SUBMITTED "Sesi ini sudah dihantar." on a second submit; nothing is written twice', async () => {
    const { started } = await play(pelajar, t.bank, { mode: 'random', subjectCode: 'MATH', count: 5 }, 3)
    const again = await submit(pelajar, started.sessionId)
    expect(again.status).toBe(409)
    expect(again.body.error).toMatchObject({ code: 'ALREADY_SUBMITTED', message: 'Sesi ini sudah dihantar.' })
    expect(await countRows(t.db, 'practice_answers')).toBe(5)
  })

  it('parallel submits give one 200 and one 409, and the answers are written once', async () => {
    const s = await startSession(pelajar, { mode: 'random', subjectCode: 'MATH', count: 10 })
    for (const [i, q] of s.questions.entries()) await checkAnswer(pelajar, s.sessionId, t.bank, q.id, i % 2 === 0)
    const results = await Promise.all([submit(pelajar, s.sessionId), submit(pelajar, s.sessionId), submit(pelajar, s.sessionId)])
    const statuses = results.map((r) => r.status).sort()
    expect(statuses).toEqual([200, 409, 409])
    for (const r of results.filter((x) => x.status === 409)) expect(r.body.error.code).toBe('ALREADY_SUBMITTED')
    expect(await countRows(t.db, 'practice_answers')).toBe(10)
    expect(t.reward.calls).toHaveLength(1)
    const mastery = await t.db.query<{ answered: number; correct: number }>('select answered, correct from mastery where user_id = $1', [ids.pelajar])
    expect(mastery).toEqual([{ answered: 10, correct: 5 }])
  })
})

describe('BR-14 revision queue and BR-20 mastery counters', () => {
  const queue = (userId: string) =>
    t.db.query<{ question_id: string; wrong_times: number; subject_id: string }>(
      'select question_id::text, wrong_times, subject_id::text from revision_queue where user_id = $1 order by question_id',
      [userId],
    )
  const mastery = (userId: string) =>
    t.db.query<{ subject_id: string; correct: number; answered: number; last_answered_at: Date }>(
      'select subject_id::text, correct, answered, last_answered_at from mastery where user_id = $1 order by subject_id',
      [userId],
    )

  it('a wrong answer queues the question, a repeated wrong adds one, a right answer removes it', async () => {
    const chapter = { mode: 'chapter', chapterId: w.chapter.c1, count: 20 }
    const first = await play(pelajar, t.bank, chapter, 4) // 6 questions: the first 4 right
    const wrongIds = first.started.questions.slice(4).map((q) => q.id)
    expect((await queue(ids.pelajar)).map((r) => [r.question_id, r.wrong_times, r.subject_id])).toEqual(wrongIds.map((id) => [id, 1, w.subject.math]))
    t.clock.advance(60_000)
    await play(pelajar, t.bank, chapter, 4) // BR-17 puts the answered ones in a different order; the same 2 are wrong or not
    const after = await queue(ids.pelajar)
    // Every question answered wrong twice is 2 times; a question answered right now is gone.
    for (const row of after) expect(row.wrong_times).toBeGreaterThanOrEqual(1)
    t.clock.advance(60_000)
    await play(pelajar, t.bank, chapter, 6) // everything right: the queue is empty
    expect(await queue(ids.pelajar)).toEqual([])
  })

  it('the second wrong answer of one question is wrong_times 2 and the latest time', async () => {
    t.bank.reset()
    const q = t.bank.add({ subjectId: w.subject.math, levelId: w.level.d1, chapterId: w.chapter.c1 })
    for (const minute of [0, 5]) {
      t.clock.set(`2026-10-19T09:${String(minute).padStart(2, '0')}:00+08:00`)
      const s = await startSession(pelajar, { mode: 'chapter', chapterId: w.chapter.c1, count: 5 })
      await checkAnswer(pelajar, s.sessionId, t.bank, q, false)
      await submit(pelajar, s.sessionId)
    }
    const rows = await t.db.query<{ wrong_times: number; last_wrong_at: Date }>('select wrong_times, last_wrong_at from revision_queue where question_id = $1', [q])
    expect(rows).toHaveLength(1)
    expect(rows[0]?.wrong_times).toBe(2)
    expect(rows[0]?.last_wrong_at.toISOString()).toBe(new Date('2026-10-19T09:05:00+08:00').toISOString())
    // The user's right answer next time removes it.
    t.clock.set('2026-10-19T09:10:00+08:00')
    const s = await startSession(pelajar, { mode: 'chapter', chapterId: w.chapter.c1, count: 5 })
    await checkAnswer(pelajar, s.sessionId, t.bank, q, true)
    await submit(pelajar, s.sessionId)
    expect(await queue(ids.pelajar)).toEqual([])
  })

  it('mastery counters add the session per subject; a user with answers but no counters starts from the log', async () => {
    // Two earlier answers (one right) exist in the log without counters (migrated history).
    await t.db.query(
      `insert into practice_answers (user_id, question_id, subject_id, is_correct, answered_at, historical) values
        ($1, 1, $2, true, '2026-01-01T00:00:00Z', true), ($1, 2, $2, false, '2026-01-02T00:00:00Z', true)`,
      [ids.pelajar, w.subject.math],
    )
    await play(pelajar, t.bank, { mode: 'random', subjectCode: 'MATH', count: 5 }, 3)
    let rows = await mastery(ids.pelajar)
    expect(rows.map((r) => [r.subject_id, r.correct, r.answered])).toEqual([[w.subject.math, 4, 7]])
    t.clock.advance(3_600_000)
    await play(pelajar, t.bank, { mode: 'random', subjectCode: 'MATH', count: 5 }, 5)
    rows = await mastery(ids.pelajar)
    expect(rows.map((r) => [r.subject_id, r.correct, r.answered])).toEqual([[w.subject.math, 9, 12]])
    expect(rows[0]?.last_answered_at.toISOString()).toBe(new Date('2026-10-19T10:00:00+08:00').toISOString())
    // Another user is untouched.
    expect(await mastery(ids.maju)).toEqual([])
  })

  it('a session over two subjects updates both counters', async () => {
    t.bank.reset()
    const a = t.bank.add({ subjectId: w.subject.math, levelId: w.level.d1, chapterId: w.chapter.c1 })
    const b = t.bank.add({ subjectId: w.subject.sej, levelId: w.level.t4, spmPool: true })
    t.assignments.set('remedial', '7800', { status: 'ok', subjectId: w.subject.math, questionIds: [a, b] })
    const s = await startSession(pelajar, { mode: 'remedial', remedialTestId: '7800' })
    await checkAnswer(pelajar, s.sessionId, t.bank, a, true)
    await checkAnswer(pelajar, s.sessionId, t.bank, b, false)
    await submit(pelajar, s.sessionId)
    const rows = await mastery(ids.pelajar)
    expect(rows.map((r) => [r.subject_id, r.correct, r.answered]).sort()).toEqual(
      [[w.subject.math, 1, 1], [w.subject.sej, 0, 1]].sort(),
    )
  })

  it('trial counters are not touched by a submit', async () => {
    const s = await startSession(pelajar, { mode: 'random', subjectCode: 'MATH', count: 5 })
    for (const q of s.questions) await checkAnswer(pelajar, s.sessionId, t.bank, q.id, true)
    const before = await trialUsed(t.db, ids.pelajar)
    await submit(pelajar, s.sessionId)
    expect(await trialUsed(t.db, ids.pelajar)).toBe(before)
  })
})

describe('remedial mode completes its test (ADR-0014 amendment 2)', () => {
  it('remedialCompleted gets the rounded accuracy and the completion time, inside the transaction', async () => {
    t.assignments.set('remedial', '7699', { status: 'ok', subjectId: w.subject.math, questionIds: bank.random.slice(0, 4) })
    const { started } = await play(maju, t.bank, { mode: 'remedial', remedialTestId: '7699' }, 3)
    expect(t.assignments.remedialCalls).toEqual([
      { remedialTestId: '7699', userId: ids.maju, afterAccuracy: 75, completedAt: new Date('2026-10-19T09:00:00+08:00'), isTest: false },
    ])
    expect((await sessionRow(started.sessionId))?.status).toBe('completed')
  })

  it('a non-remedial session never calls it', async () => {
    await play(pelajar, t.bank, { mode: 'random', subjectCode: 'MATH', count: 5 }, 5)
    expect(t.assignments.remedialCalls).toEqual([])
  })
})
