import { GURU_STUDENT_MESSAGES, GuruStudentCreatedSchema, TeacherStudentSchema, TeacherStudentsMetaSchema, envelopeOf } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { z } from 'zod'

import { TEACHER_A, TEACHER_B, bootClassesApp, client, createClass, errorIs, fieldsOf, schoolOfCode, type ClassesTestApp, type Client } from './helpers'

/** API-GUR-06 and the new columns of API-GUR-05 (S6-T10). DB spec; the default password is a throwaway set in the test process env only. */
const THROWAWAY = 'w'.repeat(10)
const StudentsBody = z.object({ data: z.array(TeacherStudentSchema), meta: TeacherStudentsMetaSchema })

describe('POST /api/guru/students (Cipta Pelajar)', () => {
  let t: ClassesTestApp
  let a: Client
  let b: Client
  let k: { id: string }

  beforeAll(async () => {
    t = await bootClassesApp({ env: { PUPIL_DEFAULT_PASSWORD: THROWAWAY } })
    a = await client(t, TEACHER_A)
    b = await client(t, TEACHER_B)
    k = await createClass(t, a, { name: 'Kelas Cipta', schoolId: await schoolOfCode(t, 'DEMO001') })
  }, 120_000)
  afterAll(async () => {
    await t.close()
  })

  it('creates the pupil in the class: username, message, enrolment source teacher, audit, no clear password stored', async () => {
    const res = await a.post('/guru/students', { name: 'Murid Contoh', classroomId: k.id })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const data = envelopeOf(GuruStudentCreatedSchema).parse(res.body).data
    expect(data.username).toBe('murid.contoh01')
    expect(data.message).toBe(`Pelajar dicipta. Login: murid.contoh01 / ${THROWAWAY}`)
    const enrol = await t.db.query<{ source: string; status: string }>(`select source, status from enrolments where student_id = $1`, [data.id])
    expect(enrol).toEqual([{ source: 'teacher', status: 'active' }])
    expect(await t.db.query(`select 1 from audit_events where action = 'classes.student.created' and detail->>'studentId' = $1`, [data.id])).toHaveLength(1)
    expect(JSON.stringify(await t.db.query(`select detail from audit_events where action = 'classes.student.created'`))).not.toContain(THROWAWAY)
    const second = await a.post('/guru/students', { name: 'Murid Contoh', classroomId: k.id })
    expect(envelopeOf(GuruStudentCreatedSchema).parse(second.body).data.username).toBe('murid.contoh02')
  })

  it('refuses a short or hyphenated IC, then a duplicate IC', async () => {
    expect(fieldsOf(await a.post('/guru/students', { name: 'Murid Satu', classroomId: k.id, ic: '12345678901' }))).toEqual({ ic: GURU_STUDENT_MESSAGES.ic })
    expect(fieldsOf(await a.post('/guru/students', { name: 'Murid Satu', classroomId: k.id, ic: '123456-12-1234' }))).toEqual({ ic: GURU_STUDENT_MESSAGES.ic })
    expect((await a.post('/guru/students', { name: 'Murid Ic', classroomId: k.id, ic: '123456121234' })).status).toBe(201)
    errorIs(await a.post('/guru/students', { name: 'Murid Ic Dua', classroomId: k.id, ic: '123456121234' }), 409, 'CONFLICT', GURU_STUDENT_MESSAGES.icTaken)
  })

  it('another teacher class is 422 fields.classroomId; a missing name is "Sila isi nama."', async () => {
    expect(fieldsOf(await b.post('/guru/students', { name: 'Murid Lain', classroomId: k.id }))).toHaveProperty('classroomId')
    expect(fieldsOf(await a.post('/guru/students', { classroomId: k.id }))).toEqual({ name: GURU_STUDENT_MESSAGES.name })
  })

  it('the list carries username, tugasan, skorPurata, lastActiveAt and the page meta', async () => {
    const res = StudentsBody.parse((await a.get('/guru/students')).body)
    const row = res.data.find((s) => s.username === 'murid.contoh01')
    expect(row).toMatchObject({ tugasan: 0, skorPurata: null, lastActiveAt: null })
    expect(res.meta).toMatchObject({ page: 1, pageSize: 25, totalPages: 1 })
  })
})
