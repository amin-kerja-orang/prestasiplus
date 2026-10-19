import { AUTH_ERROR_MESSAGES, ErrorBodySchema, SessionSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { DEMO_ACCOUNTS } from '../../prisma/seed/core/identity'
import { bcryptHashWithSalt } from '../../src/modules/auth/legacy-bcrypt'
import {
  type AuthTestApp,
  bootAuthApp,
  cookieValue,
  DEMO_PASSWORD,
  expectError,
  loginAs,
  schoolIdOf,
  setCookieLine,
  userIdOf,
} from './helpers'

describe('POST /api/auth/login', () => {
  let t: AuthTestApp
  let school1: string
  let school2: string

  beforeAll(async () => {
    t = await bootAuthApp()
    school1 = await schoolIdOf(t.db, 'DEMO001')
    school2 = await schoolIdOf(t.db, 'DEMO002')
  })
  afterAll(async () => {
    await t.close()
  })

  const post = (body: unknown) => t.http().post('/api/auth/login').send(body as object)

  describe('AC1 success and failure cases', () => {
    it('logs in by e-mail: Session body, cookie flags, no token in the body, no-store', async () => {
      const res = await post({ identifier: 'pelajar@demo.test', password: DEMO_PASSWORD })
      expect(res.status).toBe(200)
      const session = SessionSchema.parse(res.body.data)
      expect(session.active).toMatchObject({ role: 'student', via: 'direct' })
      expect(session.mode).toBeNull()
      expect(session.user.email).toBe('pelajar@demo.test')
      const token = cookieValue(res)
      expect(token).toBeTruthy()
      const cookie = setCookieLine(res) as string
      expect(cookie).toMatch(/HttpOnly/i)
      expect(cookie).toMatch(/SameSite=Lax/i)
      expect(cookie).toMatch(/Path=\//)
      expect(JSON.stringify(res.body)).not.toContain(token as string)
      expect(Object.keys(res.body)).toEqual(['data'])
      expect(res.headers['cache-control']).toBe('no-store')
    })

    it('stores only the hash of the token and of the csrf value', async () => {
      const { token, csrf, db } = { ...(await loginAs(t, 'guru@demo.test')), db: t.db }
      const rows = await db.query<{ token_hash: string; csrf_hash: string }>(
        `select token_hash, csrf_hash from sessions where token_hash = encode(sha256($1::bytea), 'hex')`,
        [token],
      )
      expect(rows).toHaveLength(1)
      const stored = JSON.stringify(await db.query(`select * from sessions`))
      expect(stored).not.toContain(token)
      expect(stored).not.toContain(csrf)
    })

    it('matches the e-mail without regard to case and ignores schoolId for an e-mail', async () => {
      const res = await post({ identifier: '  PELAJAR@Demo.Test ', password: DEMO_PASSWORD, schoolId: school2 })
      expect(res.status).toBe(200)
      expect(SessionSchema.parse(res.body.data).user.schoolId).toBe(school1)
    })

    it('logs in by username with the school, and sets last_login_at', async () => {
      const res = await post({ identifier: 'MURID01', password: DEMO_PASSWORD, schoolId: school2 })
      expect(res.status).toBe(200)
      const session = SessionSchema.parse(res.body.data)
      expect(session.user).toMatchObject({ schoolId: school2, email: null, username: 'murid01' })
      const rows = await t.db.query<{ last_login_at: Date | null }>(
        `select last_login_at from users where school_id = $1 and lower(username) = 'murid01'`,
        [school2],
      )
      expect(rows[0]?.last_login_at).not.toBeNull()
    })

    it('422 AMBIGUOUS_USERNAME with the candidate schools when a username exists in two schools', async () => {
      const res = await post({ identifier: 'murid01', password: DEMO_PASSWORD })
      const err = expectError(res, 'AMBIGUOUS_USERNAME')
      expect(err.details).toEqual({
        schools: [
          { id: school1, name: 'SMK Demo Satu' },
          { id: school2, name: 'SK Demo Dua' },
        ],
      })
      expect(cookieValue(res)).toBeUndefined()
    })

    it('does not reveal an ambiguous username to a caller with the wrong password', async () => {
      const res = await post({ identifier: 'murid01', password: 'Salah-1234' })
      expectError(res, 'INVALID_CREDENTIALS')
    })

    it('401 INVALID_CREDENTIALS for a wrong password and an unknown school/username', async () => {
      expectError(await post({ identifier: 'pelajar@demo.test', password: 'Salah-1234' }), 'INVALID_CREDENTIALS')
      expectError(await post({ identifier: 'murid01', password: DEMO_PASSWORD, schoolId: '999999' }), 'INVALID_CREDENTIALS')
      expectError(await post({ identifier: 'murid01', password: DEMO_PASSWORD, schoolId: 'bukan-id' }), 'INVALID_CREDENTIALS')
    })

    it('treats SQL-looking identifiers as plain text', async () => {
      const res = await post({ identifier: "x' OR '1'='1", password: DEMO_PASSWORD })
      expectError(res, 'INVALID_CREDENTIALS')
    })

    it('403 ACCOUNT_INACTIVE for an inactive and for a suspended account, with the right password', async () => {
      const a = await post({ identifier: 'tidakaktif@demo.test', password: DEMO_PASSWORD })
      expectError(a, 'ACCOUNT_INACTIVE')
      expect(cookieValue(a)).toBeUndefined()
      expectError(await post({ identifier: 'digantung@demo.test', password: DEMO_PASSWORD }), 'ACCOUNT_INACTIVE')
      // The wrong password for an inactive account stays an ordinary credential failure.
      expectError(await post({ identifier: 'tidakaktif@demo.test', password: 'Salah-1234' }), 'INVALID_CREDENTIALS')
    })

    it('403 SCHOOL_INACTIVE when the school of the account is not active', async () => {
      await t.db.query(`update schools set is_active = false where code = 'DEMO002'`)
      try {
        const res = await post({ identifier: 'murid01', password: DEMO_PASSWORD, schoolId: school2 })
        expectError(res, 'SCHOOL_INACTIVE')
      } finally {
        await t.db.query(`update schools set is_active = true where code = 'DEMO002'`)
      }
    })

    it('a user without a password hash gets the same 401 as a wrong password', async () => {
      await t.db.query(
        `insert into users (name, email, school_id) select 'Tanpa Kata Laluan', 'tanpahash@demo.test', id from schools where code = 'DEMO001'`,
      )
      await t.db.query(
        `insert into user_roles (user_id, role) select id, 'student' from users where email = 'tanpahash@demo.test'`,
      )
      const res = await post({ identifier: 'tanpahash@demo.test', password: DEMO_PASSWORD })
      expectError(res, 'INVALID_CREDENTIALS')
    })

    it('422 VALIDATION_ERROR for a missing field, and for any unknown key such as scope or role', async () => {
      const missing = await post({ identifier: 'pelajar@demo.test' })
      expect(missing.status).toBe(422)
      expect(ErrorBodySchema.parse(missing.body).error.code).toBe('VALIDATION_ERROR')
      const extra = await post({
        identifier: 'pelajar@demo.test',
        password: DEMO_PASSWORD,
        scope: { level: 'national', label: 'x' },
      })
      expect(extra.status).toBe(422)
      expect(ErrorBodySchema.parse(extra.body).error.code).toBe('VALIDATION_ERROR')
      expect((await post({ identifier: 'pelajar@demo.test', password: DEMO_PASSWORD, role: 'admin' })).status).toBe(422)
    })

    it('a new login revokes the session the request still carried (new id on login)', async () => {
      const first = await loginAs(t, 'guru@demo.test')
      const again = await first.agent.post('/api/auth/login').send({ identifier: 'guru@demo.test', password: DEMO_PASSWORD })
      expect(again.status).toBe(200)
      expect(cookieValue(again)).not.toBe(first.token)
      const stale = await t.http().get('/api/session').set('Cookie', `pp_session=${first.token}`)
      expectError(stale, 'UNAUTHORIZED', 'Unauthenticated.')
    })
  })

  describe('AC2 no account enumeration', () => {
    it('a wrong password and an unknown identifier give identical responses except requestId', async () => {
      const wrong = await post({ identifier: 'pelajar@demo.test', password: 'Salah-1234' })
      const unknown = await post({ identifier: 'tiada.pengguna@demo.test', password: 'Salah-1234' })
      expectError(wrong, 'INVALID_CREDENTIALS', 'E-mel/Nama pengguna atau kata laluan tidak sah.')
      const strip = (body: { error: Record<string, unknown> }) => JSON.stringify({ error: { ...body.error, requestId: undefined } })
      expect(unknown.status).toBe(wrong.status)
      expect(strip(unknown.body)).toBe(strip(wrong.body))
      const headers = (r: typeof wrong) => ({ ...r.headers, 'x-request-id': '', date: '', etag: '', 'content-length': '' })
      expect(headers(unknown)).toEqual(headers(wrong))
    })
  })

  describe('AC3 throttle', () => {
    it('the 6th attempt is 429 even with the right password; retryAfter is 1..60 and sent as a header', async () => {
      const id = 'pelajar2@demo.test'
      for (let i = 0; i < 5; i++) expectError(await post({ identifier: id, password: 'Salah-1234' }), 'INVALID_CREDENTIALS')
      const blocked = await post({ identifier: id, password: DEMO_PASSWORD })
      const err = expectError(blocked, 'RATE_LIMITED', AUTH_ERROR_MESSAGES.RATE_LIMITED)
      expect(err.retryAfter).toBeGreaterThanOrEqual(1)
      expect(err.retryAfter).toBeLessThanOrEqual(60)
      expect(blocked.headers['retry-after']).toBe(String(err.retryAfter))
      expect(cookieValue(blocked)).toBeUndefined()

      // The window passes: the right password works again.
      t.clock.advance(61_000)
      expect((await post({ identifier: id, password: DEMO_PASSWORD })).status).toBe(200)
    })

    it('stores no raw identifier or address in login_attempts', async () => {
      await post({ identifier: 'pelajar2@demo.test', password: 'Salah-1234' })
      const rows = JSON.stringify(await t.db.query(`select * from login_attempts`))
      expect(rows).not.toContain('pelajar2')
      expect(rows).not.toContain('127.0.0.1')
    })

    it('a success resets the counter', async () => {
      const id = 'pelajarmaju@demo.test'
      for (let i = 0; i < 4; i++) await post({ identifier: id, password: 'Salah-1234' })
      expect((await post({ identifier: id, password: DEMO_PASSWORD })).status).toBe(200)
      for (let i = 0; i < 4; i++) expectError(await post({ identifier: id, password: 'Salah-1234' }), 'INVALID_CREDENTIALS')
      expect((await post({ identifier: id, password: DEMO_PASSWORD })).status).toBe(200)
    })

    it('a refusal for an inactive account does not count as a failed attempt', async () => {
      for (let i = 0; i < 8; i++) {
        expectError(await post({ identifier: 'tidakaktif@demo.test', password: DEMO_PASSWORD }), 'ACCOUNT_INACTIVE')
      }
    })

    it('another identifier is not affected by a blocked one', async () => {
      const id = 'digantung@demo.test'
      for (let i = 0; i < 6; i++) await post({ identifier: id, password: 'Salah-1234' })
      expectError(await post({ identifier: id, password: 'Salah-1234' }), 'RATE_LIMITED')
      expect((await post({ identifier: 'admin@demo.test', password: DEMO_PASSWORD })).status).toBe(200)
    })

    it('the limit follows THROTTLE_LOGIN_PER_MINUTE', async () => {
      const small = await bootAuthApp({ db: t.db, env: { THROTTLE_LOGIN_PER_MINUTE: '2' } })
      try {
        const p = (body: object) => small.http().post('/api/auth/login').send(body)
        const id = 'adminsekolah@demo.test'
        expectError(await p({ identifier: id, password: 'Salah-1234' }), 'INVALID_CREDENTIALS')
        expectError(await p({ identifier: id, password: 'Salah-1234' }), 'INVALID_CREDENTIALS')
        expectError(await p({ identifier: id, password: DEMO_PASSWORD }), 'RATE_LIMITED')
      } finally {
        await small.app.close()
      }
    })
  })

  describe('AC8 legacy bcrypt hash', () => {
    it('verifies a $2y$ hash and rehashes it to argon2id on the first successful login', async () => {
      const legacy = bcryptHashWithSalt('Warisan-Lama-9', 'abcdefghijklmnopqrstuu', 4, '2y')
      expect(legacy).toMatch(/^\$2y\$04\$/)
      const id = await userIdOf(t.db, 'guru@demo.test')
      const original = (await t.db.query<{ password_hash: string }>(`select password_hash from users where id = $1`, [id]))[0]?.password_hash
      await t.db.query(`update users set password_hash = $1 where id = $2`, [legacy, id])

      expectError(await post({ identifier: 'guru@demo.test', password: 'Salah-1234' }), 'INVALID_CREDENTIALS')
      const stillLegacy = await t.db.query<{ password_hash: string }>(`select password_hash from users where id = $1`, [id])
      expect(stillLegacy[0]?.password_hash).toBe(legacy)

      const res = await post({ identifier: 'guru@demo.test', password: 'Warisan-Lama-9' })
      expect(res.status).toBe(200)
      const after = await t.db.query<{ password_hash: string }>(`select password_hash from users where id = $1`, [id])
      expect(after[0]?.password_hash).toMatch(/^\$argon2id\$/)
      expect(after[0]?.password_hash).not.toContain('Warisan')

      // The new hash is what verifies from now on.
      expect((await post({ identifier: 'guru@demo.test', password: 'Warisan-Lama-9' })).status).toBe(200)
      expectError(await post({ identifier: 'guru@demo.test', password: DEMO_PASSWORD }), 'INVALID_CREDENTIALS')
      await t.db.query(`update users set password_hash = $1 where id = $2`, [original, id]) // later tests use the demo password
    })
  })

  describe('AC10 every seeded demo account', () => {
    const LANDING = { admin: '/admin', school_admin: '/admin', teacher: '/dashboard', student: '/dashboard' } as const
    const usable = DEMO_ACCOUNTS.filter((a) => a.isActive !== false && a.isSuspended !== true)

    it.each(usable.map((a) => [a.email ?? `${a.username}@${a.schoolCode}`, a] as const))(
      'logs in %s with the demo password and gets the landing path and scope of its role',
      async (_label, account) => {
        const schoolId = account.schoolCode ? await schoolIdOf(t.db, account.schoolCode) : undefined
        const identifier = account.email ?? (account.username as string)
        const res = await t.http().post('/api/auth/login').send({
          identifier,
          password: DEMO_PASSWORD,
          ...(account.email ? {} : { schoolId }),
        })
        expect(res.status, JSON.stringify(res.body)).toBe(200)
        const s = SessionSchema.parse(res.body.data)
        const first = (['admin', 'school_admin', 'teacher', 'student'] as const).find((r) => account.roles.includes(r))!
        expect(s.active.role).toBe(first)
        expect(s.landingPath).toBe(LANDING[first])
        expect(s.roles.map((g) => g.role).sort()).toEqual([...account.roles].sort())
        if (first === 'admin') expect(s.active.scope).toEqual({ level: 'national', label: 'Seluruh Negara' })
        else if (first === 'student') expect(s.active.scope.level).toBe('self')
        else expect(s.active.scope).toMatchObject({ level: 'school', schoolId, label: 'SMK Demo Satu' })
        // Capabilities exist only for the Pentadbiran roles.
        if (first === 'admin' || first === 'school_admin') expect(s.capabilities.length).toBeGreaterThan(0)
        else expect(s.capabilities).toEqual([])
        t.clock.advance(61_000) // keep the shared client address clear of the throttle
      },
    )

    it('the inactive and the suspended demo accounts get 403 ACCOUNT_INACTIVE', async () => {
      for (const email of ['tidakaktif@demo.test', 'digantung@demo.test']) {
        expectError(await post({ identifier: email, password: DEMO_PASSWORD }), 'ACCOUNT_INACTIVE')
      }
    })
  })
})
