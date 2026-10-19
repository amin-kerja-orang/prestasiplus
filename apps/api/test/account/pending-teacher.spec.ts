import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { schoolIdOf } from '../auth/helpers'
import { type AccountTestApp, bootAccountApp, DEMO_PASSWORD, errorOf, login, userRow } from './account-helpers'

describe('a self-registered or unverified teacher has no scope (privacy over fidelity, LEAD 2026-10-20)', () => {
  let t: AccountTestApp
  let school: string

  beforeAll(async () => {
    t = await bootAccountApp()
    school = await schoolIdOf(t.db, 'DEMO001')
  })
  afterAll(async () => {
    await t.close()
  })

  it('cannot log in at all and has school_id NULL, so there is no scope to read pupils, classes or performance', async () => {
    const reg = await t.http().post('/api/auth/register').send({
      name: 'Guru Menunggu',
      email: 'menunggu@ujian.test',
      role: 'teacher',
      schoolId: school,
      password: 'rahsia1',
      passwordConfirmation: 'rahsia1',
    })
    expect(reg.status).toBe(201)
    const row = await userRow(t.db, 'menunggu@ujian.test')
    expect(row?.school_id).toBeNull()
    const login1 = await t.http().post('/api/auth/login').send({ identifier: 'menunggu@ujian.test', password: 'rahsia1' })
    errorOf(login1, 403, 'ACCOUNT_INACTIVE')
    // No session row was ever created for it.
    const sessions = await t.db.query<{ n: string }>('select count(*)::text as n from sessions where user_id = $1::bigint', [row?.id])
    expect(sessions[0]?.n).toBe('0')
    // The password reset does not open a door either: a token cannot be issued for an inactive account.
    const link = await t.http().post('/api/auth/password/email').send({ email: 'menunggu@ujian.test' })
    expect(link.status).toBe(200)
    expect(t.mail.sent).toHaveLength(0)
  })

  it('DB state: an inactive teacher with pending_school_id set gets 401 on every staff route, even with a live session from before', async () => {
    const who = await login(t, 'guru@demo.test', DEMO_PASSWORD)
    expect((await who.agent.get('/api/session')).status).toBe(200)
    await t.db.query(`update users set is_active = false, school_id = null, pending_school_id = $1::bigint where email = 'guru@demo.test'`, [school])
    for (const path of ['/api/session', '/api/admin/users', '/api/admin/schools', '/api/me', '/api/me/settings']) {
      errorOf(await who.agent.get(path), 401, 'UNAUTHORIZED')
    }
    // And a fresh login is refused.
    errorOf(await t.http().post('/api/auth/login').send({ identifier: 'guru@demo.test', password: DEMO_PASSWORD }), 403, 'ACCOUNT_INACTIVE')
  })

  it('DB state: an ACTIVE teacher whose school_id is NULL cannot hold a session either (fail closed)', async () => {
    await t.db.query(`update users set is_active = true where email = 'guru@demo.test'`)
    const res = await t.http().post('/api/auth/login').send({ identifier: 'guru@demo.test', password: DEMO_PASSWORD })
    errorOf(res, 403, 'ACCOUNT_INACTIVE')
  })
})
