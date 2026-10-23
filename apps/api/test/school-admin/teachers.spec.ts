import {
  SchoolAdminResetResultSchema,
  SchoolAdminTeacherCreatedResultSchema,
  SchoolAdminTeacherListResponseSchema,
  SchoolAdminToggleActiveResultSchema,
  SchoolAdminUserDetailSchema,
  SchoolAdminUserWriteResultSchema,
} from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { insertPendingTeacher, login, SCHOOL_ADMIN, schoolIdOf, STUDENT, TEACHER, userIdOf, type SchoolAdminTestApp } from './helpers'
import { auditRows, errorOf, expectNoCache, insertClass, insertUser, loginWith, peopleApiOf, userRow, bootPeopleApp, type PeopleApi } from './people-helpers'

/** BE-21 Part A: the seven teacher routes under /admin-sekolah/guru. DB spec (Testcontainers). */
describe('BE-21 teachers: /admin-sekolah/guru', () => {
  let t: SchoolAdminTestApp
  let admin: PeopleApi
  let s1: string
  let s2: string
  let seeded: string // guru@demo.test
  let a: string // active
  let b: string // inactive
  let c: string // suspended (shown inactive)
  let foreign: string
  let pending: string
  let pupil: string
  let schoolAdminTeacher: string // guruadmin@demo.test: also a school admin, so not manageable here

  beforeAll(async () => {
    t = await bootPeopleApp()
    admin = peopleApiOf(await login(t, SCHOOL_ADMIN))
    s1 = await schoolIdOf(t.db, 'DEMO001')
    s2 = await schoolIdOf(t.db, 'DEMO002')
    seeded = await userIdOf(t.db, TEACHER)
    schoolAdminTeacher = await userIdOf(t.db, 'guruadmin@demo.test')
    pupil = await userIdOf(t.db, STUDENT)
    a = await insertUser(t.db, { name: 'Guru Alpha', email: 'alpha@ujian.test', roles: ['teacher'], schoolId: s1, phone: '0112223334' })
    b = await insertUser(t.db, { name: 'Guru Beta', email: 'beta@ujian.test', roles: ['teacher'], schoolId: s1, isActive: false })
    c = await insertUser(t.db, { name: 'Guru Gamma', email: 'gamma@ujian.test', roles: ['teacher'], schoolId: s1, isSuspended: true })
    foreign = await insertUser(t.db, { name: 'Guru Luar', email: 'luar@ujian.test', roles: ['teacher'], schoolId: s2 })
    pending = await insertPendingTeacher(t.db, 'menunggu@ujian.test', s1, 'Guru Menunggu')
  }, 120_000)
  afterAll(async () => {
    await t.close()
  })

  it('lists the teachers of the own school only: active first, then id descending; counts ignore the filters', async () => {
    await t.db.query(`update users set last_login_at = '2026-10-18T01:00:00Z' where id = $1::bigint`, [a])
    await insertClass(t.db, { name: '4 Alpha', schoolId: s1, teacherId: a })
    await insertClass(t.db, { name: '5 Alpha', schoolId: s1, teacherId: a })
    await insertClass(t.db, { name: '3 Lama', schoolId: s1, teacherId: a, isActive: false })

    const res = await admin.get('/admin-sekolah/guru')
    expect(res.status).toBe(200)
    expectNoCache(res, false)
    const body = SchoolAdminTeacherListResponseSchema.parse(res.body)
    const ids = body.data.map((r) => r.id)
    for (const id of [seeded, a, b, c]) expect(ids).toContain(id)
    for (const id of [foreign, pending, pupil, schoolAdminTeacher]) expect(ids).not.toContain(id)

    const desc = (xs: string[]) => [...xs].sort((x, y) => (BigInt(y) > BigInt(x) ? 1 : -1))
    expect(ids).toEqual([...desc([a, seeded]), ...desc([b, c])])
    expect(body.meta).toMatchObject({ page: 1, pageSize: 25, totalItems: 4, totalPages: 1, from: 1, to: 4, counts: { total: 4, active: 2, inactive: 2 } })

    const rowA = body.data.find((r) => r.id === a)
    expect(rowA).toMatchObject({ name: 'Guru Alpha', initials: 'GA', email: 'alpha@ujian.test', phone: '0112223334', classCount: 2, lastLoginAt: '2026-10-18T09:00:00.000+08:00', isActive: true, canEdit: true })
    // A suspended account is shown as inactive and cannot be edited.
    expect(body.data.find((r) => r.id === c)).toMatchObject({ isActive: false, canEdit: false })
    expect(body.data.find((r) => r.id === b)).toMatchObject({ isActive: false, canEdit: false, classCount: 0, lastLoginAt: null })
  })

  it('filters by is_active and search; counts stay the school totals; a schoolId in the query changes nothing', async () => {
    const inactive = SchoolAdminTeacherListResponseSchema.parse((await admin.get('/admin-sekolah/guru?is_active=0')).body)
    expect(inactive.data.map((r) => r.id)).toEqual([c, b])
    expect(inactive.meta.counts).toEqual({ total: 4, active: 2, inactive: 2 })
    const active = SchoolAdminTeacherListResponseSchema.parse((await admin.get('/admin-sekolah/guru?is_active=1')).body)
    expect(active.data.map((r) => r.id)).toEqual([a, seeded])
    expect(SchoolAdminTeacherListResponseSchema.parse((await admin.get('/admin-sekolah/guru?is_active=zzz')).body).data).toHaveLength(4)

    const byName = SchoolAdminTeacherListResponseSchema.parse((await admin.get('/admin-sekolah/guru?search=BETA')).body)
    expect(byName.data.map((r) => r.id)).toEqual([b])
    const byEmail = SchoolAdminTeacherListResponseSchema.parse((await admin.get('/admin-sekolah/guru?search=alpha@ujian')).body)
    expect(byEmail.data.map((r) => r.id)).toEqual([a])
    // LIKE wildcards are literal.
    expect(SchoolAdminTeacherListResponseSchema.parse((await admin.get('/admin-sekolah/guru?search=%25')).body).data).toEqual([])

    const forged = SchoolAdminTeacherListResponseSchema.parse((await admin.get(`/admin-sekolah/guru?schoolId=${s2}&school_id=${s2}`)).body)
    expect(forged.data.map((r) => r.id)).not.toContain(foreign)
  })

  it('detail: 200 for an active teacher of the school, parsed with the contract', async () => {
    const res = await admin.get(`/admin-sekolah/guru/${a}`)
    expect(res.status).toBe(200)
    expectNoCache(res, false)
    const body = SchoolAdminUserDetailSchema.parse(res.body.data)
    expect(body).toMatchObject({ id: a, name: 'Guru Alpha', role: 'teacher', isActive: true, school: { id: s1, name: 'SMK Demo Satu', code: 'DEMO001' } })
    expect(JSON.stringify(res.body)).not.toMatch(/ic_?hash|icMasked|passwordHash|username/i)
  })

  it('detail: 404 for unknown, malformed, other school, a pupil, a pending teacher and a school-admin teacher; 403 for an inactive one', async () => {
    for (const id of ['999999999', 'abc', '0', '1e3', foreign, pupil, pending, schoolAdminTeacher]) {
      errorOf(await admin.get(`/admin-sekolah/guru/${id}`), 404, 'NOT_FOUND', 'Not Found.')
    }
    errorOf(await admin.get(`/admin-sekolah/guru/${b}`), 403, 'FORBIDDEN', 'This action is unauthorized.')
    errorOf(await admin.get(`/admin-sekolah/guru/${c}`), 403, 'FORBIDDEN')
  })

  it('create: 201 with the one-time credential; hashed, flagged must-change, created by the admin; audit has ids only', async () => {
    const res = await admin.post('/admin-sekolah/guru', { name: '  Guru Baharu ', email: 'baharu@ujian.test', phone: '0191112223' })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    expectNoCache(res)
    const body = SchoolAdminTeacherCreatedResultSchema.parse(res.body)
    expect(body.status).toBe('Pengguna berjaya didaftarkan.')
    expect(body.mustChangePassword).toBe(false) // R39: no forced change at go-live
    expect(body.data).toMatchObject({ name: 'Guru Baharu', email: 'baharu@ujian.test', phone: '0191112223', role: 'teacher', isActive: true, school: { id: s1 } })
    expect(body.credential).toMatchObject({ name: 'Guru Baharu', school: 'SMK Demo Satu', email: 'baharu@ujian.test' })
    expect(body.credential.password.length).toBeGreaterThanOrEqual(12)

    const row = await userRow(t.db, body.data.id)
    expect(row).toMatchObject({ school_id: s1, is_active: true, must_reset_password: false, created_by_id: await userIdOf(t.db, SCHOOL_ADMIN), roles: ['teacher'] })
    expect(row?.password_hash).toMatch(/^\$argon2id\$/)
    expect(row?.password_hash).not.toContain(body.credential.password)

    // The credential works exactly once as a hand-over: it logs the new teacher in.
    const who = await loginWith(t, 'baharu@ujian.test', body.credential.password)
    expect(who.csrf).toBeTruthy()

    const audit = (await auditRows(t.db, 'school_admin.teacher.created'))[0]
    expect(audit).toMatchObject({ actor_role: 'school_admin', scope_school_id: s1, target_type: 'user', target_id: body.data.id })
    const text = JSON.stringify(audit?.detail)
    for (const secret of ['Guru Baharu', 'baharu@ujian.test', '0191112223', body.credential.password]) expect(text).not.toContain(secret)
  })

  it('create: every credential is different and random', async () => {
    const one = SchoolAdminTeacherCreatedResultSchema.parse((await admin.post('/admin-sekolah/guru', { name: 'Guru Rawak Satu', email: 'rawak1@ujian.test' })).body)
    const two = SchoolAdminTeacherCreatedResultSchema.parse((await admin.post('/admin-sekolah/guru', { name: 'Guru Rawak Dua', email: 'rawak2@ujian.test' })).body)
    expect(one.credential.password).not.toBe(two.credential.password)
    expect(one.data.phone).toBeNull()
  })

  it('create: 422 with the Laravel texts; nothing is written', async () => {
    const before = (await t.db.query(`select 1 from users`)).length
    const noName = errorOf(await admin.post('/admin-sekolah/guru', { email: 'x@ujian.test' }), 422, 'VALIDATION_ERROR', 'The name field is required.')
    expect(noName.fields).toEqual({ name: 'The name field is required.' })
    errorOf(await admin.post('/admin-sekolah/guru', { name: 'Guru', email: 'bukan-emel' }), 422, 'VALIDATION_ERROR', 'The email field must be a valid email address.')
    const both = errorOf(await admin.post('/admin-sekolah/guru', {}), 422, 'VALIDATION_ERROR', 'The name field is required. (and 1 more error)')
    expect(Object.keys(both.fields ?? {}).sort()).toEqual(['email', 'name'])
    // Taken by a teacher of ANOTHER school, in another letter case (accepted enumeration trade-off).
    errorOf(await admin.post('/admin-sekolah/guru', { name: 'Guru Pendua', email: 'LUAR@ujian.test' }), 422, 'VALIDATION_ERROR', 'The email has already been taken.')
    expect((await t.db.query(`select 1 from users`)).length).toBe(before)
  })

  it('create: the Idempotency-Key header is accepted and ignored (a replayed key is not a 409)', async () => {
    const headers = { 'Idempotency-Key': 'kunci-ujian-0001' }
    const first = await admin.post('/admin-sekolah/guru', { name: 'Guru Kunci', email: 'kunci@ujian.test' }, headers)
    expect(first.status).toBe(201)
    // A replay creates nothing new: the e-mail is taken (422), never a 409, and the credential is not served again.
    const replay = await admin.post('/admin-sekolah/guru', { name: 'Guru Kunci', email: 'kunci@ujian.test' }, headers)
    errorOf(replay, 422, 'VALIDATION_ERROR', 'The email has already been taken.')
  })

  it('update: name, email and phone; absent phone keeps, null clears; status text; audit lists field names only', async () => {
    const res = await admin.put(`/admin-sekolah/guru/${a}`, { name: 'Guru Alpha Baru', email: 'alpha2@ujian.test' })
    expect(res.status).toBe(200)
    const body = SchoolAdminUserWriteResultSchema.parse(res.body)
    expect(body.status).toBe('Pengguna berjaya dikemaskini.')
    expect(body.data).toMatchObject({ name: 'Guru Alpha Baru', email: 'alpha2@ujian.test', phone: '0112223334', role: 'teacher' })
    const cleared = SchoolAdminUserWriteResultSchema.parse((await admin.put(`/admin-sekolah/guru/${a}`, { name: 'Guru Alpha Baru', email: 'alpha2@ujian.test', phone: null })).body)
    expect(cleared.data.phone).toBeNull()
    const audit = (await auditRows(t.db, 'school_admin.teacher.updated'))[0]
    expect(audit?.detail).toMatchObject({ userId: a, credentialReset: false })
    expect(JSON.stringify(audit?.detail)).not.toContain('Alpha')
  })

  it('update: 404 / 403 / 422 in that order; the e-mail of the same teacher is not "taken"', async () => {
    errorOf(await admin.put(`/admin-sekolah/guru/${foreign}`, { name: 'X', email: 'x@ujian.test' }), 404, 'NOT_FOUND', 'Not Found.')
    errorOf(await admin.put(`/admin-sekolah/guru/${pupil}`, { name: 'X', email: 'x@ujian.test' }), 404, 'NOT_FOUND')
    // Inactive wins over an invalid body.
    errorOf(await admin.put(`/admin-sekolah/guru/${b}`, {}), 403, 'FORBIDDEN', 'This action is unauthorized.')
    errorOf(await admin.put(`/admin-sekolah/guru/${a}`, { name: 'X', email: 'luar@ujian.test' }), 422, 'VALIDATION_ERROR', 'The email has already been taken.')
    errorOf(await admin.put(`/admin-sekolah/guru/${a}`, { name: '', email: 'alpha2@ujian.test' }), 422, 'VALIDATION_ERROR', 'The name field is required.')
    expect((await admin.put(`/admin-sekolah/guru/${a}`, { name: 'Guru Alpha Baru', email: 'ALPHA2@ujian.test' })).status).toBe(200)
  })

  it('update: new password rules (8 to 255, confirmed) and the hash is replaced', async () => {
    const before = (await userRow(t.db, a))?.password_hash
    errorOf(await admin.put(`/admin-sekolah/guru/${a}`, { name: 'G', email: 'alpha2@ujian.test', newPassword: 'pendek', newPasswordConfirmation: 'pendek' }), 422, 'VALIDATION_ERROR', 'The new password field must be at least 8 characters.')
    errorOf(await admin.put(`/admin-sekolah/guru/${a}`, { name: 'G', email: 'alpha2@ujian.test', newPassword: 'cukup-panjang-1', newPasswordConfirmation: 'lain-panjang-1' }), 422, 'VALIDATION_ERROR', 'The new password field confirmation does not match.')
    expect((await userRow(t.db, a))?.password_hash).toBe(before)
    const ok = await admin.put(`/admin-sekolah/guru/${a}`, { name: 'Guru Alpha Baru', email: 'alpha2@ujian.test', newPassword: 'cukup-panjang-1', newPasswordConfirmation: 'cukup-panjang-1' })
    expect(ok.status).toBe(200)
    expect(JSON.stringify(ok.body)).not.toContain('cukup-panjang-1')
    const after = await userRow(t.db, a)
    expect(after?.password_hash).not.toBe(before)
    expect(after?.must_reset_password).toBe(false) // R39: an admin password change does not force a change
    expect((await auditRows(t.db, 'school_admin.teacher.updated'))[0]?.detail).toMatchObject({ credentialReset: true })
  })

  it('toggle: flips either way; a suspended or foreign or pupil id is 404; status text; audit', async () => {
    const off = SchoolAdminToggleActiveResultSchema.parse((await admin.post(`/admin-sekolah/guru/${a}/toggle-active`)).body)
    expect(off).toEqual({ data: { isActive: false }, status: 'Status pengguna berjaya dikemaskini.' })
    expect((await userRow(t.db, a))?.is_active).toBe(false)
    const on = SchoolAdminToggleActiveResultSchema.parse((await admin.post(`/admin-sekolah/guru/${a}/toggle-active`)).body)
    expect(on.data.isActive).toBe(true)
    // An inactive teacher can be switched back on.
    expect(SchoolAdminToggleActiveResultSchema.parse((await admin.post(`/admin-sekolah/guru/${b}/toggle-active`)).body).data.isActive).toBe(true)
    await admin.post(`/admin-sekolah/guru/${b}/toggle-active`)
    for (const id of [c, foreign, pupil, pending, schoolAdminTeacher, 'abc', '999999999']) {
      errorOf(await admin.post(`/admin-sekolah/guru/${id}/toggle-active`), 404, 'NOT_FOUND', 'Not Found.')
    }
    expect((await userRow(t.db, c))?.is_active).toBe(true) // the suspended account is untouched
    const audit = await auditRows(t.db, 'school_admin.teacher.toggled')
    expect(audit[0]?.detail).toMatchObject({ isActive: false })
    expect(audit.length).toBeGreaterThanOrEqual(4)
  })

  it('the admin cannot toggle or edit themself through the teacher routes (404)', async () => {
    const me = await userIdOf(t.db, SCHOOL_ADMIN)
    errorOf(await admin.post(`/admin-sekolah/guru/${me}/toggle-active`), 404, 'NOT_FOUND')
    errorOf(await admin.put(`/admin-sekolah/guru/${me}`, { name: 'X', email: 'x@ujian.test' }), 404, 'NOT_FOUND')
  })

  it('reset-password: the admin types it; replaced, flag stays false (R39), no echo, both headers; 404 / 403 / 422', async () => {
    const before = (await userRow(t.db, a))?.password_hash
    const res = await admin.post(`/admin-sekolah/guru/${a}/reset-password`, { newPassword: 'Kata-Baharu-77', newPasswordConfirmation: 'Kata-Baharu-77' })
    expect(res.status).toBe(200)
    expectNoCache(res)
    expect(SchoolAdminResetResultSchema.parse(res.body)).toEqual({ data: { reset: true }, status: 'Pengguna berjaya dikemaskini.' })
    expect(JSON.stringify(res.body)).not.toContain('Kata-Baharu-77')
    const row = await userRow(t.db, a)
    expect(row?.password_hash).not.toBe(before)
    expect(row?.must_reset_password).toBe(false) // R39: an admin reset does not force a change
    expect((await auditRows(t.db, 'school_admin.teacher.password_reset'))[0]).toMatchObject({ target_id: a })

    const e422 = errorOf(await admin.post(`/admin-sekolah/guru/${a}/reset-password`, {}), 422, 'VALIDATION_ERROR', 'The new password field is required.')
    expect(e422.fields).toEqual({ newPassword: 'The new password field is required.' })
    errorOf(await admin.post(`/admin-sekolah/guru/${a}/reset-password`, { newPassword: 'abc', newPasswordConfirmation: 'abc' }), 422, 'VALIDATION_ERROR', 'The new password field must be at least 8 characters.')
    errorOf(await admin.post(`/admin-sekolah/guru/${a}/reset-password`, { newPassword: 'x'.repeat(256), newPasswordConfirmation: 'x'.repeat(256) }), 422, 'VALIDATION_ERROR', 'The new password field must not be greater than 255 characters.')
    errorOf(await admin.post(`/admin-sekolah/guru/${a}/reset-password`, { newPassword: 'abcdefgh', newPasswordConfirmation: 'abcdefgi' }), 422, 'VALIDATION_ERROR', 'The new password field confirmation does not match.')
    errorOf(await admin.post(`/admin-sekolah/guru/${foreign}/reset-password`, { newPassword: 'abcdefgh', newPasswordConfirmation: 'abcdefgh' }), 404, 'NOT_FOUND')
    errorOf(await admin.post(`/admin-sekolah/guru/${pupil}/reset-password`, { newPassword: 'abcdefgh', newPasswordConfirmation: 'abcdefgh' }), 404, 'NOT_FOUND')
    errorOf(await admin.post(`/admin-sekolah/guru/${b}/reset-password`, { newPassword: 'abcdefgh', newPasswordConfirmation: 'abcdefgh' }), 403, 'FORBIDDEN', 'This action is unauthorized.')
  })

  it('reset-password and update with a new password leave an already-set flag as stored; they never set it (R39)', async () => {
    const flag = async () => (await userRow(t.db, a))?.must_reset_password
    await t.db.query(`update users set must_reset_password = false where id = $1::bigint`, [a])
    expect((await admin.post(`/admin-sekolah/guru/${a}/reset-password`, { newPassword: 'Tanpa-Paksa-1', newPasswordConfirmation: 'Tanpa-Paksa-1' })).status).toBe(200)
    expect(await flag()).toBe(false)
    // An operator-set flag (e.g. the admin bootstrap) is not cleared or changed by the school admin's reset either.
    await t.db.query(`update users set must_reset_password = true where id = $1::bigint`, [a])
    expect((await admin.post(`/admin-sekolah/guru/${a}/reset-password`, { newPassword: 'Tanpa-Paksa-2', newPasswordConfirmation: 'Tanpa-Paksa-2' })).status).toBe(200)
    expect(await flag()).toBe(true)
  })

  it('page past the last is clamped to the last page', async () => {
    for (let i = 0; i < 26; i++) await insertUser(t.db, { name: `Guru Pukal ${String(i).padStart(2, '0')}`, email: `pukal${String(i)}@ujian.test`, roles: ['teacher'], schoolId: s1 })
    const last = SchoolAdminTeacherListResponseSchema.parse((await admin.get('/admin-sekolah/guru?page=99')).body)
    expect(last.meta).toMatchObject({ page: 2, pageSize: 25, totalPages: 2, to: last.meta.totalItems })
    expect(last.data.length).toBe(last.meta.totalItems - 25)
    expect(SchoolAdminTeacherListResponseSchema.parse((await admin.get('/admin-sekolah/guru?page=abc')).body).meta.page).toBe(1)
    expect(SchoolAdminTeacherListResponseSchema.parse((await admin.get('/admin-sekolah/guru?page=0')).body).data).toHaveLength(25)
  })

  it('guru/pending still reaches the pending list, not the :id route', async () => {
    const res = await admin.get('/admin-sekolah/guru/pending')
    expect(res.status).toBe(200)
    expect(res.body.data.map((r: { id: string }) => r.id)).toContain(pending)
  })
})
