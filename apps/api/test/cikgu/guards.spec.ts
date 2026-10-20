import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { ADMIN, SCHOOL_ADMIN, STUDENT_1, STUDENT_2, STUDENT_3, TEACHER_A, bootCikguApp, client, reroleUser, type CikguTestApp, type Client } from './helpers'

const PPD = 'murid.demo002.01@example.test'

/** The nine teacher routes (T2 to T10) and the shape of a request to each. */
const TEACHER_ROUTES: { method: 'get' | 'post'; path: string; body?: unknown }[] = [
  { method: 'get', path: '/cikgu/rph' },
  { method: 'post', path: '/cikgu/rph', body: { subjectName: 'Matematik', level: 'T4', tajuk: 'Bab 3' } },
  { method: 'get', path: '/cikgu/rph/1' },
  { method: 'get', path: '/cikgu/essays' },
  { method: 'get', path: '/cikgu/essays/1' },
  { method: 'get', path: '/cikgu/pbd' },
  { method: 'post', path: '/cikgu/pbd/rollup', body: { classroomId: '1' } },
  { method: 'post', path: '/cikgu/pbd/bulk-approve', body: { ids: ['1'] } },
  { method: 'get', path: '/cikgu/pbd/export.csv' },
]

describe('guards (AC2): guest 401, teacher and admin allowed, every other role 403, standard envelope', () => {
  let t: CikguTestApp
  const clients = new Map<string, Client>()

  beforeAll(async () => {
    t = await bootCikguApp()
    await reroleUser(t, STUDENT_2, 'parent')
    await reroleUser(t, STUDENT_3, 'sponsor')
    await reroleUser(t, PPD, 'ppd_officer')
    for (const email of [STUDENT_1, STUDENT_2, STUDENT_3, SCHOOL_ADMIN, PPD, TEACHER_A, ADMIN]) clients.set(email, await client(t, email))
  }, 120_000)
  afterAll(async () => {
    await t.close()
  })

  const call = (who: Client | null, r: (typeof TEACHER_ROUTES)[number]) => {
    if (who === null) return r.method === 'get' ? t.http().get(`/api${r.path}`) : t.http().post(`/api${r.path}`).send((r.body ?? {}) as object)
    return r.method === 'get' ? who.get(r.path) : who.post(r.path, r.body)
  }

  it.each(TEACHER_ROUTES.map((r) => [`${r.method.toUpperCase()} ${r.path}`, r] as const))('%s: a guest gets 401 UNAUTHORIZED "Unauthenticated."', async (_name, r) => {
    const res = await call(null, r)
    expect(res.status).toBe(401)
    expect(res.body.error).toMatchObject({ code: 'UNAUTHORIZED', message: 'Unauthenticated.' })
    expect(res.body.error.requestId).toBeTruthy()
  })

  it.each(TEACHER_ROUTES.map((r) => [`${r.method.toUpperCase()} ${r.path}`, r] as const))('%s: student, parent, sponsor, school admin and PPD officer get 403 FORBIDDEN "This action is unauthorized."', async (_name, r) => {
    for (const email of [STUDENT_1, STUDENT_2, STUDENT_3, SCHOOL_ADMIN, PPD]) {
      const res = await call(clients.get(email) as Client, r)
      expect(res.status, email).toBe(403)
      expect(res.body.error, email).toMatchObject({ code: 'FORBIDDEN', message: 'This action is unauthorized.' })
    }
  })

  it.each(TEACHER_ROUTES.map((r) => [`${r.method.toUpperCase()} ${r.path}`, r] as const))('%s: teacher and admin pass the guard (no 401/403)', async (_name, r) => {
    for (const email of [TEACHER_A, ADMIN]) {
      const res = await call(clients.get(email) as Client, r)
      expect([401, 403], `${email} ${String(res.status)}`).not.toContain(res.status)
    }
  })

  it('a teacher POST without the CSRF header is 403 CSRF_INVALID on every write route', async () => {
    const teacher = clients.get(TEACHER_A) as Client
    for (const r of TEACHER_ROUTES.filter((x) => x.method === 'post')) {
      const res = await teacher.postNoCsrf(r.path, r.body)
      expect(res.status, r.path).toBe(403)
      expect(res.body.error.code, r.path).toBe('CSRF_INVALID')
    }
  })

  it('every teacher read carries Cache-Control: no-store (child data), also the CSV', async () => {
    const teacher = clients.get(TEACHER_A) as Client
    for (const path of ['/cikgu/rph', '/cikgu/essays', '/cikgu/pbd', '/cikgu/pbd/export.csv', '/cikgu/rph/999', '/cikgu/essays/999']) {
      const res = await teacher.get(path)
      expect(res.headers['cache-control'], path).toBe('no-store')
    }
  })
})

describe('write and export throttles on the teacher routes (D57a, standard 429)', () => {
  let t: CikguTestApp

  beforeAll(async () => {
    t = await bootCikguApp({ env: { THROTTLE_CIKGU_WRITE_PER_MINUTE: '2', THROTTLE_CIKGU_EXPORT_PER_MINUTE: '1', THROTTLE_CIKGU_READ_PER_MINUTE: '3' } })
  }, 120_000)
  afterAll(async () => {
    await t.close()
  })

  it('writes are limited per user: the 3rd POST in a minute is 429 RATE_LIMITED with Retry-After', async () => {
    const teacher = await client(t, TEACHER_A)
    expect((await teacher.post('/cikgu/pbd/rollup', { classroomId: '1' })).status).toBe(200)
    expect((await teacher.post('/cikgu/pbd/bulk-approve', { ids: [] })).status).toBe(200)
    const res = await teacher.post('/cikgu/rph', { subjectName: 'Matematik', level: 'T4', tajuk: 'Bab 3' })
    expect(res.status).toBe(429)
    expect(res.body.error.code).toBe('RATE_LIMITED')
    expect(res.body.error.retryAfter).toBeGreaterThan(0)
    expect(res.headers['retry-after']).toBe(String(res.body.error.retryAfter))
    expect((await t.db.query<{ n: number }>(`select count(*)::int n from rph_plans`))[0]?.n).toBe(0)
  })

  it('the CSV export has its own tighter bucket and reads are limited too', async () => {
    const teacher = await client(t, TEACHER_A)
    expect((await teacher.get('/cikgu/pbd/export.csv')).status).toBe(200)
    const res = await teacher.get('/cikgu/pbd/export.csv')
    expect(res.status).toBe(429)
    expect(res.body.error.code).toBe('RATE_LIMITED')
    for (let i = 0; i < 3; i++) expect((await teacher.get('/cikgu/rph')).status).toBe(200)
    expect((await teacher.get('/cikgu/rph')).status).toBe(429)
    t.clock.advance(61_000)
    const again = await client(t, TEACHER_A)
    expect((await again.get('/cikgu/rph')).status).toBe(200)
  })
})
