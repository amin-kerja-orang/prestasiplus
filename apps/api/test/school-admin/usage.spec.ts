import { ErrorBodySchema, SchoolAdminUsageSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { ADMIN, apiOf, bootSchoolAdminApp, login, SCHOOL_ADMIN, schoolIdOf, STUDENT, TEACHER, type Api, type SchoolAdminTestApp } from './helpers'
import { managedPupilCount, managedTeacherCount, addPupil, addPupilsWithSessions, addSchoolAdmin, addSession } from './reports-fixtures'

/** The helpers' clock is 2026-10-19 09:00 MYT. DB spec: needs Docker/Testcontainers. */
describe('GET /admin-sekolah/usage', () => {
  let t: SchoolAdminTestApp
  let admin: Api
  let adminB: Api
  let s1: string
  let s2: string

  beforeAll(async () => {
    t = await bootSchoolAdminApp()
    s1 = await schoolIdOf(t.db, 'DEMO001')
    s2 = await schoolIdOf(t.db, 'DEMO002')
    await addSchoolAdmin(t.db, s2, 'admin.b@report.test')
    admin = apiOf(await login(t, SCHOOL_ADMIN))
    adminB = apiOf(await login(t, 'admin.b@report.test'))
  })
  afterAll(async () => {
    await t.close()
  })

  it('an empty window: counts of the school, no accuracy, no modes, no-store, parsed with the contract', async () => {
    const res = await admin.get('/admin-sekolah/usage')
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.headers['cache-control']).toBe('no-store')
    const u = SchoolAdminUsageSchema.parse(res.body.data)
    expect(u.period).toBe('30days')
    expect(u.label).toBe('30 Hari')
    expect(u.school).toEqual({ id: s1, name: 'SMK Demo Satu' })
    expect(u.tiles).toMatchObject({
      pupils: await managedPupilCount(t.db, s1),
      teachers: await managedTeacherCount(t.db, s1),
      activePupils: 0,
      sessions: 0,
      answers: 0,
      accuracy: null,
      participationPct: 0,
    })
    expect(u.modes).toEqual([])
  })

  it('an unknown period is 30days; today / 7days are echoed with their labels', async () => {
    expect(SchoolAdminUsageSchema.parse((await admin.get('/admin-sekolah/usage?period=year')).body.data).period).toBe('30days')
    const today = SchoolAdminUsageSchema.parse((await admin.get('/admin-sekolah/usage?period=today')).body.data)
    expect([today.period, today.label]).toEqual(['today', 'Hari Ini'])
    const week = SchoolAdminUsageSchema.parse((await admin.get('/admin-sekolah/usage?period=7days')).body.data)
    expect([week.period, week.label]).toEqual(['7days', '7 Hari'])
  })

  it('computes the tiles and the modes (sorted by sessions, then label) and respects the window edges', async () => {
    const ids = await addPupilsWithSessions(t.db, s1, 5, { mode: 'chapter', questions: 10, correct: 8, completedAt: '2026-10-19T08:00:00+08:00' })
    await addSession(t.db, ids[0] as string, { mode: 'revision', questions: 10, correct: 4, completedAt: '2026-10-18T10:00:00+08:00' })
    await addSession(t.db, ids[1] as string, { mode: 'random', questions: 10, correct: 10, completedAt: '2026-10-18T11:00:00+08:00' })
    // Outside the 7-day window but inside 30 days.
    await addSession(t.db, ids[2] as string, { mode: 'random', questions: 20, correct: 0, completedAt: '2026-10-05T10:00:00+08:00' })
    // Before the 30-day window: never counted.
    await addSession(t.db, ids[3] as string, { mode: 'random', questions: 50, correct: 0, completedAt: '2026-08-01T10:00:00+08:00' })

    const today = SchoolAdminUsageSchema.parse((await admin.get('/admin-sekolah/usage?period=today')).body.data)
    expect(today.tiles).toMatchObject({ sessions: 5, answers: 50, activePupils: 5 })
    expect(today.tiles.accuracy).toBe(80)
    expect(today.modes).toEqual([{ label: 'Bab', sessions: 5, accuracy: 80 }])

    const week = SchoolAdminUsageSchema.parse((await admin.get('/admin-sekolah/usage?period=7days')).body.data)
    expect(week.tiles).toMatchObject({ sessions: 7, answers: 70, activePupils: 5 })
    expect(week.modes.map((m) => m.label)).toEqual(['Bab', 'Latihan', 'Ulang Kaji'])

    const month = SchoolAdminUsageSchema.parse((await admin.get('/admin-sekolah/usage')).body.data)
    expect(month.tiles).toMatchObject({ sessions: 8, answers: 90, activePupils: 5 })
    const pupils = await managedPupilCount(t.db, s1)
    expect(month.tiles.participationPct).toBe(Math.round((5 / pupils) * 100))
  })

  it('a mode answered by fewer than 5 pupils keeps its session count but hides its accuracy', async () => {
    const month = SchoolAdminUsageSchema.parse((await admin.get('/admin-sekolah/usage')).body.data)
    expect(month.modes.find((m) => m.label === 'Ulang Kaji')).toEqual({ label: 'Ulang Kaji', sessions: 1, accuracy: null })
  })

  it('a school with fewer than 5 contributing pupils shows no accuracy at all', async () => {
    const p = await addPupil(t.db, s2, 'Murid Kecil Satu')
    await addSession(t.db, p, { mode: 'chapter', questions: 10, correct: 9, completedAt: '2026-10-19T08:00:00+08:00' })
    const after = SchoolAdminUsageSchema.parse((await adminB.get('/admin-sekolah/usage')).body.data)
    expect(after.school.id).toBe(s2)
    expect(after.tiles).toMatchObject({ sessions: 1, answers: 10, activePupils: 1, accuracy: null })
    expect(after.modes).toEqual([{ label: 'Bab', sessions: 1, accuracy: null }])
  })

  it('a school-B admin never sees school A rows, and a schoolId in the query is ignored', async () => {
    const b = SchoolAdminUsageSchema.parse((await adminB.get(`/admin-sekolah/usage?schoolId=${s1}&period=30days`)).body.data)
    expect(b.school.id).toBe(s2)
    expect(b.tiles.sessions).toBe(1)
    expect(b.tiles.answers).toBe(10)
    const a = SchoolAdminUsageSchema.parse((await admin.get(`/admin-sekolah/usage?schoolId=${s2}`)).body.data)
    expect(a.school.id).toBe(s1)
    expect(a.tiles.sessions).toBe(8)
  })

  it('401 without a session; 403 for admin, teacher and student', async () => {
    expect((await t.http().get('/api/admin-sekolah/usage')).status).toBe(401)
    for (const who of [ADMIN, TEACHER, STUDENT]) {
      const res = await apiOf(await login(t, who)).get('/admin-sekolah/usage')
      expect(res.status, who).toBe(403)
      expect(ErrorBodySchema.parse(res.body).error.code).toBe('FORBIDDEN')
    }
  })
})
