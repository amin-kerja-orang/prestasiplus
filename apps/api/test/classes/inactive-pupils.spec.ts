import { TeacherClassSchema, TeacherDashboardSchema, TeacherStudentSchema, TeacherStudentsMetaSchema, envelopeOf, listEnvelopeOf } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { z } from 'zod'

import { ClassesRepository } from '../../src/modules/classes'
import { STUDENT_1, STUDENT_2, STUDENT_MAJU, TEACHER_A, bootClassesApp, client, createClass, idOfEmail, schoolOfCode, type ClassesTestApp, type Client } from './helpers'

const StudentsBody = z.object({ data: z.array(TeacherStudentSchema), meta: TeacherStudentsMetaSchema })
const ClassList = listEnvelopeOf(TeacherClassSchema)
const Dashboard = envelopeOf(TeacherDashboardSchema)

/** SW7-06: a deactivated pupil keeps the enrolment row but leaves every teacher count and list; reactivating brings them back. */
describe('deactivated pupils in the teacher class views (SW7-06)', () => {
  let t: ClassesTestApp
  let a: Client
  let repo: ClassesRepository
  let s1: string
  let s2: string
  let sMaju: string
  let k1: { id: string }
  let k2: { id: string }

  const setActive = (id: string, active: boolean) => t.db.query(`update users set is_active = $2 where id = $1`, [id, active])
  const classOf = async (id: string) => ClassList.parse((await a.get('/guru/classes')).body).data.find((c) => c.id === id)

  beforeAll(async () => {
    t = await bootClassesApp()
    a = await client(t, TEACHER_A)
    repo = t.get(ClassesRepository)
    const school1 = await schoolOfCode(t, 'DEMO001')
    s1 = await idOfEmail(t, STUDENT_1)
    s2 = await idOfEmail(t, STUDENT_2)
    sMaju = await idOfEmail(t, STUDENT_MAJU)
    k1 = await createClass(t, a, { name: 'Kelas Satu Aktif', schoolId: school1 })
    t.clock.advance(60_000)
    k2 = await createClass(t, a, { name: 'Kelas Dua Aktif', schoolId: school1 })
    for (const [pupil, cls] of [[s1, k1], [s2, k1], [sMaju, k1], [s1, k2], [s2, k2]] as const) {
      expect((await a.put(`/guru/students/${pupil}`, { classroomId: cls.id })).status).toBe(200)
    }
  }, 120_000)
  afterAll(async () => {
    await setActive(s1, true)
    await t.close()
  })

  it('with all pupils active every view counts them (control)', async () => {
    expect((await classOf(k1.id))?.studentCount).toBe(3)
    expect((await classOf(k2.id))?.studentCount).toBe(2)
    const students = StudentsBody.parse((await a.get('/guru/students')).body)
    expect(students.meta.count).toBe(3)
    expect(Dashboard.parse((await a.get('/guru/dashboard')).body).data.stats.students).toBe(3)
  })

  it('an inactive enrolled pupil is dropped from the class counts, the student list, the dashboard and the class names', async () => {
    await setActive(s1, false)

    expect((await classOf(k1.id))?.studentCount).toBe(2)
    expect((await classOf(k2.id))?.studentCount).toBe(1)

    const students = StudentsBody.parse((await a.get('/guru/students')).body)
    expect(students.meta.count).toBe(2)
    expect(students.data.map((s) => s.id).sort()).toEqual([s2, sMaju].sort())
    expect(students.data.find((s) => s.id === s2)?.classNames).toEqual(['Kelas Dua Aktif', 'Kelas Satu Aktif'])

    const dash = Dashboard.parse((await a.get('/guru/dashboard')).body).data
    expect(dash.stats.students).toBe(2)
    expect(dash.classes).toEqual(
      expect.arrayContaining([
        { id: k1.id, name: 'Kelas Satu Aktif', studentCount: 2 },
        { id: k2.id, name: 'Kelas Dua Aktif', studentCount: 1 },
      ]),
    )

    // repository reads behind them (also used by the school-admin, reports and command-centre callers)
    expect((await repo.memberCounts([k1.id, k2.id])).get(k1.id)).toBe(2)
    expect(await repo.teacherStudentIds(await idOfEmail(t, TEACHER_A))).toEqual([s2, sMaju].sort((x, y) => Number(x) - Number(y)))
    const classes = await repo.classesByStudent(await idOfEmail(t, TEACHER_A))
    expect(classes.has(s1)).toBe(false)
    expect(classes.get(s2)).toEqual([
      { id: k2.id, name: 'Kelas Dua Aktif' },
      { id: k1.id, name: 'Kelas Satu Aktif' },
    ])

    // the enrolment rows are untouched
    const rows = await t.db.query<{ n: number }>(`select count(*)::int n from enrolments where student_id = $1 and status = 'active'`, [s1])
    expect(rows[0]?.n).toBe(2)
  })

  it('class-scoped member reads (memberIds, memberIdsOf) and the teacher-to-pupil check drop an inactive pupil; roster rows and classIdsOfStudents stay', async () => {
    const teacherId = await idOfEmail(t, TEACHER_A)
    const byNumber = (...ids: string[]) => [...ids].sort((x, y) => Number(x) - Number(y))
    const reads = async () => ({
      memberIds: await repo.memberIds(k1.id),
      memberIdsOf: (await repo.memberIdsOf([k1.id, k2.id])).get(k1.id),
      memberIdsOfK2: (await repo.memberIdsOf([k1.id, k2.id])).get(k2.id),
      isMember: await repo.isMemberOfTeacher(teacherId, s1),
      isMemberOther: await repo.isMemberOfTeacher(teacherId, s2),
    })

    // control: active (the previous test leaves the pupil inactive)
    await setActive(s1, true)
    expect(await reads()).toEqual({
      memberIds: byNumber(s1, s2, sMaju),
      memberIdsOf: byNumber(s1, s2, sMaju),
      memberIdsOfK2: byNumber(s1, s2),
      isMember: true,
      isMemberOther: true,
    })

    await setActive(s1, false)
    expect(await reads()).toEqual({
      memberIds: byNumber(s2, sMaju),
      memberIdsOf: byNumber(s2, sMaju),
      memberIdsOfK2: [s2],
      isMember: false,
      isMemberOther: true,
    })
    // raw enrolment rows (enrolment management) and the per-pupil class lookup are not member views
    expect((await repo.roster(k1.id)).map((e) => e.studentId)).toContain(s1)
    expect((await repo.classIdsOfStudents([s1])).get(s1)).toEqual(byNumber(k1.id, k2.id))

    await setActive(s1, true)
    expect((await reads()).isMember).toBe(true)
    expect((await reads()).memberIds).toEqual(byNumber(s1, s2, sMaju))
    expect((await reads()).memberIdsOfK2).toEqual(byNumber(s1, s2))
  })

  it('reactivating the pupil brings them back everywhere', async () => {
    await setActive(s1, true)
    expect((await classOf(k1.id))?.studentCount).toBe(3)
    expect((await classOf(k2.id))?.studentCount).toBe(2)
    const students = StudentsBody.parse((await a.get('/guru/students')).body)
    expect(students.meta.count).toBe(3)
    expect(students.data.find((s) => s.id === s1)?.classNames).toEqual(['Kelas Dua Aktif', 'Kelas Satu Aktif'])
    expect(Dashboard.parse((await a.get('/guru/dashboard')).body).data.stats.students).toBe(3)
  })
})
