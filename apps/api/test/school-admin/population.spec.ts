import { SchoolAdminActivityReportSchema, SchoolAdminDashboardSchema, SchoolAdminMonthlyReportSchema, SchoolAdminUsageSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { apiOf, bootSchoolAdminApp, login, SCHOOL_ADMIN, schoolIdOf, type Api, type SchoolAdminTestApp } from './helpers'
import { addPupil, addRole, addTeacher, xsPupilCount, xsTeacherCount, suspend } from './reports-fixtures'

/**
 * SW6-04, changed by S6-T03: the people counted by S0 (dashboard), S1 (statistik-penggunaan), S3 (laporan-aktiviti) and S5
 * (laporan-bulanan) are XS-1 pupils (active, not suspended, Tingkatan 1-5) and XS-3 teachers (no peer school admin). An inactive
 * (pending or deactivated) or suspended pupil is no longer counted (it used to be, as "managed accounts"); Senarai Pelajar still lists it.
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

  it('S1, S3 and S5 pupil and teacher counts equal the S0 cards, the XS-1 / XS-3 definitions and the S7 teacher total', async () => {
    const d = SchoolAdminDashboardSchema.parse((await admin.get('/admin-sekolah/dashboard')).body.data)
    const pelajar = await admin.get('/admin-sekolah/pelajar')
    const guru = await admin.get('/admin-sekolah/guru')
    // Changed: the pupil list total still counts every pupil with a status chip; the card counts XS-1 only (2 fewer here).
    expect(pelajar.body.meta.counts.total - d.cards.pupils).toBeGreaterThanOrEqual(2)
    expect(d.cards.teachers).toBe(guru.body.meta.counts.total)
    expect(d.cards.pupils).toBe(await xsPupilCount(t.db, s1))
    expect(d.cards.teachers).toBe(await xsTeacherCount(t.db, s1))

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

  it('the dual-role teacher is in no report list, and neither are the inactive and the suspended pupil (XS-1)', async () => {
    const activity = SchoolAdminActivityReportSchema.parse((await admin.get('/admin-sekolah/laporan-aktiviti')).body.data)
    const teacherNames = activity.teachers.map((x) => x.name)
    expect(teacherNames).toContain('Guru Biasa Tambahan')
    expect(teacherNames).not.toContain('Guru Dwi Peranan')
    const pupilNames = activity.pupils.semua.map((x) => x.name)
    // Changed from toContain: XS-1 counts active, non-suspended accounts only.
    expect(pupilNames).not.toContain('Murid Tidak Aktif')
    expect(pupilNames).not.toContain('Murid Digantung')
  })
})
