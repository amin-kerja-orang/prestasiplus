import {
  KirkpatrickFeedbackConflictSchema,
  KirkpatrickFeedbackResponseSchema,
  KirkpatrickFeedbackStatusSchema,
  KirkpatrickReactionSchema,
  envelopeOf,
} from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  ADMIN,
  SCHOOL_ADMIN_A,
  STUDENT_1,
  STUDENT_B,
  TEACHER_A,
  type Client,
  type KirkpatrickTestApp,
  type World,
  bootKirkpatrickApp,
  buildWorld,
  client,
  errorIs,
  fieldsOf,
} from './helpers'

describe('GET /api/feedback/status and POST /api/feedback (AC 6, 7)', () => {
  let t: KirkpatrickTestApp
  let w: World
  let student: Client
  let studentB: Client
  let teacher: Client
  let schoolAdmin: Client
  let admin: Client

  beforeAll(async () => {
    t = await bootKirkpatrickApp()
    w = await buildWorld(t)
    student = await client(t, STUDENT_1)
    studentB = await client(t, STUDENT_B)
    teacher = await client(t, TEACHER_A)
    schoolAdmin = await client(t, SCHOOL_ADMIN_A)
    admin = await client(t, ADMIN)
  }, 180_000)
  afterAll(async () => {
    await t.close()
  })

  const feedbackRows = () =>
    t.db.query<{ role: string; school_id: string | null; month: string; nps: number | null; satisfaction: number; is_test: boolean }>(
      `select role, school_id::text, to_char(month, 'YYYY-MM-DD') as month, nps, satisfaction, is_test from feedback order by id`,
    )

  it('status is false in the Malaysia month before the first response', async () => {
    const res = await student.get('/feedback/status')
    expect(res.status).toBe(200)
    expect(res.headers['cache-control']).toContain('no-store')
    expect(envelopeOf(KirkpatrickFeedbackStatusSchema).parse(res.body).data).toEqual({ month: '2026-10', answered: false })
  })

  it('stores the response with the session role and school, never the body ones', async () => {
    const res = await student.post('/feedback', { nps: 9, satisfaction: 5, role: 'admin', schoolId: w.schoolB, userId: '1', month: '2020-01' })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    expect(res.headers['cache-control']).toContain('no-store')
    const data = envelopeOf(KirkpatrickFeedbackResponseSchema).parse(res.body).data
    expect(data).toMatchObject({ userId: w.ids.p1, role: 'student', schoolId: w.schoolA, month: '2026-10', nps: 9, satisfaction: 5 })
    expect(data.createdAt).toMatch(/\+08:00$/)
    expect(await feedbackRows()).toEqual([{ role: 'student', school_id: w.schoolA, month: '2026-10-01', nps: 9, satisfaction: 5, is_test: false }])
    expect(envelopeOf(KirkpatrickFeedbackStatusSchema).parse((await student.get('/feedback/status')).body).data.answered).toBe(true)
  })

  it('a second response in the same month is 409 CONFLICT', async () => {
    const res = await student.post('/feedback', { nps: 3, satisfaction: 2 })
    expect(res.status).toBe(409)
    expect(KirkpatrickFeedbackConflictSchema.parse(res.body).error).toMatchObject({ code: 'CONFLICT', message: 'Anda sudah mengisi maklum balas untuk bulan ini.' })
    expect((await feedbackRows()).length).toBe(1)
  })

  it('every signed-in role may answer; the role is a snapshot of the active role', async () => {
    const t1 = await teacher.post('/feedback', { nps: 7, satisfaction: 4 })
    const s1 = await schoolAdmin.post('/feedback', { nps: 6, satisfaction: 3 })
    const a1 = await admin.post('/feedback', { nps: 10, satisfaction: 3 })
    const b1 = await studentB.post('/feedback', { nps: 1, satisfaction: 1 })
    for (const r of [t1, s1, a1, b1]) expect(r.status, JSON.stringify(r.body)).toBe(201)
    expect(t1.body.data).toMatchObject({ role: 'teacher', schoolId: w.schoolA })
    expect(s1.body.data).toMatchObject({ role: 'school_admin', schoolId: w.schoolA })
    expect(a1.body.data).toMatchObject({ role: 'admin', schoolId: null })
    expect(b1.body.data).toMatchObject({ role: 'student', schoolId: w.schoolB })
  })

  it('reaction means: admin over everyone, teacher over the own school, migrated rows without NPS leave the NPS mean alone', async () => {
    // Rows: pupil A 9/5, pupil B 1/1, teacher 7/4, school admin 6/3, admin 10/3.
    // Admin: students (9 + 1) / 2 = 5, teacher 7, admin 10; satisfaction (5 + 1 + 4 + 3 + 3) / 5 = 3.2.
    const all = envelopeOf(KirkpatrickReactionSchema).parse((await admin.get('/kirkpatrick/reaction')).body).data
    expect(all).toEqual({ npsStudent: 5, npsTeacher: 7, npsAdmin: 10, satisfaction: 3.2 })
    // School A (pupil B and the admin have no part in it): student 9, teacher 7, no admin; satisfaction (5 + 4 + 3) / 3 = 4.
    const own = envelopeOf(KirkpatrickReactionSchema).parse((await teacher.get('/kirkpatrick/reaction')).body).data
    expect(own).toEqual({ npsStudent: 9, npsTeacher: 7, npsAdmin: 0, satisfaction: 4 })

    // A migrated .cloud row has no NPS: it counts in the satisfaction mean only.
    await t.db.query(
      `insert into feedback (user_id, role, school_id, month, nps, satisfaction, legacy_source, legacy_id)
       values ($1, 'student', $2, '2026-08-01', null, 5, 'cloud', 'fb-1')`,
      [w.ids.p2, w.schoolA],
    )
    const withLegacy = envelopeOf(KirkpatrickReactionSchema).parse((await teacher.get('/kirkpatrick/reaction')).body).data
    // Satisfaction (5 + 4 + 3 + 5) / 4 = 4.25, half-up 4.3.
    expect(withLegacy).toEqual({ npsStudent: 9, npsTeacher: 7, npsAdmin: 0, satisfaction: 4.3 })

    // A test row (Mod Pelajar) never counts.
    await t.db.query(`insert into feedback (user_id, role, school_id, month, nps, satisfaction, is_test) values ($1, 'student', $2, '2026-07-01', 0, 1, true)`, [w.ids.p2, w.schoolA])
    expect(envelopeOf(KirkpatrickReactionSchema).parse((await teacher.get('/kirkpatrick/reaction')).body).data).toEqual(withLegacy)
  })

  describe('validation (422)', () => {
    const fresh = () => client(t, 'guruadmin@demo.test')

    it('nps must be an integer 0 to 10 and satisfaction 1 to 5', async () => {
      const who = await fresh()
      const bad: [object, Record<string, string>][] = [
        [{ nps: 11, satisfaction: 3 }, { nps: 'Medan ini tidak sah.' }],
        [{ nps: -1, satisfaction: 3 }, { nps: 'Medan ini tidak sah.' }],
        [{ nps: 1.5, satisfaction: 3 }, { nps: 'Medan ini tidak sah.' }],
        [{ nps: 'abc', satisfaction: 3 }, { nps: 'Medan ini tidak sah.' }],
        [{ nps: true, satisfaction: 3 }, { nps: 'Medan ini tidak sah.' }],
        [{ nps: 5, satisfaction: 0 }, { satisfaction: 'Medan ini tidak sah.' }],
        [{ nps: 5, satisfaction: 6 }, { satisfaction: 'Medan ini tidak sah.' }],
        [{ nps: 5, satisfaction: 2.5 }, { satisfaction: 'Medan ini tidak sah.' }],
      ]
      for (const [body, fields] of bad) expect(fieldsOf(await who.post('/feedback', body)), JSON.stringify(body)).toEqual(fields)
    })

    it('blank means required, with the Laravel-style summary message', async () => {
      const who = await fresh()
      for (const blank of [undefined, null, '']) {
        expect(fieldsOf(await who.post('/feedback', { nps: blank, satisfaction: 3 }))).toEqual({ nps: 'Medan ini diperlukan.' })
      }
      const res = await who.post('/feedback', {})
      expect(fieldsOf(res)).toEqual({ nps: 'Medan ini diperlukan.', satisfaction: 'Medan ini diperlukan.' })
      expect(res.body.error.message).toBe('Medan ini diperlukan. (and 1 more error)')
    })

    it('numeric text is accepted; nothing was stored by the refusals', async () => {
      const who = await fresh()
      expect((await feedbackRows()).some((r) => r.nps === 5 && r.satisfaction === 2)).toBe(false)
      const res = await who.post('/feedback', { nps: ' 5 ', satisfaction: '2' })
      expect(res.status, JSON.stringify(res.body)).toBe(201)
      expect(res.body.data).toMatchObject({ nps: 5, satisfaction: 2 })
    })
  })

  describe('CSRF', () => {
    it('a write without the token is 403 CSRF_INVALID and stores nothing', async () => {
      const before = (await feedbackRows()).length
      const res = await studentB.who.agent.post('/api/feedback').send({ nps: 5, satisfaction: 3 })
      errorIs(res, 403, 'CSRF_INVALID')
      const wrong = await studentB.who.agent.post('/api/feedback').set('X-CSRF-Token', 'wrong').send({ nps: 5, satisfaction: 3 })
      errorIs(wrong, 403, 'CSRF_INVALID')
      expect((await feedbackRows()).length).toBe(before)
    })
  })
})

