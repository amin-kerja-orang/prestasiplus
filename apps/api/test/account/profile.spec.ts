import {
  ACCOUNT_MESSAGES,
  ACCOUNT_PICTURE_MESSAGES,
  ACCOUNT_SETTINGS_DEFAULTS,
  AccountPlatformStatsSchema,
  AccountSettingsSchema,
  AccountUserMeSchema,
  ErrorBodySchema,
  SessionSchema,
  accountUserMeMismatches,
} from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { makePng } from '../files/fixtures'
import { schoolIdOf } from '../auth/helpers'
import {
  type AccountTestApp,
  bootAccountApp,
  cookieValue,
  DEMO_PASSWORD,
  errorOf,
  fieldsOf,
  get,
  login,
  post,
  put,
  userRow,
  type Who,
} from './account-helpers'

const STUDENT = 'pelajar@demo.test'

describe('GET/PUT /api/me, password, picture, settings, stats (AC1, AC5, AC8, AC9)', () => {
  let t: AccountTestApp
  let school2: string

  beforeAll(async () => {
    t = await bootAccountApp()
    school2 = await schoolIdOf(t.db, 'DEMO002')
  })
  afterAll(async () => {
    await t.close()
  })

  describe('authentication and CSRF', () => {
    it('every /me route needs a session (401) and a CSRF header on writes (403)', async () => {
      for (const [method, path] of [
        ['get', '/api/me'],
        ['put', '/api/me'],
        ['put', '/api/me/password'],
        ['post', '/api/me/picture'],
        ['get', '/api/me/settings'],
        ['put', '/api/me/settings'],
      ] as const) {
        errorOf(await t.http()[method](path).send({}), 401, 'UNAUTHORIZED')
      }
      const who = await login(t, STUDENT)
      errorOf(await who.agent.put('/api/me').send({ name: 'x' }), 403, 'CSRF_INVALID')
      errorOf(await who.agent.put('/api/me/settings').send({}), 403, 'CSRF_INVALID')
      errorOf(await who.agent.put('/api/me/password').send({}), 403, 'CSRF_INVALID')
    })
  })

  describe('GET /me agrees with GET /session (AC8)', () => {
    const SEEDED = [
      'pelajar@demo.test',
      'pelajarmaju@demo.test',
      'pelajar2@demo.test',
      'guru@demo.test',
      'adminsekolah@demo.test',
      'admin@demo.test',
      'guruadmin@demo.test',
    ]
    it.each(SEEDED)('id, name, e-mail, username, avatar, school, roles, active role and landing path match for %s', async (email) => {
      const who = await login(t, email)
      const res = await get(who, '/me')
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(res.headers['cache-control']).toBe('no-store')
      const me = AccountUserMeSchema.parse(res.body.data)
      const session = SessionSchema.parse((await get(who, '/session')).body.data)
      expect(accountUserMeMismatches(me, session)).toEqual([])
      expect(me.email).toBe(email)
      // Never in the projection.
      const text = JSON.stringify(res.body)
      for (const word of ['password', 'icHash', 'icMasked', 'isActive', 'passwordHash', 'rememberToken']) expect(text).not.toContain(word)
    })

    it('a roster pupil without an e-mail (username login) agrees too, and a school member sees the school summary', async () => {
      const schoolId = await schoolIdOf(t.db, 'DEMO002')
      const agent = t.agent()
      const res = await agent.post('/api/auth/login').send({ identifier: 'murid01', password: DEMO_PASSWORD, schoolId })
      expect(res.status).toBe(200)
      const session = SessionSchema.parse(res.body.data)
      const me = AccountUserMeSchema.parse((await agent.get('/api/me')).body.data)
      expect(accountUserMeMismatches(me, session)).toEqual([])
      expect(me.email).toBeNull()
      expect(me.school).toMatchObject({ id: schoolId, name: 'SK Demo Dua', code: 'DEMO002' })
    })

    it('the active role follows a role switch', async () => {
      const who = await login(t, 'guruadmin@demo.test')
      const sw = await post(who, '/session/role', { role: 'teacher' })
      expect(sw.status).toBe(200)
      const other: Who = { ...who, csrf: SessionSchema.parse(sw.body.data).csrf }
      const me = AccountUserMeSchema.parse((await get(other, '/me')).body.data)
      const session = SessionSchema.parse((await get(other, '/session')).body.data)
      expect(me.role).toBe('teacher')
      expect(accountUserMeMismatches(me, session)).toEqual([])
    })
  })

  describe('PUT /me (BR-13, BR-14)', () => {
    it('saves the profile, ignores the e-mail and unknown keys, trims, and bumps updatedAt', async () => {
      const who = await login(t, 'pelajar2@demo.test')
      t.clock.advance(60_000)
      const res = await put(who, '/me', {
        name: '  Nama Baharu ',
        email: 'lain@ujian.test',
        phone: '012-3456789',
        bio: 'Motto',
        grade: 9,
        schoolId: school2,
        isActive: false,
        roles: ['admin'],
      })
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(res.body.status).toBe(ACCOUNT_MESSAGES.profileSaved)
      const me = AccountUserMeSchema.parse(res.body.data)
      expect(me).toMatchObject({ name: 'Nama Baharu', email: 'pelajar2@demo.test', phone: '012-3456789', bio: 'Motto', grade: 9, schoolId: school2, role: 'student', roles: ['student'] })
      expect(me.school?.id).toBe(school2)
      expect(me.updatedAt).toBe('2026-10-19T09:01:00.000+08:00')
      const again = AccountUserMeSchema.parse((await get(who, '/me')).body.data)
      expect(again.name).toBe('Nama Baharu')
      const row = await userRow(t.db, 'pelajar2@demo.test')
      expect(row?.name).toBe('Nama Baharu')
      const active = await t.db.query<{ is_active: boolean }>(`select is_active from users where id = $1::bigint`, [row?.id])
      expect(active[0]?.is_active).toBe(true)
    })

    it('an absent key keeps the value; null or blank clears phone, bio, grade and school', async () => {
      const who = await login(t, 'pelajar2@demo.test')
      const kept = AccountUserMeSchema.parse((await put(who, '/me', { name: 'Nama Baharu' })).body.data)
      expect(kept).toMatchObject({ phone: '012-3456789', bio: 'Motto', grade: 9, schoolId: school2 })
      const cleared = AccountUserMeSchema.parse((await put(who, '/me', { name: 'Nama Baharu', phone: '', bio: null, grade: null, schoolId: null })).body.data)
      expect(cleared).toMatchObject({ phone: null, bio: null, grade: null, schoolId: null, school: null })
    })

    it('validates with the mock copy, one message per field', async () => {
      const who = await login(t, 'pelajar2@demo.test')
      const res = await put(who, '/me', { name: '', bio: 'a'.repeat(501), grade: 12, schoolId: '123456789' })
      expect(fieldsOf(res)).toEqual({
        name: 'The name field is required.',
        bio: 'The bio field must not be greater than 500 characters.',
        grade: 'The selected grade is invalid.',
        schoolId: 'The selected school id is invalid.',
      })
      expect(ErrorBodySchema.parse(res.body).error.message).toBe('The name field is required. (and 3 more errors)')
      const long = await put(who, '/me', { name: 'x', phone: '0'.repeat(15) })
      expect(fieldsOf(long)).toEqual({ phone: 'The phone field must not be greater than 14 characters.' })
    })

    it.each(['adminsekolah@demo.test', 'admin@demo.test'])('ignores schoolId for the staff account %s (tenant scope)', async (email) => {
      const who = await login(t, email)
      const before = AccountUserMeSchema.parse((await get(who, '/me')).body.data)
      const changed = await put(who, '/me', { name: before.name, schoolId: school2 })
      expect(changed.status, JSON.stringify(changed.body)).toBe(200)
      expect(AccountUserMeSchema.parse(changed.body.data).schoolId).toBe(before.schoolId)
      const cleared = await put(who, '/me', { name: before.name, schoolId: null })
      expect(AccountUserMeSchema.parse(cleared.body.data).schoolId).toBe(before.schoolId)
    })

    it('school membership is an ALLOW-list: a student sets it, any other role (even a new one) ignores it', async () => {
      const hash = (await t.db.query<{ h: string }>("select password_hash as h from users where email = 'pelajar@demo.test'"))[0]?.h
      const sponsor = (
        await t.db.query<{ id: string }>("insert into users (name, email, password_hash, school_id) values ('Penaja Ujian', 'penaja@ujian.test', $1, $2::bigint) returning id::text", [hash, school2])
      )[0]?.id
      await t.db.query("insert into user_roles (user_id, role) values ($1::bigint, 'sponsor')", [sponsor])
      const who = await login(t, 'penaja@ujian.test')
      const other = await schoolIdOf(t.db, 'DEMO001')
      const res = await put(who, '/me', { name: 'Penaja Ujian', schoolId: other })
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(AccountUserMeSchema.parse(res.body.data).schoolId).toBe(school2)
      const student = await login(t, 'pelajar2@demo.test')
      const set = await put(student, '/me', { name: 'Nama Baharu', schoolId: school2 })
      expect(set.status, JSON.stringify(set.body)).toBe(200)
      expect(AccountUserMeSchema.parse(set.body.data).schoolId).toBe(school2)
    })

    it('a student whose username already exists in the target school gets 422, not 500', async () => {
      const who = await login(t, 'pelajar@demo.test') // username murid01; DEMO002 already has a murid01
      const res = await put(who, '/me', { name: 'Murid Demo', schoolId: school2 })
      expect(fieldsOf(res)).toEqual({ schoolId: 'The username has already been taken.' })
    })

    it('a teacher cannot change or clear the school: schoolId is ignored (membership is managed by school_admin/admin)', async () => {
      const who = await login(t, 'guru@demo.test')
      const before = AccountUserMeSchema.parse((await get(who, '/me')).body.data)
      const changed = await put(who, '/me', { name: 'Guru Demo', schoolId: school2 })
      expect(changed.status, JSON.stringify(changed.body)).toBe(200)
      expect(AccountUserMeSchema.parse(changed.body.data).schoolId).toBe(before.schoolId)
      const cleared = await put(who, '/me', { name: 'Guru Demo', schoolId: null })
      expect(AccountUserMeSchema.parse(cleared.body.data).schoolId).toBe(before.schoolId)
    })
  })

  describe('PUT /me/password (BR-16, AC5)', () => {
    it('needs the current password; validates; rehashes with argon2id; rotates the caller session; ends the other sessions', async () => {
      const who = await login(t, 'pelajarmaju@demo.test')
      const otherDevice = await login(t, 'pelajarmaju@demo.test')

      const wrong = await put(who, '/me/password', { currentPassword: 'salah', password: 'baharu1', passwordConfirmation: 'baharu1' })
      expect(fieldsOf(wrong)).toEqual({ currentPassword: 'The password is incorrect.' })
      const short = await put(who, '/me/password', { currentPassword: DEMO_PASSWORD, password: '123', passwordConfirmation: '456' })
      expect(fieldsOf(short)).toEqual({ password: 'The password field must be at least 6 characters.' })
      const none = await put(who, '/me/password', {})
      expect(fieldsOf(none)).toMatchObject({ currentPassword: 'The current password field is required.' })

      const ok = await put(who, '/me/password', { currentPassword: DEMO_PASSWORD, password: 'baharu1', passwordConfirmation: 'baharu1' })
      expect(ok.status, JSON.stringify(ok.body)).toBe(200)
      expect(ok.body).toEqual({ data: { status: ACCOUNT_MESSAGES.passwordChanged } })
      expect(ok.headers['cache-control']).toBe('no-store')
      expect((await userRow(t.db, 'pelajarmaju@demo.test'))?.password_hash).toMatch(/^\$argon2id\$/)
      // The caller's session is rotated (new cookie, old one dead); the agent keeps the new cookie. The other device is gone.
      expect(cookieValue(ok)).toBeTruthy()
      expect(cookieValue(ok)).not.toBe(who.token)
      expect((await t.http().get('/api/session').set('Cookie', `pp_session=${who.token}`)).status).toBe(401)
      const fresh = await get(who, '/session')
      expect(fresh.status).toBe(200)
      expect(SessionSchema.parse(fresh.body.data).csrf).not.toBe(who.csrf)
      await otherDevice.agent.get('/api/session').expect(401)
      expect((await t.http().post('/api/auth/login').send({ identifier: 'pelajarmaju@demo.test', password: 'baharu1' })).status).toBe(200)
      expect((await t.http().post('/api/auth/login').send({ identifier: 'pelajarmaju@demo.test', password: DEMO_PASSWORD })).status).toBe(401)
    })

    it('a wrong current password is counted: 5 per minute per user, then 429 even with the right one', async () => {
      const who = await login(t, 'pelajar@demo.test')
      for (let i = 0; i < 5; i++) {
        expect((await put(who, '/me/password', { currentPassword: 'salah', password: 'baharu1', passwordConfirmation: 'baharu1' })).status).toBe(422)
      }
      const blocked = await put(who, '/me/password', { currentPassword: DEMO_PASSWORD, password: 'baharu1', passwordConfirmation: 'baharu1' })
      const err = errorOf(blocked, 429, 'RATE_LIMITED')
      expect(err.retryAfter).toBeGreaterThan(0)
      t.clock.advance(61_000)
      expect((await put(who, '/me/password', { currentPassword: DEMO_PASSWORD, password: DEMO_PASSWORD, passwordConfirmation: DEMO_PASSWORD })).status).toBe(200)
    })

    it('reserves the unit before the check: parallel wrong guesses cannot exceed 5 per minute', async () => {
      const who = await login(t, 'pelajar2@demo.test')
      const guesses = await Promise.all(
        Array.from({ length: 12 }, () => put(who, '/me/password', { currentPassword: 'salah', password: 'baharu1', passwordConfirmation: 'baharu1' })),
      )
      const statuses = guesses.map((g) => g.status)
      expect(statuses.filter((s) => s === 422)).toHaveLength(5)
      expect(statuses.filter((s) => s === 429)).toHaveLength(7)
    })

    it('a per-user ceiling of 20 failed changes per 15 minutes holds across minutes, and the lock is audited with counts only', async () => {
      const who = await login(t, 'adminsekolah@demo.test')
      const wrong = () => put(who, '/me/password', { currentPassword: 'salah-sungguh', password: 'baharu2', passwordConfirmation: 'baharu2' })
      for (let round = 0; round < 4; round++) {
        t.clock.advance(61_000) // the per-minute budget (5) is fresh each round; 4 x 5 = 20 failures in 4 minutes
        for (let i = 0; i < 5; i++) { const r = await wrong(); expect(r.status, `round ${round} try ${i} ${JSON.stringify(r.body)}`).toBe(422) }
      }
      t.clock.advance(61_000)
      const blocked = await put(who, '/me/password', { currentPassword: DEMO_PASSWORD, password: 'baharu2', passwordConfirmation: 'baharu2' })
      const err = errorOf(blocked, 429, 'RATE_LIMITED')
      expect(err.retryAfter).toBeGreaterThan(0)
      expect(err.retryAfter).toBeLessThanOrEqual(900)
      const rows = await t.db.query<{ detail: unknown }>("select detail from audit_events where action = 'account.password.change_locked'")
      expect(rows).toHaveLength(1)
      expect(rows[0]?.detail).toEqual({ failures: 20, windowMinutes: 15 })
      expect(JSON.stringify(rows)).not.toContain('salah-sungguh')
      t.clock.advance(15 * 60_000)
      expect((await put(who, '/me/password', { currentPassword: DEMO_PASSWORD, password: DEMO_PASSWORD, passwordConfirmation: DEMO_PASSWORD })).status).toBe(200)
    })

    it('clears must_reset_password (and rotates the session, as every change does)', async () => {
      await t.db.query(`update users set must_reset_password = true where email = 'guru@demo.test'`)
      const who = await login(t, 'guru@demo.test')
      const res = await put(who, '/me/password', { currentPassword: DEMO_PASSWORD, password: 'baharu1', passwordConfirmation: 'baharu1' })
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      const fresh = cookieValue(res)
      expect(fresh).toBeTruthy()
      expect(fresh).not.toBe(who.token)
      expect((await userRow(t.db, 'guru@demo.test'))?.must_reset_password).toBe(false)
      const oldCookie = await t.http().get('/api/session').set('Cookie', `pp_session=${who.token}`)
      expect(oldCookie.status).toBe(401)
      const newCookie = await t.http().get('/api/session').set('Cookie', `pp_session=${fresh}`)
      expect(newCookie.status).toBe(200)
      expect(SessionSchema.parse(newCookie.body.data).csrf).not.toBe(who.csrf)
    })
  })

  describe('POST /me/picture (BR-15)', () => {
    const attach = (who: Who, bytes: Buffer, type: string, name = 'a.png', field = 'profilePicture') =>
      who.agent.post('/api/me/picture').set('X-CSRF-Token', who.csrf).attach(field, bytes, { filename: name, contentType: type })

    it('stores the picture through the files service, returns the file URL, and replaces the earlier picture', async () => {
      const who = await login(t, 'adminsekolah@demo.test')
      const first = await attach(who, makePng(), 'image/png')
      expect(first.status, JSON.stringify(first.body)).toBe(200)
      expect(first.body.status).toBe(ACCOUNT_MESSAGES.pictureSaved)
      expect(first.body.data.avatarUrl).toMatch(/^\/api\/files\/[A-Za-z0-9_-]{22}$/)
      expect((await who.agent.get(first.body.data.avatarUrl as string)).headers['content-type']).toBe('image/png')
      expect(AccountUserMeSchema.parse((await get(who, '/me')).body.data).avatarUrl).toBe(first.body.data.avatarUrl)
      // AC8: after an upload GET /session and GET /me still agree, avatar included.
      const me1 = AccountUserMeSchema.parse((await get(who, '/me')).body.data)
      const session1 = SessionSchema.parse((await get(who, '/session')).body.data)
      expect(session1.user.avatarUrl).toBe(first.body.data.avatarUrl)
      expect(accountUserMeMismatches(me1, session1)).toEqual([])

      const second = await attach(who, makePng({ width: 3, height: 3 }), 'image/png')
      expect(second.status).toBe(200)
      expect(second.body.data.avatarUrl).not.toBe(first.body.data.avatarUrl)
      expect((await who.agent.get(first.body.data.avatarUrl as string)).status).toBe(404)
      const rows = await t.db.query<{ n: string }>(
        `select count(*)::text as n from files f join users u on u.id = f.owner_user_id where u.email = 'adminsekolah@demo.test' and f.purpose = 'avatar'`,
      )
      expect(rows[0]?.n).toBe('1')
    })

    it('refuses other types, bytes that are not a picture, big files and no file, with the mock copy on profilePicture', async () => {
      const who = await login(t, 'pelajar2@demo.test')
      expect(fieldsOf(await attach(who, Buffer.alloc(4), 'image/gif', 'a.gif'))).toEqual({ profilePicture: ACCOUNT_PICTURE_MESSAGES.type })
      expect(fieldsOf(await attach(who, Buffer.from('this is plain text'), 'image/png'))).toEqual({ profilePicture: ACCOUNT_PICTURE_MESSAGES.type })
      expect(fieldsOf(await attach(who, Buffer.alloc(2 * 1024 * 1024 + 1, 1), 'image/jpeg', 'a.jpg'))).toEqual({ profilePicture: ACCOUNT_PICTURE_MESSAGES.size })
      expect(fieldsOf(await attach(who, makePng(), 'image/png', 'a.png', 'wrong'))).toEqual({ profilePicture: ACCOUNT_PICTURE_MESSAGES.required })
      const none = await who.agent.post('/api/me/picture').set('X-CSRF-Token', who.csrf).field('x', 'y')
      expect(fieldsOf(none)).toEqual({ profilePicture: ACCOUNT_PICTURE_MESSAGES.required })
      const noBody = await who.agent.post('/api/me/picture').set('X-CSRF-Token', who.csrf)
      expect(fieldsOf(noBody)).toEqual({ profilePicture: ACCOUNT_PICTURE_MESSAGES.required })
    })

    it('accepts a picture of exactly 2048 KB', async () => {
      const who = await login(t, 'pelajar2@demo.test')
      const target = 2 * 1024 * 1024
      const probe = makePng({ padTo: target })
      const png = makePng({ padTo: target + (target - probe.length) })
      expect(png.length).toBe(target)
      const res = await attach(who, png, 'image/png')
      expect(res.status, JSON.stringify(res.body)).toBe(200)
    })
  })

  describe('GET/PUT /me/settings (BR-17)', () => {
    it('reads the defaults for a user who never saved, saves every field per user and reads it back', async () => {
      const who = await login(t, 'pelajar@demo.test')
      const defaults = await get(who, '/me/settings')
      expect(defaults.status).toBe(200)
      expect(defaults.headers['cache-control']).toBe('no-store')
      expect(AccountSettingsSchema.parse(defaults.body.data)).toEqual(ACCOUNT_SETTINGS_DEFAULTS)

      const next = {
        spiritualMode: true,
        showBismillahSplash: true,
        subuhPushEnabled: true,
        subuhPushTime: '05:45',
        ramadanModeEnabled: true,
        sahurPushTime: '03:50',
        faith: 'muslim',
      }
      const saved = await put(who, '/me/settings', next)
      expect(saved.status, JSON.stringify(saved.body)).toBe(200)
      expect(saved.body.status).toBe(ACCOUNT_MESSAGES.settingsSaved)
      expect(saved.body.data).toEqual(next)
      expect((await get(who, '/me/settings')).body.data).toEqual(next)
      const stored = await t.db.query<{ subuh: string; sahur: string }>(`select subuh_push_time::text as subuh, sahur_push_time::text as sahur from user_settings`)
      expect(stored[0]).toEqual({ subuh: '05:45:00', sahur: '03:50:00' })
      // Other users keep the defaults.
      const other = await login(t, 'guru@demo.test', 'baharu1')
      expect((await get(other, '/me/settings')).body.data).toEqual(ACCOUNT_SETTINGS_DEFAULTS)
      // An unticked box is false, a blank time is the default, a cleared faith is null.
      const off = await put(who, '/me/settings', { ...next, spiritualMode: false, subuhPushTime: '', sahurPushTime: null, faith: '' })
      expect(off.body.data).toMatchObject({ spiritualMode: false, showBismillahSplash: true, subuhPushTime: '05:30', sahurPushTime: '04:30', faith: null })
      const missing = await put(who, '/me/settings', {})
      expect(missing.body.data).toEqual(ACCOUNT_SETTINGS_DEFAULTS)
    })

    it('validates times and faith with the mock copy', async () => {
      const who = await login(t, 'pelajar@demo.test')
      const res = await put(who, '/me/settings', { subuhPushTime: '25:00', sahurPushTime: '4:30', faith: 'jedi' })
      expect(fieldsOf(res)).toEqual({
        subuhPushTime: 'The subuh push time field must match the format H:i.',
        sahurPushTime: 'The sahur push time field must match the format H:i.',
        faith: 'The selected faith is invalid.',
      })
    })
  })

  describe('GET /public/stats (AC9)', () => {
    it('is public and counts the question bank and curriculum from the database, per request', async () => {
      const tables = await t.db.query<{ t: string | null }>(`select to_regclass('public.subjects')::text as t`)
      const scratch = tables[0]?.t === null
      if (!scratch) return // the real BE-08 table exists: this scratch fixture would not fit its columns
      const first = await t.http().get('/api/public/stats')
      expect(first.status).toBe(200)
      expect(AccountPlatformStatsSchema.parse(first.body.data)).toEqual({ questionCount: 0, subjectCount: 0, levelCount: 0 })

      await t.db.query(`create table subjects (id serial primary key, is_active boolean not null)`)
      await t.db.query(`create table education_levels (id serial primary key, is_active boolean not null)`)
      await t.db.query(`create table questions (id serial primary key, live_version_no int)`)
      await t.db.query(`insert into subjects (is_active) values (true), (true), (false)`)
      await t.db.query(`insert into education_levels (is_active) values (true), (false)`)
      await t.db.query(`insert into questions (live_version_no) values (1), (null), (2)`)
      const base = AccountPlatformStatsSchema.parse((await t.http().get('/api/public/stats')).body.data)
      expect(base).toEqual({ questionCount: 2, subjectCount: 2, levelCount: 1 })

      await t.db.query(`insert into subjects (is_active) values (true)`)
      await t.db.query(`insert into questions (live_version_no) values (3)`)
      const next = AccountPlatformStatsSchema.parse((await t.http().get('/api/public/stats')).body.data)
      expect(next.subjectCount).toBe(base.subjectCount + 1)
      expect(next.questionCount).toBe(base.questionCount + 1)
      expect(next.levelCount).toBe(base.levelCount)
    })
  })
})
