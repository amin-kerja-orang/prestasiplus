import { ACCOUNT_MESSAGES, SessionSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { bcryptHashWithSalt } from '../../src/modules/auth/legacy-bcrypt'
import { schoolIdOf } from '../auth/helpers'
import { type AccountTestApp, bootAccountApp, cookieValue, DEMO_PASSWORD, fieldsOf, get, login, post, put, userRow } from './account-helpers'

const MUST_DIFFER = 'The password field and current password must be different.'
const SALT = 'abcdefghijklmnopqrstuu'

describe('PUT /me/password: the new password must differ from the current one (hardening, SRS SEC-M01-21c)', () => {
  let t: AccountTestApp
  let school: string

  beforeAll(async () => {
    t = await bootAccountApp()
    school = await schoolIdOf(t.db, 'DEMO001')
  })
  afterAll(async () => {
    await t.close()
  })

  const loginStatus = async (identifier: string, password: string) =>
    (await t.http().post('/api/auth/login').send({ identifier, password })).status

  const auditCount = async (action: string) =>
    Number((await t.db.query<{ n: string }>('select count(*)::text as n from audit_events where action = $1', [action]))[0]?.n)

  it('a flagged account (admin-created, one-time password) cannot clear the flag with the same password', async () => {
    const admin = await login(t, 'admin@demo.test')
    const created = await post(admin, '/admin/users', { roles: ['teacher'], name: 'Guru Sama', email: 'sama@ujian.test', schoolId: school })
    expect(created.status, JSON.stringify(created.body)).toBe(201)
    const generated = created.body.data.generatedPassword as string

    const who = await login(t, 'sama@ujian.test', generated)
    const other = await login(t, 'sama@ujian.test', generated)
    const before = await userRow(t.db, 'sama@ujian.test')
    expect(before?.must_reset_password).toBe(true)
    const changedBefore = await auditCount('account.password.changed')

    const res = await put(who, '/me/password', { currentPassword: generated, password: generated, passwordConfirmation: generated })
    expect(res.status, JSON.stringify(res.body)).toBe(422)
    expect(fieldsOf(res)).toEqual({ password: MUST_DIFFER })
    expect(res.body.error.message).toBe(MUST_DIFFER)

    // Nothing written: flag set, hash identical, old password still signs in.
    const after = await userRow(t.db, 'sama@ujian.test')
    expect(after?.must_reset_password).toBe(true)
    expect(after?.password_hash).toBe(before?.password_hash)
    expect(await loginStatus('sama@ujian.test', generated)).toBe(200)
    // No session rotation (no new cookie, the same cookie and CSRF still work) and the other session survives.
    expect(cookieValue(res)).toBeFalsy()
    const session = SessionSchema.parse((await get(who, '/session')).body.data)
    expect(session.csrf).toBe(who.csrf)
    expect(session.mustChangePassword).toBe(true)
    expect((await t.http().get('/api/session').set('Cookie', `pp_session=${who.token}`)).status).toBe(200)
    expect((await other.agent.get('/api/session')).status).toBe(200)
    // No "changed" audit row.
    expect(await auditCount('account.password.changed')).toBe(changedBefore)

    // A different password still works as before: flag cleared, session rotated, other session revoked.
    const ok = await put(who, '/me/password', { currentPassword: generated, password: 'Baharu1234', passwordConfirmation: 'Baharu1234' })
    expect(ok.status, JSON.stringify(ok.body)).toBe(200)
    expect(ok.body).toEqual({ data: { status: ACCOUNT_MESSAGES.passwordChanged } })
    expect((await userRow(t.db, 'sama@ujian.test'))?.must_reset_password).toBe(false)
    expect(cookieValue(ok)).toBeTruthy()
    expect(cookieValue(ok)).not.toBe(who.token)
    expect((await other.agent.get('/api/session')).status).toBe(401)
    expect(await loginStatus('sama@ujian.test', 'Baharu1234')).toBe(200)
    expect(await loginStatus('sama@ujian.test', generated)).toBe(401)
    expect(await auditCount('account.password.changed')).toBe(changedBefore + 1)
  })

  it('an unflagged account is refused the same way; a wrong current password is still reported on currentPassword first', async () => {
    const who = await login(t, 'pelajar@demo.test')
    const other = await login(t, 'pelajar@demo.test')
    const before = await userRow(t.db, 'pelajar@demo.test')

    const wrong = await put(who, '/me/password', { currentPassword: 'salah-sungguh', password: 'salah-sungguh', passwordConfirmation: 'salah-sungguh' })
    expect(wrong.status).toBe(422)
    expect(fieldsOf(wrong)).toEqual({ currentPassword: 'The password is incorrect.' })

    const same = await put(who, '/me/password', { currentPassword: DEMO_PASSWORD, password: DEMO_PASSWORD, passwordConfirmation: DEMO_PASSWORD })
    expect(same.status, JSON.stringify(same.body)).toBe(422)
    expect(fieldsOf(same)).toEqual({ password: MUST_DIFFER })
    expect((await userRow(t.db, 'pelajar@demo.test'))?.password_hash).toBe(before?.password_hash)
    expect(cookieValue(same)).toBeFalsy()
    expect((await get(who, '/session')).status).toBe(200)
    expect((await other.agent.get('/api/session')).status).toBe(200)
    expect(await loginStatus('pelajar@demo.test', DEMO_PASSWORD)).toBe(200)

    // Only exact equality is refused: a different password is accepted.
    const near = await put(who, '/me/password', { currentPassword: DEMO_PASSWORD, password: `${DEMO_PASSWORD}x`, passwordConfirmation: `${DEMO_PASSWORD}x` })
    expect(near.status, JSON.stringify(near.body)).toBe(200)
  })

  it('recognises "the same" against a legacy bcrypt hash (flagged migrated account) as well', async () => {
    await t.db.query(`update users set password_hash = $1, must_reset_password = true where email = 'guru@demo.test'`, [
      bcryptHashWithSalt(DEMO_PASSWORD, SALT, 4, '2y'),
    ])
    const who = await login(t, 'guru@demo.test')
    // Put the legacy hash back (the login may have rehashed it to argon2id) so the check runs against bcrypt.
    await t.db.query(`update users set password_hash = $1 where email = 'guru@demo.test'`, [bcryptHashWithSalt(DEMO_PASSWORD, SALT, 4, '2y')])
    const same = await put(who, '/me/password', { currentPassword: DEMO_PASSWORD, password: DEMO_PASSWORD, passwordConfirmation: DEMO_PASSWORD })
    expect(same.status, JSON.stringify(same.body)).toBe(422)
    expect(fieldsOf(same)).toEqual({ password: MUST_DIFFER })
    const row = await userRow(t.db, 'guru@demo.test')
    expect(row?.must_reset_password).toBe(true)
    expect(row?.password_hash).toMatch(/^\$2y\$/)
  })
})