describe('the feedback month is the Malaysia calendar month', () => {
  let t: KirkpatrickTestApp
  let student: Client

  beforeAll(async () => {
    // 23:50 MYT on 31 October is 15:50 UTC the same day; twenty minutes later it is 1 November in Malaysia, still 31 October in UTC.
    t = await bootKirkpatrickApp({ start: '2026-10-31T23:50:00+08:00' })
    student = await client(t, STUDENT_1)
  }, 180_000)
  afterAll(async () => {
    await t.close()
  })

  it('a new month opens at midnight in Kuala Lumpur, not in UTC', async () => {
    expect((await student.get('/feedback/status')).body.data).toEqual({ month: '2026-10', answered: false })
    expect((await student.post('/feedback', { nps: 9, satisfaction: 5 })).body.data.month).toBe('2026-10')
    expect((await student.get('/feedback/status')).body.data).toEqual({ month: '2026-10', answered: true })

    t.clock.advance(20 * 60 * 1000)
    expect((await student.get('/feedback/status')).body.data).toEqual({ month: '2026-11', answered: false })
    const res = await student.post('/feedback', { nps: 8, satisfaction: 4 })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    expect(res.body.data.month).toBe('2026-11')
    const months = await t.db.query<{ month: string }>(`select to_char(month, 'YYYY-MM-DD') as month from feedback order by month`)
    expect(months.map((r) => r.month)).toEqual(['2026-10-01', '2026-11-01'])
  })
})

