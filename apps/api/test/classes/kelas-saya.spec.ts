import { ClassJoinedClassSchema, listEnvelopeOf } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  ADMIN,
  STUDENT_1,
  STUDENT_2,
  TEACHER_A,
  TEACHER_B,
  bootClassesApp,
  client,
  createClass,
  idOfEmail,
  schoolOfCode,
  type ClassesTestApp,
  type Client,
} from './helpers'

const JoinedList = listEnvelopeOf(ClassJoinedClassSchema)

describe('Kelas Saya: GET /api/kelas-saya; POST /api/kelas-saya/join is gone (API-MUR-04, AC-MUR-8-3)', () => {
  let t: ClassesTestApp
  let teacher: Client
  let s1: Client
  let s2: Client
  let k: { id: string; joinCode: string; name: string }
  let s1Id: string

  /** Enrols a pupil straight in the database: the join route no longer exists. */
  const enrol = (classroomId: string, studentId: string) =>
    t.db.query(`insert into enrolments (classroom_id, student_id, status, source) values ($1, $2, 'active', 'code')`, [classroomId, studentId])

  beforeAll(async () => {
    t = await bootClassesApp()
    teacher = await client(t, TEACHER_A)
    s1 = await client(t, STUDENT_1)
    s2 = await client(t, STUDENT_2)
    s1Id = await idOfEmail(t, STUDENT_1)
    k = await createClass(t, teacher, { name: 'Kelas Join', schoolId: await schoolOfCode(t, 'DEMO001') })
  }, 120_000)
  afterAll(async () => {
    await t.close()
  })

  it('an empty list before anything is joined (single page meta)', async () => {
    const list = JoinedList.parse((await s1.get('/kelas-saya')).body)
    expect(list.data).toEqual([])
    expect(list.meta).toMatchObject({ page: 1, pageSize: 1, totalItems: 0, totalPages: 1, from: null, to: null })
  })

  it('POST /kelas-saya/join is the global 404 for a student, a teacher and an admin, and writes nothing', async () => {
    const admin = await client(t, ADMIN)
    for (const api of [s1, teacher, admin]) {
      const res = await api.post('/kelas-saya/join', { classCode: k.joinCode })
      expect(res.status, JSON.stringify(res.body)).toBe(404)
      expect(res.body.error.code).toBe('NOT_FOUND')
    }
    expect(await t.db.query(`select 1 from enrolments where classroom_id = $1`, [k.id])).toHaveLength(0)
  })

  it('lists the joined class with subject, teacher and level label', async () => {
    await enrol(k.id, s1Id)
    const list = JoinedList.parse((await s1.get('/kelas-saya')).body)
    expect(list.data).toHaveLength(1)
    expect(list.data[0]).toMatchObject({ id: k.id, name: 'Kelas Join', teacherName: 'Guru Demo', levelLabel: 'Ting. 4' })
    expect(list.data[0]?.subjectName).toEqual(expect.any(String))
    expect(list.meta).toMatchObject({ page: 1, pageSize: 1, totalItems: 1 })
    // another student does not see it
    expect(JoinedList.parse((await s2.get('/kelas-saya')).body).data).toEqual([])
  })

  it('lists the newest class first and leaves out school classes', async () => {
    t.clock.advance(60_000)
    const k2 = await createClass(t, teacher, { name: 'Kelas Baharu' })
    await enrol(k2.id, s1Id)
    const sc = (
      await t.db.query<{ id: string }>(
        `insert into classrooms (kind, name, school_id, education_level_id, academic_year) select 'school_class', 'Kelas Sekolah', null, id, 2026 from education_levels where stage <> 'primary' order by id limit 1 returning id::text`,
      )
    )[0]?.id as string
    await t.db.query(`insert into enrolments (classroom_id, student_id, status, source) values ($1, $2, 'active', 'school_admin')`, [sc, s1Id])
    const names = JoinedList.parse((await s1.get('/kelas-saya')).body).data.map((x) => x.name)
    expect(names).toEqual(['Kelas Baharu', 'Kelas Join'])
  })

  it('other roles read an empty "Kelas Saya"', async () => {
    const api = await client(t, TEACHER_B)
    const res = await api.get('/kelas-saya')
    expect(res.status).toBe(200)
    expect(JoinedList.parse(res.body).data).toEqual([])
  })
})
