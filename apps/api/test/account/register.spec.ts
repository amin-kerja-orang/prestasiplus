import { ErrorBodySchema, SessionSchema } from '@pp/contract'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { schoolIdOf } from '../auth/helpers'
import { type AccountTestApp, bootAccountApp, cookieValue, errorOf, fieldsOf, REGISTER_STUDENT, userRow } from './account-helpers'

describe('POST /api/auth/register (mock cases, AC1 and AC6)', () => {
  let t: AccountTestApp
  let schoolId: string
  let n = 0
  const body = (over: Record<string, unknown> = {}) => ({ ...REGISTER_STUDENT, email: `murid.${++n}@ujian.test`, schoolId, ...over })

  beforeAll(async () => {
    t = await bootAccountApp()
    schoolId = await schoolIdOf(t.db, 'DEMO001')
  })
  // Refused attempts count 5 per minute per address: every test starts in a fresh window.
  beforeEach(() => {
    t.clock.advance(61_000)
  })
  afterAll(async () => {
    await t.close()
  })

  it('creates a student, logs in at once and lands on /dashboard (BR-05, BR-24)', async () => {
    const res = await t.http().post('/api/auth/register').send(body({ email: 'murid.baharu@ujian.test' }))
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const session = SessionSchema.parse(res.body.data)
    expect(session.user).toMatchObject({ name: 'Murid Baharu', email: 'murid.baharu@ujian.test', schoolId })
    expect(session.active.role).toBe('student')
    expect(session.landingPath).toBe('/dashboard')
    // The session cookie is set and works; the response is never cached (D57b).
    expect(cookieValue(res)).toBeTruthy()
    expect(res.headers['cache-control']).toBe('no-store')
    // The IC never comes back; it is stored hashed and masked; the password is argon2id.
    expect(JSON.stringify(res.body)).not.toContain('100101140077')
    const row = await userRow(t.db, 'murid.baharu@ujian.test')
    expect(row?.ic_masked).toBe('xxxxxx-xx-xx77')
    expect(row?.ic_hash).toMatch(/^[0-9a-f]{64}$/)
    expect(row?.ic_hash).not.toContain('100101140077')
    expect(row?.password_hash).toMatch(/^\$argon2id\$/)
    expect(row?.grade).toBe(3)
    expect(row?.must_reset_password).toBe(false)
    const roles = await t.db.query<{ role: string }>(`select role from user_roles where user_id = $1::bigint`, [row?.id])
    expect(roles.map((r) => r.role)).toEqual(['student'])
    const login = await t.http().post('/api/auth/login').send({ identifier: 'murid.baharu@ujian.test', password: 'rahsia1' })
    expect(login.status).toBe(200)
    const lastLogin = await t.db.query<{ at: string | null }>(`select last_login_at::text as at from users where id = $1::bigint`, [row?.id])
    expect(lastLogin[0]?.at).not.toBeNull()
  })

  it('registers a teacher: grade and IC are ignored (BR-04); a teacher needs a school', async () => {
    const res = await t.http().post('/api/auth/register').send(body({ role: 'teacher', email: 'cikgu.baharu@ujian.test' }))
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    expect(SessionSchema.parse(res.body.data).active.role).toBe('teacher')
    const row = await userRow(t.db, 'cikgu.baharu@ujian.test')
    expect(row?.grade).toBeNull()
    expect(row?.ic_hash).toBeNull()
    expect(row?.ic_masked).toBeNull()

    const noSchool = await t.http().post('/api/auth/register').send(body({ role: 'teacher', schoolId: undefined }))
    expect(fieldsOf(noSchool)).toEqual({ schoolId: 'The school id field is required when role is teacher.' })
  })

  it('needs no grade for a parent, but requires it for a student', async () => {
    const s = await t.http().post('/api/auth/register').send(body({ grade: null }))
    expect(fieldsOf(s)).toEqual({ grade: 'The grade field is required.' })
    const p = await t.http().post('/api/auth/register').send(body({ role: 'parent', grade: null, schoolId: undefined }))
    expect(p.status, JSON.stringify(p.body)).toBe(201)
    expect(SessionSchema.parse(p.body.data).active.role).toBe('parent')
  })

  it('returns the Laravel copy of SRS section 5, one message per field, with the summary message', async () => {
    const r = await t.http().post('/api/auth/register').send(
      body({ name: '', email: 'pelajar@demo.test', grade: 3, password: '123', passwordConfirmation: '456' }),
    )
    expect(fieldsOf(r)).toEqual({
      name: 'The name field is required.',
      email: 'The email has already been taken.',
      password: 'The password field must be at least 6 characters.',
    })
    expect(ErrorBodySchema.parse(r.body).error.message).toBe('The name field is required. (and 2 more errors)')
    const c = await t.http().post('/api/auth/register').send(body({ passwordConfirmation: 'lain' }))
    expect(fieldsOf(c)).toEqual({ password: 'The password field confirmation does not match.' })
  })

  it('treats e-mail uniqueness case-insensitively (duplicate e-mail is 422 fields.email)', async () => {
    const r = await t.http().post('/api/auth/register').send(body({ email: 'PELAJAR@demo.test' }))
    expect(fieldsOf(r)).toEqual({ email: 'The email has already been taken.' })
  })

  it('refuses roles other than student, teacher and parent, unknown schools and over-long values', async () => {
    for (const role of ['admin', 'school_admin', 'ppd_officer', 'sponsor']) {
      t.clock.advance(61_000) // keep clear of the refusal budget
      const a = await t.http().post('/api/auth/register').send(body({ role }))
      expect(fieldsOf(a), role).toEqual({ role: 'The selected role is invalid.' })
    }
    t.clock.advance(61_000)
    const s = await t.http().post('/api/auth/register').send(body({ schoolId: '123456789' }))
    expect(fieldsOf(s)).toEqual({ schoolId: 'The selected school id is invalid.' })
    const l = await t.http().post('/api/auth/register').send(body({ phone: '0'.repeat(15), icNumber: '1'.repeat(15) }))
    expect(Object.keys(fieldsOf(l)).sort()).toEqual(['icNumber', 'phone'])
    t.clock.advance(61_000)
    const f = await t.http().post('/api/auth/register').send(body({ icNumber: '12345' }))
    expect(fieldsOf(f)).toEqual({ icNumber: 'The ic number field format is invalid.' })
  })

  it('never lets the client choose isActive, mustChangePassword or extra keys (ignored, not stored)', async () => {
    const res = await t
      .http()
      .post('/api/auth/register')
      .send(body({ email: 'extra@ujian.test', isActive: false, mustChangePassword: true, id: '1', roles: ['admin'] }))
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const row = await userRow(t.db, 'extra@ujian.test')
    expect(row?.must_reset_password).toBe(false)
    const roles = await t.db.query<{ role: string }>(`select role from user_roles where user_id = $1::bigint`, [row?.id])
    expect(roles.map((r) => r.role)).toEqual(['student'])
    const active = await t.db.query<{ is_active: boolean }>(`select is_active from users where id = $1::bigint`, [row?.id])
    expect(active[0]?.is_active).toBe(true)
  })

  it('accepts an unknown referral code silently (FR-M01-70)', async () => {
    const r = await t.http().post('/api/auth/register').send(body({ referralCode: 'TIADA-KOD' }))
    expect(r.status, JSON.stringify(r.body)).toBe(201)
  })

  it('two sign-ups racing for one e-mail: one account, the other is 422 fields.email', async () => {
    const same = body({ email: 'lumba@ujian.test' })
    const [a, b] = await Promise.all([
      t.http().post('/api/auth/register').send(same),
      t.http().post('/api/auth/register').send(same),
    ])
    expect([a.status, b.status].sort()).toEqual([201, 422])
    const count = await t.db.query<{ n: string }>(`select count(*)::text as n from users where lower(email) = 'lumba@ujian.test'`)
    expect(count[0]?.n).toBe('1')
  })

  it('AC6: 5 refused attempts per minute per address, then 429 with retryAfter (even for a valid body); created accounts do not count', async () => {
    t.clock.advance(120_000)
    // Successful sign-ups never use up the budget.
    for (let i = 0; i < 7; i++) {
      const ok = await t.http().post('/api/auth/register').send(body({ role: 'parent', grade: null, schoolId: undefined }))
      expect(ok.status, JSON.stringify(ok.body)).toBe(201)
    }
    for (let i = 0; i < 5; i++) {
      const bad = await t.http().post('/api/auth/register').send(body({ email: 'pelajar@demo.test' }))
      expect(bad.status).toBe(422)
    }
    const blocked = await t.http().post('/api/auth/register').send(body())
    const err = errorOf(blocked, 429, 'RATE_LIMITED')
    expect(err.retryAfter).toBeGreaterThan(0)
    expect(blocked.headers['retry-after']).toBe(String(err.retryAfter))
    t.clock.advance(61_000)
    const again = await t.http().post('/api/auth/register').send(body())
    expect(again.status, JSON.stringify(again.body)).toBe(201)
  })
})
