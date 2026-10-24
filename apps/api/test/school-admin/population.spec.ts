import { SchoolAdminActivityReportSchema, SchoolAdminDashboardSchema, SchoolAdminMonthlyReportSchema, SchoolAdminUsageSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { apiOf, bootSchoolAdminApp, login, SCHOOL_ADMIN, schoolIdOf, type Api, type SchoolAdminTestApp } from './helpers'
import { addPupil, addRole, addTeacher, managedPupilCount, managedTeacherCount, suspend } from './reports-fixtures'

/**
 * SW6-04: the people counted by S1 (statistik-penggunaan), S3 (laporan-aktiviti) and S5 (laporan-bulanan) are the S0 / S6 / S7
 * managed population (FR-M27-50, BR-M27-22): no peer school admin, and inactive or suspended pupils counted like S0 counts them.
 * DB spec: needs Docker/Testcontainers.
 */
describe('school-admin reports count the same people as the dashboard', () => {
  let t: SchoolAdminTestApp
  let admin: Api
  let s1: string

  beforeAll(async () => {
    t = await bootSchoolAdminApp()
    s1 = await schoolIdOf(t.db, 'DEMO001')
    // A dual-role teacher + school_admin, an inactive pupil, a suspended pupil and a plain extra teacher in school 1.
    const dual = await addTeacher(t.db, s1, 'Guru Dwi Peranan')
    await addRole(t.db, dual, 'school_admin')
    await addTeacher(t.db, s1, 'Guru Biasa Tambahan')
    await addPupil(t.db, s1, 'Murid Tidak Aktif', { active: false })
    await suspend(t.db, await addPupil(t.db, s1, 'Murid Digantung'))
    admin = apiOf(await login(t, SCHOOL_ADMIN))
  })
  afterAll(async () => {
    await t.close()
  })

  it('S1, S3 and S5 pupil and teacher counts equal the S0 cards and the S6 / S7 totals', async () => {
    const d = SchoolAdminDashboardSchema.parse((await admin.get('/admin-sekolah/dashboard')).body.data)
    const pelajar = await admin.get('/admin-sekolah/pelajar')
    const guru = await admin.get('/admin-sekolah/guru')
    expect(d.cards.pupils).toBe(pelajar.body.meta.counts.total)
    expect(d.cards.teachers).toBe(guru.body.meta.counts.total)
    expect(d.cards.pupils).toBe(await managedPupilCount(t.db, s1))
    expect(d.cards.teachers).toBe(await managedTeacherCount(t.db, s1))

    const usage = SchoolAdminUsageSchema.parse((await admin.get('/admin-sekolah/usage')).body.data)
    expect(usage.tiles.pupils).toBe(d.cards.pupils)
    expect(usage.tiles.teachers).toBe(d.cards.teachers)

    const activity = SchoolAdminActivityReportSchema.parse((await admin.get('/admin-sekolah/laporan-aktiviti')).body.data)
    expect(activity.overview.pupils).toBe(d.cards.pupils)
    expect(activity.overview.teachers).toBe(d.cards.teachers)
    expect(activity.tiles.pupils.total).toBe(d.cards.pupils)
    expect(activity.tiles.teachers.total).toBe(d.cards.teachers)

    const monthly = SchoolAdminMonthlyReportSchema.parse((await admin.get('/admin-sekolah/laporan-bulanan')).body.data)
    expect(monthly.cards.registered).toBe(d.cards.pupils)
  })

  it('the dual-role teacher is in no report list, the inactive and the suspended pupil are', async () => {
    const activity = SchoolAdminActivityReportSchema.parse((await admin.get('/admin-sekolah/laporan-aktiviti')).body.data)
    const teacherNames = activity.teachers.map((x) => x.name)
    expect(teacherNames).toContain('Guru Biasa Tambahan')
    expect(teacherNames).not.toContain('Guru Dwi Peranan')
    const pupilNames = activity.pupils.semua.map((x) => x.name)
    expect(pupilNames).toContain('Murid Tidak Aktif')
    expect(pupilNames).toContain('Murid Digantung')
  })
})
