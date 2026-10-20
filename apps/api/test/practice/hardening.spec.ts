import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import {
  type Client,
  type PracticeTestApp,
  type World,
  START,
  bootPracticeApp,
  checkAnswer,
  countRows,
  fillBank,
  loadWorld,
  loginAs,
  makeSubscribed,
  resetPractice,
  startSession,
  trialUsed,
  userIdByEmail,
} from './helpers'

/** Pre-PR security review fixes: trial bypass, assigned-work races, id validation, history bounds. */
let t: PracticeTestApp
let w: World
let pelajar: Client
let maju: Client
let ids: { pelajar: string; maju: string }
let bank: ReturnType<typeof fillBank>

beforeAll(async () => {
  t = await bootPracticeApp()
  w = await loadWorld(t.db)
  pelajar = await loginAs(t, 'pelajar@demo.test')
  maju = await loginAs(t, 'pelajarmaju@demo.test')
  ids = { pelajar: await userIdByEmail(t.db, 'pelajar@demo.test'), maju: await userIdByEmail(t.db, 'pelajarmaju@demo.test') }
}, 120_000)

afterAll(async () => {
  await t.close()
})

beforeEach(async () => {
  t.clock.set(START)
  await resetPractice(t.db)
  await t.db.query('delete from comp_students')
  t.bank.reset()
  t.assignments.items.clear()
  t.assignments.remedialCalls.length = 0
  t.reward.calls.length = 0
  t.reward.marker = false
  bank = fillBank(t.bank, w)
})

const post = (c: Client, body: unknown) => c.post('/api/practice/sessions', body)
const submit = (c: Client, id: string) => c.post(`/api/practice/sessions/${id}/submit`, { timeSpent: 10 })

