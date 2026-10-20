import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { PracticeRepository } from '../../src/modules/practice'
import {
  type PracticeTestApp,
  type World,
  START,
  bootPracticeApp,
  checkAnswer,
  countRows,
  expectCsrfInvalid,
  expectError,
  fillBank,
  loadWorld,
  loginAs,
  loginModPelajar,
  play,
  resetPractice,
  startSession,
  userIdByEmail,
} from './helpers'

let t: PracticeTestApp
let w: World
let bank: ReturnType<typeof fillBank>

beforeAll(async () => {
  t = await bootPracticeApp()
  w = await loadWorld(t.db)
}, 120_000)

afterAll(async () => {
  await t.close()
})

beforeEach(async () => {
  t.clock.set(START)
  await resetPractice(t.db)
  t.reward.calls.length = 0
  t.reward.marker = false
  t.bank.reset()
  bank = fillBank(t.bank, w)
})

const SESSION = '11111111-1111-4111-8111-111111111111'
const START_BODY = { mode: 'random', subjectCode: 'MATH', count: 5 }

describe('AC10 authentication, CSRF and roles', () => {
  it('without a session every route is 401 UNAUTHORIZED', async () => {
    const http = t.http()
    for (const res of [
      await http.post('/api/practice/sessions').send(START_BODY),
      await http.post(`/api/practice/sessions/${SESSION}/check-answer`).send({ questionId: '1', selectedOptionId: 0 }),
      await http.post(`/api/practice/sessions/${SESSION}/submit`).send({ timeSpent: 1 }),
      await http.get('/api/practice/sessions?modes=random'),
    ]) {
      expectError(res, 'UNAUTHORIZED')
    }
  })

  it('a write without the CSRF token is 403 CSRF_INVALID and changes nothing', async () => {
    const c = await loginAs(t, 'pelajar@demo.test')
    expectCsrfInvalid(await c.noCsrf.post('/api/practice/sessions', START_BODY))
    const s = await startSession(c, START_BODY)
    expectCsrfInvalid(await c.noCsrf.post(`/api/practice/sessions/${s.sessionId}/check-answer`, { questionId: s.questions[0]?.id, selectedOptionId: 0 }))
    expectCsrfInvalid(await c.noCsrf.post(`/api/practice/sessions/${s.sessionId}/submit`, { timeSpent: 5 }))
    expect(await countRows(t.db, 'practice_sessions')).toBe(1)
    expect(await countRows(t.db, 'practice_checks')).toBe(0)
    expect(await countRows(t.db, 'practice_sessions', "status = 'completed'")).toBe(0)
    // Reading needs no token.
    expect((await c.get('/api/practice/sessions?modes=random')).status).toBe(200)
  })

  it.each(['pelajar@demo.test', 'guru@demo.test', 'adminsekolah@demo.test', 'admin@demo.test', 'guruadmin@demo.test'])(
    '%s (any role with a session) can start, check, submit and read the history',
    async (email) => {
      const c = await loginAs(t, email)
      const { started, submit } = await play(c, t.bank, START_BODY, 3)
      expect(submit.status, JSON.stringify(submit.body)).toBe(200)
      const list = await c.get('/api/practice/sessions?modes=random')
      expect(list.body.data.map((r: { id: string }) => r.id)).toEqual([started.sessionId])
    },
  )

  it('the response of every route is Cache-Control: no-store', async () => {
    const c = await loginAs(t, 'pelajar@demo.test')
    const started = await c.post('/api/practice/sessions', START_BODY)
    const sessionId = started.body.data.sessionId as string
    const q = started.body.data.questions[0].id as string
    const checks = [
      started,
      await checkAnswer(c, sessionId, t.bank, q, true),
      await c.post(`/api/practice/sessions/${sessionId}/check-answer`, { questionId: q }), // a 422
      await c.post(`/api/practice/sessions/${sessionId}/submit`, { timeSpent: 1 }),
      await c.post(`/api/practice/sessions/${sessionId}/submit`, { timeSpent: 1 }), // a 409
      await c.get('/api/practice/sessions?modes=random'),
    ]
    for (const res of checks) expect(res.headers['cache-control']).toContain('no-store')
  })
})

describe('AC8 Mod Pelajar stamps every row it writes with is_test', () => {
  it('an admin in Mod Pelajar: session, served list, checks and answers are is_test, and the reward port is told', async () => {
    const admin = await loginModPelajar(t, 'admin@demo.test')
    const { started, submit } = await play(admin, t.bank, START_BODY, 2)
    expect(submit.status, JSON.stringify(submit.body)).toBe(200)
    expect(await countRows(t.db, 'practice_sessions', 'is_test')).toBe(1)
    expect(await countRows(t.db, 'practice_session_questions', 'is_test')).toBe(5)
    expect(await countRows(t.db, 'practice_answers', 'is_test and session_id = $1', [started.sessionId])).toBe(5)
    expect(await countRows(t.db, 'practice_answers', 'not is_test')).toBe(0)
    expect(t.reward.calls[0]?.isTest).toBe(true)
    // Their own list includes the test session; other modules' reads do not.
    const own = await admin.get('/api/practice/sessions?modes=random')
    expect(own.body.data).toHaveLength(1)
    const repo = t.app.get(PracticeRepository)
    const adminId = await userIdByEmail(t.db, 'admin@demo.test')
    expect(await repo.history(adminId, { modes: ['random'] })).toEqual([])
    expect(await repo.answers(adminId)).toEqual([])
    expect(await repo.answers(adminId, { includeTest: true })).toHaveLength(5)
  })

  it('checks stamped is_test while the session is open', async () => {
    const admin = await loginModPelajar(t, 'admin@demo.test')
    const s = await startSession(admin, START_BODY)
    await checkAnswer(admin, s.sessionId, t.bank, s.questions[0]?.id as string, true)
    expect(await countRows(t.db, 'practice_checks', 'is_test')).toBe(1)
  })

  it('the same admin outside Mod Pelajar writes real rows', async () => {
    const admin = await loginAs(t, 'admin@demo.test')
    await play(admin, t.bank, START_BODY, 2)
    expect(await countRows(t.db, 'practice_sessions', 'is_test')).toBe(0)
    expect(await countRows(t.db, 'practice_answers', 'is_test')).toBe(0)
    expect(t.reward.calls[0]?.isTest).toBe(false)
  })

  it('BR-16 reads the caller\'s own mode: test answers do not unlock chapters for real play', async () => {
    const admin = await loginModPelajar(t, 'admin@demo.test')
    await play(admin, t.bank, { mode: 'chapter', chapterId: w.chapter.c1, count: 20 }, 6)
    expect((await admin.post('/api/practice/sessions', { mode: 'chapter', chapterId: w.chapter.c2, count: 5 })).status).toBe(201)
    const real = await loginAs(t, 'admin@demo.test')
    expect((await real.post('/api/practice/sessions', { mode: 'chapter', chapterId: w.chapter.c2, count: 5 })).status).toBe(409)
    expect(bank.chapters.c1).toHaveLength(6)
  })
})
