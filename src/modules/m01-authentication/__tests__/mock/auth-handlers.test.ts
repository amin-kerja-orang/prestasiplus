/**
 * M01-T1: the auth and account handlers (SRS M01 v1.12 §7 #1–#6, #8–#12, #21; BR-01…BR-26).
 * Boots the whole registry (the handlers read M02, M03, M04 and M14), latency 0, a fixed clock.
 */

import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import type { TransportResponse } from '@/api/transport'
import { sessions } from '@/mock/auth/sessions'
import { CLOCK_ANCHOR_ISO, createClock, MINUTE_MS, SECOND_MS, toEpochMs } from '@/lib/time'
import { CANONICAL_ACCOUNTS, DEMO_PASSWORD } from '@/mock/core-data/accounts'
import type { UserMe as CoreUserMe } from '@/mock/core-data/me'
import { bootMock, type MockRuntime } from '@/mock/index'
import type { ClientSession as StoreSession } from '@/stores/session-types'
import { PASSWORD_RESET_OUTBOX_TYPE as HOOKS_OUTBOX_TYPE } from '@/mock/testing/hooks'
import { wallet } from '@/modules/m14-gamification/mock'

import type { ClientSession, UserMe, UserSettings } from '../../api/types'
import { impersonation, loginThrottle, passwordResets, users, userSettings } from '../../mock'
import { PASSWORD_RESET_OUTBOX_TYPE } from '../../mock/handlers/auth'
import { DEMO_EXPIRED_TOKEN, DEMO_RESET_TOKEN } from '../../mock/handlers/auth-state'

interface Body {
  data?: Record<string, unknown> & Partial<{ token: string; expiresAt: string; user: UserMe }>
  status?: string
  error?: { code: string; message: string; fields?: Record<string, string>; retryAfter?: number }
}

let runtime: MockRuntime
const clock = createClock({ at: CLOCK_ANCHOR_ISO })

beforeAll(async () => {
  runtime = await bootMock({ mode: 'test', clock, latencyMs: 0, onWarn: null })
}, 120_000)

// A full `runtime.reset()` costs seconds, so the tests share one boot and undo what they touch:
// the clock, the demo passwords, the login throttle and the outbox. Tests that leave other state
// (reset tokens, settings, profile) use accounts or an order that does not clash.
beforeEach(() => {
  clock.setNow(CLOCK_ANCHOR_ISO)
})

afterEach(() => {
  clock.setNow(CLOCK_ANCHOR_ISO)
  for (const account of CANONICAL_ACCOUNTS) {
    users.setPassword(account.id, DEMO_PASSWORD)
    loginThrottle.clear(account.email)
  }
  runtime.outbox.clear()
})

async function call(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  url: string,
  body?: unknown,
  token?: string,
): Promise<{ status: number; body: Body; res: TransportResponse }> {
  const headers: Record<string, string> = { accept: 'application/json' }
  if (token) headers.authorization = `Bearer ${token}`
  if (body !== undefined && !(body instanceof FormData))
    headers['content-type'] = 'application/json'
  const res = await runtime.transport.request({
    method,
    url,
    headers,
    ...(body === undefined ? {} : { body }),
  })
  return { status: res.status, body: res.body ?? {}, res }
}

const login = (email: string, password = DEMO_PASSWORD, remember = false) =>
  call('POST', '/api/auth/login', { email, password, remember })

async function loginToken(email: string): Promise<string> {
  const r = await login(email)
  expect(r.status).toBe(200)
  return String(r.body.data?.token)
}

const NOW = toEpochMs(CLOCK_ANCHOR_ISO)

