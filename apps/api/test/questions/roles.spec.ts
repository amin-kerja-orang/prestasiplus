import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { bootQuestionsApp, expectCsrfInvalid, expectError, loginAs, questionIdOf, type Client, type QuestionsTestApp } from './helpers'
import { mcqBody, refsOf, type Refs } from './http-helpers'

type Method = 'get' | 'post' | 'put' | 'delete'

/** Admin Pusat only: the 7 objective routes and the 2 structured reads (ids are never looked up: the guard answers first). */
const ADMIN_ROUTES: [Method, string][] = [
  ['get', '/api/questions'],
  ['get', '/api/questions/summary'],
  ['get', '/api/questions/1'],
  ['post', '/api/questions'],
  ['put', '/api/questions/1'],
  ['delete', '/api/questions/1'],
  ['post', '/api/questions/bulk-action'],
  ['get', '/api/structured-questions'],
  ['get', '/api/structured-questions/1'],
]

/** Guru or Admin Pusat. */
const GURU_ROUTES: [Method, string][] = [
  ['get', '/api/guru/questions'],
  ['get', '/api/guru/questions/1'],
  ['post', '/api/guru/questions'],
  ['put', '/api/guru/questions/1'],
  ['delete', '/api/guru/questions/1'],
]

describe('AC 10: roles, sessions and CSRF', () => {
  let t: QuestionsTestApp
  let c: Record<'student' | 'teacher' | 'schoolAdmin' | 'admin', Client>
  let refs: Refs
  beforeAll(async () => {
    t = await bootQuestionsApp()
    c = {
      student: await loginAs(t, 'student'),
      teacher: await loginAs(t, 'teacher'),
      schoolAdmin: await loginAs(t, 'schoolAdmin'),
      admin: await loginAs(t, 'admin'),
    }
    refs = await refsOf(t.db)
  })
  afterAll(async () => {
    await t.close()
  })

  it('covers all 14 routes', () => {
    expect(ADMIN_ROUTES.length + GURU_ROUTES.length).toBe(14)
  })

  it.each([...ADMIN_ROUTES, ...GURU_ROUTES])('%s %s: 401 without a session', async (method, url) => {
    expectError(await (t.http()[method](url) as unknown as Promise<import('supertest').Response>), 'UNAUTHORIZED')
  })

  it.each(ADMIN_ROUTES)('%s %s: 403 for student, teacher and school admin', async (method, url) => {
    for (const who of ['student', 'teacher', 'schoolAdmin'] as const) {
      const client = c[who]
      const res = await (method === 'get' ? client.get(url) : method === 'delete' ? client.delete(url) : client[method](url, {}))
      expectError(res, 'FORBIDDEN')
    }
  })

  it.each(GURU_ROUTES)('%s %s: 403 for student and school admin', async (method, url) => {
    for (const who of ['student', 'schoolAdmin'] as const) {
      const client = c[who]
      const res = await (method === 'get' ? client.get(url) : method === 'delete' ? client.delete(url) : client[method](url, {}))
      expectError(res, 'FORBIDDEN')
    }
  })

  it('Admin Pusat reaches every read route, the teacher reaches the Guru list', async () => {
    for (const url of ['/api/questions', '/api/questions/summary', '/api/structured-questions', '/api/guru/questions']) {
      expect((await c.admin.get(url)).status, url).toBe(200)
    }
    expect((await c.teacher.get('/api/guru/questions')).status).toBe(200)
  })

  it('a write without the CSRF header is 403 CSRF_INVALID on admin and Guru routes', async () => {
    const id = await questionIdOf(t.db, 'SEED-DRAFT-BM-T4')
    expectCsrfInvalid(await c.admin.noCsrf.post('/api/questions', mcqBody(refs)))
    expectCsrfInvalid(await c.admin.noCsrf.put(`/api/questions/${id}`, mcqBody(refs)))
    expectCsrfInvalid(await c.admin.noCsrf.delete(`/api/questions/${id}`))
    expectCsrfInvalid(await c.admin.noCsrf.post('/api/questions/bulk-action', { action: 'review', ids: [id] }))
    expectCsrfInvalid(await c.teacher.noCsrf.post('/api/guru/questions', {}))
    expectCsrfInvalid(await c.teacher.noCsrf.put('/api/guru/questions/1', {}))
    expectCsrfInvalid(await c.teacher.noCsrf.delete('/api/guru/questions/1'))
    // Nothing was written.
    expect(await t.db.query(`select 1 from questions where id = $1`, [id])).toHaveLength(1)
  })
})

describe('D57: write rate limit', () => {
  let t: QuestionsTestApp
  let admin: Client
  beforeAll(async () => {
    process.env.THROTTLE_QUESTIONS_WRITE_PER_MINUTE = '3'
    t = await bootQuestionsApp()
    admin = await loginAs(t, 'admin')
  })
  afterAll(async () => {
    delete process.env.THROTTLE_QUESTIONS_WRITE_PER_MINUTE
    await t.close()
  })

  it('the 4th write inside a minute is 429 RATE_LIMITED; reads are not counted', async () => {
    for (let i = 0; i < 3; i += 1) expectError(await admin.delete('/api/questions/999999999'), 'NOT_FOUND')
    const res = await admin.delete('/api/questions/999999999')
    expectError(res, 'RATE_LIMITED')
    expect(res.status).toBe(429)
    expect((await admin.get('/api/questions')).status).toBe(200)
  })
})
