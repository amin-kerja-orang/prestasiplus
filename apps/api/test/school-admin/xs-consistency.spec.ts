import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { featureModules } from '../../src/modules'
import { apiOf, bootSchoolAdminApp, login, SCHOOL_ADMIN, schoolIdOf, type Api, type SchoolAdminTestApp } from './helpers'
import { addPupil, addTeacher, xsPupilCount, xsTeacherCount } from './reports-fixtures'

/**
 * T-C5: ONE definition of "pupils" (XS-1) and "teachers" (XS-3) on every screen of the school admin. Before, Monitoring and
 * Kirkpatrick counted a private "T4/T5" cut (grade 10 and 11, a suspended pupil included) and every active teacher, so the same
 * school showed 20 pupils on the dashboard and 17 in Monitoring, 3 teachers and 4 in Monitoring. The expected figures are plain SQL
 * (`reports-fixtures.ts`), independent of `xs-queries.ts`.
 */
describe('XS-1 and XS-3: the same figures on every school admin screen', () => {
  let t: SchoolAdminTestApp
  let admin: Api
  let school: string

  beforeAll(async () => {
    t = await bootSchoolAdminApp({ modules: featureModules })
    admin = apiOf(await login(t, SCHOOL_ADMIN))
    school = await schoolIdOf(t.db, 'DEMO001')
    // Pupils of every Tingkatan, plus the ones XS-1 leaves out: suspended, deactivated, no Tingkatan.
    for (const grade of [7, 8, 9, 10, 11]) await addPupil(t.db, school, `Murid Tingkatan ${grade - 6}`, { grade })
    const suspended = await addPupil(t.db, school, 'Murid Digantung', { grade: 10 })
    await t.db.query(`update users set is_suspended = true where id = $1::bigint`, [suspended])
    await addPupil(t.db, school, 'Murid Tidak Aktif', { grade: 11, active: false })
    await t.db.query(`update users set grade = null where id = $1::bigint`, [await addPupil(t.db, school, 'Murid Tanpa Tingkatan')])
    // Teachers: one plain, one who is also the school admin (not an XS-3 teacher), one waiting for approval.
    await addTeacher(t.db, school, 'Guru Biasa')
    const both = await addTeacher(t.db, school, 'Guru Dan Admin')
    await t.db.query(`insert into user_roles (user_id, role, created_at) values ($1::bigint, 'school_admin', now())`, [both])
    const waiting = await addTeacher(t.db, school, 'Guru Menunggu Kelulusan')
    await t.db.query(`update users set pending_school_id = school_id, is_active = false where id = $1::bigint`, [waiting])
  }, 240_000)
  afterAll(async () => {
    await t.close()
  })

  it('pupils: dashboard, Senarai Pelajar, Monitoring and Kirkpatrick show the XS-1 count', async () => {
    const expected = await xsPupilCount(t.db, school)
    expect(expected).toBeGreaterThanOrEqual(5)
    const dashboard = (await admin.get('/admin-sekolah/dashboard')).body.data
    expect(dashboard.cards.pupils).toBe(expected)
    const list = (await admin.get('/admin-sekolah/pelajar')).body
    expect(list.meta.counts.xs).toBe(expected)
    const monitoring = (await admin.get('/monitoring/overview')).body.data
    expect(monitoring.kpi.students).toBe(expected)
    expect(monitoring.studentRows.find((r: { schoolId: string }) => r.schoolId === school)?.registered).toBe(expected)
    const kirkpatrick = (await admin.get('/kirkpatrick/overview')).body.data
    expect(kirkpatrick.kpi.t4t5).toBe(expected)
    // Every Tingkatan 1-5 pupil is listed by the Monitoring school page, with its own level label.
    const detail = (await admin.get(`/monitoring/schools/${school}`)).body.data
    expect(detail.cards.students).toBe(expected)
    expect(detail.students).toHaveLength(expected)
    expect(new Set(detail.students.map((s: { level: string }) => s.level))).toEqual(new Set(['T1', 'T2', 'T3', 'T4', 'T5']))
  })

  it('teachers: dashboard, Senarai Guru and Monitoring show the XS-3 count', async () => {
    const expected = await xsTeacherCount(t.db, school)
    expect(expected).toBeGreaterThanOrEqual(1)
    const dashboard = (await admin.get('/admin-sekolah/dashboard')).body.data
    expect(dashboard.cards.teachers).toBe(expected)
    const list = (await admin.get('/admin-sekolah/guru')).body
    expect(list.meta.counts.xs).toBe(expected)
    const monitoring = (await admin.get('/monitoring/overview')).body.data
    expect(monitoring.kpi.teachers).toBe(expected)
    const kirkpatrick = (await admin.get('/kirkpatrick/overview')).body.data
    expect(kirkpatrick.kpi.teachers).toBe(expected)
  })

  it('Amaran Awal: the dashboard panel, the school page and the summary give one tally', async () => {
    const dashboard = (await admin.get('/admin-sekolah/dashboard')).body.data
    const page = (await admin.get(`/amaran/schools/${school}`)).body.data
    const summary = (await admin.get('/amaran/summary')).body.data
    const { green, yellow, red, total } = page.tally
    expect(dashboard.performance.risk).toEqual({ safe: green, watch: yellow, high: red, total })
    expect(summary.tally).toEqual(page.tally)
  })
})
