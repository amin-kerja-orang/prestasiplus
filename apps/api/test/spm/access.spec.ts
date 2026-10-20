import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { ACCOUNTS, bootSpmApp, expectCsrfInvalid, expectError, loginAs, type SpmTestApp } from './helpers'

let t: SpmTestApp
beforeAll(async () => {
  t = await bootSpmApp()
}, 120_000)
afterAll(async () => {
  await t.close()
})

const MOCK = '11111111-1111-4111-8111-111111111111'

/** The 14 routes of the card (path params filled with harmless values). */
const ROUTES: { method: 'get' | 'post'; url: string; body?: unknown }[] = [
  { method: 'get', url: '/api/spm/overview' },
  { method: 'get', url: '/api/spm/databank' },
  { method: 'get', url: '/api/spm/latih-tubi' },
  { method: 'get', url: '/api/spm/latih-tubi/MATH' },
  { method: 'get', url: '/api/spm/tracking-a' },
  { method: 'get', url: '/api/spm/tracking-a/MATH' },
  { method: 'get', url: '/api/spm/subjektif' },
  { method: 'get', url: '/api/spm-mocks' },
  { method: 'post', url: '/api/spm-mocks', body: { subject: 'Sejarah' } },
  { method: 'get', url: `/api/spm-mocks/${MOCK}` },
  { method: 'post', url: `/api/spm-mocks/${MOCK}/submit`, body: { answers: [] } },
  { method: 'get', url: `/api/spm-mocks/${MOCK}/result` },
  { method: 'post', url: '/api/spm-walkthrough/solve', body: { subject: 'Matematik', question_text: 'x' } },
  { method: 'get', url: '/api/duta/recommendations' },
]

describe('AC1 authentication, CSRF and roles', () => {
  it('there are 14 routes and every one is 401 UNAUTHORIZED without a session', async () => {
    expect(ROUTES).toHaveLength(14)
    const http = t.http()
    for (const r of ROUTES) {
      const res = r.method === 'get' ? await http.get(r.url) : await http.post(r.url).send(r.body as object)
      expectError(res, 'UNAUTHORIZED')
    }
  })

  it('a POST without the CSRF token is 403 CSRF_INVALID', async () => {
    const c = await loginAs(t, 'student')
    for (const r of ROUTES.filter((x) => x.method === 'post')) expectCsrfInvalid(await c.noCsrf.post(r.url, r.body))
    // Reading needs no token.
    expect((await c.get('/api/spm/databank')).status).toBe(200)
  })

  it.each(Object.keys(ACCOUNTS) as (keyof typeof ACCOUNTS)[])('%s (any role with a session) can read the hub and the mock list', async (role) => {
    const c = await loginAs(t, role)
    for (const url of ['/api/spm/overview', '/api/spm/databank', '/api/spm/latih-tubi', '/api/spm/latih-tubi/MATH', '/api/spm/tracking-a', '/api/spm/tracking-a/MATH', '/api/spm/subjektif', '/api/spm-mocks', '/api/duta/recommendations']) {
      const res = await c.get(url)
      expect(res.status, `${role} ${url}: ${JSON.stringify(res.body)}`).toBe(200)
    }
    const solve = await c.post('/api/spm-walkthrough/solve', { subject: 'Matematik', question_text: 'x' })
    expect(solve.status).toBe(200)
  })

  it('every answer is Cache-Control: no-store', async () => {
    const c = await loginAs(t, 'student')
    for (const url of ['/api/spm/overview', '/api/spm-mocks', '/api/spm/latih-tubi/NOPE']) {
      expect((await c.get(url)).headers['cache-control']).toContain('no-store')
    }
  })
})

describe('AC1 readiness is admin only (role switch)', () => {
  it('null for student, teacher, school admin and after a role switch between the last two', async () => {
    for (const role of ['student', 'teacher', 'schoolAdmin'] as const) {
      const c = await loginAs(t, role)
      expect((await c.get('/api/spm/tracking-a')).body.data.readiness, role).toBeNull()
    }
    // guruadmin holds teacher + school admin (an admin account cannot hold another role): the board stays hidden
    // whichever of the two is active.
    const agent = t.agent()
    const login = await agent.post('/api/auth/login').send({ identifier: 'guruadmin@demo.test', password: 'Demo1234', remember: false })
    expect(login.status, JSON.stringify(login.body)).toBe(200)
    const asSchoolAdmin = await agent.post('/api/session/role').set('X-CSRF-Token', login.body.data.csrf).send({ role: 'school_admin' })
    expect(asSchoolAdmin.status).toBe(200)
    expect((await agent.get('/api/spm/tracking-a')).body.data.readiness).toBeNull()
    const asTeacher = await agent.post('/api/session/role').set('X-CSRF-Token', asSchoolAdmin.body.data.csrf).send({ role: 'teacher' })
    expect(asTeacher.status).toBe(200)
    expect((await agent.get('/api/spm/tracking-a')).body.data.readiness).toBeNull()
  })

  it('the admin account sees the board', async () => {
    const c = await loginAs(t, 'admin')
    const board = (await c.get('/api/spm/tracking-a')).body.data.readiness
    expect(board).not.toBeNull()
    expect(board.tiles.map((x: { code: string }) => x.code)).toEqual(['BM', 'BI', 'MATH', 'SCI', 'SEJ', 'PI', 'PM', 'ADDMATH', 'PHY', 'CHEM', 'BIO', 'GEO', 'BA', 'EKON', 'PSI'])
  })
})
