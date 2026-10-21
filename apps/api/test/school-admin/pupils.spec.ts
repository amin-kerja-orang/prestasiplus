import {
  SchoolAdminPupilCreatedResultSchema,
  SchoolAdminPupilFormOptionsSchema,
  SchoolAdminPupilListResponseSchema,
  SchoolAdminResetResultSchema,
  SchoolAdminUserDetailSchema,
  SchoolAdminUserWriteResultSchema,
} from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { login, SCHOOL_ADMIN, schoolIdOf, STUDENT, TEACHER, userIdOf, type SchoolAdminTestApp } from './helpers'
import { auditRows, bootPeopleApp, countOf, enrolIn, errorOf, expectNoCache, insertClass, insertUser, loginWith, peopleApiOf, userRow, type PeopleApi } from './people-helpers'

/** BE-21 Part A: the seven pupil routes under /admin-sekolah/pelajar. DB spec (Testcontainers). */
describe('BE-21 pupils: /admin-sekolah/pelajar', () => {
  let t: SchoolAdminTestApp
  let admin: PeopleApi
  let s1: string
  let s2: string
  let teacher: string
  let p1: string // pelajar@demo.test (grade 10)
  let pMaju: string
  let pKosong: string
  let pInactive: string // tidakaktif@demo.test
  let pSuspended: string // digantung@demo.test
  let pNoEmail: string
  let rosterS2: string
  let clsAmanah: string
  let clsBestari: string
  let clsInactive: string
  let clsSchoolKind: string
  let clsForeign: string

  beforeAll(async () => {
    t = await bootPeopleApp()
    admin = peopleApiOf(await login(t, SCHOOL_ADMIN))
    s1 = await schoolIdOf(t.db, 'DEMO001')
    s2 = await schoolIdOf(t.db, 'DEMO002')
    teacher = await userIdOf(t.db, TEACHER)
    p1 = await userIdOf(t.db, STUDENT)
    pMaju = await userIdOf(t.db, 'pelajarmaju@demo.test')
    pKosong = await userIdOf(t.db, 'pelajar2@demo.test')
    pInactive = await userIdOf(t.db, 'tidakaktif@demo.test')
    pSuspended = await userIdOf(t.db, 'digantung@demo.test')
    pNoEmail = await insertUser(t.db, { name: 'Murid Tanpa Emel', email: null, roles: ['student'], schoolId: s1, grade: 3 })
    rosterS2 = (await t.db.query<{ id: string }>(`select id::text from users where school_id = $1::bigint and 'student' in (select role from user_roles r where r.user_id = users.id)`, [s2]))[0]?.id as string
    clsAmanah = await insertClass(t.db, { name: '4 Amanah', schoolId: s1, teacherId: teacher })
    clsBestari = await insertClass(t.db, { name: '5 Bestari', schoolId: s1, teacherId: teacher })
    clsInactive = await insertClass(t.db, { name: '4 Lama', schoolId: s1, teacherId: teacher, isActive: false })
    clsSchoolKind = await insertClass(t.db, { name: 'Kelas Sekolah', schoolId: s1, kind: 'school_class' })
    clsForeign = await insertClass(t.db, { name: '4 Luar', schoolId: s2 })
  }, 120_000)
  afterAll(async () => {
    await t.close()
  })

  it('lists the pupils of the own school only, active first then id descending; counts; grade labels; no IC', async () => {
    await enrolIn(t.db, clsAmanah, p1)
    await enrolIn(t.db, clsSchoolKind, p1)
    await enrolIn(t.db, clsInactive, p1) // inactive class: left out
    await enrolIn(t.db, clsBestari, p1, 'removed') // removed enrolment: left out
    const res = await admin.get('/admin-sekolah/pelajar')
    expect(res.status).toBe(200)
    expectNoCache(res, false)
    const body = SchoolAdminPupilListResponseSchema.parse(res.body)
    const ids = body.data.map((r) => r.id)
    expect(ids).not.toContain(rosterS2)
    expect(ids).not.toContain(teacher)
    const desc = (xs: string[]) => [...xs].sort((x, y) => (BigInt(y) > BigInt(x) ? 1 : -1))
    expect(ids).toEqual([...desc([p1, pMaju, pKosong, pNoEmail]), ...desc([pInactive, pSuspended])])
    expect(body.meta.counts).toEqual({ total: 6, active: 4, inactive: 2 })
    expect(body.data.find((r) => r.id === p1)).toMatchObject({ gradeLabel: 'Tingkatan 4', classNames: ['4 Amanah', 'Kelas Sekolah'], isActive: true, canEdit: true })
    expect(body.data.find((r) => r.id === pMaju)).toMatchObject({ gradeLabel: 'Tingkatan 5', classNames: [] })
    expect(body.data.find((r) => r.id === pNoEmail)).toMatchObject({ gradeLabel: 'Darjah 3', email: '' })
    expect(body.data.find((r) => r.id === pSuspended)).toMatchObject({ isActive: false, canEdit: false })
    expect(JSON.stringify(res.body)).not.toMatch(/ic_?hash|icMasked|icNumber|passwordHash/i)
  })

  it('filters by is_active and search; a page past the last is the last page', async () => {
    const inactive = SchoolAdminPupilListResponseSchema.parse((await admin.get('/admin-sekolah/pelajar?is_active=0')).body)
    expect(inactive.data.map((r) => r.id).sort()).toEqual([pInactive, pSuspended].sort())
    expect(SchoolAdminPupilListResponseSchema.parse((await admin.get('/admin-sekolah/pelajar?search=maju')).body).data.map((r) => r.id)).toEqual([pMaju])
    expect(SchoolAdminPupilListResponseSchema.parse((await admin.get('/admin-sekolah/pelajar?page=50')).body).meta).toMatchObject({ page: 1, totalPages: 1 })
  })

  it('form-options matches before :id: the school and the ACTIVE classrooms of the school A to Z, no password field', async () => {
    const res = await admin.get('/admin-sekolah/pelajar/form-options')
    expect(res.status).toBe(200)
    const body = SchoolAdminPupilFormOptionsSchema.parse(res.body.data)
    expect(body.school).toMatchObject({ id: s1, name: 'SMK Demo Satu', code: 'DEMO001' })
    expect(body.classes).toEqual([
      { id: clsAmanah, name: '4 Amanah' },
      { id: clsBestari, name: '5 Bestari' },
    ])
    expect(JSON.stringify(res.body)).not.toMatch(/password|joinCode/i)
  })

  it('detail: 200 for an active pupil; 404 for unknown, malformed, other school and a teacher; 403 for inactive or suspended', async () => {
    const res = await admin.get(`/admin-sekolah/pelajar/${p1}`)
    expect(res.status).toBe(200)
    expect(SchoolAdminUserDetailSchema.parse(res.body.data)).toMatchObject({ id: p1, role: 'student', school: { id: s1 } })
    for (const id of ['999999999', 'abc', rosterS2, teacher]) errorOf(await admin.get(`/admin-sekolah/pelajar/${id}`), 404, 'NOT_FOUND', 'Not Found.')
    errorOf(await admin.get(`/admin-sekolah/pelajar/${pInactive}`), 403, 'FORBIDDEN', 'This action is unauthorized.')
    errorOf(await admin.get(`/admin-sekolah/pelajar/${pSuspended}`), 403, 'FORBIDDEN')
  })

  it('create without a class: 201, credential once, hashed, must-change, role student, school from the session', async () => {
    const res = await admin.post('/admin-sekolah/pelajar', { name: 'Aisyah Demo', email: 'aisyah@ujian.test' })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    expectNoCache(res)
    const body = SchoolAdminPupilCreatedResultSchema.parse(res.body)
    expect(body.status).toBe('Pelajar "Aisyah Demo" berjaya dicipta.')
    expect(body.mustChangePassword).toBe(true)
    expect(body.data).toMatchObject({ name: 'Aisyah Demo', role: 'student', isActive: true, school: { id: s1 } })
    expect(body.credential).toMatchObject({ name: 'Aisyah Demo', school: 'SMK Demo Satu', email: 'aisyah@ujian.test' })
    expect(body.credential.password.length).toBeGreaterThanOrEqual(12)

    const row = await userRow(t.db, body.data.id)
    expect(row).toMatchObject({ school_id: s1, is_active: true, must_reset_password: true, grade: null, roles: ['student'], created_by_id: await userIdOf(t.db, SCHOOL_ADMIN) })
    expect(row?.password_hash).toMatch(/^\$argon2id\$/)
    expect(await countOf(t.db, `select count(*)::text as n from enrolments where student_id = $1::bigint`, [body.data.id])).toBe(0)
    expect((await loginWith(t, 'aisyah@ujian.test', body.credential.password)).csrf).toBeTruthy()
  })

  it('create with a class: enrolled with source school_admin; the audit row records the class id only', async () => {
    const res = await admin.post('/admin-sekolah/pelajar', { name: 'Budi Demo', email: 'budi@ujian.test', classId: clsBestari })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const body = SchoolAdminPupilCreatedResultSchema.parse(res.body)
    const enrol = await t.db.query<{ classroom_id: string; status: string; source: string; is_test: boolean }>(
      `select classroom_id::text, status, source, is_test from enrolments where student_id = $1::bigint`,
      [body.data.id],
    )
    expect(enrol).toEqual([{ classroom_id: clsBestari, status: 'active', source: 'school_admin', is_test: false }])
    const audit = (await auditRows(t.db, 'school_admin.pupil.created'))[0]
    expect(audit).toMatchObject({ actor_role: 'school_admin', scope_school_id: s1, target_type: 'user', target_id: body.data.id })
    expect(audit?.detail).toMatchObject({ classId: clsBestari, enrolled: true })
    for (const secret of ['Budi Demo', 'budi@ujian.test', body.credential.password]) expect(JSON.stringify(audit?.detail)).not.toContain(secret)
    // A blank classId means no class.
    expect((await admin.post('/admin-sekolah/pelajar', { name: 'Cahaya Demo', email: 'cahaya@ujian.test', classId: '' })).status).toBe(201)
  })

  it('create: a class that is not an active classroom of THIS school is 422 "The selected class id is invalid." and nothing is written', async () => {
    const users = await countOf(t.db, `select count(*)::text as n from users`)
    const enrolments = await countOf(t.db, `select count(*)::text as n from enrolments`)
    for (const classId of [clsForeign, clsInactive, clsSchoolKind, '999999999', 'abc', 12]) {
      const e = errorOf(await admin.post('/admin-sekolah/pelajar', { name: 'Dina Demo', email: 'dina@ujian.test', classId }), 422, 'VALIDATION_ERROR', 'The selected class id is invalid.')
      expect(e.fields).toEqual({ classId: 'The selected class id is invalid.' })
    }
    expect(await countOf(t.db, `select count(*)::text as n from users`)).toBe(users)
    expect(await countOf(t.db, `select count(*)::text as n from enrolments`)).toBe(enrolments)
  })

  it('create: 422 texts (name 3 to 255, e-mail required / valid / unique across schools)', async () => {
    errorOf(await admin.post('/admin-sekolah/pelajar', { name: 'Al', email: 'al@ujian.test' }), 422, 'VALIDATION_ERROR', 'The name field must be at least 3 characters.')
    errorOf(await admin.post('/admin-sekolah/pelajar', { name: 'Aliyah' }), 422, 'VALIDATION_ERROR', 'The email field is required.')
    errorOf(await admin.post('/admin-sekolah/pelajar', { name: 'Aliyah', email: 'x' }), 422, 'VALIDATION_ERROR', 'The email field must be a valid email address.')
    errorOf(await admin.post('/admin-sekolah/pelajar', { name: 'x'.repeat(256), email: 'al@ujian.test' }), 422, 'VALIDATION_ERROR', 'The name field must not be greater than 255 characters.')
    errorOf(await admin.post('/admin-sekolah/pelajar', { name: 'Murid Pendua', email: 'PELAJAR@demo.test' }), 422, 'VALIDATION_ERROR', 'The email has already been taken.')
  })

  it('update: 200 and status; phone kept or cleared; 404 for a teacher / other school; 403 inactive; 404 suspended', async () => {
    const res = await admin.put(`/admin-sekolah/pelajar/${pMaju}`, { name: 'Murid Maju Baru', email: 'maju2@ujian.test', phone: '0123334445' })
    expect(res.status).toBe(200)
    const body = SchoolAdminUserWriteResultSchema.parse(res.body)
    expect(body).toMatchObject({ status: 'Pengguna berjaya dikemaskini.', data: { name: 'Murid Maju Baru', email: 'maju2@ujian.test', phone: '0123334445', role: 'student' } })
    expect(SchoolAdminUserWriteResultSchema.parse((await admin.put(`/admin-sekolah/pelajar/${pMaju}`, { name: 'Murid Maju Baru', email: 'maju2@ujian.test' })).body).data.phone).toBe('0123334445')
    expect(SchoolAdminUserWriteResultSchema.parse((await admin.put(`/admin-sekolah/pelajar/${pMaju}`, { name: 'Murid Maju Baru', email: 'maju2@ujian.test', phone: null })).body).data.phone).toBeNull()
    for (const id of [teacher, rosterS2, pSuspended]) errorOf(await admin.put(`/admin-sekolah/pelajar/${id}`, { name: 'X', email: 'x@ujian.test' }), 404, 'NOT_FOUND', 'Not Found.')
    errorOf(await admin.put(`/admin-sekolah/pelajar/${pInactive}`, { name: 'X', email: 'x@ujian.test' }), 403, 'FORBIDDEN', 'This action is unauthorized.')
    errorOf(await admin.put(`/admin-sekolah/pelajar/${pMaju}`, { name: 'X', email: 'pelajar@demo.test' }), 422, 'VALIDATION_ERROR', 'The email has already been taken.')
    expect((await auditRows(t.db, 'school_admin.pupil.updated')).length).toBe(3)
  })

  it('there is no toggle route for a pupil', async () => {
    errorOf(await admin.post(`/admin-sekolah/pelajar/${p1}/toggle-active`), 404, 'NOT_FOUND')
    expect((await userRow(t.db, p1))?.is_active).toBe(true)
  })

  it('reset-password: replaced, must-change, no echo, both headers; 422 / 404 / 403 / suspended 404', async () => {
    const before = (await userRow(t.db, pKosong))?.password_hash
    const res = await admin.post(`/admin-sekolah/pelajar/${pKosong}/reset-password`, { newPassword: 'Murid-Baharu-88', newPasswordConfirmation: 'Murid-Baharu-88' })
    expect(res.status).toBe(200)
    expectNoCache(res)
    expect(SchoolAdminResetResultSchema.parse(res.body)).toEqual({ data: { reset: true }, status: 'Pengguna berjaya dikemaskini.' })
    expect(JSON.stringify(res.body)).not.toContain('Murid-Baharu-88')
    const row = await userRow(t.db, pKosong)
    expect(row?.password_hash).not.toBe(before)
    expect(row?.must_reset_password).toBe(true)
    expect((await auditRows(t.db, 'school_admin.pupil.password_reset'))[0]).toMatchObject({ target_id: pKosong })
    errorOf(await admin.post(`/admin-sekolah/pelajar/${pKosong}/reset-password`, { newPassword: 'abc', newPasswordConfirmation: 'abc' }), 422, 'VALIDATION_ERROR', 'The new password field must be at least 8 characters.')
    errorOf(await admin.post(`/admin-sekolah/pelajar/${pKosong}/reset-password`, {}), 422, 'VALIDATION_ERROR', 'The new password field is required.')
    errorOf(await admin.post(`/admin-sekolah/pelajar/${rosterS2}/reset-password`, { newPassword: 'abcdefgh', newPasswordConfirmation: 'abcdefgh' }), 404, 'NOT_FOUND')
    errorOf(await admin.post(`/admin-sekolah/pelajar/${teacher}/reset-password`, { newPassword: 'abcdefgh', newPasswordConfirmation: 'abcdefgh' }), 404, 'NOT_FOUND')
    errorOf(await admin.post(`/admin-sekolah/pelajar/${pInactive}/reset-password`, { newPassword: 'abcdefgh', newPasswordConfirmation: 'abcdefgh' }), 403, 'FORBIDDEN')
    errorOf(await admin.post(`/admin-sekolah/pelajar/${pSuspended}/reset-password`, { newPassword: 'abcdefgh', newPasswordConfirmation: 'abcdefgh' }), 404, 'NOT_FOUND')
  })

  it('lost-response recovery: a retried create is 422 taken, the credential is never served again, reset-password recovers', async () => {
    const first = SchoolAdminPupilCreatedResultSchema.parse((await admin.post('/admin-sekolah/pelajar', { name: 'Hana Demo', email: 'hana@ujian.test' }, { 'Idempotency-Key': 'hana-1' })).body)
    const retry = await admin.post('/admin-sekolah/pelajar', { name: 'Hana Demo', email: 'hana@ujian.test' }, { 'Idempotency-Key': 'hana-1' })
    errorOf(retry, 422, 'VALIDATION_ERROR', 'The email has already been taken.')
    expect(JSON.stringify(retry.body)).not.toContain(first.credential.password)
    const reset = await admin.post(`/admin-sekolah/pelajar/${first.data.id}/reset-password`, { newPassword: 'Pulih-Akaun-99', newPasswordConfirmation: 'Pulih-Akaun-99' })
    expect(reset.status).toBe(200)
    expect((await loginWith(t, 'hana@ujian.test', 'Pulih-Akaun-99')).csrf).toBeTruthy()
  })
})
