import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { ADMIN, apiOf, bootSubApp, login, schoolIdOf, userIdOf, type Api, type SubTestApp } from '../subscriptions/sub-helpers'

/** BE-25 complimentary register against the REAL classroom owner (no port override). */
describe('complimentary students with the real COMP_CLASSROOM_PORT', () => {
  let t: SubTestApp
  let admin: Api
  let classId: string
  let teacherId: string

  beforeAll(async () => {
    t = await bootSubApp()
    admin = apiOf(await login(t, ADMIN))
    const school = await schoolIdOf(t.db, 'DEMO001')
    teacherId = await userIdOf(t.db, 'guru@demo.test')
    const [level] = await t.db.query<{ id: string }>(
      `insert into education_levels (code, name, name_en, stage, curriculum, grade) values ('T4', 'Tingkatan 4', 'Form 4', 'upper_secondary', 'KSSM', 10) returning id::text`,
    )
    const [cls] = await t.db.query<{ id: string }>(
      `insert into classrooms (name, teacher_id, school_id, education_level_id, academic_year, join_code) values ('4 Amanah', $1, $2, $3, 2026, 'COMP01') returning id::text`,
      [teacherId, school, level?.id],
    )
    classId = cls?.id as string
  }, 120_000)
  afterAll(async () => {
    await t.close()
  })

  const register = (over: Record<string, unknown> = {}) =>
    admin.post('/admin/comp-students', { classroomId: classId, packageExpiresAt: '2026-12-31', students: 'Aina Contoh, 070101-01-0101', ...over })

  it('refuses an unknown class with the invalid-classroom field and creates nothing', async () => {
    const res = await register({ classroomId: '99999999' })
    expect(res.status).toBe(422)
    expect(Object.keys(res.body.error.fields)).toEqual(['classroomId'])
    expect(await t.db.query(`select 1 from users where name = 'Aina Contoh'`)).toHaveLength(0)
  })

  it('registers into the class: school and grade from the class, an enrolment with source complimentary, shown in list and detail', async () => {
    const res = await register()
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const [u] = await t.db.query<{ id: string; school_id: string; grade: number }>(`select id::text, school_id::text, grade from users where name = 'Aina Contoh'`)
    expect(u?.grade).toBe(10)
    expect(u?.school_id).toBe(await schoolIdOf(t.db, 'DEMO001'))
    expect(await t.db.query(`select source, status from enrolments where classroom_id = $1 and student_id = $2`, [classId, u?.id])).toEqual([{ source: 'complimentary', status: 'active' }])
    const list = await admin.get('/admin/comp-students')
    expect(list.body.data[0]).toMatchObject({ name: 'Aina Contoh', classLabel: '4 Amanah', teacherName: 'Guru Demo' })
    const detail = await admin.get(`/admin/comp-students/${u?.id}`)
    expect(detail.body.data.classes).toEqual([{ name: '4 Amanah', classCode: 'COMP01', subjectName: null, teacherName: 'Guru Demo', status: 'active' }])
  })

  it('an inactive class is refused like an unknown one', async () => {
    await t.db.query(`update classrooms set is_active = false where id = $1`, [classId])
    const res = await register({ students: 'Budi Contoh, 880202-02-5555' })
    expect(res.status).toBe(422)
    expect(await t.db.query(`select 1 from users where name = 'Budi Contoh'`)).toHaveLength(0)
  })
})
