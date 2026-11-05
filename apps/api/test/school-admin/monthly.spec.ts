import { ErrorBodySchema, SchoolAdminMonthlyReportSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { ADMIN, apiOf, bootSchoolAdminApp, login, SCHOOL_ADMIN, schoolIdOf, STUDENT, TEACHER, type Api, type SchoolAdminTestApp } from './helpers'
import { addPupil, addSchoolAdmin, addSession, addSubject, addTeacher, xsPupilCount, xsTeacherCount } from './reports-fixtures'

/** The helpers' clock is 2026-10-19 09:00 MYT. DB spec: needs Docker/Testcontainers. */
describe('GET /admin-sekolah/laporan-bulanan', () => {
  let t: SchoolAdminTestApp
  let admin: Api
  let adminB: Api
  let s1: string
  let s2: string
  let mat: string
  let bm: string

  beforeAll(async () => {
    t = await bootSchoolAdminApp()
    s1 = await schoolIdOf(t.db, 'DEMO001')
    s2 = await schoolIdOf(t.db, 'DEMO002')
    mat = await addSubject(t.db, 'MATLAP', 'Matematik Ujian')
    bm = await addSubject(t.db, 'BMLAP', 'Bahasa Ujian')
    await addSchoolAdmin(t.db, s2, 'admin.b@report.test')
    // School A: 5 pupils; October (Matematik 8/10 each), September (Bahasa 5/10 each).
    for (let i = 1; i <= 5; i++) {
      const p = await addPupil(t.db, s1, `Murid Bulanan ${i}`)
      await addSession(t.db, p, { questions: 10, correct: 8, completedAt: '2026-10-10T10:00:00+08:00', subjectId: mat })
      await addSession(t.db, p, { questions: 10, correct: 5, completedAt: '2026-09-10T10:00:00+08:00', subjectId: bm })
    }
    // One more October session without answers or subject: "Okt" is the busiest month (6 sessions against 5 in September).
    const first = (await t.db.query<{ id: string }>(`select id::text from users where name = 'Murid Bulanan 1'`))[0]?.id as string
    await addSession(t.db, first, { questions: 5, correct: 5, completedAt: '2026-10-11T10:00:00+08:00' })
    await addTeacher(t.db, s1, 'Guru Bulanan Satu')
    await addTeacher(t.db, s1, 'Guru Bulanan Dua', false)
    // School B: 2 pupils in October only.
    for (let i = 1; i <= 2; i++) {
      const p = await addPupil(t.db, s2, `Murid Bulanan B ${i}`)
      await addSession(t.db, p, { questions: 10, correct: 10, completedAt: '2026-10-10T10:00:00+08:00', subjectId: mat })
    }
    admin = apiOf(await login(t, SCHOOL_ADMIN))
    adminB = apiOf(await login(t, 'admin.b@report.test'))
  })
  afterAll(async () => {
    await t.close()
  })

  it('the current month: cards, subject strengths and the series, parsed with the contract and no-store', async () => {
    const res = await admin.get('/admin-sekolah/laporan-bulanan')
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.headers['cache-control']).toBe('no-store')
    const r = SchoolAdminMonthlyReportSchema.parse(res.body.data)
    expect(r.month).toBe('2026-10')
    expect(r.label).toBe('Oktober 2026')
    expect(r.prev).toBe('2026-09')
    expect(r.next).toBeNull()
    expect(r.cards).toMatchObject({ active: 5, answers: 50, perPupil: 10, accuracy: 80, sessions: 6, registered: await xsPupilCount(t.db, s1), teachers: await xsTeacherCount(t.db, s1) })
    expect(r.cards.teachers).toBeGreaterThanOrEqual(2)
    expect(r.cards.busiestMonth).toEqual({ month: '2026-10', label: 'Okt', sessions: 6 })
    expect(r.months.map((m) => m.month)).toEqual(['2026-09', '2026-10'])
    expect(r.months[0]).toMatchObject({ label: 'September 2026', answers: 50, correct: 25, activePupils: 5, perPupil: 10, accuracy: 50 })
    expect(r.total).toEqual({ answers: 100, correct: 65, accuracy: 65 })
    expect(r.subjects.rows).toEqual([{ name: 'Matematik Ujian', accuracy: 80, answers: 50, pupils: 5, sessions: 5 }])
    expect(r.subjects.strongest?.name).toBe('Matematik Ujian')
    // "Trend Harian": every day of October, answers of that MYT day (the 10th holds all 50).
    expect(r.daily).toHaveLength(31)
    expect(r.daily.map((d) => d.day)).toEqual(Array.from({ length: 31 }, (_, i) => i + 1))
    expect(r.daily[9]).toEqual({ day: 10, answers: 50 })
    expect(r.daily.reduce((n, d) => n + d.answers, 0)).toBe(r.cards.answers)
    // "Trend Penggunaan Bulanan 2026": 12 bars Jan to Dis of the shown year (sessions per month).
    expect(r.yearly.year).toBe(2026)
    expect(r.yearly.months.map((m) => m.label)).toEqual(['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis'])
    expect(r.yearly.months.map((m) => m.month)[0]).toBe('2026-01')
    expect(r.yearly.months.map((m) => m.sessions)).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 5, 6, 0, 0])
    // generatedAt is the request minute.
    expect(r.generatedAt).toMatch(/:00\.000\+08:00$/)
  })

  it('a past month: prev and next, its own subject rows', async () => {
    const r = SchoolAdminMonthlyReportSchema.parse((await admin.get('/admin-sekolah/laporan-bulanan?bulan=2026-09')).body.data)
    expect(r.month).toBe('2026-09')
    expect(r.prev).toBe('2026-08')
    expect(r.next).toBe('2026-10')
    expect(r.cards.accuracy).toBe(50)
    // The yearly trend is the year of the shown month; the chosen month is the one the page highlights.
    expect(r.yearly.months[8]).toEqual({ month: '2026-09', label: 'Sep', sessions: 5 })
    expect(r.daily).toHaveLength(30)
    expect(r.daily[9]).toEqual({ day: 10, answers: 50 })
    expect(r.months.map((m) => m.month)).toEqual(['2026-09'])
    expect(r.total).toBeNull()
    expect(r.subjects.rows.map((s) => [s.name, s.sessions])).toEqual([['Bahasa Ujian', 5]])
  })

  it('a future or invalid bulan is the current month', async () => {
    for (const q of ['2099-01', '2026-13', 'abc', '']) {
      const r = SchoolAdminMonthlyReportSchema.parse((await admin.get(`/admin-sekolah/laporan-bulanan?bulan=${q}`)).body.data)
      expect(r.month, q).toBe('2026-10')
    }
  })

  it('an empty month: every section is still present (daily zeros, 12 yearly bars, empty subject rows), accuracy null', async () => {
    const r = SchoolAdminMonthlyReportSchema.parse((await admin.get('/admin-sekolah/laporan-bulanan?bulan=2026-01')).body.data)
    expect(r.months).toEqual([])
    expect(r.total).toBeNull()
    expect(r.cards).toMatchObject({ active: 0, answers: 0, accuracy: null, perPupil: 0, sessions: 0 })
    expect(r.subjects).toEqual({ strongest: null, weakest: null, rows: [] })
    expect(r.daily).toHaveLength(31)
    expect(r.daily.every((d) => d.answers === 0)).toBe(true)
    expect(r.yearly.months).toHaveLength(12)
    // February of a non-leap year, and the year of the shown month.
    const feb = SchoolAdminMonthlyReportSchema.parse((await admin.get('/admin-sekolah/laporan-bulanan?bulan=2025-02')).body.data)
    expect(feb.daily).toHaveLength(28)
    expect(feb.yearly.year).toBe(2025)
    expect(feb.yearly.months.every((m) => m.sessions === 0)).toBe(true)
    expect(feb.cards.busiestMonth).toBeNull()
  })

  it('a school with fewer than 5 active pupils in the month is shown in full (no minimum cohort for staff)', async () => {
    const res = await adminB.get(`/admin-sekolah/laporan-bulanan?schoolId=${s1}`)
    const r = SchoolAdminMonthlyReportSchema.parse(res.body.data)
    expect(r.school.id).toBe(s2)
    // Changed from accuracy null, no series, no subjects (suppressed).
    expect(r.cards).toMatchObject({ active: 2, answers: 20, accuracy: 100 })
    expect(r.daily.reduce((n, d) => n + d.answers, 0)).toBe(20)
    expect(r.months).toEqual([{ month: '2026-10', label: 'Oktober 2026', answers: 20, correct: 20, activePupils: 2, perPupil: 10, accuracy: 100 }])
    expect(r.subjects.rows).toEqual([{ name: 'Matematik Ujian', accuracy: 100, answers: 20, pupils: 2, sessions: 2 }])
  })

  it('a school-B admin never sees school A figures', async () => {
    const r = SchoolAdminMonthlyReportSchema.parse((await adminB.get('/admin-sekolah/laporan-bulanan')).body.data)
    expect(r.cards.answers).toBe(20)
    expect(JSON.stringify(r)).not.toContain('Bahasa Ujian')
  })

  it('401 without a session; 403 for admin, teacher and student', async () => {
    expect((await t.http().get('/api/admin-sekolah/laporan-bulanan')).status).toBe(401)
    for (const who of [ADMIN, TEACHER, STUDENT]) {
      const res = await apiOf(await login(t, who)).get('/admin-sekolah/laporan-bulanan')
      expect(res.status, who).toBe(403)
      expect(ErrorBodySchema.parse(res.body).error.code).toBe('FORBIDDEN')
    }
  })
})