describe('POST /api/auth/login (#1)', () => {
  it.each([
    [2, 'pelajar@demo.test', 'student', '/dashboard', 'SMK DEMO'],
    [5, 'guru@demo.test', 'teacher', '/dashboard', 'SMK DEMO'],
    [8, 'adminsekolah@demo.test', 'school_admin', '/dashboard', 'SMK DEMO'],
    [1, 'admin@demo.test', 'admin', '/admin', 'SK Demo'],
    [9, 'ppd@demo.test', 'ppd_officer', '/ppd/dashboard', null],
    [10, 'jpn@demo.test', 'jpn_officer', '/jpn/dashboard', null],
  ])('account %i logs in and lands per BR-07', async (id, email, role, landing, school) => {
    const { status, body } = await login(email)
    expect(status).toBe(200)
    const user = body.data?.user as UserMe
    expect(user).toMatchObject({ id, email, role, landingPath: landing })
    if (school) expect(user.school?.name.toLowerCase()).toContain(school.toLowerCase())
    else expect(user.school).toBeNull()
    expect(body.data?.token).toMatch(/^pp_/)
    // The token is a live session for the core `GET /api/me`.
    const me = await call('GET', '/api/me', undefined, body.data?.token)
    expect(me.status).toBe(200)
    expect((me.body.data as unknown as UserMe).id).toBe(id)
  })

  it('never returns the password, IC, isActive or the remember token', async () => {
    const { body } = await login('pelajar@demo.test')
    const text = JSON.stringify(body)
    for (const leak of [
      'password',
      'icNumber',
      'icHash',
      'isActive',
      'rememberToken',
      DEMO_PASSWORD,
    ]) {
      expect(text).not.toContain(leak)
    }
  })

  it('is case-insensitive and trims the e-mail (Laravel TrimStrings)', async () => {
    const { status } = await login('  Pelajar@Demo.TEST ')
    expect(status).toBe(200)
  })

  it('sets lastLoginAt from the mock clock (BR-25) and leaves updatedAt alone', async () => {
    const before = users.get(2)!
    clock.advance(3 * MINUTE_MS)
    const { body } = await login('pelajar@demo.test')
    const user = body.data?.user as UserMe
    expect(Date.parse(user.lastLoginAt!)).toBe(NOW + 3 * MINUTE_MS)
    expect(users.get(2)!.lastLoginAt).toBe(user.lastLoginAt)
    expect(users.get(2)!.updatedAt).toBe(before.updatedAt)
  })

  it('refuses a wrong password and an unknown e-mail with the same message (BR-01)', async () => {
    const lastLogin = users.get(2)!.lastLoginAt
    const wrong = await login('pelajar@demo.test', 'salah-salah')
    const unknown = await login('tiada@demo.test')
    for (const r of [wrong, unknown]) {
      expect(r.status).toBe(422)
      expect(r.body.error).toMatchObject({
        code: 'VALIDATION_ERROR',
        message: 'Emel atau kata laluan tidak sah.',
        fields: { email: 'Emel atau kata laluan tidak sah.' },
      })
    }
    // A failed attempt changes nothing (BR-25).
    expect(users.get(2)!.lastLoginAt).toBe(lastLogin)
  })

  it('validates required fields', async () => {
    const r = await call('POST', '/api/auth/login', { email: '', password: '' })
    expect(r.status).toBe(422)
    expect(r.body.error?.fields).toEqual({
      email: 'The email field is required.',
      password: 'The password field is required.',
    })
  })

  it('refuses the inactive account 11 after the credentials match, without a session (BR-23)', async () => {
    const r = await login('tidakaktif@demo.test')
    expect(r.status).toBe(403)
    expect(r.body.error).toMatchObject({
      code: 'ACCOUNT_INACTIVE',
      message: 'Akaun anda tidak aktif. Sila hubungi pentadbir.',
    })
    expect(users.get(11)!.lastLoginAt).toBeNull()
    // A wrong password on an inactive account is the ordinary credentials failure.
    const wrong = await login('tidakaktif@demo.test', 'salah-salah')
    expect(wrong.status).toBe(422)
  })

  it('does not count refused inactive attempts toward the throttle (BR-23)', async () => {
    for (let i = 0; i < 8; i++) expect((await login('tidakaktif@demo.test')).status).toBe(403)
  })

  it('throttles the 6th attempt after 5 failures and unlocks after 60 s (BR-02)', async () => {
    for (let i = 0; i < 5; i++) expect((await login('guru@demo.test', 'x')).status).toBe(422)
    const locked = await login('guru@demo.test') // even the right password
    expect(locked.status).toBe(429)
    expect(locked.body.error).toMatchObject({
      code: 'RATE_LIMITED',
      message: 'Too many login attempts. Please try again in 60 seconds.',
      retryAfter: 60,
    })
    expect(locked.res.headers['retry-after']).toBe('60')
    // Another e-mail is unaffected.
    expect((await login('pelajar@demo.test')).status).toBe(200)
    clock.advance(30 * SECOND_MS)
    expect((await login('guru@demo.test')).body.error?.retryAfter).toBe(30)
    clock.advance(30 * SECOND_MS)
    expect((await login('guru@demo.test')).status).toBe(200)
  })

  it('a successful login clears earlier failures', async () => {
    for (let i = 0; i < 4; i++) await login('ibubapa@demo.test', 'x')
    expect((await login('ibubapa@demo.test')).status).toBe(200)
    for (let i = 0; i < 4; i++) expect((await login('ibubapa@demo.test', 'x')).status).toBe(422)
  })

  it('sessions: 120 min sliding without "Ingat saya", 5 years with it (BR-06)', async () => {
    const plain = await login('pelajar@demo.test')
    expect(Date.parse(plain.body.data!.expiresAt!)).toBe(NOW + 120 * MINUTE_MS)
    const remembered = await login('pelajar@demo.test', DEMO_PASSWORD, true)
    expect(Date.parse(remembered.body.data!.expiresAt!)).toBe(
      toEpochMs('2031-09-25T15:40:00+08:00'),
    )
    clock.advance(121 * MINUTE_MS)
    expect((await call('GET', '/api/me', undefined, plain.body.data!.token)).status).toBe(401)
    expect((await call('GET', '/api/me', undefined, remembered.body.data!.token)).status).toBe(200)
  })

  it('credits the M14 daily login once for a student, not for a teacher (FR-M01-69)', async () => {
    const before = wallet.summary(2).currentSyiling
    await login('pelajar@demo.test')
    const first = wallet.summary(2).currentSyiling
    await login('pelajar@demo.test')
    expect(wallet.summary(2).currentSyiling).toBe(first)
    expect(first - before).toBeLessThanOrEqual(2)
    const teacher = wallet.summary(5).currentSyiling
    await login('guru@demo.test')
    expect(wallet.summary(5).currentSyiling).toBe(teacher)
  })
})

