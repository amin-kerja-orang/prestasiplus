import {
  CommandCenterClassResponseSchema,
  CommandCenterHeadcountDetailResponseSchema,
  CommandCenterSchoolResponseSchema,
  CommandCenterTeacherResponseSchema,
} from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { HEADCOUNT_PORT, type HeadcountReadPort, NoHeadcount } from '../../src/modules/command-center/shared/ports'
import { buildDrillWorld, type DrillWorld } from './drill-fixture'
import { bootCommandCenterApp, type CcTestApp, createClass, expectError, getAs, login, type LoggedIn, loginRole } from './helpers'

/**
 * Drill-down routes 4 to 7 (school, teacher, class, headcount): shapes, scope per role and level (404 on every miss, 403 by role),
 * and the counts adding up from the school page down to the class page (AC 2). Own database, own world.
 */
let t: CcTestApp
let w: DrillWorld
let admin: LoggedIn
let schoolAdmin: LoggedIn
let teacher: LoggedIn
let teacherB: LoggedIn
let student: LoggedIn

beforeAll(async () => {
  t = await bootCommandCenterApp()
  w = await buildDrillWorld(t)
  admin = await loginRole(t, 'admin')
  student = await loginRole(t, 'student')
  schoolAdmin = await login(t, w.schoolAdminA.email)
  teacher = await login(t, w.ta.email)
  teacherB = await login(t, w.tb.email)
})
afterAll(async () => {
  await t.close()
})

const NOT_FOUND = 'Not Found.'
const expect404 = async (who: LoggedIn, path: string): Promise<void> => {
  expectError(await getAs(who, path), 'NOT_FOUND', NOT_FOUND)
}

