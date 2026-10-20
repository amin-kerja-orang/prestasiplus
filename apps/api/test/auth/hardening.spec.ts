import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { LoginThrottle } from '../../src/modules/auth/login-throttle.service'
import { bcryptHashWithSalt, LegacyBcryptPool } from '../../src/modules/auth/legacy-bcrypt'
import { type AuthTestApp, bootAuthApp, DEMO_PASSWORD, expectError } from './helpers'

const SALT = 'abcdefghijklmnopqrstuu'

describe('N1 failure latency floor', () => {
  let t: AuthTestApp
  beforeAll(async () => {
    t = await bootAuthApp({ env: { LOGIN_FAILURE_FLOOR_MS: '500' } })
    await t.db.query(`insert into users (name, email) values ('Tanpa Hash', 'tanpahash@demo.test')`)
  })
  afterAll(async () => {
    await t.close()
  })

  it('wrong password, unknown identifier and a user without a hash all take at least the floor', async () => {
    for (const identifier of ['guru@demo.test', 'tiada@demo.test', 'tanpahash@demo.test']) {
      t.clock.advance(120_000)
      const started = Date.now()
      const res = await t.http().post('/api/auth/login').send({ identifier, password: 'Salah-1234' })
      expectError(res, 'INVALID_CREDENTIALS')
      expect(Date.now() - started, identifier).toBeGreaterThanOrEqual(450)
    }
  })

  it('a successful login and an inactive-account refusal are not credential failures (no floor, no 401)', async () => {
    t.clock.advance(120_000)
    expect((await t.http().post('/api/auth/login').send({ identifier: 'guru@demo.test', password: DEMO_PASSWORD })).status).toBe(200)
    expectError(await t.http().post('/api/auth/login').send({ identifier: 'tidakaktif@demo.test', password: DEMO_PASSWORD }), 'ACCOUNT_INACTIVE')
  })
})

describe('N3 ceilings are reserved before the work', () => {
  let t: AuthTestApp
  // A roomy queue: this test is about the address ceiling, not about the hashing queue.
  const pool = new LegacyBcryptPool({ size: 2, maxQueue: 100 })
  beforeAll(async () => {
    t = await bootAuthApp({ pool })
  })
  afterAll(async () => {
    await t.close()
    await pool.onModuleDestroy()
  })

  it('a burst of parallel failures cannot pass the per-address ceiling (exactly 20 get through)', async () => {
    const results = await Promise.all(
      Array.from({ length: 30 }, (_, i) =>
        t.http().post('/api/auth/login').send({ identifier: `burst${i}@demo.test`, password: 'Salah-1234' }),
      ),
    )
    const count = (status: number) => results.filter((r) => r.status === status).length
    expect(count(401)).toBe(20)
    expect(count(429)).toBe(10)
  })

  it('successful and non-credential outcomes give the reserved unit back', async () => {
    t.clock.advance(120_000)
    for (let i = 0; i < 3; i++) {
      t.clock.advance(1_000)
      expect((await t.http().post('/api/auth/login').send({ identifier: 'guru@demo.test', password: DEMO_PASSWORD })).status).toBe(200)
    }
    await t.http().post('/api/auth/login').send({ identifier: 'tidakaktif@demo.test', password: DEMO_PASSWORD })
    const rows = await t.db.query<{ attempts: number }>(
      `select attempts from login_attempts where identifier_hash = 'any-identifier' and expires_at > $1`,
      [t.clock.now()],
    )
    expect(rows[0]?.attempts).toBe(0)
  })

  it('a failure to write the global counters never turns a 401 into a 500', async () => {
    t.clock.advance(120_000)
    const spy = vi.spyOn(LoginThrottle.prototype, 'fail').mockRejectedValue(new Error('db down'))
    try {
      expectError(await t.http().post('/api/auth/login').send({ identifier: 'guru@demo.test', password: 'Salah-1234' }), 'INVALID_CREDENTIALS')
      expect(spy).toHaveBeenCalled()
    } finally {
      spy.mockRestore()
    }
  })
})

describe('N3 legacy bcrypt work per request', () => {
  it('only the first 3 legacy accounts of a username login are checked; the rest count as failed', async () => {
    const t = await bootAuthApp()
    try {
      const hash = bcryptHashWithSalt('Kata-Sama-1', SALT, 4, '2y')
      for (let i = 1; i <= 5; i++) {
        await t.db.query(`insert into schools (name, code) values ($1, $2)`, [`Sekolah Sama ${i}`, `SAMA00${i}`])
        await t.db.query(
          `insert into users (name, username, school_id, password_hash)
             select $1, 'sama', id, $2 from schools where code = $3`,
          [`Murid Sama ${i}`, hash, `SAMA00${i}`],
        )
        await t.db.query(`insert into user_roles (user_id, role) select id, 'student' from users where name = $1`, [`Murid Sama ${i}`])
      }
      const res = await t.http().post('/api/auth/login').send({ identifier: 'sama', password: 'Kata-Sama-1' })
      const err = expectError(res, 'AMBIGUOUS_USERNAME')
      expect((err.details as { schools: unknown[] }).schools).toHaveLength(3)
    } finally {
      await t.close()
    }
  })

  it('a full hashing queue answers 429 and gives the attempt back (pair and address counters)', async () => {
    const pool = new LegacyBcryptPool({ size: 1, maxQueue: 0 })
    const t = await bootAuthApp({ pool })
    try {
      await t.db.query(`update users set password_hash = $1 where email = 'guru@demo.test'`, [bcryptHashWithSalt(DEMO_PASSWORD, SALT, 4, '2y')])
      const busy = pool.hash('x', SALT, 11, '2y') // occupies the only worker for about half a second
      const res = await t.http().post('/api/auth/login').send({ identifier: 'guru@demo.test', password: DEMO_PASSWORD })
      const err = expectError(res, 'RATE_LIMITED')
      expect(err.retryAfter).toBe(5)
      await busy
      const rows = await t.db.query<{ attempts: number }>(`select attempts from login_attempts order by id`)
      expect(rows.every((r) => r.attempts === 0)).toBe(true)
      // The same login works once the worker is free.
      expect((await t.http().post('/api/auth/login').send({ identifier: 'guru@demo.test', password: DEMO_PASSWORD })).status).toBe(200)
    } finally {
      await t.close()
      await pool.onModuleDestroy()
    }
  }, 60_000)
})