describe('POST /api/auth/logout (#6)', () => {
  it('ends the session and answers 204', async () => {
    const token = await loginToken('pelajar@demo.test')
    const out = await call('POST', '/api/auth/logout', undefined, token)
    expect(out.status).toBe(204)
    expect((await call('GET', '/api/me', undefined, token)).status).toBe(401)
  })

  it('also ends the impersonation sessions opened from the logged-out session', async () => {
    const actor = await loginToken('adminsekolah@demo.test')
    const pupil = users
      .adminList({ role: 'student', schoolId: users.get(8)!.schoolId!, page: 1, pageSize: 1 })
      .rows.find((u) => u.isActive)!
    const child = impersonation.start({ id: 8, sessionToken: actor }, pupil.id, NOW).session.token
    const other = await loginToken('pelajar@demo.test')
    expect((await call('GET', '/api/me', undefined, child)).status).toBe(200)
    expect((await call('POST', '/api/auth/logout', undefined, actor)).status).toBe(204)
    expect((await call('GET', '/api/me', undefined, child)).status).toBe(401)
    expect(sessions.peek(child)).toBeUndefined()
    // an unrelated session is untouched
    expect((await call('GET', '/api/me', undefined, other)).status).toBe(200)
  })

  it('answers 204 without a session or with a dead token (a 401 is ignored)', async () => {
    expect((await call('POST', '/api/auth/logout')).status).toBe(204)
    expect((await call('POST', '/api/auth/logout', undefined, 'pp_dead')).status).toBe(204)
  })
})

