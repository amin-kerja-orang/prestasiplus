import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { ADMIN, PATH, SCHOOL_ADMIN, STUDENT, STUDENT_B, TEACHER, applications, bootSponsorshipApp, client, reroleUser, validBody, type SponsorshipTestApp } from './helpers'

describe('AC7 guards, no-store and the CSRF check', () => {
  let t: SponsorshipTestApp

  beforeAll(async () => {
    t = await bootSponsorshipApp()
    await reroleUser(t, STUDENT_B, 'parent')
  }, 120_000)
  afterAll(async () => {
    await t.close()
  })

  it('no session is 401 UNAUTHORIZED "Unauthenticated." and stores nothing', async () => {
    const res = await t.http().post(PATH).send(validBody())
    expect(res.status).toBe(401)
    expect(res.body.error).toMatchObject({ code: 'UNAUTHORIZED', message: 'Unauthenticated.', requestId: expect.any(String) })
    expect(await applications(t)).toHaveLength(0)
  })

  it('a session without the CSRF header is 403 CSRF_INVALID and stores nothing', async () => {
    const res = await (await client(t, STUDENT)).postNoCsrf(validBody())
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('CSRF_INVALID')
    expect(await applications(t)).toHaveLength(0)
  })

  it('a wrong CSRF token is 403 CSRF_INVALID', async () => {
    const agent = t.agent()
    await agent.post('/api/auth/login').send({ identifier: STUDENT, password: 'Demo1234', remember: false })
    const res = await agent.post(PATH).set('X-CSRF-Token', 'x'.repeat(43)).send(validBody())
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('CSRF_INVALID')
  })

  it.each([
    ['student', STUDENT],
    ['teacher', TEACHER],
    ['parent', STUDENT_B],
    ['admin', ADMIN],
    ['school_admin', SCHOOL_ADMIN],
  ])('a %s session succeeds with 201', async (role, email) => {
    const res = await (await client(t, email)).post(validBody())
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const row = (await applications(t)).find((r) => r.id === res.body.data.id)
    expect(row?.applicant_role).toBe(role)
  })

  it('Cache-Control: no-store on the 201 and on a 422', async () => {
    const who = await client(t, STUDENT)
    expect((await who.post(validBody())).headers['cache-control']).toBe('no-store')
    expect((await who.post({})).headers['cache-control']).toBe('no-store')
  })

  it('a GET on the path has no route (the data is write-only)', async () => {
    const who = t.agent()
    await who.post('/api/auth/login').send({ identifier: STUDENT, password: 'Demo1234', remember: false })
    expect((await who.get(PATH)).status).toBe(404)
  })
})

describe('AC7 Mod Pelajar stamps is_test (G-07)', () => {
  let t: SponsorshipTestApp

  beforeAll(async () => {
    t = await bootSponsorshipApp()
  }, 120_000)
  afterAll(async () => {
    await t.close()
  })

  it('an admin in Mod Pelajar stores is_test = true and the role student; the same admin outside it stores false and admin', async () => {
    const test = await (await client(t, ADMIN, { modPelajar: true })).post(validBody())
    expect(test.status, JSON.stringify(test.body)).toBe(201)
    const normal = await (await client(t, ADMIN)).post(validBody())
    expect(normal.status).toBe(201)
    const rows = await applications(t)
    expect(rows.find((r) => r.id === test.body.data.id)).toMatchObject({ is_test: true, applicant_role: 'student' })
    expect(rows.find((r) => r.id === normal.body.data.id)).toMatchObject({ is_test: false, applicant_role: 'admin' })
  })

  it('a student outside Mod Pelajar stores is_test = false', async () => {
    const res = await (await client(t, STUDENT)).post(validBody())
    expect((await applications(t)).find((r) => r.id === res.body.data.id)?.is_test).toBe(false)
  })
})

describe('rate limit (D57a)', () => {
  let t: SponsorshipTestApp

  beforeAll(async () => {
    t = await bootSponsorshipApp({ env: { THROTTLE_FOSTER_APPLICATION_PER_MINUTE: '3' } })
  }, 120_000)
  afterAll(async () => {
    await t.close()
  })

  it('the 4th POST of a user in a minute is 429 RATE_LIMITED with error.retryAfter and Retry-After; valid or not, all count', async () => {
    const who = await client(t, STUDENT)
    expect((await who.post(validBody())).status).toBe(201)
    expect((await who.post({})).status).toBe(422)
    expect((await who.post(validBody())).status).toBe(201)
    const res = await who.post(validBody())
    expect(res.status).toBe(429)
    expect(res.body.error.code).toBe('RATE_LIMITED')
    expect(res.body.error.retryAfter).toBeGreaterThan(0)
    expect(res.headers['retry-after']).toBe(String(res.body.error.retryAfter))
    expect(await applications(t)).toHaveLength(2)
  })

  it('the limit is per user: another user is not affected, and the window renews', async () => {
    const other = await client(t, TEACHER)
    expect((await other.post(validBody())).status).toBe(201)
    t.clock.advance(61_000)
    const again = await client(t, STUDENT)
    expect((await again.post(validBody())).status).toBe(201)
  })
})

describe('rate limit default', () => {
  let t: SponsorshipTestApp

  beforeAll(async () => {
    t = await bootSponsorshipApp({ env: { THROTTLE_FOSTER_APPLICATION_PER_MINUTE: undefined } })
  }, 120_000)
  afterAll(async () => {
    await t.close()
  })

  it('is 5 per user per minute when the variable is unset', async () => {
    const who = await client(t, STUDENT)
    for (let i = 0; i < 5; i += 1) expect((await who.post(validBody())).status, String(i)).toBe(201)
    expect((await who.post(validBody())).status).toBe(429)
  })
})
