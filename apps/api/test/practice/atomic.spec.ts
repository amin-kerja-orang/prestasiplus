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
  resetPractice,
  startSession,
  trialUsed,
  userIdByEmail,
} from './helpers'

/**
 * AC1: submit runs in ONE transaction. A failure injected at each step (a Postgres trigger that raises on
 * the write of that step, a reward port that throws, a remedial hook that throws) leaves no answer rows,
 * no queue or mastery change, no session completion and no reward effect; the same submit then succeeds.
 */
let t: PracticeTestApp
let w: World
let pelajar: Client
let userId: string
let bank: ReturnType<typeof fillBank>

beforeAll(async () => {
  t = await bootPracticeApp()
  w = await loadWorld(t.db)
  pelajar = await loginAs(t, 'pelajar@demo.test')
  userId = await userIdByEmail(t.db, 'pelajar@demo.test')
  await t.db.query(`create or replace function pp_test_fail() returns trigger language plpgsql as $$ begin raise exception 'forced failure on %', tg_table_name; end $$`)
}, 120_000)

afterAll(async () => {
  await t.close()
})

beforeEach(async () => {
  t.clock.set(START)
  await disarm()
  await resetPractice(t.db)
  await t.db.query('delete from notifications')
  t.bank.reset()
  bank = fillBank(t.bank, w)
  t.reward.calls.length = 0
  t.reward.failWith = null
  t.reward.marker = true
  t.assignments.items.clear()
  t.assignments.remedialCalls.length = 0
  t.assignments.failRemedial = null
})

async function disarm() {
  for (const [table, name] of [
    ['practice_answers', 'pp_fail_answers'],
    ['practice_sessions', 'pp_fail_session'],
    ['practice_checks', 'pp_fail_checks'],
    ['revision_queue', 'pp_fail_queue'],
    ['mastery', 'pp_fail_mastery'],
  ]) {
    await t.db.query(`drop trigger if exists ${name} on ${table}`)
  }
}

const TRIGGERS = {
  answers: `create trigger pp_fail_answers before insert on practice_answers for each row execute function pp_test_fail()`,
  session: `create trigger pp_fail_session before update on practice_sessions for each row when (new.status = 'completed') execute function pp_test_fail()`,
  checks: `create trigger pp_fail_checks before delete on practice_checks for each row execute function pp_test_fail()`,
  queue: `create trigger pp_fail_queue before insert on revision_queue for each row execute function pp_test_fail()`,
  mastery: `create trigger pp_fail_mastery before insert on mastery for each row execute function pp_test_fail()`,
} as const

/** A started session with 5 checked questions: 2 right, 3 wrong. */
async function checkedSession(body: Record<string, unknown> = { mode: 'random', subjectCode: 'MATH', count: 5 }) {
  const s = await startSession(pelajar, body)
  for (const [i, q] of s.questions.entries()) await checkAnswer(pelajar, s.sessionId, t.bank, q.id, i < 2)
  return s
}

async function expectUntouched(sessionId: string) {
  expect(await countRows(t.db, 'practice_answers')).toBe(0)
  expect(await countRows(t.db, 'practice_checks', 'session_id = $1', [sessionId])).toBe(5)
  expect(await countRows(t.db, 'revision_queue')).toBe(0)
  expect(await countRows(t.db, 'mastery')).toBe(0)
  expect(await countRows(t.db, 'notifications')).toBe(0)
  const row = await t.db.query<{ status: string; correct_count: number; points_earned: number; coins_earned: number; completed_at: Date | null }>(
    'select status, correct_count, points_earned, coins_earned, completed_at from practice_sessions where id = $1',
    [sessionId],
  )
  expect(row[0]).toEqual({ status: 'in_progress', correct_count: 0, points_earned: 0, coins_earned: 0, completed_at: null })
  expect(await trialUsed(t.db, userId)).toBe(5)
}

async function expectCompleted(sessionId: string) {
  const res = await pelajar.post(`/api/practice/sessions/${sessionId}/submit`, { timeSpent: 30 })
  expect(res.status, JSON.stringify(res.body)).toBe(200)
  expect(res.body.data.results).toMatchObject({ score: 2, total: 5 })
  expect(await countRows(t.db, 'practice_answers', 'session_id = $1', [sessionId])).toBe(5)
  expect(await countRows(t.db, 'practice_checks', 'session_id = $1', [sessionId])).toBe(0)
  expect(await countRows(t.db, 'revision_queue')).toBe(3)
  expect((await t.db.query<{ answered: number; correct: number }>('select answered, correct from mastery'))[0]).toEqual({ answered: 5, correct: 2 })
  expect(await countRows(t.db, 'notifications')).toBe(1)
  expect((await t.db.query<{ status: string }>('select status from practice_sessions where id = $1', [sessionId]))[0]?.status).toBe('completed')
}

describe('AC1 submit atomicity: a failure at each step rolls everything back', () => {
  for (const step of ['answers', 'session', 'checks', 'queue', 'mastery'] as const) {
    it(`a failure on the ${step} write leaves nothing behind, and the same submit then succeeds`, async () => {
      const s = await checkedSession()
      await t.db.query(TRIGGERS[step])
      const failed = await pelajar.post(`/api/practice/sessions/${s.sessionId}/submit`, { timeSpent: 30 })
      expect(failed.status).toBe(500)
      expect(failed.body.error.code).toBe('SERVER_ERROR')
      // The error never reveals the cause.
      expect(JSON.stringify(failed.body)).not.toContain('forced failure')
      await expectUntouched(s.sessionId)
      await disarm()
      await expectCompleted(s.sessionId)
    })
  }

  it('a reward port that throws after its own write rolls back the answers, the queue, the counters and its write', async () => {
    const s = await checkedSession()
    t.reward.failWith = new Error('wallet down')
    const failed = await pelajar.post(`/api/practice/sessions/${s.sessionId}/submit`, { timeSpent: 30 })
    expect(failed.status).toBe(500)
    expect(t.reward.calls).toHaveLength(1) // it ran, inside the transaction
    await expectUntouched(s.sessionId)
    t.reward.failWith = null
    await expectCompleted(s.sessionId)
    expect(t.reward.calls).toHaveLength(2)
  })

  it('a remedial hook that throws after the reward step rolls back the reward write too', async () => {
    t.assignments.set('remedial', '7699', { status: 'ok', subjectId: w.subject.math, questionIds: bank.random.slice(0, 5) })
    const s = await checkedSession({ mode: 'remedial', remedialTestId: '7699' })
    t.assignments.failRemedial = new Error('classroom down')
    const failed = await pelajar.post(`/api/practice/sessions/${s.sessionId}/submit`, { timeSpent: 30 })
    expect(failed.status).toBe(500)
    expect(t.assignments.remedialCalls).toHaveLength(1)
    await expectUntouched(s.sessionId)
    t.assignments.failRemedial = null
    await expectCompleted(s.sessionId)
  })

  it('a failed submit is not a second submit: the session is still open and a retry is not 409', async () => {
    const s = await checkedSession()
    t.reward.failWith = new Error('wallet down')
    expect((await pelajar.post(`/api/practice/sessions/${s.sessionId}/submit`, { timeSpent: 1 })).status).toBe(500)
    t.reward.failWith = null
    expect((await pelajar.post(`/api/practice/sessions/${s.sessionId}/submit`, { timeSpent: 1 })).status).toBe(200)
    expect((await pelajar.post(`/api/practice/sessions/${s.sessionId}/submit`, { timeSpent: 1 })).status).toBe(409)
  })
})
