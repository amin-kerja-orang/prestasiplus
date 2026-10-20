import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { bootCurriculumApp, expectCsrfInvalid, expectError, loginAs, type Client, type CurriculumTestApp } from './helpers'

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete'

/** Every admin route of M03 (24 of the 29): path ids are never looked up because the guard answers first. */
const ADMIN_ROUTES: [Method, string][] = [
  ['get', '/api/admin/subjects'],
  ['get', '/api/admin/subjects/1'],
  ['post', '/api/admin/subjects'],
  ['put', '/api/admin/subjects/1'],
  ['patch', '/api/admin/subjects/1/active'],
  ['delete', '/api/admin/subjects/1'],
  ['get', '/api/admin/education-levels'],
  ['get', '/api/admin/education-levels/1'],
  ['post', '/api/admin/education-levels'],
  ['put', '/api/admin/education-levels/1'],
  ['patch', '/api/admin/education-levels/1/active'],
  ['delete', '/api/admin/education-levels/1'],
  ['get', '/api/admin/curriculum'],
  ['get', '/api/admin/curriculum/chapters/1'],
  ['post', '/api/admin/curriculum/chapters'],
  ['put', '/api/admin/curriculum/chapters/1'],
  ['delete', '/api/admin/curriculum/chapters/1'],
  ['get', '/api/admin/curriculum/topics/1'],
  ['post', '/api/admin/curriculum/topics'],
  ['put', '/api/admin/curriculum/topics/1'],
  ['delete', '/api/admin/curriculum/topics/1'],
  ['post', '/api/admin/curriculum/subtopics'],
  ['put', '/api/admin/curriculum/subtopics/1'],
  ['delete', '/api/admin/curriculum/subtopics/1'],
]

describe('AC9: roles and CSRF on the admin routes', () => {
  let t: CurriculumTestApp
  let clients: Record<'student' | 'teacher' | 'schoolAdmin' | 'admin', Client>
  beforeAll(async () => {
    t = await bootCurriculumApp()
    clients = {
      student: await loginAs(t, 'pelajar@demo.test'),
      teacher: await loginAs(t, 'guru@demo.test'),
      schoolAdmin: await loginAs(t, 'adminsekolah@demo.test'),
      admin: await loginAs(t, 'admin@demo.test'),
    }
  })
  afterAll(async () => {
    await t.close()
  })

  it('covers 24 admin routes', () => {
    expect(ADMIN_ROUTES).toHaveLength(24)
  })

  it.each(ADMIN_ROUTES)('%s %s: 401 without a session', async (method, url) => {
    const res = await (t.http()[method](url) as unknown as Promise<import('supertest').Response>)
    expectError(res, 'UNAUTHORIZED')
  })

  it.each(ADMIN_ROUTES)('%s %s: 403 for student, teacher and school admin', async (method, url) => {
    for (const who of ['student', 'teacher', 'schoolAdmin'] as const) {
      const c = clients[who]
      const res = await (method === 'get' ? c.get(url) : method === 'delete' ? c.delete(url) : c[method](url, {}))
      expectError(res, 'FORBIDDEN')
    }
  })

  it.each(ADMIN_ROUTES.filter(([m]) => m !== 'get'))('%s %s: 403 CSRF_INVALID without the token, and with a wrong one', async (rawMethod, url) => {
    const c = clients.admin
    const method = rawMethod as 'post' | 'put' | 'patch' | 'delete'
    expectCsrfInvalid(await (method === 'delete' ? c.noCsrf.delete(url) : c.noCsrf[method](url, {})))
    const wrong = method === 'delete' ? c.noCsrf.delete(url) : c.noCsrf[method](url, {})
    expectCsrfInvalid(await wrong.set('X-CSRF-Token', 'not-the-token'))
  })

  it('a refused write changes nothing', async () => {
    const before = await t.db.query<{ n: string }>('select count(*) n from subjects')
    await clients.student.post('/api/admin/subjects', { name: 'x', nameEn: 'y', code: 'ZZ1' })
    await clients.admin.noCsrf.post('/api/admin/subjects', { name: 'x', nameEn: 'y', code: 'ZZ1' })
    expect((await t.db.query<{ n: string }>('select count(*) n from subjects'))[0]).toEqual(before[0])
  })

  it('an admin in Mod Pelajar (student mode) is refused like a student', async () => {
    const c = await loginAs(t, 'admin@demo.test')
    expect((await c.get('/api/admin/subjects')).status).toBe(200)
    const mode = await c.post('/api/session/mode', { mode: 'mod_pelajar' })
    expect(mode.status, JSON.stringify(mode.body)).toBe(200)
    // The session now acts as student/self: the admin routes refuse it.
    expectError(await c.get('/api/admin/subjects'), 'FORBIDDEN')
    expect((await c.get('/api/subjects')).status).toBe(200)
  })
})
