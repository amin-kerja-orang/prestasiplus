import { ApiError } from '../../src/common/errors/api-error'
import { SessionSchema } from '@pp/contract'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

import { DEMO_ACCOUNTS } from '../../prisma/seed/core/identity'
import { AuthService } from '../../src/modules/auth/auth.service'
import type { ResolvedSession } from '../../src/modules/auth/session-resolver.service'

import {
  type AuthTestApp,
  bootAuthApp,
  cookieValue,
  COOKIE_NAME,
  DEMO_PASSWORD,
  expectError,
  loginAs,
  schoolIdOf,
  setCookieLine,
  userIdOf,
} from './helpers'

const MIN = 60_000

describe('session endpoints', () => {
  let t: AuthTestApp

  beforeAll(async () => {
    t = await bootAuthApp()
  })
  afterAll(async () => {
    await t.close()
  })

  /** Each test gets a fresh throttle window for the shared client address. */
  const login = async (email: string, remember = false) => {
    t.clock.advance(2 * MIN)
    return loginAs(t, email, { remember })
  }
  const withCookie = (token: string) => ({ Cookie: `${COOKIE_NAME}=${token}` })

  describe('GET /api/session and logout', () => {
    it('401 UNAUTHORIZED without a session, 200 with the same Session (csrf included) after login', async () => {
      expectError(await t.http().get('/api/session'), 'UNAUTHORIZED', 'Unauthenticated.')
      const me = await login('adminsekolah@demo.test')
      const res = await me.agent.get('/api/session')
      expect(res.status).toBe(200)
      expect(SessionSchema.parse(res.body.data)).toEqual(me.session)
      expect(res.headers['cache-control']).toBe('no-store')
    })

    it('logout invalidates the session server-side; the old cookie then gets 401', async () => {
      const me = await login('guru@demo.test')
      const out = await me.agent.post('/api/auth/logout').set('X-CSRF-Token', me.csrf)
      expect(out.status).toBe(204)
      expect(out.text).toBe('')
      expect(setCookieLine(out)).toMatch(/Expires=Thu, 01 Jan 1970/)
      expectError(await t.http().get('/api/session').set(withCookie(me.token)), 'UNAUTHORIZED')
      const rows = await t.db.query<{ revoked_at: Date | null }>(`select revoked_at from sessions where user_id = $1`, [
        await userIdOf(t.db, 'guru@demo.test'),
      ])
      expect(rows.every((r) => r.revoked_at !== null)).toBe(true)
    })

    it('logout is idempotent: 204 with no session and with a dead cookie', async () => {
      expect((await t.http().post('/api/auth/logout')).status).toBe(204)
      const me = await login('guru@demo.test')
      await me.agent.post('/api/auth/logout').set('X-CSRF-Token', me.csrf).expect(204)
      expect((await t.http().post('/api/auth/logout').set(withCookie(me.token))).status).toBe(204)
    })
  })

  describe('AC4 session id and lifetime', () => {
    it('the session id changes on role switch and on mode change (old cookie stops working)', async () => {
      const me = await login('guruadmin@demo.test')
      const switched = await me.agent.post('/api/session/role').set('X-CSRF-Token', me.csrf).send({ role: 'teacher' })
      expect(switched.status).toBe(200)
      const t2 = cookieValue(switched) as string
      expect(t2).not.toBe(me.token)
      expectError(await t.http().get('/api/session').set(withCookie(me.token)), 'UNAUTHORIZED')
      expect((await t.http().get('/api/session').set(withCookie(t2))).status).toBe(200)

      const csrf2 = SessionSchema.parse(switched.body.data).csrf
      expect(csrf2).not.toBe(me.csrf)
      const back = await me.agent.post('/api/session/role').set('X-CSRF-Token', csrf2).send({ role: 'school_admin' })
      const t3 = cookieValue(back) as string
      const mode = await me.agent
        .post('/api/session/mode')
        .set('X-CSRF-Token', SessionSchema.parse(back.body.data).csrf)
        .send({ mode: 'mod_pelajar' })
      expect(mode.status).toBe(200)
      expect(cookieValue(mode)).not.toBe(t3)
      expectError(await t.http().get('/api/session').set(withCookie(t3)), 'UNAUTHORIZED')
    })

    it('without remember: 120 minutes sliding, moved at most once per minute', async () => {
      const me = await login('pelajar@demo.test')
      const row = async () =>
        (await t.db.query<{ expires_at: Date; last_seen_at: Date }>(
          `select expires_at, last_seen_at from sessions where token_hash = encode(sha256($1::bytea), 'hex')`,
          [me.token],
        ))[0]!
      const start = t.clock.now().getTime()
      expect((await row()).expires_at.getTime()).toBe(start + 120 * MIN)
      expect(setCookieLine(me.res)).toMatch(/Max-Age=7200/)

      // Within a minute nothing is written.
      t.clock.advance(30_000)
      await me.agent.get('/api/session').expect(200)
      expect((await row()).expires_at.getTime()).toBe(start + 120 * MIN)

      // After a minute the expiry slides and the cookie is re-sent.
      t.clock.advance(31_000)
      const slid = await me.agent.get('/api/session')
      expect(slid.status).toBe(200)
      expect((await row()).expires_at.getTime()).toBe(t.clock.now().getTime() + 120 * MIN)
      expect(setCookieLine(slid)).toMatch(/Max-Age=7200/)

      // 119 minutes idle is still fine, and slides again.
      t.clock.advance(119 * MIN)
      await me.agent.get('/api/session').expect(200)
      // 120 minutes idle is over.
      t.clock.advance(120 * MIN)
      expectError(await me.agent.get('/api/session'), 'UNAUTHORIZED')
    })

    const DAY = 24 * 60 * MIN
    const expiresOf = async (token: string) =>
      (await t.db.query<{ expires_at: Date }>(
        `select expires_at from sessions where token_hash = encode(sha256($1::bytea), 'hex')`,
        [token],
      ))[0]!.expires_at.getTime()

    it('with remember: 30 days for a learner, no sliding, 401 afterwards', async () => {
      const me = await login('pelajar2@demo.test', true)
      const created = t.clock.now().getTime()
      expect(await expiresOf(me.token)).toBe(created + 30 * DAY)
      expect(setCookieLine(me.res)).toMatch(new RegExp(`Max-Age=${30 * 24 * 60 * 60}`))

      t.clock.advance(20 * DAY)
      await me.agent.get('/api/session').expect(200)
      expect(await expiresOf(me.token)).toBe(created + 30 * DAY) // did not slide

      t.clock.advance(11 * DAY)
      expectError(await me.agent.get('/api/session'), 'UNAUTHORIZED')
    })

    it('with remember: admin and school_admin are capped at 1 day', async () => {
      for (const email of ['admin@demo.test', 'adminsekolah@demo.test']) {
        const me = await login(email, true)
        const created = t.clock.now().getTime()
        expect(await expiresOf(me.token)).toBe(created + DAY)
        t.clock.advance(23 * 60 * MIN)
        await me.agent.get('/api/session').expect(200)
        t.clock.advance(2 * 60 * MIN)
        expectError(await me.agent.get('/api/session'), 'UNAUTHORIZED')
      }
    })

    it('with remember: a teacher + school_admin account gets the staff cap, also after a role switch', async () => {
      const me = await login('guruadmin@demo.test', true)
      const created = t.clock.now().getTime()
      expect(await expiresOf(me.token)).toBe(created + DAY)
      const sw = await me.agent.post('/api/session/role').set('X-CSRF-Token', me.csrf).send({ role: 'teacher' })
      expect(await expiresOf(cookieValue(sw) as string)).toBe(created + DAY) // rotation keeps the expiry
    })

    it('SESSION_REMEMBER_DAYS and SESSION_REMEMBER_DAYS_STAFF are honoured; the staff value never exceeds the general one', async () => {
      const custom = await bootAuthApp({ db: t.db, env: { SESSION_REMEMBER_DAYS: '7', SESSION_REMEMBER_DAYS_STAFF: '3' } })
      const capped = await bootAuthApp({ db: t.db, env: { SESSION_REMEMBER_DAYS: '2', SESSION_REMEMBER_DAYS_STAFF: '10' } })
      try {
        const days = async (app: AuthTestApp, email: string) => {
          const res = await app.http().post('/api/auth/login').send({ identifier: email, password: DEMO_PASSWORD, remember: true })
          expect(res.status).toBe(200)
          return (await expiresOf(cookieValue(res) as string)) - app.clock.now().getTime()
        }
        expect(await days(custom, 'guru@demo.test')).toBe(7 * DAY)
        expect(await days(custom, 'admin@demo.test')).toBe(3 * DAY)
        expect(await days(capped, 'admin@demo.test')).toBe(2 * DAY)
      } finally {
        await custom.app.close()
        await capped.app.close()
      }
    })
  })

  describe('AC5 CSRF', () => {
    it('a mutating request with a valid session and a missing or wrong X-CSRF-Token is 403 CSRF_INVALID', async () => {
      const me = await login('guruadmin@demo.test')
      expectError(await me.agent.post('/api/session/role').send({ role: 'teacher' }), 'CSRF_INVALID')
      expectError(await me.agent.post('/api/session/role').set('X-CSRF-Token', 'salah').send({ role: 'teacher' }), 'CSRF_INVALID')
      expectError(await me.agent.post('/api/session/mode').send({ mode: 'mod_pelajar' }), 'CSRF_INVALID')
      expectError(await me.agent.delete('/api/session/mode'), 'CSRF_INVALID')
      expectError(await me.agent.post('/api/auth/logout'), 'CSRF_INVALID')
      // Nothing changed, the session still works, and GET needs no token.
      const res = await me.agent.get('/api/session')
      expect(res.status).toBe(200)
      expect(res.body.data.active.role).toBe('school_admin')
    })

    it('the csrf of another session is rejected', async () => {
      const a = await login('guruadmin@demo.test')
      const b = await login('adminsekolah@demo.test')
      expectError(await a.agent.post('/api/session/role').set('X-CSRF-Token', b.csrf).send({ role: 'teacher' }), 'CSRF_INVALID')
    })

    it('without a session a mutating request is 401, not 403', async () => {
      expectError(await t.http().post('/api/session/role').send({ role: 'teacher' }), 'UNAUTHORIZED')
    })
  })

  describe('POST /api/session/role', () => {
    it('switches to another role of the account and returns that role portal, scope and landing', async () => {
      const me = await login('guruadmin@demo.test')
      expect(me.session.active.role).toBe('school_admin')
      expect(me.session.roles.map((g) => g.role)).toEqual(['school_admin', 'teacher'])
      const res = await me.agent.post('/api/session/role').set('X-CSRF-Token', me.csrf).send({ role: 'teacher' })
      expect(res.status).toBe(200)
      const s = SessionSchema.parse(res.body.data)
      expect(s.active).toMatchObject({ role: 'teacher', portal: 'pembelajaran', via: 'direct' })
      expect(s.capabilities).toEqual([]) // the active role only, never the union
      expect(s.landingPath).toBe('/dashboard')
      expect(s.roles).toHaveLength(2)
      const audit = await t.db.query<{ detail: Record<string, unknown>; actor_role: string }>(
        `select detail, actor_role from audit_events where action = 'session.role.switched' order by id desc limit 1`,
      )
      expect(audit[0]?.actor_role).toBe('teacher')
      expect(audit[0]?.detail).toMatchObject({ from: 'school_admin', to: 'teacher' })
    })

    it('403 ROLE_NOT_ALLOWED for a role the account does not hold', async () => {
      const me = await login('guruadmin@demo.test')
      expectError(await me.agent.post('/api/session/role').set('X-CSRF-Token', me.csrf).send({ role: 'admin' }), 'ROLE_NOT_ALLOWED')
      const student = await login('pelajar@demo.test')
      expectError(
        await student.agent.post('/api/session/role').set('X-CSRF-Token', student.csrf).send({ role: 'teacher' }),
        'ROLE_NOT_ALLOWED',
      )
    })

    it('422 for an unknown role and for a client scope (strict body)', async () => {
      const me = await login('guruadmin@demo.test')
      const set = (b: object) => me.agent.post('/api/session/role').set('X-CSRF-Token', me.csrf).send(b)
      expectError(await set({ role: 'wizard' }), 'VALIDATION_ERROR', 'The given data was invalid.')
      expectError(
        await set({ role: 'teacher', scope: { level: 'national', label: 'Seluruh Negara' } }),
        'VALIDATION_ERROR',
        'The given data was invalid.',
      )
    })

    it('409 MODE_ACTIVE while Mod Pelajar is on', async () => {
      const me = await login('guruadmin@demo.test')
      const mode = await me.agent.post('/api/session/mode').set('X-CSRF-Token', me.csrf).send({ mode: 'mod_pelajar' })
      const csrf = SessionSchema.parse(mode.body.data).csrf
      expectError(await me.agent.post('/api/session/role').set('X-CSRF-Token', csrf).send({ role: 'teacher' }), 'MODE_ACTIVE')
    })
  })

  describe('POST and DELETE /api/session/mode', () => {
    it('admin enters Mod Pelajar (student, self, via mod_pelajar, isTest) and leaves it again', async () => {
      const me = await login('admin@demo.test')
      const entered = await me.agent.post('/api/session/mode').set('X-CSRF-Token', me.csrf).send({ mode: 'mod_pelajar' })
      expect(entered.status).toBe(200)
      const s = SessionSchema.parse(entered.body.data)
      expect(s.active).toMatchObject({ role: 'student', portal: 'pembelajaran', via: 'mod_pelajar' })
      expect(s.active.scope.level).toBe('self')
      expect(s.mode).toMatchObject({ kind: 'mod_pelajar', returnRole: 'admin', isTest: true })
      expect(s.roles.map((g) => g.role)).toEqual(['admin'])
      expect(s.capabilities).toEqual([])
      expect(s.landingPath).toBe('/dashboard')

      expectError(await me.agent.post('/api/session/mode').set('X-CSRF-Token', s.csrf).send({ mode: 'mod_pelajar' }), 'MODE_ALREADY_ACTIVE')

      const left = await me.agent.delete('/api/session/mode').set('X-CSRF-Token', s.csrf)
      expect(left.status).toBe(200)
      const back = SessionSchema.parse(left.body.data)
      expect(back.active).toMatchObject({ role: 'admin', via: 'direct' })
      expect(back.mode).toBeNull()
      expect(back.landingPath).toBe('/admin')

      expectError(await me.agent.delete('/api/session/mode').set('X-CSRF-Token', back.csrf), 'NO_MODE_ACTIVE')
      const audits = await t.db.query<{ action: string }>(
        `select action from audit_events where action in ('session.mode.entered','session.mode.exited') order by id`,
      )
      expect(audits.slice(-2).map((a) => a.action)).toEqual(['session.mode.entered', 'session.mode.exited'])
    })

    it('403 MODE_NOT_ALLOWED for teacher, student and a dual-role account acting as teacher', async () => {
      const student = await login('pelajar@demo.test')
      expectError(await student.agent.post('/api/session/mode').set('X-CSRF-Token', student.csrf).send({ mode: 'mod_pelajar' }), 'MODE_NOT_ALLOWED')
      const teacher = await login('guru@demo.test')
      expectError(await teacher.agent.post('/api/session/mode').set('X-CSRF-Token', teacher.csrf).send({ mode: 'mod_pelajar' }), 'MODE_NOT_ALLOWED')
      const dual = await login('guruadmin@demo.test')
      const sw = await dual.agent.post('/api/session/role').set('X-CSRF-Token', dual.csrf).send({ role: 'teacher' })
      expectError(
        await dual.agent.post('/api/session/mode').set('X-CSRF-Token', SessionSchema.parse(sw.body.data).csrf).send({ mode: 'mod_pelajar' }),
        'MODE_NOT_ALLOWED',
      )
    })

    it('422 for an unknown mode and for extra keys', async () => {
      const me = await login('admin@demo.test')
      const set = (b: object) => me.agent.post('/api/session/mode').set('X-CSRF-Token', me.csrf).send(b)
      expectError(await set({ mode: 'sandbox' }), 'VALIDATION_ERROR')
      expectError(await set({ mode: 'mod_pelajar', userId: '1' }), 'VALIDATION_ERROR')
    })

    it('the audit rows hold ids and codes only', async () => {
      const rows = JSON.stringify(await t.db.query(`select * from audit_events`))
      expect(rows).not.toContain(DEMO_PASSWORD)
      expect(rows).not.toMatch(/@demo\.test/)
      expect(rows).not.toContain('127.0.0.1')
    })
  })

  describe('AC11 permission changes apply on the next request', () => {
    /** Puts every row these tests change back to the seeded state, even when a test fails half way. */
    afterEach(async () => {
      await t.db.query(`update schools set is_active = true`)
      for (const a of DEMO_ACCOUNTS) {
        const where = a.email ? `lower(email) = '${a.email}'` : `email is null and lower(username) = '${a.username}'`
        await t.db.query(
          `update users set is_active = $1, is_suspended = $2,
             school_id = (select id from schools where code = $3) where ${where}`,
          [a.isActive ?? true, a.isSuspended ?? false, a.schoolCode],
        )
        if (a.email) {
          await t.db.query(
            `delete from user_roles where user_id = (select id from users where lower(email) = $1) and role <> all($2::text[])`,
            [a.email, [...a.roles]],
          )
          for (const role of a.roles) {
            await t.db.query(
              `insert into user_roles (user_id, role) select id, $2 from users where lower(email) = $1 on conflict do nothing`,
              [a.email, role],
            )
          }
        }
      }
      await t.db.query(`delete from user_scopes where role <> 'admin'`)
    })

    it('a changed school shows the new scope and label at once', async () => {
      const me = await login('guru@demo.test')
      expect(me.session.active.scope).toMatchObject({ level: 'school', label: 'SMK Demo Satu' })
      const school2 = await schoolIdOf(t.db, 'DEMO002')
      await t.db.query(`update users set school_id = $1 where email = 'guru@demo.test'`, [school2])
      const res = await me.agent.get('/api/session')
      expect(res.status).toBe(200)
      expect(res.body.data.active.scope).toMatchObject({ level: 'school', schoolId: school2, label: 'SK Demo Dua' })
      expect(res.body.data.user.schoolId).toBe(school2)
      await t.db.query(`update users set school_id = (select id from schools where code = 'DEMO001') where email = 'guru@demo.test'`)
    })

    it('a stored scope row wins over the school column', async () => {
      const me = await login('adminsekolah@demo.test')
      const school2 = await schoolIdOf(t.db, 'DEMO002')
      await t.db.query(
        `insert into user_scopes (user_id, role, level, school_id) select id, 'school_admin', 'school', $1 from users where email = 'adminsekolah@demo.test'`,
        [school2],
      )
      const res = await me.agent.get('/api/session')
      expect(res.body.data.active.scope).toMatchObject({ schoolId: school2, label: 'SK Demo Dua' })
      await t.db.query(`delete from user_scopes where role = 'school_admin'`)
    })

    it('a removed role shows the new role list and falls back to a role the account still has', async () => {
      const me = await login('guruadmin@demo.test')
      expect(me.session.capabilities.length).toBeGreaterThan(0)
      await t.db.query(
        `delete from user_roles where role = 'school_admin' and user_id = (select id from users where email = 'guruadmin@demo.test')`,
      )
      const res = await me.agent.get('/api/session')
      expect(res.status).toBe(200)
      expect(res.body.data.roles.map((g: { role: string }) => g.role)).toEqual(['teacher'])
      expect(res.body.data.active.role).toBe('teacher')
      expect(res.body.data.capabilities).toEqual([])
      await t.db.query(
        `insert into user_roles (user_id, role) select id, 'school_admin' from users where email = 'guruadmin@demo.test'`,
      )
    })

    it('a mode that the account may no longer use is dropped', async () => {
      const me = await login('adminsekolah@demo.test')
      await me.agent.post('/api/session/mode').set('X-CSRF-Token', me.csrf).send({ mode: 'mod_pelajar' }).expect(200)
      await t.db.query(
        `update user_roles set role = 'teacher' where user_id = (select id from users where email = 'adminsekolah@demo.test')`,
      )
      const res = await me.agent.get('/api/session')
      expect(res.body.data.mode).toBeNull()
      expect(res.body.data.active.role).toBe('teacher')
      await t.db.query(
        `update user_roles set role = 'school_admin' where user_id = (select id from users where email = 'adminsekolah@demo.test')`,
      )
    })

    it('a deactivated account gets 401 on the next request, and so does a suspended one', async () => {
      const a = await login('pelajarmaju@demo.test')
      await t.db.query(`update users set is_active = false where email = 'pelajarmaju@demo.test'`)
      expectError(await a.agent.get('/api/session'), 'UNAUTHORIZED')
      await t.db.query(`update users set is_active = true where email = 'pelajarmaju@demo.test'`)
      expectError(await a.agent.get('/api/session'), 'UNAUTHORIZED') // the session is gone for good

      const b = await login('pelajar2@demo.test')
      await t.db.query(`update users set is_suspended = true where email = 'pelajar2@demo.test'`)
      expectError(await b.agent.get('/api/session'), 'UNAUTHORIZED')
      await t.db.query(`update users set is_suspended = false where email = 'pelajar2@demo.test'`)
    })

    it('a deactivated school ends the sessions of its users', async () => {
      const me = await login('guru@demo.test')
      await t.db.query(`update schools set is_active = false where code = 'DEMO001'`)
      expectError(await me.agent.get('/api/session'), 'UNAUTHORIZED')
      await t.db.query(`update schools set is_active = true where code = 'DEMO001'`)
    })

    it('a user whose roles became invalid (student plus teacher) cannot keep a session', async () => {
      const me = await login('pelajar@demo.test')
      await t.db.query(
        `insert into user_roles (user_id, role) select id, 'teacher' from users where email = 'pelajar@demo.test'`,
      )
      expectError(await me.agent.get('/api/session'), 'UNAUTHORIZED')
      await t.db.query(
        `delete from user_roles where role = 'teacher' and user_id = (select id from users where email = 'pelajar@demo.test')`,
      )
    })
  })
})

