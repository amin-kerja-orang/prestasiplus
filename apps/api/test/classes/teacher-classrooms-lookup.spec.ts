import { CreatedUserSchema, TeacherClassroomOptionSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { ADMIN, SCHOOL_ADMIN, STUDENT, TEACHER, apiOf, bootSubApp, expectError, login, schoolIdOf, userIdOf, type Api, type SubTestApp } from '../subscriptions/sub-helpers'
import { teacherBody } from '../users/helpers'

/** BUG-02: `GET /admin/teachers/:id/classrooms` lists the teacher's ACTIVE classes, the ones `POST /admin/comp-students` accepts. */
describe('GET /admin/teachers/:id/classrooms (S7 "Kelas guru")', () => {
  let t: SubTestApp
  let admin: Api
  let sa: Api
  let s1: string
  let s2: string
  let teacherId: string
  let emptyTeacher: string
  let otherSchoolTeacher: string
  const ids: Record<string, string> = {}

  const url = (id: string) => `/admin/teachers/${id}/classrooms`
  const one = async (sql: string, args: unknown[]): Promise<string> => ((await t.db.query<{ id: string }>(sql, args))[0] as { id: string }).id
  const newClass = (name: string, teacher: string, school: string, level: string, code: string | null, over: { kind?: string; active?: boolean } = {}) =>
    one(
      `insert into classrooms (kind, name, teacher_id, school_id, education_level_id, academic_year, join_code, is_active)
       values ($1, $2, $3, $4, $5, 2026, $6, $7) returning id::text`,
      [over.kind ?? 'classroom', name, teacher, school, level, code, over.active ?? true],
    )

  beforeAll(async () => {
    t = await bootSubApp()
    admin = apiOf(await login(t, ADMIN))
    sa = apiOf(await login(t, SCHOOL_ADMIN))
    s1 = await schoolIdOf(t.db, 'DEMO001')
    // The seeded DEMO002 is a primary school (SK), hidden by D72 (a user cannot be created there), so the "other school" is a secondary one.
    s2 = await one(`insert into schools (name, code, type, state, district, is_active) values ('SMK Ujian Dua', 'UJIAN02', 'SMK', 'Selangor', 'Gombak', true) returning id::text`, [])
    teacherId = await userIdOf(t.db, TEACHER)
    emptyTeacher = CreatedUserSchema.parse((await admin.post('/admin/users', teacherBody(s1, { email: 'guru.kosong@ujian.test' }))).body.data).id
    otherSchoolTeacher = CreatedUserSchema.parse((await admin.post('/admin/users', teacherBody(s2, { email: 'guru.sekolah.lain@ujian.test' }))).body.data).id
    const level = await one(
      `insert into education_levels (code, name, name_en, stage, curriculum, grade) values ('T4', 'Tingkatan 4', 'Form 4', 'upper_secondary', 'KSSM', 10) returning id::text`,
      [],
    )
    // Inserted out of name order on purpose: the answer is A to Z, then id.
    ids.b = await newClass('4 Bestari', teacherId, s1, level, 'BEST01')
    ids.a = await newClass('4 Amanah', teacherId, s1, level, 'AMAN01')
    ids.a2 = await newClass('4 Amanah', teacherId, s1, level, 'AMAN02')
    ids.inactive = await newClass('4 Cemerlang', teacherId, s1, level, 'CEME01', { active: false })
    ids.schoolClass = await newClass('Kelas Sekolah 4', teacherId, s1, level, null, { kind: 'school_class' })
    ids.other = await newClass('5 Dedikasi', otherSchoolTeacher, s2, level, 'DEDI01')
  }, 120_000)
  afterAll(async () => {
    await t.close()
  })

  it("an admin gets the teacher's active classes in the documented shape, A to Z then id", async () => {
    const res = await admin.get(url(teacherId))
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.headers['cache-control']).toBe('no-store')
    const rows = (res.body.data as unknown[]).map((r) => TeacherClassroomOptionSchema.parse(r))
    expect(rows).toEqual([
      { id: ids.a, name: '4 Amanah', classCode: 'AMAN01' },
      { id: ids.a2, name: '4 Amanah', classCode: 'AMAN02' },
      { id: ids.b, name: '4 Bestari', classCode: 'BEST01' },
    ])
    expect(Object.keys(res.body)).toEqual(['data'])
  })

  it('inactive classes and school classes (kind school_class) are not listed', async () => {
    const listed = (await admin.get(url(teacherId))).body.data.map((r: { id: string }) => r.id)
    expect(listed).toContain(ids.a)
    expect(listed).not.toContain(ids.inactive)
    expect(listed).not.toContain(ids.schoolClass)
  })

  it("another teacher's class is not listed", async () => {
    const listed = (await admin.get(url(teacherId))).body.data.map((r: { id: string }) => r.id)
    expect(listed).toContain(ids.a)
    expect(listed).not.toContain(ids.other)
    expect((await admin.get(url(otherSchoolTeacher))).body.data).toEqual([{ id: ids.other, name: '5 Dedikasi', classCode: 'DEDI01' }])
  })

  it('a teacher with no classes is []', async () => {
    const res = await admin.get(url(emptyTeacher))
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ data: [] })
  })

  it('an unknown or malformed teacher id is [] (no 404)', async () => {
    for (const id of ['987654321', 'abc']) {
      const res = await admin.get(url(id))
      expect(res.status).toBe(200)
      expect(res.body).toEqual({ data: [] })
    }
  })

  it('every listed class id is accepted by POST /admin/comp-students; an unlisted (inactive) one is refused', async () => {
    const listed: { id: string }[] = (await admin.get(url(teacherId))).body.data
    expect(listed).toHaveLength(3)
    for (const [i, c] of listed.entries()) {
      const res = await admin.post('/admin/comp-students', { classroomId: c.id, packageExpiresAt: '2026-12-31', students: `Murid Contoh ${String(i)}, 07010101010${String(i)}` })
      expect(res.status, JSON.stringify(res.body)).toBe(201)
    }
    for (const id of [ids.inactive, ids.schoolClass]) {
      const res = await admin.post('/admin/comp-students', { classroomId: id, packageExpiresAt: '2026-12-31', students: 'Murid Tolak, 070101010199' })
      expect(res.status).toBe(422)
    }
  })

  describe('school_admin scope', () => {
    it("sees the classes of a teacher of their own school", async () => {
      const res = await sa.get(url(teacherId))
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(res.body.data.map((r: { id: string }) => r.id)).toEqual([ids.a, ids.a2, ids.b])
    })

    it("gets [] for another school's teacher, the same as for an unknown one (the contract has no 404 here)", async () => {
      const res = await sa.get(url(otherSchoolTeacher))
      expect(res.status).toBe(200)
      expect(res.body).toEqual({ data: [] })
    })

    it('gets [] for an id that is not a teacher (a student of their own school)', async () => {
      const res = await sa.get(url(await userIdOf(t.db, STUDENT)))
      expect(res.status).toBe(200)
      expect(res.body).toEqual({ data: [] })
    })
  })

  describe('role guard', () => {
    it('no session is 401', async () => {
      expectError(await t.http().get(`/api${url(teacherId)}`), 'UNAUTHORIZED', 'Unauthenticated.')
    })

    it('a teacher and a student are 403', async () => {
      for (const who of [TEACHER, STUDENT]) {
        expectError(await apiOf(await login(t, who)).get(url(teacherId)), 'FORBIDDEN')
      }
    })
  })
})
