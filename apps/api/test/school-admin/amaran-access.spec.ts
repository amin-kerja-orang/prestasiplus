import { AMARAN_MESSAGES, AmaranEffectivenessResultSchema, AmaranSchoolRiskSchema, AmaranSummarySchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { ADMIN, login, SCHOOL_ADMIN, schoolIdOf, STUDENT, TEACHER, userIdOf, type SchoolAdminTestApp } from './helpers'
import { bootPeopleApp, enrolIn, errorOf, expectNoCache, insertClass, insertSchoolAdmin, insertUser, peopleApiOf, type PeopleApi } from './people-helpers'
import { addSession, addSubject } from './reports-fixtures'

/**
 * BE-21 Part C: who may read the Amaran routes and which school. DB spec (Testcontainers). All data is fictitious.
 * Wire contract: packages/contract/src/school-admin/amaran.ts.
 */

const mastery = (t: SchoolAdminTestApp, userId: string, subjectId: string, correct: number, answered: number, at = '2026-10-18T10:00:00+08:00') =>
  t.db.query(`insert into mastery (user_id, subject_id, correct, answered, last_answered_at) values ($1::bigint, $2::bigint, $3, $4, $5::timestamptz)`, [userId, subjectId, correct, answered, at])

describe('BE-21 Amaran access: /amaran/*', () => {
  let t: SchoolAdminTestApp
  let schoolAdmin: PeopleApi
  let admin: PeopleApi
  let teacher: PeopleApi
  let student: PeopleApi
  let otherAdmin: PeopleApi
  let s1: string
  let s2: string
  let unknownSchool: string
  let subject: string
  let pupilIds: string[]

  beforeAll(async () => {
    t = await bootPeopleApp()
    s1 = await schoolIdOf(t.db, 'DEMO001')
    s2 = await schoolIdOf(t.db, 'DEMO002')
    unknownSchool = '987654321'
    await insertSchoolAdmin(t.db, s2, 'admin2@ujian.test')
    schoolAdmin = peopleApiOf(await login(t, SCHOOL_ADMIN))
    admin = peopleApiOf(await login(t, ADMIN))
    teacher = peopleApiOf(await login(t, TEACHER))
    student = peopleApiOf(await login(t, STUDENT))
    otherAdmin = peopleApiOf(await login(t, 'admin2@ujian.test'))

    subject = await addSubject(t.db, 'AMR1', 'Matematik Ujian')
    pupilIds = []
    for (let i = 1; i <= 6; i++) {
      const id = await insertUser(t.db, { name: `Murid Amaran ${i}`, email: `amaran${i}@ujian.test`, roles: ['student'], schoolId: s1, grade: 10, phone: '0123334445' })
      pupilIds.push(id)
      await addSession(t.db, id, { mode: 'chapter', questions: 10, correct: i <= 3 ? 2 : 9, completedAt: '2026-10-17T10:00:00+08:00', subjectId: subject })
      await mastery(t, id, subject, i <= 3 ? 2 : 60, 10)
    }
    // The pupil of school 2 must never show on school 1.
    await insertUser(t.db, { name: 'Murid Sekolah Dua', email: 'dua@ujian.test', roles: ['student'], schoolId: s2, grade: 10 })
    // The teacher owns a class of school 1 (Tingkatan 4) with the first three pupils.
    const teacherId = await userIdOf(t.db, TEACHER)
    const t4 = await insertClass(t.db, { name: '4 Amanah', schoolId: s1, teacherId })
    for (const id of pupilIds.slice(0, 3)) await enrolIn(t.db, t4, id)
  }, 180_000)
  afterAll(async () => {
    await t.close()
  })

  const ROUTES = () => ['/amaran/schools/1', '/amaran/summary', '/amaran/effectiveness', '/amaran/export/school/1']

  it('401 without a session on all four routes', async () => {
    for (const path of ROUTES()) expect((await t.http().get(`/api${path}`)).status, path).toBe(401)
  })

  it('403 "This action is unauthorized." for a pupil on all four routes, before any school lookup', async () => {
    for (const path of [`/amaran/schools/${s1}`, `/amaran/schools/${unknownSchool}`, '/amaran/summary', '/amaran/effectiveness', `/amaran/export/school/${unknownSchool}`]) {
      errorOf(await student.get(path), 403, 'FORBIDDEN', 'This action is unauthorized.')
    }
  })

  it('the CSV is admin and school_admin only: a teacher gets 403 even for an unknown school (role before 404)', async () => {
    errorOf(await teacher.get(`/amaran/export/school/${s1}`), 403, 'FORBIDDEN', 'This action is unauthorized.')
    errorOf(await teacher.get(`/amaran/export/school/${unknownSchool}`), 403, 'FORBIDDEN')
  })

  it('an unknown school and a school outside the caller reach answer the SAME 404 (no enumeration)', async () => {
    for (const path of [`/amaran/schools/${unknownSchool}`, `/amaran/schools/${s2}`, '/amaran/schools/abc', '/amaran/schools/0', '/amaran/schools/-1']) {
      const res = await schoolAdmin.get(path)
      errorOf(res, 404, 'NOT_FOUND', 'Not Found.')
    }
    const unknown = await schoolAdmin.get(`/amaran/schools/${unknownSchool}`)
    const foreign = await schoolAdmin.get(`/amaran/schools/${s2}`)
    expect(foreign.body).toEqual(unknown.body)
    const teacherForeign = await teacher.get(`/amaran/schools/${s2}`)
    expect(teacherForeign.body).toEqual(unknown.body)
    const exportForeign = await schoolAdmin.get(`/amaran/export/school/${s2}`)
    const exportUnknown = await schoolAdmin.get(`/amaran/export/school/${unknownSchool}`)
    errorOf(exportForeign, 404, 'NOT_FOUND', 'Not Found.')
    expect(exportForeign.body).toEqual(exportUnknown.body)
    // The other school admin cannot read school 1 either.
    errorOf(await otherAdmin.get(`/amaran/schools/${s1}`), 404, 'NOT_FOUND')
    errorOf(await otherAdmin.get(`/amaran/export/school/${s1}`), 404, 'NOT_FOUND')
  })

  it('admin reads any school; school_admin and teacher read the own school', async () => {
    for (const api of [admin, schoolAdmin, teacher]) {
      const res = await api.get(`/amaran/schools/${s1}`)
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      AmaranSchoolRiskSchema.parse(res.body.data)
    }
    expect((await admin.get(`/amaran/schools/${s2}`)).status).toBe(200)
  })

  it('a teacher also reads a school where the teacher owns a class', async () => {
    errorOf(await teacher.get(`/amaran/schools/${s2}`), 404, 'NOT_FOUND')
    const teacherId = await userIdOf(t.db, TEACHER)
    await insertClass(t.db, { name: '4 Tamu', schoolId: s2, teacherId })
    expect((await teacher.get(`/amaran/schools/${s2}`)).status).toBe(200)
    await t.db.query(`delete from classrooms where school_id = $1::bigint and teacher_id = $2::bigint`, [s2, teacherId])
    errorOf(await teacher.get(`/amaran/schools/${s2}`), 404, 'NOT_FOUND')
  })

  it('the risk page: only the school pupils, ranked, with the BM cell texts, never an IC, e-mail or phone, and no-store', async () => {
    const res = await schoolAdmin.get(`/amaran/schools/${s1}`)
    expect(res.status).toBe(200)
    expectNoCache(res, false)
    const data = AmaranSchoolRiskSchema.parse(res.body.data)
    const names = data.pupils.map((p) => p.name)
    expect(names).not.toContain('Murid Sekolah Dua')
    expect(names).toEqual(expect.arrayContaining(pupilIds.map((_, i) => `Murid Amaran ${i + 1}`)))
    expect(data.pupils.map((p) => p.rank)).toEqual(data.pupils.map((_, i) => i + 1))
    const scores = data.pupils.map((p) => p.score)
    expect(scores).toEqual([...scores].sort((a, b) => b - a))
    expect(data.tally.total).toBe(data.pupils.length)
    expect(data.levelFilter).toBeNull()
    const weak = data.pupils.find((p) => p.name === 'Murid Amaran 1')
    expect(weak?.accuracyText).toBe('Purata ketepatan: 20%')
    expect(weak?.engagementText).toBe('Terakhir aktif: 2026-10-18')
    expect(weak?.masteryText).toMatch(/^Purata tahap: L\d+$/)
    const text = JSON.stringify(res.body)
    expect(text).not.toContain('@ujian.test')
    expect(text).not.toContain('0123334445')
    expect(text).not.toMatch(/"(email|phone|icNumber|ic_masked)"/)
    // k = 5: 6 pupils answered the subject, so the weakness row is there (3 weak).
    expect(data.weakness).toEqual([expect.objectContaining({ subjectName: 'Matematik Ujian', weak: 3, total: 6, pct: 50 })])
  })

  it('k=5: a subject answered by fewer than five pupils is not shown', async () => {
    const lone = await addSubject(t.db, 'AMR2', 'Sains Ujian')
    await mastery(t, pupilIds[0] as string, lone, 1, 10)
    const data = AmaranSchoolRiskSchema.parse((await schoolAdmin.get(`/amaran/schools/${s1}`)).body.data)
    expect(data.weakness.map((w) => w.subjectName)).not.toContain('Sains Ujian')
  })

  it('tingkatan filter is class based; an unknown value means no filter', async () => {
    const t4 = AmaranSchoolRiskSchema.parse((await schoolAdmin.get(`/amaran/schools/${s1}?tingkatan=t4`)).body.data)
    expect(t4.levelFilter).toBe('T4')
    expect(t4.levelSuffix).toBe(' — Tingkatan 4')
    expect(t4.pupils.map((p) => p.name).sort()).toEqual(['Murid Amaran 1', 'Murid Amaran 2', 'Murid Amaran 3'])
    expect(AmaranSchoolRiskSchema.parse((await schoolAdmin.get(`/amaran/schools/${s1}?tingkatan=5`)).body.data).pupils).toHaveLength(0)
    const none = AmaranSchoolRiskSchema.parse((await schoolAdmin.get(`/amaran/schools/${s1}?tingkatan=zzz`)).body.data)
    expect(none.levelFilter).toBeNull()
    expect(none.pupils.length).toBeGreaterThan(3)
  })

  it('summary: the default scope is the own school for school_admin and teacher; admin has no default (403)', async () => {
    for (const api of [schoolAdmin, teacher]) {
      const res = await api.get('/amaran/summary')
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      const s = AmaranSummarySchema.parse(res.body.data)
      expect(s.scope).toBe('school')
      expect(s.pupilsLine).toBe(`${s.tally.total} pelajar`)
      expect(Number.isInteger(s.generatedAt)).toBe(true)
    }
    errorOf(await admin.get('/amaran/summary'), 403, 'FORBIDDEN', 'This action is unauthorized.')
  })

  it('summary 422 texts come from AMARAN_MESSAGES and the top-level message equals the field text', async () => {
    const e1 = errorOf(await admin.get('/amaran/summary?scope=school'), 422, 'VALIDATION_ERROR', AMARAN_MESSAGES.schoolIdRequired)
    expect(e1.fields).toEqual({ schoolId: AMARAN_MESSAGES.schoolIdRequired })
    errorOf(await admin.get('/amaran/summary?scope=school&schoolId=abc'), 422, 'VALIDATION_ERROR', AMARAN_MESSAGES.schoolIdRequired)
    const e2 = errorOf(await admin.get('/amaran/summary?scope=district&state=Selangor'), 422, 'VALIDATION_ERROR', AMARAN_MESSAGES.districtStateRequired)
    expect(e2.fields).toEqual({ district: AMARAN_MESSAGES.districtStateRequired })
    const e3 = errorOf(await admin.get('/amaran/summary?scope=state'), 422, 'VALIDATION_ERROR', AMARAN_MESSAGES.stateRequired)
    expect(e3.fields).toEqual({ state: AMARAN_MESSAGES.stateRequired })
    const e4 = errorOf(await admin.get('/amaran/summary?scope=galaxy'), 422, 'VALIDATION_ERROR', AMARAN_MESSAGES.scopeInvalid)
    expect(e4.fields).toEqual({ scope: AMARAN_MESSAGES.scopeInvalid })
    // 422 comes before 403: a school admin with a bad scope also gets 422.
    errorOf(await schoolAdmin.get('/amaran/summary?scope=state'), 422, 'VALIDATION_ERROR', AMARAN_MESSAGES.stateRequired)
  })

  it('district and state scopes are admin only (403 for school_admin and teacher); admin gets 404 for a state without schools', async () => {
    for (const api of [schoolAdmin, teacher]) {
      errorOf(await api.get('/amaran/summary?scope=state&state=Selangor'), 403, 'FORBIDDEN', 'This action is unauthorized.')
      errorOf(await api.get('/amaran/summary?scope=district&district=Gombak&state=Selangor'), 403, 'FORBIDDEN')
    }
    errorOf(await admin.get('/amaran/summary?scope=state&state=Negeri%20Tiada'), 404, 'NOT_FOUND', 'Not Found.')
    errorOf(await admin.get('/amaran/summary?scope=district&district=Daerah%20Tiada&state=Negeri%20Tiada'), 404, 'NOT_FOUND')
  })

  it('summary scope=school with a foreign or unknown school is the same 404 for school_admin; admin reads any', async () => {
    const foreign = await schoolAdmin.get(`/amaran/summary?scope=school&schoolId=${s2}`)
    const unknown = await schoolAdmin.get(`/amaran/summary?scope=school&schoolId=${unknownSchool}`)
    errorOf(foreign, 404, 'NOT_FOUND', 'Not Found.')
    expect(foreign.body).toEqual(unknown.body)
    expect((await admin.get(`/amaran/summary?scope=school&schoolId=${s2}`)).status).toBe(200)
  })

  it('effectiveness: the own school only; 403 for a caller without a school', async () => {
    const teacherId = await userIdOf(t.db, TEACHER)
    const own = pupilIds[0] as string
    await t.db.query(
      `insert into interventions (student_id, alert_type, action_date, alert_description, action_taken, before_accuracy, after_accuracy, created_by_id)
       values ($1::bigint, 'declining', '2026-10-10', 'x', 'y', 40, 70, $2::bigint)`,
      [own, teacherId],
    )
    const foreignPupil = await insertUser(t.db, { name: 'Murid Luar', email: 'luar@ujian.test', roles: ['student'], schoolId: s2, grade: 10 })
    await t.db.query(
      `insert into interventions (student_id, alert_type, action_date, alert_description, action_taken, created_by_id)
       values ($1::bigint, 'inactive', '2026-10-11', 'x', 'y', $2::bigint)`,
      [foreignPupil, teacherId],
    )
    const res = await schoolAdmin.get('/amaran/effectiveness')
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expectNoCache(res, false)
    const data = AmaranEffectivenessResultSchema.parse(res.body.data)
    expect(data.school.id).toBe(s1)
    expect(data.report.cards.total).toBe(1)
    expect(data.report.cards.berkesan).toBe(1)
    expect(data.report.followUps.map((f) => f.studentId)).not.toContain(foreignPupil)
    expect(JSON.stringify(res.body)).not.toContain('Murid Luar')
    expect(data.report.trend.labels).toHaveLength(6)
    // The other school sees only its own record.
    const other = AmaranEffectivenessResultSchema.parse((await otherAdmin.get('/amaran/effectiveness')).body.data)
    expect(other.school.id).toBe(s2)
    expect(other.report.cards.total).toBe(1)
    errorOf(await admin.get('/amaran/effectiveness'), 403, 'FORBIDDEN', 'This action is unauthorized.')
  })

  it('a teacher sees the interventions of the own pupils only', async () => {
    const data = AmaranEffectivenessResultSchema.parse((await teacher.get('/amaran/effectiveness')).body.data)
    expect(data.report.cards.total).toBe(1)
  })
})