describe('POST /api/auth/register (#2)', () => {
  const student = {
    name: 'Murid Baharu',
    email: 'murid.baharu@demo.test',
    phone: '0191234567',
    role: 'student',
    grade: 3,
    icNumber: '100101140077',
    schoolId: 900_001,
    password: 'rahsia1',
    passwordConfirmation: 'rahsia1',
  }

  it('creates a student, logs in at once and lands on /dashboard (BR-05, BR-24)', async () => {
    const r = await call('POST', '/api/auth/register', student)
    expect(r.status).toBe(201)
    const user = r.body.data!.user!
    expect(user).toMatchObject({
      name: 'Murid Baharu',
      email: 'murid.baharu@demo.test',
      role: 'student',
      grade: 3,
      schoolId: 900_001,
      landingPath: '/dashboard',
    })
    expect(user.id).toBeGreaterThanOrEqual(9_000_001)
    expect(user.lastLoginAt).not.toBeNull()
    expect(JSON.stringify(r.body)).not.toContain('100101140077')
    expect(Date.parse(r.body.data!.expiresAt!)).toBe(NOW + 120 * MINUTE_MS)
    // The password works, the IC is stored hashed and masked.
    expect((await login('murid.baharu@demo.test', 'rahsia1')).status).toBe(200)
    expect(users.verifyIc(user.id, '100101140077')).toBe(true)
    expect(users.icMasked(user.id)).toBe('xxxxxx-xx-xx77')
    // Ids are never reused.
    const second = await call('POST', '/api/auth/register', { ...student, email: 'dua@demo.test' })
    expect(second.body.data!.user!.id).toBe(user.id + 1)
  })

  it('registers a teacher: grade and IC are ignored (BR-04)', async () => {
    const r = await call('POST', '/api/auth/register', {
      ...student,
      role: 'teacher',
      email: 'cikgu.baharu@demo.test',
    })
    expect(r.status).toBe(201)
    expect(r.body.data!.user).toMatchObject({ role: 'teacher', grade: null })
    expect(users.icMasked(r.body.data!.user!.id)).toBeNull()
  })

  it('needs no grade for teacher or parent, but requires it for a student', async () => {
    const noGrade = { ...student, email: 'tanpa.tahap@demo.test', grade: null }
    const s = await call('POST', '/api/auth/register', noGrade)
    expect(s.status).toBe(422)
    expect(s.body.error?.fields).toEqual({ grade: 'The grade field is required.' })
    const p = await call('POST', '/api/auth/register', {
      ...noGrade,
      role: 'parent',
      email: 'ibu@demo.test',
    })
    expect(p.status).toBe(201)
  })

  it('returns the Laravel copy of SRS §5, one message per field', async () => {
    const r = await call('POST', '/api/auth/register', {
      name: '',
      email: 'pelajar@demo.test',
      role: 'student',
      grade: 3,
      password: '123',
      passwordConfirmation: '456',
    })
    expect(r.status).toBe(422)
    expect(r.body.error?.fields).toEqual({
      name: 'The name field is required.',
      email: 'The email has already been taken.',
      password: 'The password field must be at least 6 characters.',
    })
    const c = await call('POST', '/api/auth/register', {
      ...student,
      email: 'x@demo.test',
      passwordConfirmation: 'lain',
    })
    expect(c.body.error?.fields).toEqual({
      password: 'The password field confirmation does not match.',
    })
  })

  it('treats e-mail uniqueness case-insensitively', async () => {
    const r = await call('POST', '/api/auth/register', { ...student, email: 'PELAJAR@demo.test' })
    expect(r.body.error?.fields?.email).toBe('The email has already been taken.')
  })

  it('refuses roles other than student, teacher and parent, and unknown schools', async () => {
    const a = await call('POST', '/api/auth/register', {
      ...student,
      email: 'peranan@demo.test',
      role: 'admin',
    })
    expect(a.body.error?.fields).toEqual({ role: 'The selected role is invalid.' })
    const s = await call('POST', '/api/auth/register', {
      ...student,
      email: 'sekolah@demo.test',
      schoolId: 123_456_789,
    })
    expect(s.body.error?.fields).toEqual({ schoolId: 'The selected school id is invalid.' })
    const l = await call('POST', '/api/auth/register', {
      ...student,
      email: 'panjang@demo.test',
      phone: '0'.repeat(15),
      icNumber: '1'.repeat(15),
    })
    expect(Object.keys(l.body.error!.fields!).sort()).toEqual(['icNumber', 'phone'])
  })

  it('accepts an unknown referral code silently (FR-M01-70)', async () => {
    const r = await call('POST', '/api/auth/register', {
      ...student,
      email: 'rujukan@demo.test',
      referralCode: 'TIADA-KOD',
    })
    expect(r.status).toBe(201)
  })
})