/** The subject section lists the top 10 by sessions ("{n} sesi · {x}%"); strongest and weakest are taken over all subjects. */
describe('GET /admin-sekolah/laporan-bulanan subject rows', () => {
  let t: SchoolAdminTestApp
  let admin: Api

  beforeAll(async () => {
    t = await bootSchoolAdminApp()
    const s1 = await schoolIdOf(t.db, 'DEMO001')
    const pupils: string[] = []
    for (let i = 1; i <= 5; i++) pupils.push(await addPupil(t.db, s1, `Murid Subjek ${i}`))
    for (let k = 1; k <= 11; k++) {
      const subject = await addSubject(t.db, `SUBJ${k}`, `Subjek ${String(k).padStart(2, '0')}`)
      for (const p of pupils) {
        // Subject 01 has two sessions per pupil (10 in all), the others one each (5); correct answers grow with k.
        for (let n = 0; n < (k === 1 ? 2 : 1); n++) {
          await addSession(t.db, p, { questions: 2, correct: k <= 2 ? k - 1 : 2, completedAt: `2026-08-${String(10 + n).padStart(2, '0')}T10:00:00+08:00`, subjectId: subject })
        }
      }
    }
    admin = apiOf(await login(t, SCHOOL_ADMIN))
  })
  afterAll(async () => {
    await t.close()
  })

  it('the top 10 rows by sessions descending, always an array; strongest and weakest over all 11', async () => {
    const r = SchoolAdminMonthlyReportSchema.parse((await admin.get('/admin-sekolah/laporan-bulanan?bulan=2026-08')).body.data)
    expect(r.subjects.rows).toHaveLength(10)
    expect(r.subjects.rows[0]).toMatchObject({ name: 'Subjek 01', sessions: 10, accuracy: 0, answers: 20, pupils: 5 })
    expect(r.subjects.rows.slice(1).every((x) => x.sessions === 5)).toBe(true)
    // Subject 01 has accuracy 0 (the weakest) yet leads the list by sessions.
    expect(r.subjects.weakest?.name).toBe('Subjek 01')
    expect(r.subjects.strongest?.accuracy).toBe(100)
    // An empty month still has the key with an empty array.
    const empty = SchoolAdminMonthlyReportSchema.parse((await admin.get('/admin-sekolah/laporan-bulanan?bulan=2026-03')).body.data)
    expect(empty.subjects.rows).toEqual([])
  })
})
