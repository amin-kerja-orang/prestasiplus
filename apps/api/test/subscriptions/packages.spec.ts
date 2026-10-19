import { SCHOOL_PACKAGE_MESSAGES, SchoolPackageAssignmentSchema, SchoolPackageUserViewSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { priceLabel } from '../../src/modules/subscriptions/user-packages.service'
import {
  ADMIN,
  SCHOOL_ADMIN,
  STUDENT,
  addStudents,
  apiOf,
  bootSubApp,
  expectError,
  fieldsOf,
  login,
  schoolIdOf,
  userIdOf,
  type Api,
  type SubTestApp,
} from './sub-helpers'

describe('priceLabel (pure)', () => {
  const pkg = { priceAnnual: '30.00', maxRenewals: 1 } as never
  it('formats the mock label "RM 30/pelajar · {years} tahun"', () => {
    expect(priceLabel(pkg)).toBe('RM 30/pelajar · 2 tahun')
    expect(priceLabel({ priceAnnual: '30.50', maxRenewals: 0 } as never)).toBe('RM 30.50/pelajar · 1 tahun')
  })
})

describe('user packages (AC 1)', () => {
  let t: SubTestApp
  let admin: Api
  let schoolAdminId: string
  let s1: string
  let packageId: Record<string, string>

  beforeAll(async () => {
    t = await bootSubApp()
    admin = apiOf(await login(t, ADMIN))
    schoolAdminId = await userIdOf(t.db, SCHOOL_ADMIN)
    s1 = await schoolIdOf(t.db, 'DEMO001')
    packageId = Object.fromEntries((await t.db.query<{ code: string; id: string }>(`select code, id::text from school_packages`)).map((r) => [r.code, r.id]))
  })
  afterAll(async () => {
    await t.close()
  })

  const view = async (id = schoolAdminId) => admin.get(`/admin/users/${id}/packages`)
  const assign = (body: Record<string, unknown>, id = schoolAdminId) => admin.post(`/admin/users/${id}/packages`, body)
  const rows = async () =>
    t.db.query<{ form_level: string; school_package_id: string; student_quota: number }>(
      `select form_level, school_package_id::text, student_quota from user_packages where user_id = $1 order by form_level`,
      [schoolAdminId],
    )

  it('shows the T4 and T5 cards with nothing assigned, the school and the existing T5 pupils', async () => {
    const res = await view()
    expect(res.status).toBe(200)
    expect(res.headers['cache-control']).toBe('no-store')
    const v = SchoolPackageUserViewSchema.parse(res.body.data)
    expect(v.user).toEqual({ id: schoolAdminId, name: 'Admin Sekolah Demo' })
    expect(v.school).toMatchObject({ id: s1, code: 'DEMO001' })
    expect(v.packages).toEqual([
      { formLevel: 't4', packageId: packageId.T4, code: 'T4', name: 'Pakej SPM Tingkatan 4', priceLabel: 'RM 30/pelajar · 2 tahun', years: 2, assigned: null },
      { formLevel: 't5', packageId: packageId.T5, code: 'T5', name: 'Pakej SPM Tingkatan 5', priceLabel: 'RM 30/pelajar · 1 tahun', years: 1, assigned: null },
    ])
    // Grade 11 is T5: the seed has one such pupil.
    expect(v.existingT5Count).toBe(1)
    await addStudents(t.db, s1, 2, { grade: 11 })
    expect(SchoolPackageUserViewSchema.parse((await view()).body.data).existingT5Count).toBe(3)
  })

  it('assigns a package: exact message, upsert per (user, form level), assignedAt = now', async () => {
    const res = await assign({ formLevel: 't4', packageId: packageId.T4, studentQuota: 150 })
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('Pakej berjaya ditetapkan.')
    expect(SchoolPackageAssignmentSchema.parse(res.body.data)).toMatchObject({
      userId: schoolAdminId,
      formLevel: 't4',
      packageId: packageId.T4,
      studentQuota: 150,
      assignedAt: '2026-10-19T09:00:00.000+08:00',
    })
    t.clock.advance(60_000)
    const again = await assign({ formLevel: 't4', packageId: packageId.T4, studentQuota: '200' })
    expect(again.body.data.id).toBe(res.body.data.id)
    expect(again.body.data.assignedAt).toBe('2026-10-19T09:01:00.000+08:00')
    await assign({ formLevel: 't5', packageId: packageId.T5, studentQuota: 1 })
    expect(await rows()).toEqual([
      { form_level: 't4', school_package_id: packageId.T4, student_quota: 200 },
      { form_level: 't5', school_package_id: packageId.T5, student_quota: 1 },
    ])
    const cards = SchoolPackageUserViewSchema.parse((await view()).body.data).packages
    expect(cards[0]?.assigned).toEqual({ studentQuota: 200, assignedAt: '2026-10-19T09:01:00.000+08:00' })
    expect(cards[1]?.assigned?.studentQuota).toBe(1)
  })

  it('parallel assigns of one form level leave a single row (lock)', async () => {
    await t.db.query(`delete from user_packages where user_id = $1`, [schoolAdminId])
    const results = await Promise.all([10, 20, 30, 40].map((q) => assign({ formLevel: 't5', packageId: packageId.T5, studentQuota: q })))
    expect(results.every((r) => r.status === 200)).toBe(true)
    expect(await rows()).toHaveLength(1)
  })

  it('writes an audit row with the actor, the form level and the quota only', async () => {
    const a = await t.db.query<{ actor_role: string; scope_school_id: string; detail: Record<string, unknown> }>(
      `select actor_role, scope_school_id::text, detail from audit_events where action = 'subscriptions.user_package_assigned' and target_id = $1 order by id desc limit 1`,
      [schoolAdminId],
    )
    expect(a[0]?.actor_role).toBe('admin')
    expect(a[0]?.scope_school_id).toBe(s1)
    expect(Object.keys(a[0]?.detail ?? {}).sort()).toEqual(['formLevel', 'packageId', 'sessionRowId', 'studentQuota'])
  })

  it('404 for an unknown user; 422 on fields.id for a user who is not a school admin (before the body is read)', async () => {
    expectError(await view('999999'), 'NOT_FOUND')
    expectError(await assign({}, '999999'), 'NOT_FOUND')
    const studentId = await userIdOf(t.db, STUDENT)
    for (const res of [await view(studentId), await assign({ nonsense: 1 }, studentId)]) {
      expect(fieldsOf(res)).toEqual({ id: 'Pengguna ini bukan admin sekolah.' })
      expect(res.body.error.message).toBe(SCHOOL_PACKAGE_MESSAGES.notSchoolAdmin)
    }
    expect(await t.db.query(`select 1 from user_packages where user_id = $1`, [studentId])).toHaveLength(0)
  })

  it.each([
    ['unknown form level', { formLevel: 't9' }, 'formLevel', 'The selected form level is invalid.'],
    ['missing form level', { formLevel: undefined }, 'formLevel', 'The form level field is required.'],
    ['t4 with the t5 package id', { formLevel: 't4', packageId: 'T5' }, 'packageId', 'The selected package id is invalid.'],
    ['unknown package', { packageId: '999999' }, 'packageId', 'The selected package id is invalid.'],
    ['quota 0', { studentQuota: 0 }, 'studentQuota', 'The student quota field must be at least 1.'],
    ['quota 2001', { studentQuota: 2001 }, 'studentQuota', 'The student quota field must not be greater than 2000.'],
    ['quota not a number', { studentQuota: 'x' }, 'studentQuota', 'The student quota field must be an integer.'],
    ['unknown key', { userId: '1' }, 'userId', 'The userId field is not allowed.'],
  ])('422 when %s', async (_label, over, field, message) => {
    const base = { formLevel: 't4', packageId: packageId.T4, studentQuota: 10 }
    const body = { ...base, ...over } as Record<string, unknown>
    if ('packageId' in over && over.packageId === 'T5') body.packageId = packageId.T5
    expect(fieldsOf(await assign(body))[field]).toBe(message)
  })
})
