import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { PracticeRepository } from '../../src/modules/practice'
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
  play,
  resetPractice,
  startSession,
  userIdByEmail,
} from './helpers'

/**
 * AC9 mock parity: the assertions of the write-path block of
 * `src/modules/m05-practice/__tests__/mock/practice-store.test.ts` ("write path (BR-31)"), replayed against
 * the API with a fake bank and the fake reward port. Differences from the mock are listed in the report:
 * a foreign session is 404 (the mock said 403), the draw is seeded per start, ids are strings, option ids are
 * unchanged, `coinsEarned` of the response comes from the reward port (the mock fell back to BR-09 without M14).
 */
let t: PracticeTestApp
let w: World
let pelajar: Client
let ids: { pelajar: string }
let bank: ReturnType<typeof fillBank>

beforeAll(async () => {
  t = await bootPracticeApp()
  w = await loadWorld(t.db)
  pelajar = await loginAs(t, 'pelajar@demo.test')
  ids = { pelajar: await userIdByEmail(t.db, 'pelajar@demo.test') }
}, 120_000)

afterAll(async () => {
  await t.close()
})

beforeEach(async () => {
  t.clock.set(START)
  await resetPractice(t.db)
  t.bank.reset()
  t.reward.calls.length = 0
  t.reward.marker = false
  t.ramalan.sets.clear()
  bank = fillBank(t.bank, w)
})

const MODES: readonly [string, () => Record<string, unknown>][] = [
  ['random', () => ({ mode: 'random', subjectCode: 'MATH', levelId: w.level.d1, count: 5 })],
  ['chapter', () => ({ mode: 'chapter', chapterId: w.chapter.c1, count: 5 })],
  ['revision', () => ({ mode: 'revision', subjectCode: 'MATH', count: 20 })],
  ['past_year', () => ({ mode: 'past_year', subjectCode: 'SEJ', count: 5 })],
  ['latih_tubi', () => ({ mode: 'latih_tubi', subjectCode: 'SEJ', count: 40 })],
  ['ramalan', () => ({ mode: 'ramalan', subjectCode: 'MATH', year: 2026, setNo: 1 })],
]

