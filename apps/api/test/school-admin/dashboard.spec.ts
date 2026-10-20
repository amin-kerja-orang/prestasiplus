import { ErrorBodySchema, SchoolAdminDashboardSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  ADMIN,
  apiOf,
  bootSchoolAdminApp,
  emptyView,
  FakePerformance,
  login,
  SCHOOL_ADMIN,
  schoolIdOf,
  STUDENT,
  TEACHER,
  type Api,
  type SchoolAdminTestApp,
} from './helpers'

describe('GET /admin-sekolah/dashboard with no BE-19 / BE-17 provider (fail-closed defaults)', () => {
  let t: SchoolAdminTestApp
  let admin: Api
  let s1: string

  beforeAll(async () => {
    t = await bootSchoolAdminApp()
    admin = apiOf(await login(t, SCHOOL_ADMIN))
    s1 = await schoolIdOf(t.db, 'DEMO001')
  })
  afterAll(async () => {
    await t.close()
  })

  it('answers the empty aggregate, parsed with the contract, no-store, with the own school and real counts', async () => {
    const res = await admin.get('/admin-sekolah/dashboard')
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.headers['cache-control']).toBe('no-store')
    const d = SchoolAdminDashboardSchema.parse(res.body.data)
    expect(d.school).toMatchObject({ id: s1, name: 'SMK Demo Satu', code: 'DEMO001', ppd: 'Petaling', state: 'Selangor' })
    expect(d.roleLabel).toBe('Admin Sekolah')
    expect(d.cards.pupils).toBeGreaterThan(0)
    expect(d.cards.teachers).toBeGreaterThan(0)
    expect(d.cards.activeClasses).toBe(0)
    expect(d.cards.subscription).toEqual({ status: 'none', label: 'Belum Ada' })
    expect(d.performance.practice).toEqual({ accuracy: null, sessions: 0, questions: 0 })
    expect(d.performance.risk).toBeNull()
    expect(d.performance.total).toBe(0)
    expect(d.perutusan.length).toBeLessThanOrEqual(3)
  })

  it('a schoolId in the query is ignored: the dashboard is always the own school', async () => {
    const s2 = await schoolIdOf(t.db, 'DEMO002')
    const d = SchoolAdminDashboardSchema.parse((await admin.get(`/admin-sekolah/dashboard?schoolId=${s2}`)).body.data)
    expect(d.school.id).toBe(s1)
  })

  it('401 without a session; 403 for admin, teacher and student', async () => {
    expect((await t.http().get('/api/admin-sekolah/dashboard')).status).toBe(401)
    for (const who of [ADMIN, TEACHER, STUDENT]) {
      const res = await apiOf(await login(t, who)).get('/admin-sekolah/dashboard')
      expect(res.status, who).toBe(403)
      expect(ErrorBodySchema.parse(res.body).error.code).toBe('FORBIDDEN')
    }
  })

  it('a school admin without a school has no session at all (exactly 401): never "all schools"; the controller 403 is defence in depth', async () => {
    const id = (await t.db.query<{ id: string }>(`select id::text from users where email = $1`, [SCHOOL_ADMIN]))[0]?.id as string
    const who = apiOf(await login(t, SCHOOL_ADMIN))
    await t.db.query(`update users set school_id = null where id = $1::bigint`, [id])
    try {
      const res = await who.get('/admin-sekolah/dashboard')
      // buildGrants() cannot derive a scope for a school-less school_admin, so the session is refused before the controller.
      expect(res.status).toBe(401)
    } finally {
      await t.db.query(`update users set school_id = $1::bigint where id = $2::bigint`, [s1, id])
    }
  })
})

describe('GET /admin-sekolah/dashboard with a BE-19-shaped provider', () => {
  let t: SchoolAdminTestApp
  let admin: Api
  let s1: string
  const fake = new FakePerformance(
    emptyView({
      stats: { students: 12, sessions: 40, answered: 500, accuracy: 68.4 },
      levels: [
        { code: 't4', accuracy: 71.2, students: 9 },
        { code: 't5', accuracy: 64.9, students: 3 },
      ],
      distribution: [
        { grade: 'A', count: 6, pct: 50 },
        { grade: 'B', count: 4, pct: 33 },
        { grade: 'C', count: 2, pct: 17 },
      ],
    }),
  )

  beforeAll(async () => {
    t = await bootSchoolAdminApp({ performance: fake, classes: { activeClasses: async () => 7 } })
    admin = apiOf(await login(t, SCHOOL_ADMIN))
    s1 = await schoolIdOf(t.db, 'DEMO001')
  })
  afterAll(async () => {
    await t.close()
  })

  it('maps the BE-19 figures, applies k = 5 to small groups, and asks BE-19 with the own school scope', async () => {
    const res = await admin.get('/admin-sekolah/dashboard')
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    const d = SchoolAdminDashboardSchema.parse(res.body.data)
    expect(d.cards.activeClasses).toBe(7)
    expect(d.performance.practice).toEqual({ accuracy: 68.4, sessions: 40, questions: 500 })
    // t5 has 3 pupils: suppressed. t4 has 9: shown.
    expect(d.performance.levels).toEqual([
      { code: 't4', name: 'Tingkatan 4', accuracy: 71.2 },
      { code: 't5', name: 'Tingkatan 5', accuracy: 0 },
    ])
    // Grades B (4) and C (2) are under 5 pupils: suppressed; the total follows what is shown.
    expect(d.performance.distribution).toEqual([
      { grade: 'A', count: 6, pct: 50 },
      { grade: 'B', count: 0, pct: 0 },
      { grade: 'C', count: 0, pct: 0 },
    ])
    expect(d.performance.total).toBe(6)
    expect(d.performance.gps).toEqual({ value: null, grade: null, band: null, entries: 0 })

    const ctx = fake.calls.at(-1)
    expect(ctx?.role).toBe('school_admin')
    expect(ctx?.scope).toMatchObject({ level: 'school', schoolId: s1 })
  })

  it('shows no pupil name: no seeded student name appears anywhere in the body', async () => {
    const names = (await t.db.query<{ name: string }>(
      `select u.name from users u join user_roles r on r.user_id = u.id where r.role = 'student'`,
    )).map((r) => r.name)
    expect(names.length).toBeGreaterThan(0)
    const text = (await admin.get('/admin-sekolah/dashboard')).text
    for (const name of names) expect(text).not.toContain(name)
  })

  it('a school under the cohort size shows an empty practice block', async () => {
    fake.view = emptyView({ stats: { students: 4, sessions: 9, answered: 90, accuracy: 55 } })
    const d = SchoolAdminDashboardSchema.parse((await admin.get('/admin-sekolah/dashboard')).body.data)
    expect(d.performance.practice).toEqual({ accuracy: null, sessions: 0, questions: 0 })
  })
})
