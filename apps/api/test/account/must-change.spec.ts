import { ACCOUNT_MESSAGES, ErrorBodySchema, SessionSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { SubscriptionsModule } from '../../src/modules/subscriptions'
import { schoolIdOf } from '../auth/helpers'
import { type AccountTestApp, bootAccountApp, cookieValue, get, login, post, put, userRow, type Who } from './account-helpers'
import { makePng } from '../files/fixtures'

const MESSAGE = 'Sila tukar kata laluan anda sebelum meneruskan.'

describe('forced password change: global guard on must_reset_password (AC 4)', () => {
  let t: AccountTestApp
  let school: string
  let generated: string
  let unflagged: { responseFlag: unknown; rowFlag: boolean | undefined; sessionFlag: boolean }

  beforeAll(async () => {
    t = await bootAccountApp({ modules: [SubscriptionsModule] })
    school = await schoolIdOf(t.db, 'DEMO001')
    const admin = await login(t, 'admin@demo.test')
    const created = await post(admin, '/admin/users', { roles: ['teacher'], name: 'Guru Paksa', email: 'paksa@ujian.test', schoolId: school })
    expect(created.status, JSON.stringify(created.body)).toBe(201)
    generated = created.body.data.generatedPassword as string
    // R39: the admin-created account is NOT flagged. Capture that, then set the flag directly: the guard is what this
    // file tests, and only an operator action (admin bootstrap, a manual reset) flags an account now.
    const who = await login(t, 'paksa@ujian.test', generated)
    unflagged = { responseFlag: created.body.data.mustChangePassword, rowFlag: (await userRow(t.db, 'paksa@ujian.test'))?.must_reset_password, sessionFlag: who.session.mustChangePassword }
    await t.db.query(`update users set must_reset_password = true where email = 'paksa@ujian.test'`)
  })
  afterAll(async () => {
    await t.close()
  })

  const refused = (res: { status: number; body: unknown }) => {
    expect(res.status).toBe(403)
    const err = ErrorBodySchema.parse(res.body).error
    expect(err.code).toBe('PASSWORD_CHANGE_REQUIRED')
    expect(err.message).toBe(MESSAGE)
  }

  it('an admin-created account is not flagged (R39: no forced change at go-live): row and session report false', () => {
    expect(unflagged).toEqual({ responseFlag: false, rowFlag: false, sessionFlag: false })
  })

  it('a flagged account (flag set directly) logs in and the session carries mustChangePassword = true', async () => {
    const who = await login(t, 'paksa@ujian.test', generated)
    expect(who.session.mustChangePassword).toBe(true)
    const again = SessionSchema.parse((await get(who, '/session')).body.data)
    expect(again.mustChangePassword).toBe(true)
  })

  it('a normal account is unaffected: flag false, routes answer', async () => {
    const who = await login(t, 'pelajar@demo.test')
    expect(who.session.mustChangePassword).toBe(false)
    expect((await get(who, '/me')).status).toBe(200)
    expect((await get(who, '/me/settings')).status).toBe(200)
  })

  it('every other authenticated route answers 403 PASSWORD_CHANGE_REQUIRED while the flag is set (role and mode switch included)', async () => {
    const who = await login(t, 'paksa@ujian.test', generated)
    for (const path of ['/me', '/me/settings', '/me/notifications', '/me/notifications/unread-count', '/admin/users', '/admin/schools', `/admin/schools/${school}/quota`]) {
      refused(await get(who, path))
    }
    refused(await put(who, '/me', { name: 'x' }))
    refused(await put(who, '/me/settings', {}))
    refused(await post(who, '/session/role', { role: 'teacher' }))
    refused(await post(who, '/session/mode', {}))
    refused(await post(who, '/me/notifications/read-all', {}))
    const pic = await who.agent.post('/api/me/picture').set('X-CSRF-Token', who.csrf).attach('profilePicture', makePng(), { filename: 'a.png', contentType: 'image/png' })
    refused(pic)
    // A write without CSRF still hits the CSRF check first (the session is resolved before the guard).
    expect((await who.agent.put('/api/me').send({ name: 'x' })).status).toBe(403)
  })

  it('public routes are unaffected, and logout works', async () => {
    const who = await login(t, 'paksa@ujian.test', generated)
    expect((await t.http().get('/api/public/stats')).status).toBe(200)
    expect((await t.http().post('/api/auth/password/email').send({ email: 'paksa@ujian.test' })).status).toBe(200)
    expect((await who.agent.post('/api/auth/logout').set('X-CSRF-Token', who.csrf)).status).toBe(204)
  })

  it('the allow-list is enough: GET /session gives the CSRF token, PUT /me/password clears the flag and rotates the session', async () => {
    const who: Who = await login(t, 'paksa@ujian.test', generated)
    // The CSRF token the client needs is in GET /session (allowed).
    const current = SessionSchema.parse((await get(who, '/session')).body.data)
    expect(current.csrf).toBe(who.csrf)

    const wrong = await put(who, '/me/password', { currentPassword: 'salah', password: 'Baharu1234', passwordConfirmation: 'Baharu1234' })
    expect(wrong.status).toBe(422)
    const ok = await put(who, '/me/password', { currentPassword: generated, password: 'Baharu1234', passwordConfirmation: 'Baharu1234' })
    expect(ok.status, JSON.stringify(ok.body)).toBe(200)
    expect(ok.body).toEqual({ data: { status: ACCOUNT_MESSAGES.passwordChanged } })
    expect((await userRow(t.db, 'paksa@ujian.test'))?.must_reset_password).toBe(false)

    // The old cookie is dead; the new one (kept by the agent) works and reports the flag as false.
    const fresh = cookieValue(ok)
    expect(fresh).toBeTruthy()
    expect(fresh).not.toBe(who.token)
    expect((await t.http().get('/api/session').set('Cookie', `pp_session=${who.token}`)).status).toBe(401)
    const after = SessionSchema.parse((await get(who, '/session')).body.data)
    expect(after.mustChangePassword).toBe(false)
    expect(after.csrf).not.toBe(who.csrf)
    const next: Who = { ...who, csrf: after.csrf }
    expect((await get(next, '/me')).status).toBe(200)
    expect((await put(next, '/me', { name: 'Guru Paksa' })).status).toBe(200)
  })

  it('the flag is read fresh on every request: setting it on a live session blocks it at once, clearing it unblocks', async () => {
    const who = await login(t, 'pelajar2@demo.test')
    expect((await get(who, '/me')).status).toBe(200)
    await t.db.query(`update users set must_reset_password = true where email = 'pelajar2@demo.test'`)
    refused(await get(who, '/me'))
    expect(SessionSchema.parse((await get(who, '/session')).body.data).mustChangePassword).toBe(true)
    await t.db.query(`update users set must_reset_password = false where email = 'pelajar2@demo.test'`)
    expect((await get(who, '/me')).status).toBe(200)
  })
})
