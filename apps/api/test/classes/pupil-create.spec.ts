import { GURU_STUDENT_MESSAGES, GuruStudentCreatedSchema, TeacherStudentSchema, TeacherStudentsMetaSchema, envelopeOf } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { z } from 'zod'

import { TEACHER_A, TEACHER_B, bootClassesApp, client, createClass, errorIs, fieldsOf, firstSubject, idOfEmail, schoolOfCode, type ClassesTestApp, type Client } from './helpers'

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

  it('computes tugasan, skorPurata and lastActiveAt from real sessions and answers (FR-GUR-41-6)', async () => {
    const created = envelopeOf(GuruStudentCreatedSchema).parse((await a.post('/guru/students', { name: 'Murid Skor', classroomId: k.id })).body).data
    const pupil = created.id
    const teacherA = await idOfEmail(t, TEACHER_A)
    const teacherB = await idOfEmail(t, TEACHER_B)
    const subject = await firstSubject(t)
    const kOther = await createClass(t, b, { name: 'Kelas Guru Lain', schoolId: await schoolOfCode(t, 'DEMO001') })

    const one = async (sql: string, args: unknown[]): Promise<string> => (await t.db.query<{ id: string }>(sql, args))[0]?.id as string
    const mission = await one(
      `insert into missions (teacher_id, classroom_id, title, mission_type, mission_date, subject_id, question_count)
       values ($1::bigint, $2::bigint, 'Misi Ujian', 'latih_tubi', '2026-10-01', $3::bigint, 10) returning id::text`,
      [teacherA, k.id, subject.id],
    )
    const ownSet = await one(
      `insert into question_sets (teacher_id, classroom_id, title, status) values ($1::bigint, $2::bigint, 'Set Ujian', 'published') returning id::text`,
      [teacherA, k.id],
    )
    const otherSet = await one(
      `insert into question_sets (teacher_id, classroom_id, title, status) values ($1::bigint, $2::bigint, 'Set Guru Lain', 'published') returning id::text`,
      [teacherB, kOther.id],
    )
    const session = (mode: string, correct: number, over: { missionId?: string; setId?: string; isTest?: boolean } = {}) =>
      t.db.query(
        `insert into practice_sessions (user_id, mode, subject_id, question_count, status, correct_count, started_at, completed_at, is_test, mission_id, question_set_id)
         values ($1::bigint, $2, $3::bigint, 10, 'completed', $4, now(), now(), $5, $6::bigint, $7::bigint)`,
        [pupil, mode, subject.id, correct, over.isTest ?? false, over.missionId ?? null, over.setId ?? null],
      )
    await session('random', 6) // 60%
    await session('random', 8) // 80%
    await session('random', 0, { isTest: true }) // ignored everywhere
    await session('mission', 7, { missionId: mission }) // 70%, counts as a Tugasan
    await session('question_set', 7, { setId: ownSet }) // 70%, counts as a Tugasan
    await session('question_set', 7, { setId: otherSet }) // 70%, set of ANOTHER teacher class: in the mean, not a Tugasan
    // mean of 60, 80, 70, 70, 70 = 70

    const answer = (at: string, isTest: boolean) =>
      t.db.query(`insert into practice_answers (user_id, subject_id, is_correct, answered_at, is_test) values ($1::bigint, $2::bigint, true, $3::timestamptz, $4)`, [
        pupil,
        subject.id,
        at,
        isTest,
      ])
    await answer('2026-10-01T02:00:00Z', false)
    await answer('2026-10-03T04:30:00Z', false) // the latest non-test answer
    await answer('2026-10-09T00:00:00Z', true) // test row: ignored

    const row = StudentsBody.parse((await a.get('/guru/students')).body).data.find((s) => s.id === pupil)
    expect(row).toMatchObject({ tugasan: 2, skorPurata: 70, lastActiveAt: '2026-10-03T12:30:00.000+08:00' })
  })
})
