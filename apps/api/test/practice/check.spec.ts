import { CheckAnswerResponseSchema } from '@pp/contract'
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
  makeSubscribed,
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
  bank = fillBank(t.bank, w)
})

const start = (c: Client = pelajar, count = 5) => startSession(c, { mode: 'random', subjectCode: 'MATH', count })
const check = (c: Client, sessionId: string, body: unknown) => c.post(`/api/practice/sessions/${sessionId}/check-answer`, body)

describe('check-answer: grading and the stored check', () => {
  it('a right and a wrong answer return {isCorrect, correctOptionId, feedback, explanation} and store one check each', async () => {
    const s = await start()
    const [q1, q2] = s.questions
    const key1 = t.bank.correctIndex(q1?.id as string)
    const right = await check(pelajar, s.sessionId, { questionId: q1?.id, selectedOptionId: key1 })
    expect(right.status).toBe(200)
    expect(CheckAnswerResponseSchema.parse(right.body.data)).toEqual({
      isCorrect: true,
      correctOptionId: key1,
      feedback: 'Betul!',
      explanation: `Penjelasan soalan ${q1?.id}`,
    })
    const key2 = t.bank.correctIndex(q2?.id as string)
    const wrong = await check(pelajar, s.sessionId, { questionId: q2?.id, selectedOptionId: (key2 + 1) % 4 })
    expect(wrong.body.data).toMatchObject({ isCorrect: false, correctOptionId: key2, feedback: 'Salah' })
    const rows = await t.db.query<{ question_id: string; selected_label: string; is_correct: boolean; seq: number; is_test: boolean; question_version_no: number }>(
      'select question_id::text, selected_label, is_correct, seq, is_test, question_version_no from practice_checks where session_id = $1 order by seq',
      [s.sessionId],
    )
    expect(rows).toEqual([
      { question_id: q1?.id, selected_label: 'ABCD'[key1], is_correct: true, seq: 1, is_test: false, question_version_no: 1 },
      { question_id: q2?.id, selected_label: 'ABCD'[(key2 + 1) % 4], is_correct: false, seq: 2, is_test: false, question_version_no: 1 },
    ])
    // BR-06: a check alone writes no answer row (the answer log is written at submit).
    expect(await countRows(t.db, 'practice_answers')).toBe(0)
  })

  it('revision feedback titles are "Betul! Kali ini berjaya!" and "Masih belum tepat"', async () => {
    const [a, b] = bank.random as [string, string]
    for (const [i, id] of [a, b].entries()) {
      await t.db.query(`insert into revision_queue (user_id, question_id, subject_id, wrong_times, last_wrong_at) values ($1, $2, $3, 1, now())`, [ids.pelajar, id, w.subject.math])
      expect(i).toBeGreaterThanOrEqual(0)
    }
    const s = await startSession(pelajar, { mode: 'revision', subjectCode: 'MATH' })
    const q = s.questions[0]?.id as string
    const other = s.questions[1]?.id as string
    const right = await checkAnswer(pelajar, s.sessionId, t.bank, q, true)
    const wrong = await checkAnswer(pelajar, s.sessionId, t.bank, other, false)
    expect(right.body.data.feedback).toBe('Betul! Kali ini berjaya!')
    expect(wrong.body.data.feedback).toBe('Masih belum tepat')
  })

  it('one check per question: a repeat returns the stored result, adds no row and no trial use', async () => {
    const s = await start()
    const q = s.questions[0]?.id as string
    const key = t.bank.correctIndex(q)
    const first = await check(pelajar, s.sessionId, { questionId: q, selectedOptionId: key })
    expect(first.body.data.isCorrect).toBe(true)
    const used = await trialUsed(t.db, ids.pelajar)
    // A different selection changes nothing: the stored selection stays the answer.
    const again = await check(pelajar, s.sessionId, { questionId: q, selectedOptionId: (key + 1) % 4 })
    expect(again.status).toBe(200)
    expect(again.body.data).toEqual(first.body.data)
    expect(await countRows(t.db, 'practice_checks', 'session_id = $1', [s.sessionId])).toBe(1)
    expect(await trialUsed(t.db, ids.pelajar)).toBe(used)
    const stored = await t.db.query<{ selected_label: string }>('select selected_label from practice_checks where session_id = $1', [s.sessionId])
    expect(stored[0]?.selected_label).toBe('ABCD'[key])
  })

  it('parallel duplicate checks give one check row and one trial use', async () => {
    const s = await start()
    const q = s.questions[0]?.id as string
    const key = t.bank.correctIndex(q)
    const before = await trialUsed(t.db, ids.pelajar)
    const results = await Promise.all(Array.from({ length: 6 }, () => check(pelajar, s.sessionId, { questionId: q, selectedOptionId: key })))
    expect(results.map((r) => r.status)).toEqual([200, 200, 200, 200, 200, 200])
    expect(await countRows(t.db, 'practice_checks', 'session_id = $1', [s.sessionId])).toBe(1)
    expect(await trialUsed(t.db, ids.pelajar)).toBe(before + 1)
  })
})