describe('session rotation race', () => {
  it('a rotation that lost to a parallel request answers 401 (no second session is created)', async () => {
    const rotated: unknown[] = []
    const service = new AuthService(
      { transaction: (fn: () => Promise<unknown>) => fn() } as never,
      { now: () => new Date() },
      { secret: 'x' } as never,
      {} as never,
      {} as never,
      {} as never,
      { regenerate: async () => (rotated.push(1), null) } as never,
      { record: async () => undefined } as never,
    )
    const state = {
      auth: { mode: null, userId: '1' },
      grants: [{ role: 'admin' }, { role: 'teacher' }],
      assembled: { baseRole: 'admin', mode: null, grants: [] },
      row: {},
      account: {},
    } as unknown as ResolvedSession
    const err = await service
      .switchRole(state, 'teacher', { ip: '::1', userAgent: null, requestId: null })
      .catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect((err as ApiError).code).toBe('UNAUTHORIZED')
    expect(rotated).toHaveLength(1)
  })

  it('two parallel role switches with the same cookie: one wins, the other is refused', async () => {
    const t = await bootAuthApp()
    try {
      const me = await loginAs(t, 'guruadmin@demo.test')
      const one = () => t.http().post('/api/session/role').set('Cookie', `${COOKIE_NAME}=${me.token}`).set('X-CSRF-Token', me.csrf).send({ role: 'teacher' })
      const results = await Promise.all([one(), one(), one()])
      const statuses = results.map((r) => r.status).sort()
      expect(statuses.filter((s) => s === 200)).toHaveLength(1)
      expect(statuses.filter((s) => s === 401)).toHaveLength(2)
      const live = await t.db.query(`select 1 from sessions where revoked_at is null`)
      expect(live).toHaveLength(1)
    } finally {
      await t.close()
    }
  })
})
