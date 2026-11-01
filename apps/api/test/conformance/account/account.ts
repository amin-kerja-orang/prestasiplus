import { sessionLogin, type HttpClient, type Scenario, type ScenarioContext, type SessionClient } from '@pp/contract-tests'

import { API_ONLY, dataOf, errorOf, expectError, nextTag } from '../helpers'
import { schoolIdByCode } from '../users/users'

/**
 * Account (BE-06 part A) scenarios: register, password reset, `/me`, password change, settings and the
 * forced password change. They need a cookie session with CSRF and an account of their own (so a
 * password change never touches a seeded demo account), so they run on the API target only.
 *
 * Understood differences from the mock are deviation rows of `docs/architecture/v2-backend-deviations.md`
 * (BE-06 account): D55b no enumeration, the unverified teacher, the rotated session on password change.
 */

const PASSWORD = 'Rahsia-Konf-1'
const IC = '100101140077'

export interface Registered {
  email: string
  school: string
  client: SessionClient
}

/** Registers a student with a school and an IC, then signs in with a cookie session. */
export async function registerStudent(ctx: ScenarioContext): Promise<Registered> {
  const anon = ctx.anonymous()
  const admin = await ctx.as('admin')
  const school = await schoolIdByCode(admin, 'DEMO001')
  const email = `${nextTag('murid')}@ujian.test`
  const res = await anon.request('POST', '/auth/register', {
    body: { name: 'Murid Konformans', email, role: 'student', grade: 10, icNumber: IC, schoolId: school, password: PASSWORD, passwordConfirmation: PASSWORD },
  })
  ctx.expectStatus(res, 201)
  const client = await sessionLogin(anon, { identifier: email, password: PASSWORD })
  return { email, school, client }
}

const fieldsOf = (res: { body: unknown }): Record<string, string> => (errorOf(res as never).fields as Record<string, string> | undefined) ?? {}