describe('password reset (#3, #4, #5)', () => {
  it('forgot: unknown e-mail is a validation error (BR-10)', async () => {
    const r = await call('POST', '/api/auth/password/email', { email: 'tiada@demo.test' })
    expect(r.status).toBe(422)
    expect(r.body.error?.fields).toEqual({
      email: "Kami tidak menemui pengguna dengan alamat emel itu.",
    })
    expect((await call('POST', '/api/auth/password/email', { email: '' })).status).toBe(422)
  })

  it('forgot: sends the token to the outbox, then throttles for 60 s (BR-10)', async () => {
    const sent = await call('POST', '/api/auth/password/email', { email: 'guru@demo.test' })
    expect(sent.status).toBe(200)
    expect(sent.body.data).toEqual({ status: 'Kami telah menghantar pautan set semula kata laluan ke emel anda.' })
    const mail = runtime.outbox.last(PASSWORD_RESET_OUTBOX_TYPE, 'guru@demo.test')
    expect(mail?.data?.token).toMatch(/^rt_/)
    expect(String(mail?.data?.link)).toContain(`/password/reset/${String(mail?.data?.token)}`)

    const again = await call('POST', '/api/auth/password/email', { email: 'GURU@demo.test' })
    expect(again.status).toBe(429)
    expect(again.body.error).toMatchObject({
      code: 'RATE_LIMITED',
      message: 'Sila tunggu sebelum mencuba semula.',
      retryAfter: 60,
    })
    clock.advance(61 * SECOND_MS)
    const later = await call('POST', '/api/auth/password/email', { email: 'guru@demo.test' })
    expect(later.status).toBe(200)
    // The new token replaces the old one.
    const first = String(mail?.data?.token)
    const second = String(
      runtime.outbox.last(PASSWORD_RESET_OUTBOX_TYPE, 'guru@demo.test')?.data?.token,
    )
    expect(second).not.toBe(first)
    const oldUse = await call('POST', '/api/auth/password/reset', {
      token: first,
      email: 'guru@demo.test',
      password: 'baharu1',
      passwordConfirmation: 'baharu1',
    })
    expect(oldUse.body.error?.fields?.email).toBe('Token set semula kata laluan ini tidak sah.')
  })

  it('forgot then reset: new password, auto-login, single use (BR-11)', async () => {
    await call('POST', '/api/auth/password/email', { email: 'penaja@demo.test' })
    const token = String(
      runtime.outbox.last(PASSWORD_RESET_OUTBOX_TYPE, 'penaja@demo.test')?.data?.token,
    )
    clock.advance(59 * MINUTE_MS)
    const body = {
      token,
      email: 'penaja@demo.test',
      password: 'baharu1',
      passwordConfirmation: 'baharu1',
    }
    const r = await call('POST', '/api/auth/password/reset', body)
    expect(r.status).toBe(200)
    expect(r.body.data).toMatchObject({ status: 'Kata laluan anda telah ditetapkan semula.' })
    expect(r.body.data?.user).toMatchObject({ id: 7, landingPath: '/dashboard' })
    expect(Date.parse(r.body.data!.user!.lastLoginAt!)).toBe(NOW + 59 * MINUTE_MS)
    expect((await login('penaja@demo.test', 'baharu1')).status).toBe(200)
    expect((await login('penaja@demo.test', DEMO_PASSWORD)).status).toBe(422)
    const reuse = await call('POST', '/api/auth/password/reset', body)
    expect(reuse.status).toBe(422)
    expect(reuse.body.error?.message).toBe('Token set semula kata laluan ini tidak sah.')
  })

  it('reset: a token expires after 60 minutes (BR-10)', async () => {
    await call('POST', '/api/auth/password/email', { email: 'ppd@demo.test' })
    const token = String(
      runtime.outbox.last(PASSWORD_RESET_OUTBOX_TYPE, 'ppd@demo.test')?.data?.token,
    )
    clock.advance(60 * MINUTE_MS)
    const r = await call('POST', '/api/auth/password/reset', {
      token,
      email: 'ppd@demo.test',
      password: 'baharu1',
      passwordConfirmation: 'baharu1',
    })
    expect(r.body.error?.fields?.email).toBe('Token set semula kata laluan ini tidak sah.')
  })

  it('reset: wrong e-mail, unknown e-mail and bad passwords', async () => {
    const wrongOwner = await call('POST', '/api/auth/password/reset', {
      token: DEMO_RESET_TOKEN,
      email: 'guru@demo.test',
      password: 'baharu1',
      passwordConfirmation: 'baharu1',
    })
    expect(wrongOwner.body.error?.fields?.email).toBe('Token set semula kata laluan ini tidak sah.')
    const unknown = await call('POST', '/api/auth/password/reset', {
      token: DEMO_RESET_TOKEN,
      email: 'tiada@demo.test',
      password: 'baharu1',
      passwordConfirmation: 'baharu1',
    })
    expect(unknown.body.error?.fields?.email).toBe("Kami tidak menemui pengguna dengan alamat emel itu.")
    const short = await call('POST', '/api/auth/password/reset', {
      token: DEMO_RESET_TOKEN,
      email: 'pelajar@demo.test',
      password: '123',
      passwordConfirmation: '124',
    })
    expect(short.body.error?.fields).toEqual({
      password: 'The password field must be at least 6 characters.',
    })
  })

  it('reset: the seeded demo tokens (§6.8)', async () => {
    const good = await call('POST', '/api/auth/password/reset', {
      token: DEMO_RESET_TOKEN,
      email: 'pelajar@demo.test',
      password: 'baharu1',
      passwordConfirmation: 'baharu1',
    })
    expect(good.status).toBe(200)
    const expired = await call('POST', '/api/auth/password/reset', {
      token: DEMO_EXPIRED_TOKEN,
      email: 'pelajar@demo.test',
      password: 'baharu1',
      passwordConfirmation: 'baharu1',
    })
    expect(expired.status).toBe(422)
    expect(expired.body.error?.message).toBe('Token set semula kata laluan ini tidak sah.')
  })

  it('reset: an inactive account with a real token is refused and nothing changes (BR-23, INFERRED)', async () => {
    const row = passwordResets.issue('tidakaktif@demo.test', NOW)
    const r = await call('POST', '/api/auth/password/reset', {
      token: row.id,
      email: 'tidakaktif@demo.test',
      password: 'baharu1',
      passwordConfirmation: 'baharu1',
    })
    expect(r.status).toBe(403)
    expect(r.body.error?.code).toBe('ACCOUNT_INACTIVE')
    expect(users.verifyPassword(11, DEMO_PASSWORD)).toBe(true)
    expect(users.verifyPassword(11, 'baharu1')).toBe(false)
    expect(passwordResets.find(row.id)).toBeDefined()
    expect(users.get(11)!.lastLoginAt).toBeNull()
    expect(sessions.listFor(11)).toHaveLength(0)
  })

  it('uses the same outbox type as the test hooks', () => {
    expect(PASSWORD_RESET_OUTBOX_TYPE).toBe(HOOKS_OUTBOX_TYPE)
  })

  it('IC reset: a match issues a token that resets the password (BR-12)', async () => {
    const r = await call('POST', '/api/auth/password/reset-ic', {
      email: 'pelajar@demo.test',
      icNumber: ' 100101140001 ',
    })
    expect(r.status).toBe(200)
    expect(r.body.data).toMatchObject({ email: 'pelajar@demo.test' })
    const reset = await call('POST', '/api/auth/password/reset', {
      token: r.body.data!.token,
      email: 'pelajar@demo.test',
      password: 'baharu1',
      passwordConfirmation: 'baharu1',
    })
    expect(reset.status).toBe(200)
  })

  it('IC reset: mismatch, no stored IC and unknown e-mail all fail alike', async () => {
    const message = 'Emel atau No Kad Pengenalan tidak sepadan.'
    for (const body of [
      { email: 'pelajar@demo.test', icNumber: '100101140002' },
      { email: 'pelajar2@demo.test', icNumber: '100101140001' },
      { email: 'tiada@demo.test', icNumber: '100101140001' },
    ]) {
      const r = await call('POST', '/api/auth/password/reset-ic', body)
      expect(r.status).toBe(422)
      expect(r.body.error).toMatchObject({ message, fields: { email: message } })
    }
    const missing = await call('POST', '/api/auth/password/reset-ic', { email: '', icNumber: '' })
    expect(missing.body.error?.fields).toEqual({
      email: 'The email field is required.',
      icNumber: 'The ic number field is required.',
    })
  })
})