describe('AC3 invalid answers: "Jawapan tidak sah."', () => {
  it('a question outside the session is 422 fields.questionId; nothing is stored', async () => {
    const s = await start()
    const served = new Set(s.questions.map((q) => q.id))
    const outside = [...bank.random, ...bank.chapters.c1, ...bank.chapters.c2, ...bank.chapters.c3].find((id) => !served.has(id)) as string
    const res = await check(pelajar, s.sessionId, { questionId: outside, selectedOptionId: 0 })
    expect(res.status).toBe(422)
    expect(res.body.error).toMatchObject({ code: 'VALIDATION_ERROR', message: 'Jawapan tidak sah.', fields: { questionId: 'Jawapan tidak sah.' } })
    expect(await trialUsed(t.db, ids.pelajar)).toBe(0)
    expect(await countRows(t.db, 'practice_checks')).toBe(0)
  })

  it('an option out of range is 422 fields.selectedOptionId; a missing or malformed field is 422 "Jawapan tidak sah."', async () => {
    const s = await start()
    const q = s.questions[0]?.id
    for (const selectedOptionId of [4, 7, 99]) {
      const res = await check(pelajar, s.sessionId, { questionId: q, selectedOptionId })
      expect(res.status).toBe(422)
      expect(res.body.error).toMatchObject({ message: 'Jawapan tidak sah.', fields: { selectedOptionId: 'Jawapan tidak sah.' } })
    }
    for (const body of [{ questionId: q, selectedOptionId: -1 }, { questionId: q }, { selectedOptionId: 0 }, { questionId: 'abc', selectedOptionId: 0 }, {}, { questionId: q, selectedOptionId: '1' }]) {
      const res = await check(pelajar, s.sessionId, body)
      expect(res.status, JSON.stringify(body)).toBe(422)
      expect(res.body.error).toMatchObject({ code: 'VALIDATION_ERROR', message: 'Jawapan tidak sah.' })
    }
    // Refused checks store nothing and cost no trial use; a valid one then counts.
    expect(await trialUsed(t.db, ids.pelajar)).toBe(0)
    expect((await check(pelajar, s.sessionId, { questionId: q, selectedOptionId: 0 })).status).toBe(200)
    expect(await trialUsed(t.db, ids.pelajar)).toBe(1)
  })

  it('409 ALREADY_SUBMITTED "Sesi ini sudah dihantar." once the session is submitted', async () => {
    const s = await start()
    const q = s.questions[0]?.id as string
    await checkAnswer(pelajar, s.sessionId, t.bank, q, true)
    expect((await pelajar.post(`/api/practice/sessions/${s.sessionId}/submit`, { timeSpent: 5 })).status).toBe(200)
    const res = await checkAnswer(pelajar, s.sessionId, t.bank, s.questions[1]?.id as string, true)
    expect(res.status).toBe(409)
    expect(res.body.error).toMatchObject({ code: 'ALREADY_SUBMITTED', message: 'Sesi ini sudah dihantar.' })
  })
})

describe('AC7 sessions belong to their owner', () => {
  it('an unknown, a non-uuid and another student\'s session are all 404 "Rekod tidak dijumpai." (never 403)', async () => {
    const s = await start(pelajar)
    const q = s.questions[0]?.id as string
    const body = { questionId: q, selectedOptionId: 0 }
    const unknown = await check(pelajar, '00000000-0000-4000-8000-000000000000', body)
    const nonUuid = await check(pelajar, 's_unknown', body)
    const foreign = await check(maju, s.sessionId, body)
    for (const res of [unknown, nonUuid, foreign]) {
      expect(res.status).toBe(404)
      expect(res.body.error).toMatchObject({ code: 'NOT_FOUND', message: 'Rekod tidak dijumpai.' })
    }
    expect(await countRows(t.db, 'practice_checks')).toBe(0)
    expect(await trialUsed(t.db, ids.maju)).toBe(0)
  })
})