export const accountScenarios: Scenario[] = [
  {
    id: 'account-api/register: a student gets a Session and a cookie; a duplicate e-mail is 422 fields.email',
    domain: 'account',
    targets: API_ONLY,
    async run(ctx) {
      const anon = ctx.anonymous()
      const email = `${nextTag('murid')}@ujian.test`
      const body = { name: 'Murid Baharu', email, role: 'student', grade: 10, password: PASSWORD, passwordConfirmation: PASSWORD }
      const res = await anon.request('POST', '/auth/register', { body })
      ctx.expectStatus(res, 201)
      ctx.check(/pp_session=[^;]+/.test(res.headers['set-cookie'] ?? ''), 'register did not set the session cookie')
      ctx.check(res.headers['cache-control']?.includes('no-store') === true, 'register response is cacheable')
      const data = dataOf(res)
      ctx.check(typeof data.csrf === 'string' && !('status' in data), 'a student registration must answer the Session variant')
      ctx.check((data.active as { role?: string } | undefined)?.role === 'student', 'active role is not student')
      const dup = await anon.request('POST', '/auth/register', { body })
      expectError(ctx, dup, 422, 'VALIDATION_ERROR')
      ctx.check(fieldsOf(dup).email === 'The email has already been taken.', 'duplicate e-mail message differs')
    },
  },
  {
    id: 'account-api/register: a teacher is created pending (no session) and cannot log in',
    domain: 'account',
    targets: API_ONLY,
    async run(ctx) {
      const anon = ctx.anonymous()
      const school = await schoolIdByCode(await ctx.as('admin'), 'DEMO001')
      const email = `${nextTag('guru')}@ujian.test`
      const res = await anon.request('POST', '/auth/register', {
        body: { name: 'Guru Menunggu', email, role: 'teacher', schoolId: school, password: PASSWORD, passwordConfirmation: PASSWORD },
      })
      ctx.expectStatus(res, 201)
      ctx.check(dataOf(res).status === 'pending_verification', 'a teacher registration must answer the pending variant')
      ctx.check(!res.headers['set-cookie'], 'a pending teacher must not get a session cookie')
      const login = await anon.request('POST', '/auth/login', { body: { identifier: email, password: PASSWORD } })
      expectError(ctx, login, 403, 'ACCOUNT_INACTIVE')
    },
  },
  {
    id: 'account-api/password/email: a known and an unknown e-mail get the identical 200 (D55b)',
    domain: 'account',
    targets: API_ONLY,
    async run(ctx) {
      const anon = ctx.anonymous()
      const known = await anon.request('POST', '/auth/password/email', { body: { email: ctx.credentials('student').identifier } })
      const unknown = await anon.request('POST', '/auth/password/email', { body: { email: `${nextTag('tiada')}@ujian.test` } })
      ctx.expectStatus(known, 200)
      ctx.expectStatus(unknown, 200)
      ctx.check(JSON.stringify(known.body) === JSON.stringify(unknown.body), 'a known and an unknown e-mail are distinguishable')
      ctx.check(dataOf(known).status === 'We have emailed your password reset link.', 'status text differs')
      // The 60 s interval is per e-mail: a second request is 429 with retryAfter (known or not).
      const again = await anon.request('POST', '/auth/password/email', { body: { email: ctx.credentials('student').identifier } })
      expectError(ctx, again, 429, 'RATE_LIMITED')
      ctx.check(typeof errorOf(again).retryAfter === 'number', '429 carries no retryAfter')
    },
  },
  {
    id: 'account-api/password/reset: an invalid token and an unknown e-mail give the same 422 (D55b)',
    domain: 'account',
    targets: API_ONLY,
    async run(ctx) {
      const anon = ctx.anonymous()
      const body = (email: string) => ({ token: 'x'.repeat(43), email, password: PASSWORD, passwordConfirmation: PASSWORD })
      const wrong = await anon.request('POST', '/auth/password/reset', { body: body(ctx.credentials('student').identifier) })
      const unknown = await anon.request('POST', '/auth/password/reset', { body: body(`${nextTag('tiada')}@ujian.test`) })
      for (const res of [wrong, unknown]) {
        expectError(ctx, res, 422, 'VALIDATION_ERROR')
        ctx.check(fieldsOf(res).email === 'This password reset token is invalid.', 'token-invalid message differs')
      }
    },
  },
  {
    id: 'account-api/password/reset-ic: a mismatch is 422; the 6th attempt in 15 minutes is 429 with the BM message (D55a)',
    domain: 'account',
    targets: API_ONLY,
    async run(ctx) {
      const anon = ctx.anonymous()
      const email = ctx.credentials('student').identifier
      for (let n = 1; n <= 5; n++) {
        const res = await anon.request('POST', '/auth/password/reset-ic', { body: { email, icNumber: '999999999999' } })
        expectError(ctx, res, 422, 'VALIDATION_ERROR')
        ctx.check(fieldsOf(res).email === 'Email atau No Kad Pengenalan tidak sepadan.', 'IC mismatch message differs')
      }
      const sixth = await anon.request('POST', '/auth/password/reset-ic', { body: { email, icNumber: '999999999999' } })
      expectError(ctx, sixth, 429, 'RATE_LIMITED')
      ctx.check(errorOf(sixth).message === 'Terlalu banyak percubaan. Sila cuba lagi dalam 15 minit.', 'rate-limit message differs')
    },
  },
  {
    id: 'account-api/GET and PUT /me: the profile, the e-mail is ignored, the shared fields agree with GET /session',
    domain: 'account',
    targets: API_ONLY,
    async run(ctx) {
      const me = await registerStudent(ctx)
      const before = await me.client.request('GET', '/me')
      ctx.expectStatus(before, 200)
      ctx.check(before.headers['cache-control']?.includes('no-store') === true, 'GET /me is cacheable')
      const session = dataOf(await me.client.request('GET', '/session'))
      ctx.check(dataOf(before).id === (session.user as { id?: string }).id, 'GET /me and GET /session disagree on the id')
      const saved = await me.client.request('PUT', '/me', { body: { name: 'Nama Baharu', email: 'lain@ujian.test', bio: 'Motto', grade: 11 } })
      ctx.expectStatus(saved, 200)
      ctx.check((saved.body as { status?: string }).status === 'Profil berjaya dikemaskini.', 'profile status text differs')
      ctx.check(dataOf(saved).email === me.email && dataOf(saved).name === 'Nama Baharu', 'the e-mail must be ignored and the name saved')
      expectError(ctx, await me.client.request('PUT', '/me', { body: { name: '' } }), 422, 'VALIDATION_ERROR')
    },
  },
  {
    id: 'account-api/PUT /me/password: a wrong current password is 422 fields.currentPassword; a change rotates the session',
    domain: 'account',
    targets: API_ONLY,
    async run(ctx) {
      const me = await registerStudent(ctx)
      const wrong = await me.client.request('PUT', '/me/password', { body: { currentPassword: 'salah', password: 'Baharu-1234', passwordConfirmation: 'Baharu-1234' } })
      expectError(ctx, wrong, 422, 'VALIDATION_ERROR')
      ctx.check(fieldsOf(wrong).currentPassword === 'The password is incorrect.', 'wrong-password message differs')
      const before = me.client.csrf
      const ok = await me.client.request('PUT', '/me/password', { body: { currentPassword: PASSWORD, password: 'Baharu-1234', passwordConfirmation: 'Baharu-1234' } })
      ctx.expectStatus(ok, 200)
      ctx.check(dataOf(ok).status === 'Kata laluan berjaya dikemaskini.', 'password status text differs')
      ctx.check(/pp_session=[^;]+/.test(ok.headers['set-cookie'] ?? ''), 'the session was not rotated (no new cookie)')
      // The client re-reads GET /session for the new CSRF token.
      ctx.expectStatus(await me.client.request('GET', '/session'), 200)
      ctx.check(me.client.csrf !== before, 'the CSRF token did not change after the rotation')
      const relogin = await sessionLogin(ctx.anonymous(), { identifier: me.email, password: 'Baharu-1234' })
      ctx.check(typeof relogin.csrf === 'string', 'the new password does not log in')
    },
  },
  {
    id: 'account-api/GET and PUT /me/settings: defaults, then a full save read back',
    domain: 'account',
    targets: API_ONLY,
    async run(ctx) {
      const me = await registerStudent(ctx)
      const defaults = await me.client.request('GET', '/me/settings')
      ctx.expectStatus(defaults, 200)
      ctx.check(dataOf(defaults).subuhPushTime === '05:30' && dataOf(defaults).faith === null, 'the BR-17 defaults differ')
      const next = {
        spiritualMode: true,
        showBismillahSplash: true,
        subuhPushEnabled: true,
        subuhPushTime: '05:45',
        ramadanModeEnabled: true,
        sahurPushTime: '03:50',
        faith: 'muslim',
      }
      const saved = await me.client.request('PUT', '/me/settings', { body: next })
      ctx.expectStatus(saved, 200)
      ctx.check((saved.body as { status?: string }).status === 'Tetapan berjaya disimpan.', 'settings status text differs')
      ctx.check(JSON.stringify(dataOf(await me.client.request('GET', '/me/settings'))) === JSON.stringify(next), 'settings did not read back')
      expectError(ctx, await me.client.request('PUT', '/me/settings', { body: { ...next, subuhPushTime: '25:00', faith: 'jedi' } }), 422, 'VALIDATION_ERROR')
    },
  },
  {
    id: 'account-api/mustChangePassword: an admin-created account is not flagged (R39); GET /session false, routes answer, PUT /me/password works',
    domain: 'account',
    targets: API_ONLY,
    async run(ctx) {
      const admin = await ctx.as('admin')
      const school = await schoolIdByCode(admin, 'DEMO001')
      const email = `${nextTag('paksa')}@ujian.test`
      const created = await admin.request('POST', '/admin/users', { body: { roles: ['teacher'], name: 'Guru Paksa', email, schoolId: school } })
      ctx.expectStatus(created, 201)
      const generated = String(dataOf(created).generatedPassword)
      const me: SessionClient = await sessionLogin(ctx.anonymous(), { identifier: email, password: generated })
      const session = await me.request('GET', '/session')
      ctx.expectStatus(session, 200)
      // R39 (LEAD 24 Oct): an admin-created account is NOT flagged, so the forced-change guard does not apply to it. No API route
      // flags an account any more (only the operator admin bootstrap does), so the 403 PASSWORD_CHANGE_REQUIRED guard is covered by
      // test/account/must-change.spec.ts, which sets the flag in the database. Here: the created account works at once.
      ctx.check(dataOf(created).mustChangePassword === false, 'the create response flags a generated password as must-change')
      ctx.check(dataOf(session).mustChangePassword === false, 'session.mustChangePassword is not false for an admin-created account')
      for (const path of ['/me', '/me/settings', '/me/notifications']) ctx.expectStatus(await me.request('GET', path), 200)
      // The user changes the password in /profile/edit (PUT /me/password); the flag stays false.
      const ok = await me.request('PUT', '/me/password', { body: { currentPassword: generated, password: 'Baharu-1234', passwordConfirmation: 'Baharu-1234' } })
      ctx.expectStatus(ok, 200)
      const after = await me.request('GET', '/session')
      ctx.check(dataOf(after).mustChangePassword === false, 'the flag is set after the password change')
      ctx.expectStatus(await me.request('GET', '/me'), 200)
    },
  },
  {
    id: 'account-api/anonymous and missing CSRF: 401 on /me routes, 403 CSRF_INVALID on writes, public stats open',
    domain: 'account',
    targets: API_ONLY,
    async run(ctx) {
      const anon: HttpClient = ctx.anonymous()
      for (const path of ['/me', '/me/settings']) expectError(ctx, await anon.request('GET', path), 401, 'UNAUTHORIZED')
      expectError(ctx, await anon.request('PUT', '/me', { body: { name: 'x' } }), 401, 'UNAUTHORIZED')
      const student = await ctx.as('student', { csrf: false })
      expectError(ctx, await student.request('PUT', '/me', { body: { name: 'Murid Demo' } }), 403, 'CSRF_INVALID')
      ctx.expectStatus(await anon.request('GET', '/public/stats'), 200)
    },
  },
]
