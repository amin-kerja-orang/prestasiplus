import { ErrorBodySchema, SchoolAdminMonthlyReportSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { ADMIN, apiOf, bootSchoolAdminApp, login, SCHOOL_ADMIN, schoolIdOf, STUDENT, TEACHER, type Api, type SchoolAdminTestApp } from './helpers'
import { addPupil, addSchoolAdmin, addSession, addSubject } from './reports-fixtures'

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
    expect(r.cards).toMatchObject({ active: 5, answers: 50, perPupil: 10, accuracy: 80, sessions: 5 })
    expect(r.months.map((m) => m.month)).toEqual(['2026-09', '2026-10'])
    expect(r.months[0]).toMatchObject({ label: 'September 2026', answers: 50, correct: 25, activePupils: 5, perPupil: 10, accuracy: 50 })
    expect(r.total).toEqual({ answers: 100, correct: 65, accuracy: 65 })
    expect(r.subjects.rows).toEqual([{ name: 'Matematik Ujian', accuracy: 80, answers: 50, pupils: 5 }])
    expect(r.subjects.strongest?.name).toBe('Matematik Ujian')
    // generatedAt is the request minute.
    expect(r.generatedAt).toMatch(/:00\+08:00$/)
  })

  it('a past month: prev and next, its own subject rows', async () => {
    const r = SchoolAdminMonthlyReportSchema.parse((await admin.get('/admin-sekolah/laporan-bulanan?bulan=2026-09')).body.data)
    expect(r.month).toBe('2026-09')
    expect(r.prev).toBe('2026-08')
    expect(r.next).toBe('2026-10')
    expect(r.cards.accuracy).toBe(50)
    expect(r.months.map((m) => m.month)).toEqual(['2026-09'])
    expect(r.total).toBeNull()
    expect(r.subjects.rows.map((s) => s.name)).toEqual(['Bahasa Ujian'])
  })

  it('a future or invalid bulan is the current month', async () => {
    for (const q of ['2099-01', '2026-13', 'abc', '']) {
      const r = SchoolAdminMonthlyReportSchema.parse((await admin.get(`/admin-sekolah/laporan-bulanan?bulan=${q}`)).body.data)
      expect(r.month, q).toBe('2026-10')
    }
  })

  it('an empty month gives the empty shape', async () => {
    const r = SchoolAdminMonthlyReportSchema.parse((await admin.get('/admin-sekolah/laporan-bulanan?bulan=2026-01')).body.data)
    expect(r.months).toEqual([])
    expect(r.total).toBeNull()
    expect(r.cards).toMatchObject({ active: 0, answers: 0, accuracy: null, perPupil: 0, sessions: 0 })
    expect(r.subjects).toEqual({ strongest: null, weakest: null, rows: [] })
  })

  it('a school with fewer than 5 active pupils in the month is suppressed (no accuracy, no series, no subjects) but keeps its counts', async () => {
    const res = await adminB.get(`/admin-sekolah/laporan-bulanan?schoolId=${s1}`)
    const r = SchoolAdminMonthlyReportSchema.parse(res.body.data)
    expect(r.school.id).toBe(s2)
    expect(r.cards).toMatchObject({ active: 2, answers: 20, accuracy: null })
    expect(r.months).toEqual([])
    expect(r.subjects).toEqual({ strongest: null, weakest: null, rows: [] })
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