describe('GET /command-center/school/:id', () => {
  it('admin: cards over the whole school, teachers by name then owner-only owners', async () => {
    const res = await getAs(admin, `/command-center/school/${w.schoolA}`)
    expect(res.status).toBe(200)
    const { data } = CommandCenterSchoolResponseSchema.parse(res.body)
    expect(data.school).toEqual({ id: w.schoolA, name: 'Sekolah Kajian A' })
    // 6 students (p1 p2 p5 p3 p4 p6); 4 active pupils answered (p5 is inactive, p3 never answered); is_test rows never count.
    expect(data.cards).toEqual({ students: 6, active: 4, answers: 26, accuracy: 65.4 })
    expect(data.teachers.map((x) => [x.name, x.ownerOnly])).toEqual([
      ['Guru Alpha', false],
      ['Guru Beta', false],
      ['Guru Pemilik', true],
    ])
    expect(data.teachers[0]).toMatchObject({ userId: w.ta.id, subjectText: 'Matematik', classes: 2, students: 4, active30d: 2 })
    expect(data.teachers[1]).toMatchObject({ userId: w.tb.id, subjectText: null, classes: 1, students: 1, active30d: 1 })
    expect(data.teachers[2]).toMatchObject({ userId: w.to.id, classes: 1, students: 1, active30d: 1 })
  })

  it('school admin: the own school only', async () => {
    const res = await getAs(schoolAdmin, `/command-center/school/${w.schoolA}`)
    expect(res.status).toBe(200)
    expect(CommandCenterSchoolResponseSchema.parse(res.body).data.cards.students).toBe(6)
    await expect404(schoolAdmin, `/command-center/school/${w.schoolB}`)
  })

  it('teacher: only the schools of own active classrooms, and only own classes and self row', async () => {
    const res = await getAs(teacher, `/command-center/school/${w.schoolA}`)
    expect(res.status).toBe(200)
    const { data } = CommandCenterSchoolResponseSchema.parse(res.body)
    // A1 (p1 p2 p5) + A2 (p3): 4 students, 2 active pupils with answers (p1 p2): 19 answers, 13 correct.
    expect(data.cards).toEqual({ students: 4, active: 2, answers: 19, accuracy: 68.4 })
    expect(data.teachers.map((x) => x.userId)).toEqual([w.ta.id])
    await expect404(teacher, `/command-center/school/${w.schoolB}`)
  })

  it('unknown, non-numeric and zero ids are 404; a student is refused with 403', async () => {
    await expect404(admin, '/command-center/school/999999999')
    await expect404(admin, '/command-center/school/abc')
    await expect404(admin, '/command-center/school/0')
    await expect404(admin, '/command-center/school/007')
    expectError(await getAs(student, `/command-center/school/${w.schoolA}`), 'FORBIDDEN')
  })

  it('answers no-store with a weak ETag and 304 on a repeat', async () => {
    const first = await getAs(admin, `/command-center/school/${w.schoolA}`)
    expect(first.headers['cache-control']).toBe('no-store')
    const tag = first.headers['etag'] as string
    expect(tag).toMatch(/^W\//)
    const again = await admin.agent.get(`/api/command-center/school/${w.schoolA}`).set('If-None-Match', tag)
    expect(again.status).toBe(304)
    expect(again.headers['cache-control']).toBe('no-store')
  })
})

describe('GET /command-center/school/:sid/teacher/:uid', () => {
  it('admin: one row per active class of the teacher at the school, by class id', async () => {
    const res = await getAs(admin, `/command-center/school/${w.schoolA}/teacher/${w.ta.id}`)
    expect(res.status).toBe(200)
    const { data } = CommandCenterTeacherResponseSchema.parse(res.body)
    expect(data.school.id).toBe(w.schoolA)
    expect(data.teacher).toEqual({ id: w.ta.id, name: 'Guru Alpha' })
    expect(data.classes).toEqual([
      { id: w.a1, name: 'Kelas A1', level: 'T4', students: 3, active30d: 2, answers: 19, accuracy: 68.4 },
      { id: w.a2, name: 'Kelas A2', level: 'D3', students: 1, active30d: 0, answers: 0, accuracy: 0 },
    ])
  })

  it('an owner-only teacher has a page at the school, an unrelated teacher or a teacher of another school does not', async () => {
    expect((await getAs(admin, `/command-center/school/${w.schoolA}/teacher/${w.to.id}`)).status).toBe(200)
    await expect404(admin, `/command-center/school/${w.schoolA}/teacher/${w.tc.id}`)
    await expect404(admin, `/command-center/school/${w.schoolB}/teacher/${w.ta.id}`)
    await expect404(admin, `/command-center/school/${w.schoolA}/teacher/${w.p.p1}`)
    await expect404(admin, `/command-center/school/${w.schoolA}/teacher/x`)
  })

  it('teacher: only the own page; school admin: only teachers of the own school', async () => {
    expect((await getAs(teacher, `/command-center/school/${w.schoolA}/teacher/${w.ta.id}`)).status).toBe(200)
    await expect404(teacher, `/command-center/school/${w.schoolA}/teacher/${w.tb.id}`)
    expect((await getAs(schoolAdmin, `/command-center/school/${w.schoolA}/teacher/${w.tb.id}`)).status).toBe(200)
    expect((await getAs(schoolAdmin, `/command-center/school/${w.schoolA}/teacher/${w.to.id}`)).status).toBe(200)
    await expect404(schoolAdmin, `/command-center/school/${w.schoolB}/teacher/${w.tc.id}`)
  })
})

describe('GET /command-center/classroom/:id', () => {
  it('admin: members by answers desc, status from the last answer within 7 days, no mood without the port', async () => {
    const res = await getAs(admin, `/command-center/classroom/${w.a1}`)
    expect(res.status).toBe(200)
    const { data } = CommandCenterClassResponseSchema.parse(res.body)
    expect(data.school).toEqual({ id: w.schoolA, name: 'Sekolah Kajian A' })
    expect(data.teacher).toEqual({ id: w.ta.id, name: 'Guru Alpha' })
    expect(data.class).toEqual({ id: w.a1, name: 'Kelas A1', level: 'T4' })
    // The is_test member is not listed.
    expect(data.students.map((s) => s.userId)).toEqual([w.p.p1, w.p.p2, w.p.p5])
    expect(data.students[0]).toMatchObject({ name: 'Murid Satu', answers: 14, accuracy: 78.6, status: 'aktif', mood: null })
    expect(data.students[0]?.lastActiveAt).toMatch(/^2026-10-19T08:00:10(\.000)?\+08:00$/)
    expect(data.students[1]).toMatchObject({ answers: 5, accuracy: 40, status: 'tidak_aktif' })
    expect(data.students[2]).toMatchObject({ answers: 0, accuracy: 0, lastActiveAt: null, status: 'tidak_aktif' })
  })

  it('scope: teacher own active classes only, school admin classes of the own school, inactive and unknown classes 404', async () => {
    expect((await getAs(teacher, `/command-center/classroom/${w.a2}`)).status).toBe(200)
    await expect404(teacher, `/command-center/classroom/${w.b1}`)
    await expect404(teacher, `/command-center/classroom/${w.a3}`)
    await expect404(admin, `/command-center/classroom/${w.a3}`)
    expect((await getAs(schoolAdmin, `/command-center/classroom/${w.o1}`)).status).toBe(200)
    expect((await getAs(schoolAdmin, `/command-center/classroom/${w.b1}`)).status).toBe(200)
    await expect404(schoolAdmin, `/command-center/classroom/${w.c1}`)
    await expect404(teacherB, `/command-center/classroom/${w.a1}`)
    await expect404(admin, '/command-center/classroom/999999999')
    await expect404(admin, '/command-center/classroom/abc')
  })

  it('a class with no member answers an empty list', async () => {
    const empty = await createClass(t.db, { teacherId: w.ta.id, schoolId: w.schoolA, name: 'Kelas Kosong' })
    const res = await getAs(admin, `/command-center/classroom/${empty}`)
    expect(res.status).toBe(200)
    expect(CommandCenterClassResponseSchema.parse(res.body).data.students).toEqual([])
  })
})

describe('GET /command-center/headcount/:configId', () => {
  it('every config is 404 until the headcount owner binds its port', async () => {
    await expect404(admin, '/command-center/headcount/1')
    await expect404(teacher, '/command-center/headcount/1')
    await expect404(schoolAdmin, '/command-center/headcount/1')
    await expect404(admin, '/command-center/headcount/abc')
  })
})

describe('headcount with a bound port', () => {
  let pt: CcTestApp
  let pw: DrillWorld
  const detail = { subject: 'Matematik', totalStudents: 1, avgTov: 50, avgEtr: 60, passRate: 100, students: [{ userId: '1', name: 'Murid', tov: 50, etr: 60, rs: 55, grade: 'B' }] }

  beforeAll(async () => {
        // The class id is only known after the world is built, so the fake reads it lazily.
    const state: { classId: string } = { classId: '0' }
    const fake = new NoHeadcount() as unknown as HeadcountReadPort
    fake.config = async (configId: string) => (configId === '5' ? { classId: state.classId, detail } : null)
    pt = await bootCommandCenterApp({ overrides: [{ token: HEADCOUNT_PORT, useValue: fake }] })
    pw = await buildDrillWorld(pt)
    state.classId = pw.a1
  })
  afterAll(async () => {
    await pt.close()
  })

  it('the detail is served inside the class scope and 404 outside it', async () => {
    const ta = await login(pt, pw.ta.email)
    const tb = await login(pt, pw.tb.email)
    const res = await getAs(ta, '/command-center/headcount/5')
    expect(res.status).toBe(200)
    expect(CommandCenterHeadcountDetailResponseSchema.parse(res.body).data.subject).toBe('Matematik')
    await expect404(tb, '/command-center/headcount/5')
    await expect404(ta, '/command-center/headcount/6')
  })
})

describe('AC 2: the counts add up from the school down to the class', () => {
  it('students: school cards = sum of teachers = sum of classes = sum of class rosters', async () => {
    const school = CommandCenterSchoolResponseSchema.parse((await getAs(admin, `/command-center/school/${w.schoolA}`)).body).data
    expect(school.cards.students).toBe(school.teachers.reduce((a, x) => a + x.students, 0))

    let classStudents = 0
    let classAnswers = 0
    for (const row of school.teachers) {
      const page = CommandCenterTeacherResponseSchema.parse((await getAs(admin, `/command-center/school/${w.schoolA}/teacher/${row.userId}`)).body).data
      expect(page.classes).toHaveLength(row.classes)
      expect(page.classes.reduce((a, c) => a + c.students, 0)).toBe(row.students)
      expect(page.classes.reduce((a, c) => a + c.active30d, 0)).toBe(row.active30d)
      for (const c of page.classes) {
        const cls = CommandCenterClassResponseSchema.parse((await getAs(admin, `/command-center/classroom/${c.id}`)).body).data
        expect(cls.students).toHaveLength(c.students)
        expect(cls.students.reduce((a, s) => a + s.answers, 0)).toBe(c.answers)
        classStudents += cls.students.length
        classAnswers += c.answers
      }
    }
    expect(classStudents).toBe(school.cards.students)
    expect(classAnswers).toBe(school.cards.answers)
  })

  it('the school admin and the admin see the same figures for the same school', async () => {
    const a = (await getAs(admin, `/command-center/school/${w.schoolA}`)).body
    const b = (await getAs(schoolAdmin, `/command-center/school/${w.schoolA}`)).body
    expect(b).toEqual(a)
  })

  it('an is_test enrolment and its answers change no figure', async () => {
    const before = (await getAs(admin, `/command-center/classroom/${w.a1}`)).body
    await t.db.query(`update enrolments set is_test = false where student_id = $1::bigint`, [w.p.test])
    const after = CommandCenterClassResponseSchema.parse((await getAs(admin, `/command-center/classroom/${w.a1}`)).body).data
    // As a real member the test pupil would appear (with zero non-test answers); as a test enrolment it must not.
    expect(after.students.map((s) => s.userId)).toContain(w.p.test)
    await t.db.query(`update enrolments set is_test = true where student_id = $1::bigint`, [w.p.test])
    expect((await getAs(admin, `/command-center/classroom/${w.a1}`)).body).toEqual(before)
  })
})
