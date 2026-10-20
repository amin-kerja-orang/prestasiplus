import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  type Client,
  type PracticeTestApp,
  type World,
  bootPracticeApp,
  countRows,
  loadWorld,
  loginAs,
  userIdByEmail,
} from './helpers'

/**
 * The module with NO adapter plugged in (BE-09, BE-18, BE-41, BE-11 not merged): the documented defaults.
 * The empty bank gives NOT_ENOUGH_QUESTIONS, the assigned-work and ramalan sources give SET_NOT_READY, and
 * the reward port credits nothing.
 */
let t: PracticeTestApp
let w: World
let pelajar: Client
let userId: string

beforeAll(async () => {
  t = await bootPracticeApp({ defaults: { questions: true, assignments: true, ramalan: true, reward: true } })
  w = await loadWorld(t.db)
  pelajar = await loginAs(t, 'pelajar@demo.test')
  userId = await userIdByEmail(t.db, 'pelajar@demo.test')
}, 120_000)

afterAll(async () => {
  await t.close()
})

const post = (body: unknown) => pelajar.post('/api/practice/sessions', body)

describe('AC3 default ports', () => {
  it('the empty bank: random, chapter, past_year and latih_tubi are 422 NOT_ENOUGH_QUESTIONS "Soalan tidak mencukupi."', async () => {
    for (const body of [
      { mode: 'random', subjectCode: 'MATH', count: 5 },
      { mode: 'chapter', chapterId: w.chapter.c1, count: 5 },
      { mode: 'past_year', subjectCode: 'SEJ', count: 5 },
      { mode: 'latih_tubi', subjectCode: 'PERNIAGA', count: 5 },
    ]) {
      const res = await post(body)
      expect(res.status, JSON.stringify(body)).toBe(422)
      expect(res.body.error).toMatchObject({ code: 'NOT_ENOUGH_QUESTIONS', message: 'Soalan tidak mencukupi.' })
    }
    expect(await countRows(t.db, 'practice_sessions')).toBe(0)
  })

  it('revision with an empty queue is 422 NO_WRONG_QUESTIONS; with a queue but an empty bank it is the same (nothing is eligible)', async () => {
    const res = await post({ mode: 'revision', subjectCode: 'MATH' })
    expect(res.body.error).toMatchObject({ code: 'NO_WRONG_QUESTIONS', message: 'Maaf, terdapat masalah memuatkan kuiz ulang kaji.' })
    await t.db.query(`insert into revision_queue (user_id, question_id, subject_id, wrong_times, last_wrong_at) values ($1, 1, $2, 1, now())`, [userId, w.subject.math])
    expect((await post({ mode: 'revision', subjectCode: 'MATH' })).body.error.code).toBe('NO_WRONG_QUESTIONS')
    await t.db.query('delete from revision_queue')
  })

  it('mission, remedial, question_set and ramalan are 422 SET_NOT_READY "Soalan tidak mencukupi."', async () => {
    for (const body of [
      { mode: 'mission', missionId: '1' },
      { mode: 'remedial', remedialTestId: '1' },
      { mode: 'question_set', questionSetId: '1' },
      { mode: 'ramalan', subjectCode: 'MATH', year: 2026, setNo: 1 },
    ]) {
      const res = await post(body)
      expect(res.status, JSON.stringify(body)).toBe(422)
      expect(res.body.error).toMatchObject({ code: 'SET_NOT_READY', message: 'Soalan tidak mencukupi.' })
    }
  })

  it('"Buka Soalan Sama" on an empty bank is 422 fields.targetQuestionId', async () => {
    const res = await post({ mode: 'latih_tubi', subjectCode: 'SEJ', count: 1, targetQuestionId: '5' })
    expect(res.body.error.fields).toEqual({ targetQuestionId: 'Nilai tidak sah.' })
  })

  it('a session that exists can be submitted; the default reward port credits nothing and the figures are zero', async () => {
    const rows = await t.db.query<{ id: string }>(
      `insert into practice_sessions (user_id, mode, subject_id, question_count, started_at) values ($1, 'random', $2, 5, now()) returning id::text`,
      [userId, w.subject.math],
    )
    const id = rows[0]?.id as string
    const res = await pelajar.post(`/api/practice/sessions/${id}/submit`, { timeSpent: 12 })
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.body.data.results).toEqual({ score: 0, total: 5, gamification: { coinsEarned: 0, streakCount: 0, pointsEarned: 0, totalBalance: 0 } })
    // A check on a served version the empty source does not know is "Jawapan tidak sah.".
    const other = await t.db.query<{ id: string }>(
      `insert into practice_sessions (user_id, mode, question_count, started_at) values ($1, 'random', 1, now()) returning id::text`,
      [userId],
    )
    await t.db.query('insert into practice_session_questions (session_id, position, question_id, question_version_no) values ($1, 0, 77, 1)', [other[0]?.id])
    const check = await pelajar.post(`/api/practice/sessions/${other[0]?.id}/check-answer`, { questionId: '77', selectedOptionId: 0 })
    expect(check.status).toBe(422)
    expect(check.body.error).toMatchObject({ code: 'VALIDATION_ERROR', message: 'Jawapan tidak sah.' })
  })
})
