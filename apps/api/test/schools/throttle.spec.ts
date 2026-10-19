import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { bootSchoolsApp, expectError, loginAs, type LoggedIn, type SchoolsTestApp } from './helpers'

const VALID = { name: 'SK Had', code: 'HAD0001', type: 'SK', state: 'Selangor', district: 'Gombak', city: 'Gombak' }

describe('rate limits (D57a)', () => {
  describe('public pickers, per client address', () => {
    let t: SchoolsTestApp
    beforeAll(async () => {
      t = await bootSchoolsApp({ env: { THROTTLE_PUBLIC_PER_MINUTE: '3' } })
    })
    afterAll(async () => {
      await t.close()
    })

    it('the 4th request in a minute is 429 RATE_LIMITED with retryAfter and the Retry-After header', async () => {
      for (const path of ['/api/schools/search', '/api/jpn', '/api/schools/search']) {
        expect((await t.http().get(path)).status).toBe(200)
      }
      const res = await t.http().get('/api/jpn/1/ppd')
      const err = expectError(res, 'RATE_LIMITED', 'Too Many Attempts.')
      expect(err.retryAfter).toBe(60)
      expect(res.headers['retry-after']).toBe('60')
    })

    it('the window slides: Retry-After shrinks with time and requests pass again after it', async () => {
      t.clock.advance(20_000)
      const res = await t.http().get('/api/jpn')
      expect(expectError(res, 'RATE_LIMITED', 'Too Many Attempts.').retryAfter).toBe(40)
      t.clock.advance(41_000)
      expect((await t.http().get('/api/jpn')).status).toBe(200)
    })

    it('an X-Forwarded-For header does not give a new counter (TRUST_PROXY_HOPS=0)', async () => {
      t.clock.advance(120_000)
      for (let i = 0; i < 3; i++) expect((await t.http().get('/api/jpn').set('X-Forwarded-For', `10.0.0.${String(i + 1)}`)).status).toBe(200)
      expectError(await t.http().get('/api/jpn').set('X-Forwarded-For', '10.9.9.9'), 'RATE_LIMITED', 'Too Many Attempts.')
    })
  })

  describe('admin routes, per user', () => {
    let t: SchoolsTestApp
    let admin: LoggedIn
    beforeAll(async () => {
      t = await bootSchoolsApp({ env: { THROTTLE_ADMIN_WRITE_PER_MINUTE: '2', THROTTLE_ADMIN_READ_PER_MINUTE: '3' } })
      admin = await loginAs(t, 'admin@demo.test')
    })
    afterAll(async () => {
      await t.close()
    })

    it('writes: the 3rd write in a minute is 429; reads are counted separately', async () => {
      const post = (code: string) => admin.agent.post('/api/admin/schools').set('X-CSRF-Token', admin.csrf).send({ ...VALID, code })
      expect((await post('HAD0001')).status).toBe(201)
      expect((await post('HAD0002')).status).toBe(201)
      const res = await post('HAD0003')
      expect(expectError(res, 'RATE_LIMITED', 'Too Many Attempts.').retryAfter).toBe(60)
      expect(res.headers['retry-after']).toBe('60')
      const rows = await t.db.query(`select 1 from schools where code = 'HAD0003'`)
      expect(rows).toEqual([])
      expect((await admin.agent.get('/api/admin/schools')).status).toBe(200)
    })

    it('reads: the 4th read is 429, for every admin read route', async () => {
      t.clock.advance(61_000)
      for (let i = 0; i < 3; i++) expect((await admin.agent.get('/api/admin/schools/options')).status).toBe(200)
      expectError(await admin.agent.get('/api/admin/schools'), 'RATE_LIMITED', 'Too Many Attempts.')
      expectError(await admin.agent.get('/api/schools?all=1'), 'RATE_LIMITED', 'Too Many Attempts.')
    })

    it('a refused request (403 CSRF_INVALID, 401) is not counted against the user', async () => {
      t.clock.advance(61_000)
      for (let i = 0; i < 5; i++) expectError(await admin.agent.post('/api/admin/schools').send({ ...VALID, code: 'NOCSRF' }), 'CSRF_INVALID')
      for (let i = 0; i < 5; i++) expectError(await t.http().post('/api/admin/schools').send(VALID), 'UNAUTHORIZED')
      expect((await admin.agent.post('/api/admin/schools').set('X-CSRF-Token', admin.csrf).send({ ...VALID, code: 'HAD0004' })).status).toBe(201)
    })

    it('another user has a counter of their own', async () => {
      t.clock.advance(61_000)
      const other = await loginAs(t, 'adminsekolah@demo.test')
      // the school admin is refused (403) and so is not counted; the admin is still limited per user
      for (let i = 0; i < 4; i++) expectError(await other.agent.get('/api/admin/schools'), 'FORBIDDEN')
      expect((await admin.agent.get('/api/admin/schools')).status).toBe(200)
    })
  })
})
