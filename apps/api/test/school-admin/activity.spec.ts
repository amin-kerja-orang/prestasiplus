import { ErrorBodySchema, SchoolAdminActivityReportSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { ADMIN, apiOf, bootSchoolAdminApp, login, SCHOOL_ADMIN, schoolIdOf, STUDENT, TEACHER, type Api, type SchoolAdminTestApp } from './helpers'
import { addPupil, addSubject, managedPupilCount, addPupilsWithSessions, addSchoolAdmin, addSession, addTeacher } from './reports-fixtures'

/** The helpers' clock is 2026-10-19 09:00 MYT. DB spec: needs Docker/Testcontainers. */
describe('GET /admin-sekolah/laporan-aktiviti', () => {
  let t: SchoolAdminTestApp
  let admin: Api
  let adminB: Api
  let s1: string
  let s2: string
  let neverLoggedPupil: string
  let neverLoggedTeacher: string

  beforeAll(async () => {
    t = await bootSchoolAdminApp()
    s1 = await schoolIdOf(t.db, 'DEMO001')
    s2 = await schoolIdOf(t.db, 'DEMO002')
    await addSchoolAdmin(t.db, s2, 'admin.b@report.test')
    // School A: 5 pupils with sessions today, one that never logged in, one teacher who never logged in.
    // A subject makes the seed write practice_answers: the pills count "aktif" from the answer log.
    const subject = await addSubject(t.db, 'AKT', 'Subjek Aktiviti')
    await addPupilsWithSessions(t.db, s1, 5, { subjectId: subject, mode: 'chapter', questions: 10, correct: 7, completedAt: '2026-10-19T08:00:00+08:00', seconds: 120 }, 'Murid Aktiviti')
    neverLoggedPupil = await addPupil(t.db, s1, 'Murid Belum Masuk', { loggedIn: false })
    neverLoggedTeacher = await addTeacher(t.db, s1, 'Guru Belum Masuk', false)
    // School B: one pupil and one session.
    const b = await addPupil(t.db, s2, 'Murid Sekolah B')
    await addSession(t.db, b, { questions: 10, correct: 10, completedAt: '2026-10-19T08:00:00+08:00' })
    await addTeacher(t.db, s2, 'Guru Sekolah B')
    admin = apiOf(await login(t, SCHOOL_ADMIN))
    adminB = apiOf(await login(t, 'admin.b@report.test'))
  })
  afterAll(async () => {
    await t.close()
  })

  it('answers the school report parsed with the contract, no-store, with no platform-only keys', async () => {
    const res = await admin.get('/admin-sekolah/laporan-aktiviti')
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.headers['cache-control']).toBe('no-store')
    const r = SchoolAdminActivityReportSchema.parse(res.body.data)
    expect(r.range).toBe(30)
    expect(r.schoolId).toBe(s1)
    expect(r.trend).toHaveLength(30)
    expect(r.trend.at(-1)).toMatchObject({ label: '19/10', value: 5 })
    expect(r.overview).toMatchObject({ pupils: await managedPupilCount(t.db, s1), practised: 5, activity: 5 })
    expect(r.breakdown).toEqual({ quiz: 5, structured: 0, battle: 0, game: 0 })
    expect(r.tiles.pupils).toMatchObject({ practised: 5, sessions: 5, accuracy: 70 })
    const text = JSON.stringify(res.body)
    for (const key of ['"score"', '"structuredScore"', '"schoolName"', '"schools"']) expect(text).not.toContain(key)
  })

  it('range: 7, 30 and 90 are accepted, anything else is 30', async () => {
    const days = async (q: string) => SchoolAdminActivityReportSchema.parse((await admin.get(`/admin-sekolah/laporan-aktiviti${q}`)).body.data).trend.length
    expect(await days('?range=7')).toBe(7)
    expect(await days('?range=90')).toBe(90)
    expect(await days('?range=15')).toBe(30)
    expect(await days('?range=abc')).toBe(30)
    expect(await days('')).toBe(30)
  })

  it('pupil pills: semua, aktif, loginSahaja and belumLogin; each row carries sessions, accuracy, seconds and coins', async () => {
    const r = SchoolAdminActivityReportSchema.parse((await admin.get('/admin-sekolah/laporan-aktiviti')).body.data)
    expect(r.pupils.semua.length).toBeGreaterThanOrEqual(6)
    expect(r.pupils.aktif).toHaveLength(5)
    const row = r.pupils.aktif[0]
    expect(row).toMatchObject({ sessions: 1, accuracy: 70, seconds: 120, coins: 0 })
    expect(r.pupils.belumLogin.map((p) => p.userId)).toContain(neverLoggedPupil)
    expect(r.pupils.aktif.map((p) => p.userId)).not.toContain(neverLoggedPupil)
    for (const list of Object.values(r.pupils)) expect(list.length).toBeLessThanOrEqual(200)
  })

  it('teachers: never-logged teacher listed, rows carry the figures; the report has no teacher of another school', async () => {
    const r = SchoolAdminActivityReportSchema.parse((await admin.get('/admin-sekolah/laporan-aktiviti')).body.data)
    expect(r.teachersNeverLogged.map((x) => x.userId)).toContain(neverLoggedTeacher)
    const row = r.teachers.find((x) => x.userId === neverLoggedTeacher)
    expect(row).toMatchObject({ loggedIn: false, mcq: 0, structured: 0, coins: 0, hasHeadcount: false, lastLoginAt: null })
    expect(r.tiles.teachers.total).toBe(r.teachers.length)
    expect(JSON.stringify(r)).not.toContain('Guru Sekolah B')
  })

  it('a school-B admin never sees school A rows (pupils, teachers, sessions)', async () => {
    const res = await adminB.get(`/admin-sekolah/laporan-aktiviti?schoolId=${s1}`)
    const r = SchoolAdminActivityReportSchema.parse(res.body.data)
    expect(r.schoolId).toBe(s2)
    const text = JSON.stringify(r)
    expect(text).not.toContain('Murid Aktiviti')
    expect(text).not.toContain('Guru Belum Masuk')
    expect(text).not.toContain('Murid Belum Masuk')
    expect(text).toContain('Murid Sekolah B')
    expect(r.breakdown.quiz).toBe(1)
  })

  it('a school with fewer than 5 contributing pupils: the accuracy tile is hidden (0), the session count stays', async () => {
    const r = SchoolAdminActivityReportSchema.parse((await adminB.get('/admin-sekolah/laporan-aktiviti')).body.data)
    expect(r.tiles.pupils.sessions).toBe(1)
    expect(r.tiles.pupils.accuracy).toBe(0)
  })

  it('401 without a session; 403 for admin, teacher and student', async () => {
    expect((await t.http().get('/api/admin-sekolah/laporan-aktiviti')).status).toBe(401)
    for (const who of [ADMIN, TEACHER, STUDENT]) {
      const res = await apiOf(await login(t, who)).get('/admin-sekolah/laporan-aktiviti')
      expect(res.status, who).toBe(403)
      expect(ErrorBodySchema.parse(res.body).error.code).toBe('FORBIDDEN')
    }
  })
})

/** DB spec (not run by the fixer): both anti-cache headers on the 200 and on the 429 of the activity report. */
describe('GET /admin-sekolah/laporan-aktiviti anti-cache headers', () => {
  let t: SchoolAdminTestApp
  let admin: Api

  beforeAll(async () => {
    t = await bootSchoolAdminApp({ env: { THROTTLE_SCHOOL_ADMIN_READ_PER_MINUTE: '1' } })
    admin = apiOf(await login(t, SCHOOL_ADMIN))
  })
  afterAll(async () => {
    await t.close()
  })

  it('sends no-store and Pragma: no-cache on the 200 and on the 429', async () => {
    const ok = await admin.get('/admin-sekolah/laporan-aktiviti')
    expect(ok.status).toBe(200)
    expect(ok.headers['cache-control']).toBe('no-store')
    expect(ok.headers.pragma).toBe('no-cache')
    const limited = await admin.get('/admin-sekolah/laporan-aktiviti')
    expect(limited.status).toBe(429)
    expect(limited.headers['cache-control']).toBe('no-store')
    expect(limited.headers.pragma).toBe('no-cache')
  })
})