describe('profile, picture and password (#8, #9, #10)', () => {
  it('needs a session', async () => {
    expect((await call('PUT', '/api/me', { name: 'x' })).status).toBe(401)
    expect((await call('PUT', '/api/me/password', {})).status).toBe(401)
    expect((await call('GET', '/api/me/settings')).status).toBe(401)
    expect((await call('PUT', '/api/me/settings', {})).status).toBe(401)
    expect((await call('POST', '/api/me/picture', new FormData())).status).toBe(401)
  })

  it('PUT /api/me saves the profile, ignores the e-mail and bumps updatedAt (BR-13, BR-14)', async () => {
    const token = await loginToken('pelajar@demo.test')
    clock.advance(MINUTE_MS)
    const r = await call(
      'PUT',
      '/api/me',
      {
        name: '  Nama Baharu ',
        email: 'lain@demo.test',
        phone: '012-3456789',
        bio: 'Motto',
        grade: 9,
        schoolId: 900_002,
      },
      token,
    )
    expect(r.status).toBe(200)
    expect(r.body.status).toBe('Profil berjaya dikemaskini.')
    expect(r.body.data).toMatchObject({
      name: 'Nama Baharu',
      email: 'pelajar@demo.test',
      phone: '012-3456789',
      bio: 'Motto',
      grade: 9,
      schoolId: 900_002,
    })
    expect(Date.parse(r.body.data!.updatedAt as string)).toBe(NOW + MINUTE_MS)
    expect((r.body.data as unknown as UserMe).school?.id).toBe(900_002)
    const me = await call('GET', '/api/me', undefined, token)
    expect((me.body.data as unknown as UserMe).name).toBe('Nama Baharu')
  })

  it.each([
    ['adminsekolah@demo.test', 8],
    ['ppd@demo.test', 9],
    ['jpn@demo.test', 10],
    ['admin@demo.test', 1],
  ])('PUT /api/me ignores schoolId for the staff account %s (tenant scope)', async (email, id) => {
    const token = await loginToken(email)
    const before = users.get(id)!
    const r = await call('PUT', '/api/me', { name: before.name, schoolId: 900_002 }, token)
    expect(r.status).toBe(200)
    expect(users.get(id)!.schoolId).toBe(before.schoolId)
    expect((r.body.data as unknown as UserMe).schoolId).toBe(before.schoolId)
    const cleared = await call('PUT', '/api/me', { name: before.name, schoolId: null }, token)
    expect(cleared.status).toBe(200)
    expect(users.get(id)!.schoolId).toBe(before.schoolId)
  })

  it('PUT /api/me clears optional fields with null and validates (BR-14)', async () => {
    const token = await loginToken('pelajar@demo.test')
    const cleared = await call(
      'PUT',
      '/api/me',
      { name: 'Pelajar Demo', phone: '', bio: null, grade: null, schoolId: null },
      token,
    )
    expect(cleared.body.data).toMatchObject({ phone: null, bio: null, grade: null, schoolId: null })
    const bad = await call(
      'PUT',
      '/api/me',
      { name: '', bio: 'a'.repeat(501), grade: 12, schoolId: 123_456_789 },
      token,
    )
    expect(bad.status).toBe(422)
    expect(bad.body.error?.fields).toEqual({
      name: 'The name field is required.',
      bio: 'The bio field must not be greater than 500 characters.',
      grade: 'The selected grade is invalid.',
      schoolId: 'The selected school id is invalid.',
    })
  })

  it('POST /api/me/picture stores a data URL (BR-15)', async () => {
    const token = await loginToken('pelajar@demo.test')
    const form = new FormData()
    form.append(
      'profilePicture',
      new File([new Uint8Array([1, 2, 3])], 'a.png', { type: 'image/png' }),
    )
    const r = await call('POST', '/api/me/picture', form, token)
    expect(r.status).toBe(200)
    expect(r.body.status).toBe('Gambar profil berjaya dikemaskini.')
    expect(r.body.data).toEqual({ avatarUrl: 'data:image/png;base64,AQID' })
    const me = await call('GET', '/api/me', undefined, token)
    expect((me.body.data as unknown as UserMe).avatarUrl).toBe('data:image/png;base64,AQID')
  })

  it('POST /api/me/picture refuses other types, big files and no file', async () => {
    const token = await loginToken('pelajar@demo.test')
    const gif = new FormData()
    gif.append('profilePicture', new File([new Uint8Array(4)], 'a.gif', { type: 'image/gif' }))
    const type = await call('POST', '/api/me/picture', gif, token)
    expect(type.body.error?.fields).toEqual({
      profilePicture: 'The profile picture field must be a file of type: jpeg, png, webp.',
    })
    const big = new FormData()
    big.append(
      'profilePicture',
      new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'a.jpg', { type: 'image/jpeg' }),
    )
    const size = await call('POST', '/api/me/picture', big, token)
    expect(size.body.error?.fields).toEqual({
      profilePicture: 'The profile picture field must not be greater than 2048 kilobytes.',
    })
    const ok2mb = new FormData()
    ok2mb.append(
      'profilePicture',
      new File([new Uint8Array(2 * 1024 * 1024)], 'a.webp', { type: 'image/webp' }),
    )
    expect((await call('POST', '/api/me/picture', ok2mb, token)).status).toBe(200)
    const none = await call('POST', '/api/me/picture', new FormData(), token)
    expect(none.body.error?.fields).toEqual({
      profilePicture: 'The profile picture field is required.',
    })
  })

  it('PUT /api/me/password checks the current one, keeps the session (BR-16)', async () => {
    const token = await loginToken('pelajar@demo.test')
    const wrong = await call(
      'PUT',
      '/api/me/password',
      { currentPassword: 'salah', password: 'baharu1', passwordConfirmation: 'baharu1' },
      token,
    )
    expect(wrong.body.error?.fields).toEqual({ currentPassword: 'The password is incorrect.' })
    const short = await call(
      'PUT',
      '/api/me/password',
      { currentPassword: DEMO_PASSWORD, password: '123', passwordConfirmation: '456' },
      token,
    )
    expect(short.body.error?.fields).toEqual({
      password: 'The password field must be at least 6 characters.',
    })
    const none = await call('PUT', '/api/me/password', {}, token)
    expect(none.body.error?.fields).toMatchObject({
      currentPassword: 'The current password field is required.',
    })
    const ok = await call(
      'PUT',
      '/api/me/password',
      { currentPassword: DEMO_PASSWORD, password: 'baharu1', passwordConfirmation: 'baharu1' },
      token,
    )
    expect(ok.status).toBe(200)
    expect(ok.body.data).toEqual({ status: 'Kata laluan berjaya dikemaskini.' })
    expect((await call('GET', '/api/me', undefined, token)).status).toBe(200)
    expect((await login('pelajar@demo.test', 'baharu1')).status).toBe(200)
    expect((await login('pelajar@demo.test', DEMO_PASSWORD)).status).toBe(422)
  })
})