describe('Mod Pelajar feedback is test data and never uses the real monthly slot (is_test is part of the key)', () => {
  let t: KirkpatrickTestApp

  beforeAll(async () => {
    t = await bootKirkpatrickApp()
  }, 180_000)
  afterAll(async () => {
    await t.close()
  })

  const enter = async (c: Client): Promise<string> => {
    const res = await c.who.agent.post('/api/session/mode').set('X-CSRF-Token', c.who.csrf).send({ mode: 'mod_pelajar' })
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    return res.body.data.csrf as string
  }
  const leave = async (c: Client, csrf: string): Promise<string> => {
    const res = await c.who.agent.delete('/api/session/mode').set('X-CSRF-Token', csrf)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    return res.body.data.csrf as string
  }
  const post = (c: Client, csrf: string, nps: number) =>
    c.who.agent.post('/api/feedback').set('X-CSRF-Token', csrf).send({ nps, satisfaction: 3 })
  const rows = (email: string) =>
    t.db.query<{ is_test: boolean; nps: number }>(
      `select f.is_test, f.nps from feedback f join users u on u.id = f.user_id where lower(u.email) = lower($1) order by f.id`,
      [email],
    )

  it('a test response first leaves the real one open (status and submit match on is_test)', async () => {
    const c = await client(t, SCHOOL_ADMIN_A)
    const testCsrf = await enter(c)
    expect((await c.get('/feedback/status')).body.data.answered).toBe(false)
    expect((await post(c, testCsrf, 2)).status).toBe(201)
    expect((await c.get('/feedback/status')).body.data.answered).toBe(true)
    expect((await post(c, testCsrf, 3)).status).toBe(409)

    const realCsrf = await leave(c, testCsrf)
    expect((await c.get('/feedback/status')).body.data.answered).toBe(false)
    expect((await post(c, realCsrf, 8)).status).toBe(201)
    expect((await c.get('/feedback/status')).body.data.answered).toBe(true)
    expect((await post(c, realCsrf, 9)).status).toBe(409)
    expect(await rows(SCHOOL_ADMIN_A)).toEqual([
      { is_test: true, nps: 2 },
      { is_test: false, nps: 8 },
    ])
  })

  it('a real response first leaves the test one open', async () => {
    const c = await client(t, ADMIN)
    expect((await post(c, c.who.csrf, 7)).status).toBe(201)
    const testCsrf = await enter(c)
    expect((await c.get('/feedback/status')).body.data.answered).toBe(false)
    expect((await post(c, testCsrf, 1)).status).toBe(201)
    expect((await post(c, testCsrf, 1)).status).toBe(409)
    const realCsrf = await leave(c, testCsrf)
    expect((await c.get('/feedback/status')).body.data.answered).toBe(true)
    expect((await post(c, realCsrf, 6)).status).toBe(409)
    expect(await rows(ADMIN)).toEqual([
      { is_test: false, nps: 7 },
      { is_test: true, nps: 1 },
    ])
  })
})