describe('1 trial: the limit holds on the check, not only on the start', () => {
  it('at 50 used a first check in an already started session is 402; no check row, the counter stays 50', async () => {
    const s = await startSession(pelajar, { mode: 'random', subjectCode: 'MATH', count: 5 })
    await t.db.query('update users set trial_questions_used = 50 where id = $1', [ids.pelajar])
    const res = await checkAnswer(pelajar, s.sessionId, t.bank, s.questions[0]?.id as string, true)
    expect(res.status).toBe(402)
    expect(res.body.error).toMatchObject({ code: 'TRIAL_EXHAUSTED', message: 'Baki percubaan percuma anda telah habis.' })
    expect(await countRows(t.db, 'practice_checks')).toBe(0)
    expect(await trialUsed(t.db, ids.pelajar)).toBe(50)
  })

  it('the 50th check is allowed (49 to 50); a repeat of a checked question still answers at the limit', async () => {
    const s = await startSession(pelajar, { mode: 'random', subjectCode: 'MATH', count: 5 })
    await t.db.query('update users set trial_questions_used = 49 where id = $1', [ids.pelajar])
    const q = s.questions[0]?.id as string
    expect((await checkAnswer(pelajar, s.sessionId, t.bank, q, true)).status).toBe(200)
    expect(await trialUsed(t.db, ids.pelajar)).toBe(50)
    expect((await checkAnswer(pelajar, s.sessionId, t.bank, q, false)).status).toBe(200)
    expect((await checkAnswer(pelajar, s.sessionId, t.bank, s.questions[1]?.id as string, true)).status).toBe(402)
  })

  it('parallel first checks at 49: exactly one succeeds, one check row, counter 50', async () => {
    const s = await startSession(pelajar, { mode: 'random', subjectCode: 'MATH', count: 5 })
    await t.db.query('update users set trial_questions_used = 49 where id = $1', [ids.pelajar])
    const results = await Promise.all(s.questions.map((q) => checkAnswer(pelajar, s.sessionId, t.bank, q.id, true)))
    expect(results.map((r) => r.status).sort()).toEqual([200, 402, 402, 402, 402])
    expect(await countRows(t.db, 'practice_checks')).toBe(1)
    expect(await trialUsed(t.db, ids.pelajar)).toBe(50)
  })

  it('a subscribed user is never refused', async () => {
    await makeSubscribed(t.db, ids.maju)
    await t.db.query('update users set trial_questions_used = 500 where id = $1', [ids.maju])
    const s = await startSession(maju, { mode: 'random', subjectCode: 'MATH', count: 5 })
    expect((await checkAnswer(maju, s.sessionId, t.bank, s.questions[0]?.id as string, true)).status).toBe(200)
  })

  it('checks of one session get distinct, increasing seq values even in parallel', async () => {
    const s = await startSession(maju, { mode: 'random', subjectCode: 'MATH', count: 10 })
    await Promise.all(s.questions.map((q) => checkAnswer(maju, s.sessionId, t.bank, q.id, true)))
    const rows = await t.db.query<{ seq: number }>('select seq from practice_checks where session_id = $1 order by seq', [s.sessionId])
    expect(rows.map((r) => r.seq)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  })
})

describe('2 assigned work: parallel starts and submits cannot multiply attempts', () => {
  it('question_set: parallel starts give one session (resumed), then maxAttempts 1 is spent by one completion', async () => {
    t.assignments.set('question_set', '7499', { status: 'ok', subjectId: w.subject.math, questionIds: bank.random.slice(0, 3), maxAttempts: 1, timeLimitSec: 60 })
    const racing = await Promise.all([1, 2, 3, 4, 5].map(() => post(pelajar, { mode: 'question_set', questionSetId: '7499' })))
    expect(racing.map((r) => r.status)).toEqual([201, 201, 201, 201, 201])
    expect(new Set(racing.map((r) => r.body.data.sessionId)).size).toBe(1)
    expect(await countRows(t.db, 'practice_sessions')).toBe(1)
    const id = racing[0]?.body.data.sessionId as string
    const done = await Promise.all([submit(pelajar, id), submit(pelajar, id)])
    expect(done.map((r) => r.status).sort()).toEqual([200, 409])
    expect(t.reward.calls).toHaveLength(1)
    const again = await post(pelajar, { mode: 'question_set', questionSetId: '7499' })
    expect(again.body.error.code).toBe('NO_ATTEMPTS_LEFT')
  })

  it('question_set: two open sessions of an older start cannot both complete (submit re-checks maxAttempts)', async () => {
    t.assignments.set('question_set', '7500', { status: 'ok', subjectId: w.subject.math, questionIds: bank.random.slice(0, 3), maxAttempts: 1 })
    const mk = async () =>
      (
        await t.db.query<{ id: string }>(
          `insert into practice_sessions (user_id, mode, subject_id, question_set_id, question_count, started_at) values ($1, 'question_set', $2, 7500, 3, now()) returning id::text`,
          [ids.pelajar, w.subject.math],
        )
      )[0]?.id as string
    const [a, b] = [await mk(), await mk()]
    const results = await Promise.all([submit(pelajar, a), submit(pelajar, b)])
    expect(results.map((r) => r.status).sort()).toEqual([200, 409])
    const refused = results.find((r) => r.status === 409)
    expect(refused?.body.error).toMatchObject({ code: 'NO_ATTEMPTS_LEFT', message: 'Tiada percubaan lagi untuk set ini.' })
    expect(t.reward.calls).toHaveLength(1)
    expect(await countRows(t.db, 'practice_sessions', "status = 'completed'")).toBe(1)
  })

  it('question_set with maxAttempts 0 (unlimited) can be completed many times', async () => {
    t.assignments.set('question_set', '7501', { status: 'ok', subjectId: w.subject.math, questionIds: bank.random.slice(0, 3), maxAttempts: 0 })
    for (let i = 0; i < 3; i++) {
      const s = await startSession(pelajar, { mode: 'question_set', questionSetId: '7501' })
      expect((await submit(pelajar, s.sessionId)).status).toBe(200)
    }
  })

  it('remedial: parallel starts give one session; a completed test is 409 "Ujian ini sudah selesai." even if the port is stale', async () => {
    t.assignments.set('remedial', '7700', { status: 'ok', subjectId: w.subject.math, questionIds: bank.random.slice(0, 4) })
    const racing = await Promise.all([1, 2, 3, 4].map(() => post(pelajar, { mode: 'remedial', remedialTestId: '7700' })))
    expect(new Set(racing.map((r) => r.body.data.sessionId)).size).toBe(1)
    expect(await countRows(t.db, 'practice_sessions')).toBe(1)
    const id = racing[0]?.body.data.sessionId as string
    expect((await submit(pelajar, id)).status).toBe(200)
    // The port still says "not completed" (stale): the stored completed session decides.
    const again = await post(pelajar, { mode: 'remedial', remedialTestId: '7700' })
    expect(again.status).toBe(409)
    expect(again.body.error).toMatchObject({ code: 'ALREADY_COMPLETED', message: 'Ujian ini sudah selesai.' })
  })

  it('remedial: two open sessions of an older start cannot both complete; the hook and the reward run once', async () => {
    t.assignments.set('remedial', '7701', { status: 'ok', subjectId: w.subject.math, questionIds: bank.random.slice(0, 4) })
    const mk = async () =>
      (
        await t.db.query<{ id: string }>(
          `insert into practice_sessions (user_id, mode, subject_id, remedial_test_id, question_count, started_at) values ($1, 'remedial', $2, 7701, 4, now()) returning id::text`,
          [ids.pelajar, w.subject.math],
        )
      )[0]?.id as string
    const [a, b] = [await mk(), await mk()]
    const results = await Promise.all([submit(pelajar, a), submit(pelajar, b)])
    expect(results.map((r) => r.status).sort()).toEqual([200, 409])
    expect(results.find((r) => r.status === 409)?.body.error).toMatchObject({ code: 'ALREADY_COMPLETED', message: 'Ujian ini sudah selesai.' })
    expect(t.assignments.remedialCalls).toHaveLength(1)
    expect(t.reward.calls).toHaveLength(1)
  })

  it('another student has their own attempts: the lock is per user', async () => {
    t.assignments.set('question_set', '7502', { status: 'ok', subjectId: w.subject.math, questionIds: bank.random.slice(0, 3), maxAttempts: 1 })
    const a = await startSession(pelajar, { mode: 'question_set', questionSetId: '7502' })
    const b = await startSession(maju, { mode: 'question_set', questionSetId: '7502' })
    expect(a.sessionId).not.toBe(b.sessionId)
  })
})

describe('3 ids and bounds in the start body are validated, never a 500', () => {
  const bad = ['abc', '12x', '-1', '99999999999999999999', '9223372036854775808', '01']
  it.each([
    ['chapter', 'chapterId', { count: 5 }],
    ['mission', 'missionId', {}],
    ['remedial', 'remedialTestId', {}],
    ['question_set', 'questionSetId', {}],
  ])('%s with a malformed %s is 404 "Rekod tidak dijumpai."', async (mode, field, extra) => {
    for (const value of bad) {
      const res = await post(pelajar, { mode, [field]: value, ...extra })
      expect(res.status, `${field}=${value}`).toBe(404)
      expect(res.body.error).toMatchObject({ code: 'NOT_FOUND', message: 'Rekod tidak dijumpai.' })
    }
  })

  it('a malformed targetQuestionId is 422 fields.targetQuestionId', async () => {
    const res = await post(pelajar, { mode: 'latih_tubi', subjectCode: 'SEJ', count: 1, targetQuestionId: 'abc' })
    expect(res.status).toBe(422)
    expect(res.body.error.fields).toEqual({ targetQuestionId: 'Nilai tidak sah.' })
  })

  it('ramalan year must be 1900 to 2100 and setNo 1 to 999, else 404', async () => {
    t.ramalan.set(w.subject.math, 2026, 1, bank.random.slice(0, 3))
    for (const [year, setNo] of [[1899, 1], [2101, 1], [2026, 0], [2026, 1000]]) {
      const res = await post(pelajar, { mode: 'ramalan', subjectCode: 'MATH', year, setNo })
      expect(res.status, `${String(year)}/${String(setNo)}`).toBe(404)
    }
    expect((await post(pelajar, { mode: 'ramalan', subjectCode: 'MATH', year: 2026, setNo: 1 })).status).toBe(201)
  })
})

describe('4 history is bounded', () => {
  it('page above 10000 is 422 fields.page; 10000 is an empty page', async () => {
    const over = await pelajar.get('/api/practice/sessions?modes=random&page=10001')
    expect(over.status).toBe(422)
    expect(over.body.error).toMatchObject({ code: 'VALIDATION_ERROR', fields: { page: 'Nilai tidak sah.' } })
    const edge = await pelajar.get('/api/practice/sessions?modes=random&page=10000')
    expect(edge.status).toBe(200)
    expect(edge.body.data).toEqual([])
  })

  it('the unpaged list returns at most 1000 rows; the meta still reports the whole history', async () => {
    await t.db.query(
      `insert into practice_sessions (user_id, mode, question_count, status, started_at, completed_at)
       select $1, 'random', 4, 'completed', '2026-09-01T00:00:00Z'::timestamptz + (g || ' minutes')::interval, '2026-09-01T00:00:00Z'::timestamptz + (g || ' minutes')::interval from generate_series(1, 1005) g`,
      [ids.pelajar],
    )
    const res = await pelajar.get('/api/practice/sessions?modes=random')
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(1000)
    expect(res.body.meta).toMatchObject({ page: 1, pageSize: 1000, totalItems: 1005, totalPages: 2, stats: { sessions: 1005 } })
    // The newest rows come first.
    expect(res.body.data[0].completedAt > res.body.data[999].completedAt).toBe(true)
  })
})