describe('settings (#11, #12)', () => {
  const DEFAULTS: UserSettings = {
    spiritualMode: false,
    showBismillahSplash: false,
    subuhPushEnabled: false,
    subuhPushTime: '05:30',
    ramadanModeEnabled: false,
    sahurPushTime: '04:30',
    faith: null,
  }

  it('reads the BR-17 defaults for a user who never saved', async () => {
    const token = await loginToken('pelajar@demo.test')
    const r = await call('GET', '/api/me/settings', undefined, token)
    expect(r.status).toBe(200)
    expect(r.body.data).toEqual(DEFAULTS)
  })

  it('saves every field per user and reads it back', async () => {
    const token = await loginToken('pelajar@demo.test')
    const next: UserSettings = {
      spiritualMode: true,
      showBismillahSplash: true,
      subuhPushEnabled: true,
      subuhPushTime: '05:45',
      ramadanModeEnabled: true,
      sahurPushTime: '03:50',
      faith: 'muslim',
    }
    const saved = await call('PUT', '/api/me/settings', next, token)
    expect(saved.status).toBe(200)
    expect(saved.body.status).toBe('Tetapan berjaya disimpan.')
    expect(saved.body.data).toEqual(next)
    expect((await call('GET', '/api/me/settings', undefined, token)).body.data).toEqual(next)
    expect(userSettings.get(2)).toEqual(next)
    // Other users are unaffected.
    const other = await loginToken('guru@demo.test')
    expect((await call('GET', '/api/me/settings', undefined, other)).body.data).toEqual(DEFAULTS)
    // An unticked checkbox is false, a cleared faith is null.
    const off = await call(
      'PUT',
      '/api/me/settings',
      { ...next, spiritualMode: false, faith: '' },
      token,
    )
    expect(off.body.data).toMatchObject({
      spiritualMode: false,
      showBismillahSplash: true,
      faith: null,
    })
  })

  it('validates times and faith', async () => {
    const token = await loginToken('pelajar@demo.test')
    const r = await call(
      'PUT',
      '/api/me/settings',
      { ...DEFAULTS, subuhPushTime: '25:00', sahurPushTime: '4:30', faith: 'jedi' },
      token,
    )
    expect(r.status).toBe(422)
    expect(r.body.error?.fields).toEqual({
      subuhPushTime: 'The subuh push time field must match the format H:i.',
      sahurPushTime: 'The sahur push time field must match the format H:i.',
      faith: 'The selected faith is invalid.',
    })
  })
})