describe('AC9 write path: one completion updates the log, the queue and the counters, and calls the reward port once', () => {
  for (const [mode, body] of MODES) {
    it(`${mode}: parity with the mock assertions`, async () => {
      const repo = t.app.get(PracticeRepository)
      if (mode === 'revision') {
        for (const [i, id] of bank.random.slice(0, 4).entries()) {
          await t.db.query(`insert into revision_queue (user_id, question_id, subject_id, wrong_times, last_wrong_at) values ($1, $2, $3, 2, now() + ($4 || ' seconds')::interval)`, [ids.pelajar, id, w.subject.math, String(i)])
        }
      }
      if (mode === 'ramalan') t.ramalan.set(w.subject.math, 2026, 1, bank.random.slice(0, 4))
      const queueBefore = await repo.queue(ids.pelajar)
      const masteryBefore = await repo.mastery(ids.pelajar)
      const logBefore = await countRows(t.db, 'practice_answers')
      const sessionsBefore = await countRows(t.db, 'practice_sessions')

      const { started, submit } = await play(pelajar, t.bank, body(), 2, 120)
      expect(submit.status, JSON.stringify(submit.body)).toBe(200)
      const n = started.questions.length
      const result = submit.body.data.results as { score: number; total: number; gamification: { coinsEarned: number; pointsEarned: number } }
      expect([result.score, result.total]).toEqual([2, n])
      expect(result.gamification.pointsEarned).toBe(20)
      // BR-06: the log grows by the checked answers; the sessions by one.
      expect(await countRows(t.db, 'practice_answers')).toBe(logBefore + n)
      expect(await countRows(t.db, 'practice_sessions')).toBe(sessionsBefore + 1)
      const s = (
        await t.db.query<{ status: string; correct_count: number; question_count: number; points_earned: number; mode: string; coins_earned: number }>(
          'select status, correct_count, question_count, points_earned, mode, coins_earned from practice_sessions where id = $1',
          [started.sessionId],
        )
      )[0]
      expect(s).toMatchObject({ status: 'completed', correct_count: 2, question_count: n, points_earned: 20, mode })
      // BR-09: the session keeps coins = correct; the wallet credit is in the response only.
      expect(s?.coins_earned).toBe(2)
      expect(typeof result.gamification.coinsEarned).toBe('number')
      const answers = await repo.answers(ids.pelajar, { sessionId: started.sessionId })
      expect(answers).toHaveLength(n)
      // The reward port is called once with the session totals.
      expect(t.reward.calls).toHaveLength(1)
      expect(t.reward.calls[0]).toMatchObject({ userId: ids.pelajar, sessionId: started.sessionId, mode, correct: 2, total: n, pointsEarned: 20 })
      expect(t.reward.calls[0]).not.toHaveProperty('coinsPerCorrect')
      // BR-14: wrong answers queued (wrongTimes + 1), correct ones removed.
      const queue = new Map((await repo.queue(ids.pelajar)).map((q) => [q.questionId, q]))
      const before = new Map(queueBefore.map((q) => [q.questionId, q]))
      for (const a of answers) {
        if (a.questionId === null) continue
        if (a.isCorrect) expect(queue.has(a.questionId)).toBe(false)
        else expect(queue.get(a.questionId)?.wrongTimes).toBe((before.get(a.questionId)?.wrongTimes ?? 0) + 1)
      }
      // BR-20: counters += the session's answers per subject.
      const after = new Map((await repo.mastery(ids.pelajar)).map((m) => [m.subjectId, m]))
      const prev = new Map(masteryBefore.map((m) => [m.subjectId, m]))
      for (const sid of new Set(answers.map((a) => a.subjectId))) {
        if (sid === null) continue
        const add = answers.filter((a) => a.subjectId === sid)
        expect(after.get(sid)?.answered).toBe((prev.get(sid)?.answered ?? 0) + add.length)
        expect(after.get(sid)?.correct).toBe((prev.get(sid)?.correct ?? 0) + add.filter((a) => a.isCorrect).length)
      }
      // History lists it first.
      const list = await pelajar.get(`/api/practice/sessions?modes=${mode}`)
      expect(list.body.data[0]?.id).toBe(started.sessionId)
    })
  }
})

