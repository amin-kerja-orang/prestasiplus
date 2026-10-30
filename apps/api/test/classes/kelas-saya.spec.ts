import { CLASS_MESSAGES, ClassJoinResponseSchema, ClassJoinedClassSchema, listEnvelopeOf } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  ADMIN,
  SCHOOL_ADMIN,
  STUDENT_1,
  STUDENT_2,
  STUDENT_MAJU,
  STUDENT_OTHER_SCHOOL,
  TEACHER_A,
  TEACHER_B,
  bootClassesApp,
  client,
  createClass,
  errorIs,
  fieldsOf,
  idOfEmail,
  login,
  schoolOfCode,
  type ClassesTestApp,
  type Client,
} from './helpers'

const JoinedList = listEnvelopeOf(ClassJoinedClassSchema)

describe('Kelas Saya: GET /api/kelas-saya and POST /api/kelas-saya/join (AC 1)', () => {
  let t: ClassesTestApp
  let teacher: Client
  let s1: Client
  let s2: Client
  let k: { id: string; joinCode: string; name: string }
  let s1Id: string

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

  it('joins with the code trimmed and in any letter case: 201, the mock message, an enrolment with source "code"', async () => {
    const res = await s1.post('/kelas-saya/join', { classCode: `  ${k.joinCode.toLowerCase()}  ` })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const body = ClassJoinResponseSchema.parse(res.body)
    expect(body.data).toEqual({ classroomId: k.id })
    expect(body.message).toBe('Berjaya menyertai kelas Kelas Join.')
    const [row] = await t.db.query<{ status: string; source: string; is_test: boolean }>(`select status, source, is_test from enrolments where classroom_id = $1 and student_id = $2`, [k.id, s1Id])
    expect(row).toEqual({ status: 'active', source: 'code', is_test: false })
    const audit = await t.db.query<{ detail: Record<string, unknown> }>(`select detail from audit_events where action = 'classes.class.joined'`)
    expect(audit).toHaveLength(1)
    expect(JSON.stringify(audit[0]?.detail)).not.toContain(k.joinCode)
  })

  it('lists the joined class with subject, teacher and level label', async () => {
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
    await s1.post('/kelas-saya/join', { classCode: k2.joinCode })
    const sc = (
      await t.db.query<{ id: string }>(
        `insert into classrooms (kind, name, school_id, education_level_id, academic_year) select 'school_class', 'Kelas Sekolah', null, id, 2026 from education_levels where stage <> 'primary' order by id limit 1 returning id::text`,
      )
    )[0]?.id as string
    await t.db.query(`insert into enrolments (classroom_id, student_id, status, source) values ($1, $2, 'active', 'school_admin')`, [sc, s1Id])
    const names = JoinedList.parse((await s1.get('/kelas-saya')).body).data.map((x) => x.name)
    expect(names).toEqual(['Kelas Baharu', 'Kelas Join'])
  })

  it('a second join of the same class is 409 and writes nothing', async () => {
    const before = await t.db.query(`select 1 from enrolments where classroom_id = $1`, [k.id])
    errorIs(await s1.post('/kelas-saya/join', { classCode: k.joinCode }), 409, 'CONFLICT', CLASS_MESSAGES.joinAlready)
    expect(await t.db.query(`select 1 from enrolments where classroom_id = $1`, [k.id])).toHaveLength(before.length)
  })

  it('a blank, missing or non-text code is 422 "Sila masukkan kod kelas."; an unknown key is refused', async () => {
    for (const body of [{}, { classCode: '' }, { classCode: '   ' }, { classCode: 12 }, { classCode: null }]) {
      expect(fieldsOf(await s2.post('/kelas-saya/join', body))).toEqual({ classCode: CLASS_MESSAGES.classCode })
    }
    expect(fieldsOf(await s2.post('/kelas-saya/join', { classCode: k.joinCode, classroomId: '1' }))).toEqual({ classroomId: 'The classroomId field is not allowed.' })
  })

  it('an unknown code is 404 "Kod kelas tidak sah."; so is the code of a school class', async () => {
    errorIs(await s2.post('/kelas-saya/join', { classCode: 'ZZZZZZ' }), 404, 'NOT_FOUND', CLASS_MESSAGES.joinNotFound)
    await t.db.query(
      `insert into classrooms (kind, name, education_level_id, academic_year, join_code) select 'school_class', 'KS', id, 2026, 'SCHKLS' from education_levels where stage <> 'primary' order by id limit 1`,
    )
    errorIs(await s2.post('/kelas-saya/join', { classCode: 'schkls' }), 404, 'NOT_FOUND', CLASS_MESSAGES.joinNotFound)
    expect(await t.db.query(`select 1 from enrolments where student_id = $1`, [await idOfEmail(t, STUDENT_2)])).toHaveLength(0)
  })

  it('only a student (and the admin) may join: a teacher and a school admin are 403; the admin joins', async () => {
    for (const who of [TEACHER_B, SCHOOL_ADMIN]) {
      const api = await client(t, who)
      errorIs(await api.post('/kelas-saya/join', { classCode: k.joinCode }), 403, 'FORBIDDEN', 'This action is unauthorized.')
    }
    const admin = await client(t, ADMIN)
    const res = await admin.post('/kelas-saya/join', { classCode: k.joinCode })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    expect(JoinedList.parse((await admin.get('/kelas-saya')).body).data.map((x) => x.id)).toEqual([k.id])
  })

  it('other roles read an empty "Kelas Saya"', async () => {
    const api = await client(t, TEACHER_B)
    const res = await api.get('/kelas-saya')
    expect(res.status).toBe(200)
    expect(JoinedList.parse(res.body).data).toEqual([])
  })

  it('a write without CSRF is 403 CSRF_INVALID', async () => {
    const res = await s2.who.agent.post('/api/kelas-saya/join').send({ classCode: k.joinCode })
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('CSRF_INVALID')
  })

  it('a pupil of another school can join by code (the code is the invitation)', async () => {
    const other = await client(t, STUDENT_OTHER_SCHOOL)
    expect((await other.post('/kelas-saya/join', { classCode: k.joinCode })).status).toBe(201)
  })

  it('a removed pupil who joins again is reactivated on the same row', async () => {
    const maju = await client(t, STUDENT_MAJU)
    const majuId = await idOfEmail(t, STUDENT_MAJU)
    expect((await maju.post('/kelas-saya/join', { classCode: k.joinCode })).status).toBe(201)
    expect((await teacher.del(`/guru/students/${majuId}?classroomId=${k.id}`)).status).toBe(200)
    expect(JoinedList.parse((await maju.get('/kelas-saya')).body).data).toEqual([])
    expect((await maju.post('/kelas-saya/join', { classCode: k.joinCode })).status).toBe(201)
    const rows = await t.db.query<{ status: string; source: string }>(`select status, source from enrolments where classroom_id = $1 and student_id = $2`, [k.id, majuId])
    expect(rows).toEqual([{ status: 'active', source: 'code' }])
  })

  it('under Mod Pelajar the join is test data: not counted in rosters, visible only inside the mode', async () => {
    const who = await login(t, 'guruadmin@demo.test')
    const bId = await idOfEmail(t, 'guruadmin@demo.test')
    const switched = await who.agent.post('/api/session/role').set('X-CSRF-Token', who.csrf).send({ role: 'school_admin' })
    expect(switched.status).toBe(200)
    const entered = await who.agent.post('/api/session/mode').set('X-CSRF-Token', switched.body.data.csrf as string).send({ mode: 'mod_pelajar' })
    expect(entered.status, JSON.stringify(entered.body)).toBe(200)
    const csrf = entered.body.data.csrf as string
    const joined = await who.agent.post('/api/kelas-saya/join').set('X-CSRF-Token', csrf).send({ classCode: k.joinCode })
    expect(joined.status, JSON.stringify(joined.body)).toBe(201)
    const [row] = await t.db.query<{ is_test: boolean }>(`select is_test from enrolments where classroom_id = $1 and student_id = $2`, [k.id, bId])
    expect(row?.is_test).toBe(true)
    expect(JoinedList.parse((await who.agent.get('/api/kelas-saya')).body).data.map((x) => x.id)).toEqual([k.id])
    // the owner's counters and roster ignore it
    const [count] = await t.db.query<{ n: number }>(`select count(*)::int n from enrolments where classroom_id = $1 and status = 'active' and not is_test`, [k.id])
    const mine = (await teacher.get('/guru/classes')).body.data.find((x: { id: string }) => x.id === k.id)
    expect(mine.studentCount).toBe(count?.n)
    const left = await who.agent.delete('/api/session/mode').set('X-CSRF-Token', csrf)
    expect(left.status).toBe(200)
    expect(JoinedList.parse((await who.agent.get('/api/kelas-saya')).body).data).toEqual([])
  })
})