describe('GET /api/public/stats (#21)', () => {
  it('is public and derived from M04 Q-ELIGIBLE and the M03 counts (DV-05, BR-21)', async () => {
    const r = await call('GET', '/api/public/stats')
    expect(r.status).toBe(200)
    expect(r.body.data).toEqual({ questionCount: 128_989, subjectCount: 31, levelCount: 11 })
  })
})

describe('expireSession hook and the API contract', () => {
  it('registers expireSession on the plugin', () => {
    const m01 = runtime.modules.find((m) => m.id === 'M01')!
    expect(Object.keys(m01.hooks).sort()).toEqual([
      'expireSession',
      'impersonationAudit',
      'pushNotification',
    ])
  })

  it('expireSession ends a token, or every session of a user', async () => {
    const { expireSession } = await import('../../mock/hooks/expire-session')
    const a = await loginToken('pelajar@demo.test')
    const b = await loginToken('pelajar@demo.test')
    expect(expireSession(a)).toBe(1)
    expect((await call('GET', '/api/me', undefined, a)).status).toBe(401)
    expect((await call('GET', '/api/me', undefined, b)).status).toBe(200)
    const open = sessions.listFor(2).length
    expect(open).toBeGreaterThanOrEqual(1)
    expect(expireSession('pelajar@demo.test')).toBe(open)
    expect(sessions.listFor(2)).toHaveLength(0)
    expect((await call('GET', '/api/me', undefined, b)).status).toBe(401)
    expect(expireSession(2)).toBe(0)
    expect(() => expireSession('tiada@demo.test')).toThrow()
  })

  it('the canonical demo accounts all log in with the documented password', async () => {
    for (const account of CANONICAL_ACCOUNTS.filter((a) => a.id !== 11)) {
      const r = await login(account.email)
      expect(r.status, account.email).toBe(200)
    }
  })

  it('the session payload has the ClientSession shape the UI stores', async () => {
    const r = await login('pelajar@demo.test', DEMO_PASSWORD, true)
    const session: ClientSession = {
      ...(r.body.data as { token: string; expiresAt: string; user: UserMe }),
      remember: true,
    }
    // The M01 api types, the F-12 store types and the mock core's `UserMe` stay structurally equal.
    const asStore: StoreSession = session
    const back: ClientSession = asStore
    const core: CoreUserMe = session.user
    const backUser: UserMe = core
    expect([back, backUser]).toBeDefined()
    expect(Object.keys(session).sort()).toEqual(['expiresAt', 'remember', 'token', 'user'])
    expect(Object.keys(session.user).sort()).toEqual(
      [
        'avatarUrl',
        'bio',
        'createdAt',
        'email',
        'grade',
        'id',
        'landingPath',
        'lastLoginAt',
        'name',
        'phone',
        'role',
        'school',
        'schoolId',
        'updatedAt',
      ].sort(),
    )
  })
})
