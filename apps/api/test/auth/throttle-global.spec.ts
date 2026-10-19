import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { type AuthTestApp, bootAuthApp, DEMO_PASSWORD, expectError, schoolIdOf } from './helpers'

describe('login throttle: global ceilings, proxy trust and timing', () => {
  describe('with no proxy (TRUST_PROXY_HOPS=0)', () => {
    let t: AuthTestApp
    beforeAll(async () => {
      t = await bootAuthApp()
    })
    afterAll(async () => {
      await t.close()
    })
    const post = (body: object, headers: Record<string, string> = {}) =>
      t.http().post('/api/auth/login').set(headers).send(body)

    it('M1: 20 failed logins per minute from one address, across identifiers, block the 21st (even a valid login)', async () => {
      for (let i = 0; i < 20; i++) {
        expectError(await post({ identifier: `tiada${i}@demo.test`, password: 'Salah-1234' }), 'INVALID_CREDENTIALS')
      }
      const blocked = await post({ identifier: 'admin@demo.test', password: DEMO_PASSWORD })
      const err = expectError(blocked, 'RATE_LIMITED')
      expect(err.retryAfter).toBeGreaterThanOrEqual(1)
      expect(err.retryAfter).toBeLessThanOrEqual(60)
      t.clock.advance(61_000)
      expect((await post({ identifier: 'admin@demo.test', password: DEMO_PASSWORD })).status).toBe(200)
    })

    it('a success does not reset the per-address ceiling', async () => {
      t.clock.advance(120_000)
      for (let i = 0; i < 19; i++) await post({ identifier: `lain${i}@demo.test`, password: 'Salah-1234' })
      expect((await post({ identifier: 'guru@demo.test', password: DEMO_PASSWORD })).status).toBe(200)
      await post({ identifier: 'lain99@demo.test', password: 'Salah-1234' }) // the 20th failure
      expectError(await post({ identifier: 'guru@demo.test', password: DEMO_PASSWORD }), 'RATE_LIMITED')
    })

    it('a username login weighs every password hash it checked against the budget', async () => {
      t.clock.advance(120_000)
      // murid01 exists in two schools: one failed attempt checks 2 hashes and costs 2 units.
      await post({ identifier: 'murid01', password: 'Salah-1' })
      const rows = await t.db.query<{ attempts: number }>(
        `select attempts from login_attempts where identifier_hash = 'any-identifier' order by updated_at desc limit 1`,
      )
      expect(rows[0]?.attempts).toBe(2)
    })

    it('an X-Forwarded-For header is ignored: spoofed addresses share one counter', async () => {
      t.clock.advance(1_000_000)
      const id = 'pelajar2@demo.test'
      for (let i = 0; i < 5; i++) {
        expectError(
          await post({ identifier: id, password: 'Salah-1234' }, { 'X-Forwarded-For': `10.0.0.${i + 1}` }),
          'INVALID_CREDENTIALS',
        )
      }
      expectError(
        await post({ identifier: id, password: DEMO_PASSWORD }, { 'X-Forwarded-For': '10.9.9.9' }),
        'RATE_LIMITED',
      )
    })

    it('SCHOOL_INACTIVE refuses without counting as a failed attempt', async () => {
      t.clock.advance(1_000_000)
      const school2 = await schoolIdOf(t.db, 'DEMO002')
      await t.db.query(`update schools set is_active = false where code = 'DEMO002'`)
      try {
        for (let i = 0; i < 8; i++) {
          expectError(
            await post({ identifier: 'murid01', password: DEMO_PASSWORD, schoolId: school2 }),
            'SCHOOL_INACTIVE',
          )
        }
      } finally {
        await t.db.query(`update schools set is_active = true where code = 'DEMO002'`)
      }
    })
  })

  describe('behind one proxy (TRUST_PROXY_HOPS=1)', () => {
    let t: AuthTestApp
    beforeAll(async () => {
      t = await bootAuthApp({ env: { TRUST_PROXY_HOPS: '1', LOGIN_IDENTIFIER_FAIL_LIMIT: '6' } })
    })
    afterAll(async () => {
      await t.close()
    })
    const post = (body: object, ip: string) => t.http().post('/api/auth/login').set('X-Forwarded-For', ip).send(body)

    it('uses the forwarded address: another client of the same proxy has its own pair counter', async () => {
      const id = 'pelajar2@demo.test'
      for (let i = 0; i < 5; i++) await post({ identifier: id, password: 'Salah-1234' }, '10.1.1.1')
      expectError(await post({ identifier: id, password: DEMO_PASSWORD }, '10.1.1.1'), 'RATE_LIMITED')
      expect((await post({ identifier: id, password: DEMO_PASSWORD }, '10.1.1.2')).status).toBe(200)
    })

    it('M1/N2: failures for one identifier from different addresses (limit 6 here, default 100) block that identifier everywhere', async () => {
      t.clock.advance(1_000_000)
      const id = 'pelajarmaju@demo.test'
      for (let i = 0; i < 6; i++) {
        expectError(await post({ identifier: id, password: 'Salah-1234' }, `10.2.0.${i + 1}`), 'INVALID_CREDENTIALS')
      }
      const err = expectError(await post({ identifier: id, password: DEMO_PASSWORD }, '10.2.9.9'), 'RATE_LIMITED')
      expect(err.retryAfter).toBeLessThanOrEqual(900)
      // Another identifier from the same fresh address is fine.
      expect((await post({ identifier: 'guru@demo.test', password: DEMO_PASSWORD }, '10.2.9.9')).status).toBe(200)
      // The 15-minute window passes.
      t.clock.advance(16 * 60_000)
      expect((await post({ identifier: id, password: DEMO_PASSWORD }, '10.2.9.9')).status).toBe(200)
    }, 120_000)
  })

  describe('L1 timing: an unknown identifier does the same kind of work as a migrated account', () => {
    it('runs a dummy legacy bcrypt of the configured cost', async () => {
      const t = await bootAuthApp({ env: { LEGACY_BCRYPT_DUMMY_COST: '12' } })
      try {
        const started = Date.now()
        const res = await t.http().post('/api/auth/login').send({ identifier: 'tiada@demo.test', password: 'Salah-1234' })
        expectError(res, 'INVALID_CREDENTIALS')
        expect(Date.now() - started).toBeGreaterThan(250) // cost 12 is about 1 s; argon2 alone is far less
      } finally {
        await t.close()
      }
    }, 60_000)
  })
})
