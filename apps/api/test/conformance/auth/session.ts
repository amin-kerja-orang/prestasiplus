import { sessionLogin, type Scenario } from '@pp/contract-tests'

import { DUAL_ROLE_ACCOUNT, DEMO_PASSWORD } from '../accounts'
import { API_ONLY, dataOf, errorOf, expectError } from '../helpers'

/**
 * BE-03 auth and session scenarios (BE-31 AC1): login success, wrong password, unknown user
 * (identical response), throttle (6th attempt 429 with `retryAfter`), role switch, Mod Pelajar
 * enter and exit, logout, and a missing CSRF token (403 `CSRF_INVALID`).
 *
 * They need a cookie session with a CSRF token that rotates, which the frontend mock does not have
 * (it uses Bearer tokens and has no `/session`), so they run on the API target only; the shared
 * `auth/*` smoke scenarios of `@pp/contract-tests` run on both.
 */
export const authSessionScenarios: Scenario[] = [
  {
    id: 'auth-api/login success sets a session cookie and returns the Session',
    domain: 'auth',
    targets: API_ONLY,
    async run(ctx) {
      const res = await ctx.anonymous().request('POST', '/auth/login', {
        body: { ...ctx.credentials('student'), remember: false },
      })
      ctx.expectStatus(res, 200)
      const cookie = res.headers['set-cookie'] ?? ''
      ctx.check(/pp_session=[^;]+/.test(cookie), 'login did not set the pp_session cookie')
      ctx.check(/httponly/i.test(cookie), 'the session cookie is not HttpOnly')
      ctx.check(res.headers['cache-control']?.includes('no-store') === true, 'login response is cacheable')
      ctx.check(typeof dataOf(res).csrf === 'string', 'Session.csrf is missing')
    },
  },
  {
    id: 'auth-api/wrong password and unknown user give the identical 401',
    domain: 'auth',
    targets: API_ONLY,
    async run(ctx) {
      const anon = ctx.anonymous()
      const wrong = await anon.request('POST', '/auth/login', {
        body: { identifier: ctx.credentials('student').identifier, password: 'bukan-kata-laluan' },
      })
      const unknown = await anon.request('POST', '/auth/login', {
        body: { identifier: 'tiada.pengguna@demo.test', password: 'bukan-kata-laluan' },
      })
      expectError(ctx, wrong, 401, 'INVALID_CREDENTIALS')
      ctx.expectStatus(unknown, 401)
      const a = errorOf(wrong)
      const b = errorOf(unknown)
      ctx.check(a.code === b.code && a.message === b.message, 'unknown user is distinguishable from a wrong password')
    },
  },
  {
    id: 'auth-api/6th login attempt in a minute is 429 with retryAfter',
    domain: 'auth',
    targets: API_ONLY,
    async run(ctx) {
      const anon = ctx.anonymous()
      const body = { identifier: ctx.credentials('teacher').identifier, password: 'bukan-kata-laluan' }
      for (let n = 1; n <= 5; n++) {
        ctx.expectStatus(await anon.request('POST', '/auth/login', { body }), 401)
      }
      const sixth = await anon.request('POST', '/auth/login', { body })
      expectError(ctx, sixth, 429, 'RATE_LIMITED')
      const retry = errorOf(sixth).retryAfter
      ctx.check(typeof retry === 'number' && retry >= 1 && retry <= 60, `retryAfter ${String(retry)} is not within 1..60`)
      // Even the right password is refused once the ceiling is used up (card AC3).
      const right = await anon.request('POST', '/auth/login', { body: { ...body, password: DEMO_PASSWORD } })
      ctx.expectStatus(right, 429)
    },
  },
  {
    id: 'auth-api/GET /session returns the session of the cookie, with the same csrf',
    domain: 'auth',
    targets: API_ONLY,
    async run(ctx) {
      const me = await sessionLogin(ctx.anonymous(), { ...ctx.credentials('student') })
      const res = await me.request('GET', '/session')
      ctx.expectStatus(res, 200)
      ctx.check(dataOf(res).csrf === me.csrf, 'GET /session returned another csrf than login')
    },
  },
  {
    id: 'auth-api/role switch changes the active role and rotates the session',
    domain: 'auth',
    targets: API_ONLY,
    async run(ctx) {
      const me = await sessionLogin(ctx.anonymous(), { identifier: DUAL_ROLE_ACCOUNT, password: DEMO_PASSWORD })
      const before = me.csrf
      const first = await me.request('GET', '/session')
      const from = (dataOf(first).active as { role?: string } | undefined)?.role
      const to = from === 'teacher' ? 'school_admin' : 'teacher'
      const sw = await me.request('POST', '/session/role', { body: { role: to } })
      ctx.expectStatus(sw, 200)
      ctx.check((dataOf(sw).active as { role?: string } | undefined)?.role === to, `active role is not ${to} after the switch`)
      ctx.check(me.csrf !== before, 'the csrf token did not rotate on a role switch')
      const again = await me.request('GET', '/session')
      ctx.check((dataOf(again).active as { role?: string } | undefined)?.role === to, 'GET /session does not show the new role')
      const bad = await me.request('POST', '/session/role', { body: { role: 'admin' } })
      expectError(ctx, bad, 403, 'ROLE_NOT_ALLOWED')
    },
  },
  {
    id: 'auth-api/Mod Pelajar enter and exit',
    domain: 'auth',
    targets: API_ONLY,
    async run(ctx) {
      const admin = await ctx.as('admin')
      const entered = await admin.request('POST', '/session/mode', { body: { mode: 'mod_pelajar' } })
      ctx.expectStatus(entered, 200)
      ctx.check((dataOf(entered).active as { role?: string } | undefined)?.role === 'student', 'Mod Pelajar did not make the active role student')
      ctx.check((dataOf(entered).mode as { kind?: string } | null)?.kind === 'mod_pelajar', 'Session.mode.kind is not mod_pelajar')
      expectError(ctx, await admin.request('POST', '/session/mode', { body: { mode: 'mod_pelajar' } }), 409, 'MODE_ALREADY_ACTIVE')
      const left = await admin.request('DELETE', '/session/mode')
      ctx.expectStatus(left, 200)
      ctx.check(dataOf(left).mode === null, 'Session.mode is not null after exit')
      ctx.check((dataOf(left).active as { role?: string } | undefined)?.role === 'admin', 'the role did not return to admin')
      expectError(ctx, await admin.request('DELETE', '/session/mode'), 409, 'NO_MODE_ACTIVE')
    },
  },
  {
    id: 'auth-api/a student cannot enter Mod Pelajar',
    domain: 'auth',
    targets: API_ONLY,
    async run(ctx) {
      const student = await ctx.as('student')
      expectError(ctx, await student.request('POST', '/session/mode', { body: { mode: 'mod_pelajar' } }), 403, 'MODE_NOT_ALLOWED')
    },
  },
  {
    id: 'auth-api/logout ends the session',
    domain: 'auth',
    targets: API_ONLY,
    async run(ctx) {
      const me = await sessionLogin(ctx.anonymous(), { ...ctx.credentials('teacher') })
      const out = await me.request('POST', '/auth/logout')
      ctx.expectStatus(out, 204)
      ctx.check(/pp_session=;|pp_session=\s*;|expires=/i.test(out.headers['set-cookie'] ?? ''), 'logout did not clear the cookie')
      expectError(ctx, await ctx.anonymous().request('GET', '/session', { headers: { cookie: out.headers['set-cookie']?.split(';')[0] ?? '' } }), 401, 'UNAUTHORIZED')
    },
  },
  {
    id: 'auth-api/a write without the CSRF token is 403 CSRF_INVALID',
    domain: 'auth',
    targets: API_ONLY,
    async run(ctx) {
      const noCsrf = await ctx.as('admin', { csrf: false })
      expectError(ctx, await noCsrf.request('POST', '/session/mode', { body: { mode: 'mod_pelajar' } }), 403, 'CSRF_INVALID')
      expectError(ctx, await noCsrf.request('POST', '/session/role', { body: { role: 'admin' } }), 403, 'CSRF_INVALID')
      // A read needs no token.
      ctx.expectStatus(await noCsrf.request('GET', '/session'), 200)
    },
  },
]
