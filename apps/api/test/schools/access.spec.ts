import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  bootSchoolsApp,
  expectError,
  loginAs,
  schoolIdOf,
  type LoggedIn,
  type SchoolsTestApp,
} from './helpers'

const VALID = { name: 'SK Contoh Baru', code: 'ZZZ9001', type: 'SK', state: 'Selangor', district: 'PPD GOMBAK', city: 'Gombak', isActive: true }

type Method = 'get' | 'post' | 'put'

describe('schools: roles, scope and CSRF (AC 3, AC 10)', () => {
  let t: SchoolsTestApp
  let own: string
  let other: string
  const people: Record<string, LoggedIn> = {}

  beforeAll(async () => {
    t = await bootSchoolsApp({ env: { THROTTLE_ADMIN_WRITE_PER_MINUTE: '1000', THROTTLE_ADMIN_READ_PER_MINUTE: '1000' } })
    own = await schoolIdOf(t.db, 'DEMO001')
    other = await schoolIdOf(t.db, 'DEMO002')
    for (const [key, email] of [
      ['admin', 'admin@demo.test'],
      ['schoolAdmin', 'adminsekolah@demo.test'],
      ['teacher', 'guru@demo.test'],
      ['student', 'pelajar@demo.test'],
      ['teacherAdmin', 'guruadmin@demo.test'],
    ] as const) {
      people[key] = await loginAs(t, email)
    }
  })
  afterAll(async () => {
    await t.close()
  })

  const endpoints = (): [Method, string][] => [
    ['get', '/api/admin/schools'],
    ['get', '/api/admin/schools/options'],
    ['get', `/api/admin/schools/${own}`],
    ['post', '/api/admin/schools'],
    ['put', `/api/admin/schools/${own}`],
    ['post', `/api/admin/schools/${own}/toggle`],
    ['get', '/api/schools?all=1'],
  ]

  it('a guest gets 401 UNAUTHORIZED on every admin route, with and without a body', async () => {
    for (const [method, url] of endpoints()) {
      const req = t.http()[method](url)
      const res = method === 'get' ? await req : await req.send(VALID)
      expectError(res, 'UNAUTHORIZED', 'Unauthenticated.')
    }
  })

  it.each([
    ['student', 'student'],
    ['teacher', 'teacher'],
    ['school admin of the own school', 'schoolAdmin'],
    ['teacher/school admin account acting as teacher', 'teacherAdmin'],
  ])('%s gets 403 FORBIDDEN on every admin route (the mock allows Admin Pusat only)', async (_label, key) => {
    const me = people[key] as LoggedIn
    for (const [method, url] of endpoints()) {
      const req = me.agent[method](url)
      const res = method === 'get' ? await req : await req.set('X-CSRF-Token', me.csrf).send(VALID)
      expectError(res, 'FORBIDDEN', 'This action is unauthorized.')
    }
  })

  it("a school admin cannot read, edit or toggle another school either: 403, never a body (AC 3)", async () => {
    const me = people.schoolAdmin as LoggedIn
    expectError(await me.agent.get(`/api/admin/schools/${other}`), 'FORBIDDEN')
    expectError(await me.agent.put(`/api/admin/schools/${other}`).set('X-CSRF-Token', me.csrf).send(VALID), 'FORBIDDEN')
    expectError(await me.agent.post(`/api/admin/schools/${other}/toggle`).set('X-CSRF-Token', me.csrf), 'FORBIDDEN')
    const row = await t.db.query<{ is_active: boolean; name: string }>(`select is_active, name from schools where id = $1`, [other])
    expect(row[0]).toEqual({ is_active: true, name: 'SK Demo Dua' })
  })

  it('an unknown or malformed id is 404 for the admin (nothing is probed through 403)', async () => {
    const me = people.admin as LoggedIn
    expectError(await me.agent.get('/api/admin/schools/99999999'), 'NOT_FOUND', 'Not Found.')
    expectError(await me.agent.get('/api/admin/schools/abc'), 'NOT_FOUND')
    expectError(await me.agent.get('/api/admin/schools/12345678901234567890123'), 'NOT_FOUND')
  })

  it('a mutation without the CSRF header is 403 CSRF_INVALID, with a wrong header too; nothing is written', async () => {
    const me = people.admin as LoggedIn
    const before = await t.db.query(`select count(*)::int as n from schools`)
    expectError(await me.agent.post('/api/admin/schools').send(VALID), 'CSRF_INVALID')
    expectError(await me.agent.post('/api/admin/schools').set('X-CSRF-Token', 'wrong').send(VALID), 'CSRF_INVALID')
    expectError(await me.agent.put(`/api/admin/schools/${own}`).send(VALID), 'CSRF_INVALID')
    expectError(await me.agent.post(`/api/admin/schools/${own}/toggle`), 'CSRF_INVALID')
    expect(await t.db.query(`select count(*)::int as n from schools`)).toEqual(before)
    const active = await t.db.query<{ is_active: boolean }>(`select is_active from schools where id = $1`, [own])
    expect(active[0]?.is_active).toBe(true)
  })

  it('the public pickers need no session (and a session does not change them)', async () => {
    expect((await t.http().get('/api/schools/search')).status).toBe(200)
    expect((await t.http().get('/api/jpn')).status).toBe(200)
    expect((await (people.student as LoggedIn).agent.get('/api/jpn')).status).toBe(200)
  })

  it('GET /api/schools (the all=1 list) is not public', async () => {
    expectError(await t.http().get('/api/schools?all=1'), 'UNAUTHORIZED')
  })
})