describe('AC2 trial (BR-07)', () => {
  it('+1 per first check while not subscribed; a refused or repeated check costs nothing; 402 at 50', async () => {
    expect(await trialUsed(t.db, ids.pelajar)).toBe(0)
    const s = await start(pelajar, 5)
    for (const [i, q] of s.questions.slice(0, 3).entries()) {
      await checkAnswer(pelajar, s.sessionId, t.bank, q.id, true)
      expect(await trialUsed(t.db, ids.pelajar)).toBe(i + 1)
    }
    await checkAnswer(pelajar, s.sessionId, t.bank, s.questions[0]?.id as string, false)
    expect(await trialUsed(t.db, ids.pelajar)).toBe(3)
    // 47 more checks reach the limit of 50; the next start is refused.
    await t.db.query('update users set trial_questions_used = 49 where id = $1', [ids.pelajar])
    await checkAnswer(pelajar, s.sessionId, t.bank, s.questions[3]?.id as string, true)
    expect(await trialUsed(t.db, ids.pelajar)).toBe(50)
    const blocked = await pelajar.post('/api/practice/sessions', { mode: 'random', subjectCode: 'MATH', count: 5 })
    expect(blocked.status).toBe(402)
    expect(blocked.body.error).toMatchObject({ code: 'TRIAL_EXHAUSTED', message: 'Baki percubaan percuma anda telah habis.' })
    // A first check in an already started session is refused too (402, nothing stored); a repeat still answers.
    const over = await checkAnswer(pelajar, s.sessionId, t.bank, s.questions[4]?.id as string, true)
    expect(over.status).toBe(402)
    expect(over.body.error).toMatchObject({ code: 'TRIAL_EXHAUSTED', message: 'Baki percubaan percuma anda telah habis.' })
    expect(await trialUsed(t.db, ids.pelajar)).toBe(50)
    expect((await checkAnswer(pelajar, s.sessionId, t.bank, s.questions[3]?.id as string, true)).status).toBe(200)
    expect((await pelajar.post(`/api/practice/sessions/${s.sessionId}/submit`, { timeSpent: 5 })).status).toBe(200)
  })

  it('a subscribed user (complimentary package) is never counted and never limited', async () => {
    await makeSubscribed(t.db, ids.maju)
    const s = await start(maju)
    for (const q of s.questions) await checkAnswer(maju, s.sessionId, t.bank, q.id, true)
    expect(await trialUsed(t.db, ids.maju)).toBe(0)
    await t.db.query('update users set trial_questions_used = 50 where id = $1', [ids.maju])
    expect((await maju.post('/api/practice/sessions', { mode: 'random', subjectCode: 'MATH', count: 5 })).status).toBe(201)
  })
})

describe('AC11 grading uses the version the session served', () => {
  it('after the question is edited (version n+1) the check, the answer row and the explanation stay on version 1', async () => {
    const s = await start(pelajar, 5)
    const q = s.questions[0]?.id as string
    const keyBefore = t.bank.correctIndex(q)
    const explanationBefore = t.bank.get(q).explanation
    const newVersion = t.bank.edit(q, { correct: (keyBefore + 1) % 4, explanation: 'Penjelasan baharu' })
    expect(newVersion).toBe(2)
    expect(t.bank.correctIndex(q)).toBe((keyBefore + 1) % 4)

    // The old key is still the right answer for this session.
    const res = await check(pelajar, s.sessionId, { questionId: q, selectedOptionId: keyBefore })
    expect(res.body.data).toMatchObject({ isCorrect: true, correctOptionId: keyBefore, explanation: explanationBefore })
    // A second question is checked against its own served version too.
    const q2 = s.questions[1]?.id as string
    const key2 = t.bank.correctIndex(q2)
    t.bank.edit(q2, { correct: (key2 + 2) % 4 })
    const res2 = await check(pelajar, s.sessionId, { questionId: q2, selectedOptionId: (key2 + 2) % 4 })
    expect(res2.body.data.isCorrect).toBe(false)

    const submit = await pelajar.post(`/api/practice/sessions/${s.sessionId}/submit`, { timeSpent: 20 })
    expect(submit.body.data.results).toMatchObject({ score: 1, total: 5 })
    const answers = await t.db.query<{ question_id: string; question_version_no: number; is_correct: boolean }>(
      'select question_id::text, question_version_no, is_correct from practice_answers where session_id = $1 order by id',
      [s.sessionId],
    )
    expect(answers).toEqual([
      { question_id: q, question_version_no: 1, is_correct: true },
      { question_id: q2, question_version_no: 1, is_correct: false },
    ])
  })

  it('a question deactivated after the start can still be checked (eligibility is not re-checked)', async () => {
    const s = await start()
    const q = s.questions[0]?.id as string
    t.bank.deactivate(q)
    const res = await checkAnswer(pelajar, s.sessionId, t.bank, q, true)
    expect(res.status).toBe(200)
    expect(res.body.data.isCorrect).toBe(true)
  })
})