describe('AC9 the other assertions of the mock write-path block', () => {
  it('an abandoned session writes nothing (BR-06); a second submit answers 409; a foreign session and an unknown one are 404', async () => {
    const repo = t.app.get(PracticeRepository)
    const s = await startSession(pelajar, { mode: 'random', subjectCode: 'MATH', count: 5 })
    await checkAnswer(pelajar, s.sessionId, t.bank, s.questions[0]?.id as string, false)
    expect(await countRows(t.db, 'practice_answers')).toBe(0)
    expect(await repo.history(ids.pelajar, { modes: ['random'], includeTest: true })).toEqual([])
    expect(await repo.queue(ids.pelajar)).toEqual([])
    expect(await repo.mastery(ids.pelajar)).toEqual([])
    const first = await pelajar.post(`/api/practice/sessions/${s.sessionId}/submit`, { timeSpent: 10 })
    expect(first.status).toBe(200)
    // Only the checked question is recorded (BR-30).
    expect(await countRows(t.db, 'practice_answers')).toBe(1)
    expect((await pelajar.post(`/api/practice/sessions/${s.sessionId}/submit`, { timeSpent: 10 })).status).toBe(409)
    const other = await loginAs(t, 'pelajarmaju@demo.test')
    expect((await other.post(`/api/practice/sessions/${s.sessionId}/submit`, {})).status).toBe(404)
    expect((await pelajar.post('/api/practice/sessions/s_unknown/submit', {})).status).toBe(404)
  })

  it('a throwing reward call rolls the whole completion back (mock: "a throwing M14 call rolls the whole completion back")', async () => {
    const s = await startSession(pelajar, { mode: 'random', subjectCode: 'MATH', count: 5 })
    for (const q of s.questions) await checkAnswer(pelajar, s.sessionId, t.bank, q.id, false)
    t.reward.failWith = new Error('boom')
    const failed = await pelajar.post(`/api/practice/sessions/${s.sessionId}/submit`, { timeSpent: 30 })
    expect(failed.status).toBe(500)
    t.reward.failWith = null
    expect(await countRows(t.db, 'practice_answers')).toBe(0)
    expect(await countRows(t.db, 'revision_queue')).toBe(0)
    expect(await countRows(t.db, 'mastery')).toBe(0)
    expect(await countRows(t.db, 'practice_sessions', "status = 'completed'")).toBe(0)
  })

  it('mission: coinsPerCorrect 3 is passed; 3 x 4 correct is stored on the session; the response coins come from the reward port', async () => {
    t.assignments.set('mission', '9001', { status: 'ok', subjectId: w.subject.math, questionIds: bank.random.slice(0, 4), coinsPerCorrect: 3 })
    t.reward.result = { coinsEarned: 99, streakCount: 1, totalBalance: 99 }
    const open1 = await startSession(pelajar, { mode: 'mission', missionId: '9001' })
    const open2 = await startSession(pelajar, { mode: 'mission', missionId: '9001' })
    expect(open2.sessionId).toBe(open1.sessionId)
    for (const q of open1.questions) await checkAnswer(pelajar, open1.sessionId, t.bank, q.id, true)
    const done = await pelajar.post(`/api/practice/sessions/${open1.sessionId}/submit`, { timeSpent: 60 })
    expect(done.status).toBe(200)
    expect(t.reward.calls[0]).toMatchObject({ mode: 'mission', correct: 4, coinsPerCorrect: 3 })
    expect(done.body.data.results.gamification.coinsEarned).toBe(99)
    const coins = await t.db.query<{ coins_earned: number }>('select coins_earned from practice_sessions where id = $1', [open1.sessionId])
    expect(coins[0]?.coins_earned).toBe(12)
    const again = await pelajar.post('/api/practice/sessions', { mode: 'mission', missionId: '9001' })
    expect(again.status).toBe(409)
    expect(again.body.error.code).toBe('ALREADY_COMPLETED')
    t.reward.result = { coinsEarned: 7, streakCount: 3, totalBalance: 120 }
  })

  it('BR-30: the stored timeSpent is capped at 180 s per question and floored at 0', async () => {
    const a = await startSession(pelajar, { mode: 'random', subjectCode: 'MATH', count: 5 })
    await checkAnswer(pelajar, a.sessionId, t.bank, a.questions[0]?.id as string, true)
    await pelajar.post(`/api/practice/sessions/${a.sessionId}/submit`, { timeSpent: 99_999 })
    const b = await startSession(pelajar, { mode: 'random', subjectCode: 'MATH', count: 5 })
    await pelajar.post(`/api/practice/sessions/${b.sessionId}/submit`, { timeSpent: -5 })
    const rows = await t.db.query<{ id: string; time_spent_sec: number }>('select id::text, time_spent_sec from practice_sessions where id = any($1::uuid[])', [[a.sessionId, b.sessionId]])
    expect(Object.fromEntries(rows.map((r) => [r.id, r.time_spent_sec]))).toEqual({ [a.sessionId]: 5 * 180, [b.sessionId]: 0 })
  })

  it('revision serves the queued questions ("Salah 2x") with revisionMeta and four options each', async () => {
    for (const [i, id] of bank.random.slice(0, 4).entries()) {
      await t.db.query(`insert into revision_queue (user_id, question_id, subject_id, wrong_times, last_wrong_at) values ($1, $2, $3, 2, now() + ($4 || ' seconds')::interval)`, [ids.pelajar, id, w.subject.math, String(i)])
    }
    const rev = await startSession(pelajar, { mode: 'revision', subjectCode: 'MATH', count: 20 })
    expect(rev.body.revisionMeta).toEqual({ selected: 4, totalWrong: 4 })
    expect(rev.questions.map((q) => q.wrongTimes)).toEqual([2, 2, 2, 2])
    expect(rev.questions[0]?.options).toHaveLength(4)
  })
})
