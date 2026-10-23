import {
  CLASS_MESSAGES,
  ClassEnrolmentSchema,
  ClassStudentRemovedSchema,
  TeacherChapterOptionSchema,
  TeacherContributionsSchema,
  TeacherDashboardSchema,
  TeacherGallerySchema,
  TeacherStudentSchema,
  TeacherStudentsMetaSchema,
  TeacherTopicOptionSchema,
  envelopeOf,
} from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { z } from 'zod'

import { ClassesPorts } from '../../src/modules/classes'
import {
  STUDENT_1,
  STUDENT_2,
  STUDENT_INACTIVE,
  STUDENT_MAJU,
  STUDENT_OTHER_SCHOOL,
  TEACHER_A,
  TEACHER_B,
  TEACHER_C,
  bootClassesApp,
  client,
  createClass,
  errorIs,
  fieldsOf,
  idOfEmail,
  schoolOfCode,
  type ClassesTestApp,
  type Client,
} from './helpers'

const StudentsBody = z.object({ data: z.array(TeacherStudentSchema), meta: TeacherStudentsMetaSchema })

describe('teacher roster, dashboard and inline curriculum (AC 2, 3, 4, 7)', () => {
  let t: ClassesTestApp
  let a: Client
  let b: Client
  let c: Client
  let school1: string
  let s1: string
  let s2: string
  let sMaju: string
  let sInactive: string
  let sOther: string
  let k1: { id: string; joinCode: string }

  beforeAll(async () => {
    t = await bootClassesApp()
    a = await client(t, TEACHER_A)
    b = await client(t, TEACHER_B)
    c = await client(t, TEACHER_C)
    school1 = await schoolOfCode(t, 'DEMO001')
    s1 = await idOfEmail(t, STUDENT_1)
    s2 = await idOfEmail(t, STUDENT_2)
    sMaju = await idOfEmail(t, STUDENT_MAJU)
    sInactive = await idOfEmail(t, STUDENT_INACTIVE)
    sOther = await idOfEmail(t, STUDENT_OTHER_SCHOOL)
    k1 = await createClass(t, a, { name: 'Kelas Roster', schoolId: school1 })
  }, 120_000)
  afterAll(async () => {
    await t.close()
  })

  describe('PUT /api/guru/students/:id', () => {
    it('adds a pupil of the teacher school to an own class (source teacher, status active)', async () => {
      const res = await a.put(`/guru/students/${s1}`, { classroomId: k1.id })
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      const row = envelopeOf(ClassEnrolmentSchema).parse(res.body).data
      expect(row).toMatchObject({ classroomKind: 'classroom', classroomId: k1.id, studentId: s1, status: 'active', source: 'teacher' })
      expect(row.joinedAt).toBe('2026-10-19T09:00:00.000+08:00')
      const audit = await t.db.query<{ detail: Record<string, unknown>; actor_role: string }>(`select detail, actor_role from audit_events where action = 'classes.student.added'`)
      expect(audit).toHaveLength(1)
      expect(audit[0]?.actor_role).toBe('teacher')
      expect(JSON.stringify(audit[0]?.detail)).not.toMatch(/Murid|@/)
    })

    it('a second add is 409 with the mock message', async () => {
      errorIs(await a.put(`/guru/students/${s1}`, { classroomId: k1.id }), 409, 'CONFLICT', CLASS_MESSAGES.alreadyInClass)
    })

    it('a pupil of another school is 403 "Pelajar bukan daripada sekolah anda."', async () => {
      errorIs(await a.put(`/guru/students/${sOther}`, { classroomId: k1.id }), 403, 'FORBIDDEN', CLASS_MESSAGES.studentOtherSchool)
    })

    it('another teacher of the same school gets 403 "Kelas ini bukan milik anda."; a teacher of another school gets 404', async () => {
      errorIs(await b.put(`/guru/students/${s2}`, { classroomId: k1.id }), 403, 'FORBIDDEN', CLASS_MESSAGES.classNotOwn)
      errorIs(await c.put(`/guru/students/${sOther}`, { classroomId: k1.id }), 404, 'NOT_FOUND', CLASS_MESSAGES.classroom)
      expect(await t.db.query(`select 1 from enrolments where student_id = $1`, [s2])).toHaveLength(0)
    })

    it('checks in the order of the mock: body 422, pupil 404, class 404, then ownership', async () => {
      expect(fieldsOf(await a.put(`/guru/students/${s2}`, {}))).toEqual({ classroomId: CLASS_MESSAGES.classroom })
      for (const classroomId of ['abc', '0', '-3', '']) {
        expect(fieldsOf(await a.put(`/guru/students/${s2}`, { classroomId }))).toEqual({ classroomId: CLASS_MESSAGES.classroom })
      }
      expect(fieldsOf(await a.put(`/guru/students/${s2}`, { classroomId: 5 }))).toEqual({ classroomId: CLASS_MESSAGES.classroom })
      errorIs(await a.put(`/guru/students/99999999`, { classroomId: k1.id }), 404, 'NOT_FOUND', CLASS_MESSAGES.studentNotFound)
      errorIs(await a.put(`/guru/students/abc`, { classroomId: k1.id }), 404, 'NOT_FOUND', CLASS_MESSAGES.studentNotFound)
      // a teacher account is not a pupil
      errorIs(await a.put(`/guru/students/${await idOfEmail(t, TEACHER_B)}`, { classroomId: k1.id }), 404, 'NOT_FOUND', CLASS_MESSAGES.studentNotFound)
      errorIs(await a.put(`/guru/students/${s2}`, { classroomId: '99999999' }), 404, 'NOT_FOUND', CLASS_MESSAGES.classroom)
      // pupil unknown AND class unknown: the pupil comes first
      errorIs(await a.put(`/guru/students/99999999`, { classroomId: '99999999' }), 404, 'NOT_FOUND', CLASS_MESSAGES.studentNotFound)
      // a school class is not a class of the roster
      const sc = (
        await t.db.query<{ id: string }>(
          `insert into classrooms (kind, name, school_id, education_level_id, academic_year) select 'school_class', 'KS', $1, id, 2026 from education_levels limit 1 returning id::text`,
          [school1],
        )
      )[0]?.id as string
      errorIs(await a.put(`/guru/students/${s2}`, { classroomId: sc }), 404, 'NOT_FOUND', CLASS_MESSAGES.classroom)
      expect(fieldsOf(await a.put(`/guru/students/${s2}`, { classroomId: k1.id, studentId: '1' }))).toEqual({ studentId: 'The studentId field is not allowed.' })
    })

    it('a write without CSRF is 403 CSRF_INVALID', async () => {
      const res = await a.who.agent.put(`/api/guru/students/${s2}`).send({ classroomId: k1.id })
      expect(res.status).toBe(403)
      expect(res.body.error.code).toBe('CSRF_INVALID')
    })
  })

  describe('GET /api/guru/students', () => {
    it('tab=mine lists the distinct pupils of own active classes, A to Z, with the class chips and the level name', async () => {
      const k2 = await createClass(t, a, { name: 'Kelas Dua', schoolId: school1 })
      await a.put(`/guru/students/${s2}`, { classroomId: k2.id })
      await a.put(`/guru/students/${s1}`, { classroomId: k2.id })
      const res = await a.get('/guru/students')
      const body = StudentsBody.parse(res.body)
      expect(body.meta).toEqual({ count: 2, schoolSet: true })
      expect(body.data.map((s) => s.name)).toEqual(['Murid Demo', 'Murid Demo Kosong'])
      const first = body.data[0]
      expect(first?.id).toBe(s1)
      expect(first?.levelName).toBe('Tingkatan 4')
      expect([...(first?.classNames ?? [])].sort()).toEqual(['Kelas Dua', 'Kelas Roster'])
      expect(body.data[1]?.classNames).toEqual(['Kelas Dua'])
      // SW5-03: `classes` carries the ids, in the same order as `classNames`
      expect(first?.classes.map((c) => c.name)).toEqual(first?.classNames)
      expect([...(first?.classes.map((c) => c.id) ?? [])].sort()).toEqual([k1.id, k2.id].sort())
      expect(body.data[1]?.classes).toEqual([{ id: k2.id, name: 'Kelas Dua' }])
      // an unknown tab falls back to "mine"; a repeated key is read as absent
      expect(StudentsBody.parse((await a.get('/guru/students?tab=xyz')).body).meta.count).toBe(2)
      expect(StudentsBody.parse((await a.get('/guru/students?tab=school&tab=mine')).body).meta.count).toBe(2)
    })

    it('search is a case-insensitive name filter; wildcards are literal', async () => {
      expect(StudentsBody.parse((await a.get('/guru/students?search=KOSONG')).body).data.map((s) => s.id)).toEqual([s2])
      expect(StudentsBody.parse((await a.get('/guru/students?search=%25')).body).data).toHaveLength(0)
      expect(StudentsBody.parse((await a.get('/guru/students?search=_')).body).data).toHaveLength(0)
      expect(StudentsBody.parse((await a.get('/guru/students?search=')).body).data).toHaveLength(2)
    })

    it('an inactive class and a removed enrolment drop the pupil from "mine"', async () => {
      const k3 = await createClass(t, a, { name: 'Kelas Tiga', schoolId: school1 })
      await a.put(`/guru/students/${sMaju}`, { classroomId: k3.id })
      expect(StudentsBody.parse((await a.get('/guru/students')).body).meta.count).toBe(3)
      await t.db.query(`update classrooms set is_active = false where id = $1`, [k3.id])
      expect(StudentsBody.parse((await a.get('/guru/students')).body).meta.count).toBe(2)
      await t.db.query(`update classrooms set is_active = true where id = $1`, [k3.id])
      await t.db.query(`update enrolments set is_test = true where classroom_id = $1`, [k3.id])
      expect(StudentsBody.parse((await a.get('/guru/students')).body).meta.count).toBe(2)
      await t.db.query(`delete from enrolments where classroom_id = $1`, [k3.id])
    })

    it('another teacher sees none of these pupils; a teacher of another school sees only their own school', async () => {
      expect(StudentsBody.parse((await b.get('/guru/students')).body)).toMatchObject({ data: [], meta: { count: 0, schoolSet: true } })
      expect(StudentsBody.parse((await c.get('/guru/students')).body).data).toHaveLength(0)
    })

    it('tab=school lists the active pupils of the teacher school only (name A to Z), never another school', async () => {
      const res = StudentsBody.parse((await a.get('/guru/students?tab=school')).body)
      const ids = res.data.map((s) => s.id)
      expect(ids).toContain(s1)
      expect(ids).toContain(sMaju)
      expect(ids).not.toContain(sInactive)
      expect(ids).not.toContain(sOther)
      expect(res.meta).toEqual({ count: res.data.length, schoolSet: true })
      const other = StudentsBody.parse((await c.get('/guru/students?tab=school')).body)
      expect(other.data.map((s) => s.id)).toContain(sOther)
      expect(other.data.map((s) => s.id)).not.toContain(s1)
    })

    it('tab=school is capped at 200 rows while meta.count counts every match', async () => {
      await t.db.query(
        `with u as (insert into users (name, email, school_id, grade, is_active) select 'Murid Penuh ' || lpad(g::text, 3, '0'), 'penuh.' || g || '@ujian.test', $1, 10, true from generate_series(1, 205) g returning id)
         insert into user_roles (user_id, role) select id, 'student' from u`,
        [school1],
      )
      const res = StudentsBody.parse((await a.get('/guru/students?tab=school')).body)
      expect(res.data).toHaveLength(200)
      expect(res.meta.count).toBeGreaterThanOrEqual(205)
      const filtered = StudentsBody.parse((await a.get('/guru/students?tab=school&search=Murid%20Penuh')).body)
      expect(filtered.meta.count).toBe(205)
      expect(filtered.data).toHaveLength(200)
    })

    it('SW5-03: two own classes with the same name give two entries with distinct ids, in the order of classNames', async () => {
      const twinA = await createClass(t, a, { name: 'Kelas Kembar', schoolId: school1 })
      const twinB = await createClass(t, a, { name: 'Kelas Kembar', schoolId: school1 })
      expect(twinA.id).not.toBe(twinB.id)
      await a.put(`/guru/students/${sMaju}`, { classroomId: twinA.id })
      await a.put(`/guru/students/${sMaju}`, { classroomId: twinB.id })
      try {
        const row = StudentsBody.parse((await a.get('/guru/students')).body).data.find((s) => s.id === sMaju)
        expect(row?.classNames).toEqual(['Kelas Kembar', 'Kelas Kembar'])
        expect(row?.classes).toHaveLength(2)
        expect(row?.classes.map((c) => c.name)).toEqual(row?.classNames)
        expect(new Set(row?.classes.map((c) => c.id))).toEqual(new Set([twinA.id, twinB.id]))
        // the school tab fills the same field
        const school = StudentsBody.parse((await a.get('/guru/students?tab=school')).body).data.find((s) => s.id === sMaju)
        expect(school?.classes).toEqual(row?.classes)
      } finally {
        await t.db.query(`delete from enrolments where classroom_id = any($1::bigint[])`, [[twinA.id, twinB.id]])
      }
    })
  })

  describe('DELETE /api/guru/students/:id', () => {
    it('removes the pupil from an own class: the row stays with status removed', async () => {
      const res = await a.del(`/guru/students/${s1}?classroomId=${k1.id}`)
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(envelopeOf(ClassStudentRemovedSchema).parse(res.body).data).toEqual({ removed: 1 })
      const [row] = await t.db.query<{ status: string }>(`select status from enrolments where classroom_id = $1 and student_id = $2`, [k1.id, s1])
      expect(row?.status).toBe('removed')
      errorIs(await a.del(`/guru/students/${s1}?classroomId=${k1.id}`), 404, 'NOT_FOUND', CLASS_MESSAGES.notInClass)
    })

    it('adding the pupil again reactivates the same row', async () => {
      const res = await a.put(`/guru/students/${s1}`, { classroomId: k1.id })
      expect(res.status).toBe(200)
      expect(await t.db.query(`select 1 from enrolments where classroom_id = $1 and student_id = $2`, [k1.id, s1])).toHaveLength(1)
      const [row] = await t.db.query<{ status: string; source: string }>(`select status, source from enrolments where classroom_id = $1 and student_id = $2`, [k1.id, s1])
      expect(row).toEqual({ status: 'active', source: 'teacher' })
    })

    it('validates the class like the mock: 422 missing or bad id, 404 unknown, 403 not own, 404 another school', async () => {
      expect(fieldsOf(await a.del(`/guru/students/${s1}`))).toEqual({ classroomId: CLASS_MESSAGES.classroom })
      expect(fieldsOf(await a.del(`/guru/students/${s1}?classroomId=abc`))).toEqual({ classroomId: CLASS_MESSAGES.classroom })
      expect(fieldsOf(await a.del(`/guru/students/${s1}?classroomId=0`))).toEqual({ classroomId: CLASS_MESSAGES.classroom })
      errorIs(await a.del(`/guru/students/${s1}?classroomId=99999999`), 404, 'NOT_FOUND', CLASS_MESSAGES.classroom)
      errorIs(await b.del(`/guru/students/${s1}?classroomId=${k1.id}`), 403, 'FORBIDDEN', CLASS_MESSAGES.classNotOwn)
      errorIs(await c.del(`/guru/students/${s1}?classroomId=${k1.id}`), 404, 'NOT_FOUND', CLASS_MESSAGES.classroom)
      errorIs(await a.del(`/guru/students/abc?classroomId=${k1.id}`), 404, 'NOT_FOUND', CLASS_MESSAGES.notInClass)
      const [row] = await t.db.query<{ status: string }>(`select status from enrolments where classroom_id = $1 and student_id = $2`, [k1.id, s1])
      expect(row?.status).toBe('active')
    })

    it('a delete without CSRF is 403 and removes nothing', async () => {
      const res = await a.who.agent.delete(`/api/guru/students/${s1}?classroomId=${k1.id}`)
      expect(res.status).toBe(403)
      expect(res.body.error.code).toBe('CSRF_INVALID')
      const [row] = await t.db.query<{ status: string }>(`select status from enrolments where classroom_id = $1 and student_id = $2`, [k1.id, s1])
      expect(row?.status).toBe('active')
    })
  })

  describe('GET /api/guru/dashboard (AC 3)', () => {
    it('is all false and zero for a teacher without classes', async () => {
      const res = await c.get('/guru/dashboard')
      expect(res.status).toBe(200)
      expect(envelopeOf(TeacherDashboardSchema).parse(res.body).data).toEqual({
        checklist: { hasClass: false, hasStudents: false, hasMission: false },
        stats: { activeClasses: 0, totalClasses: 0, students: 0, questions: 0, questionsApproved: 0, assignments: 0 },
        today: { students: [], topics: [], actions: [] },
        peerTutor: [],
        classes: [],
        submissions: [],
      })
    })

    it('contributions: zero counters with the eight tiers until the question bank plugs in', async () => {
      const res = await c.get('/guru/contributions')
      expect(res.status).toBe(200)
      const body = TeacherContributionsSchema.parse(res.body)
      expect(body.stats).toEqual({ total: 0, approved: 0, pending: 0, used: 0 })
      expect(body.tiers).toHaveLength(8)
      expect(body.tiers.every((x) => !x.reached)).toBe(true)
      expect(body.nextTier).toEqual({ name: 'Penyumbang Baru', threshold: 10 })
      expect(body.breakdown).toEqual([])
      expect(body.tiers[0]).toEqual({ name: 'Penyumbang Baru', threshold: 10, icon: 'fa-seedling', reached: false })
    })

    it('counts come from the tables on every call (no stored aggregate)', async () => {
      const x = await createClass(t, b, { name: 'Aktif B', schoolId: school1 })
      const y = await createClass(t, b, { name: 'Tidak Aktif B', schoolId: school1 })
      await b.put(`/guru/students/${s1}`, { classroomId: x.id })
      await b.put(`/guru/students/${s2}`, { classroomId: x.id })
      await b.put(`/guru/students/${s2}`, { classroomId: y.id })
      await b.put(`/guru/students/${sMaju}`, { classroomId: y.id })
      await t.db.query(`update classrooms set is_active = false where id = $1`, [y.id])
      const d = envelopeOf(TeacherDashboardSchema).parse((await b.get('/guru/dashboard')).body).data
      expect(d.checklist).toEqual({ hasClass: true, hasStudents: true, hasMission: false })
      expect(d.stats).toMatchObject({ activeClasses: 1, totalClasses: 2, students: 2, assignments: 0 })
      expect(d.classes).toEqual([{ id: x.id, name: 'Aktif B', studentCount: 2 }])
      await b.del(`/guru/students/${s1}?classroomId=${x.id}`)
      const after = envelopeOf(TeacherDashboardSchema).parse((await b.get('/guru/dashboard')).body).data
      expect(after.stats.students).toBe(1)
      expect(after.classes[0]?.studentCount).toBe(1)
    })

    it('questions and the mission check come from the ports (zero / false until BE-09 and BE-18 plug in)', async () => {
      const ports = t.get(ClassesPorts)
      ports.provideQuestions({ statsOf: () => Promise.resolve({ total: 12, approved: 7, pending: 3, used: 2, bySubject: [] }) })
      ports.provideMissions({ hasMission: () => Promise.resolve(true) })
      const d = envelopeOf(TeacherDashboardSchema).parse((await a.get('/guru/dashboard')).body).data
      expect(d.stats).toMatchObject({ questions: 12, questionsApproved: 7 })
      expect(d.checklist.hasMission).toBe(true)
      expect(() => ports.provideQuestions({ statsOf: () => Promise.reject(new Error('x')) })).toThrow(/already set/)
    })
  })

  describe('inline chapters and topics (M03 data)', () => {
    let subjectId: string
    let levelId: string

    beforeAll(async () => {
      const rows = await t.db.query<{ subject_id: string; education_level_id: string }>(
        `select subject_id::text, education_level_id::text from chapters where in_tree and is_active and education_level_id is not null order by id limit 1`,
      )
      subjectId = rows[0]?.subject_id as string
      levelId = rows[0]?.education_level_id as string
    })

    it('GET chapters returns a bare array of the active chapters; a missing or unknown parent gives []', async () => {
      const res = await a.get(`/guru/chapters?subjectId=${subjectId}&educationLevelId=${levelId}`)
      expect(res.status).toBe(200)
      const list = z.array(TeacherChapterOptionSchema).parse(res.body)
      expect(list.length).toBeGreaterThan(0)
      for (const q of ['', `?subjectId=${subjectId}`, `?educationLevelId=${levelId}`, '?subjectId=abc&educationLevelId=1', '?subjectId=999999&educationLevelId=999999']) {
        const r = await a.get(`/guru/chapters${q}`)
        expect(r.status).toBe(200)
        expect(r.body).toEqual([])
      }
    })

    it('POST chapters creates an M03 chapter and answers the bare option with 201', async () => {
      const res = await a.post('/guru/chapters', { name: '  Bab Baru Ujian ', chapterNumber: '7', subjectId, educationLevelId: levelId })
      expect(res.status, JSON.stringify(res.body)).toBe(201)
      expect(TeacherChapterOptionSchema.parse(res.body)).toMatchObject({ chapterNumber: 7, name: 'Bab Baru Ujian' })
      const listed = z.array(TeacherChapterOptionSchema).parse((await a.get(`/guru/chapters?subjectId=${subjectId}&educationLevelId=${levelId}`)).body)
      expect(listed.map((x) => x.id)).toContain(res.body.id)
      const audit = await t.db.query(`select 1 from audit_events where action = 'curriculum.chapter.created' and actor_role = 'teacher'`)
      expect(audit).toHaveLength(1)
    })

    it('POST chapters validates with the mock messages (standard 422 shape)', async () => {
      const f = fieldsOf(await a.post('/guru/chapters', {}))
      expect(f).toMatchObject({ name: CLASS_MESSAGES.chapterName, chapterNumber: CLASS_MESSAGES.chapterNumber, subjectId: CLASS_MESSAGES.chapterParent })
      for (const chapterNumber of [0, 100, '1.5', 'x']) {
        expect(fieldsOf(await a.post('/guru/chapters', { name: 'B', chapterNumber, subjectId, educationLevelId: levelId }))).toEqual({ chapterNumber: CLASS_MESSAGES.chapterNumber })
      }
      expect(fieldsOf(await a.post('/guru/chapters', { name: 'B', chapterNumber: 1, subjectId: '999999', educationLevelId: levelId }))).toEqual({ subjectId: CLASS_MESSAGES.chapterParent })
      expect(fieldsOf(await a.post('/guru/chapters', { name: 'B', chapterNumber: 1, subjectId, educationLevelId: 'abc' }))).toEqual({ educationLevelId: CLASS_MESSAGES.chapterParent })
    })

    it('topics: list of a chapter, create numbered max + 1, validation, empty list for an unknown chapter', async () => {
      const chapter = await a.post('/guru/chapters', { name: 'Bab Topik', chapterNumber: 9, subjectId, educationLevelId: levelId })
      const chapterId = chapter.body.id as string
      expect((await a.get(`/guru/topics?chapterId=${chapterId}`)).body).toEqual([])
      const t1 = await a.post('/guru/topics', { name: 'Topik Satu', chapterId })
      expect(t1.status).toBe(201)
      expect(TeacherTopicOptionSchema.parse(t1.body)).toMatchObject({ topicNumber: '1', name: 'Topik Satu' })
      const t2 = await a.post('/guru/topics', { name: 'Topik Dua', chapterId })
      expect(t2.body.topicNumber).toBe('2')
      const list = z.array(TeacherTopicOptionSchema).parse((await a.get(`/guru/topics?chapterId=${chapterId}`)).body)
      expect(list.map((x) => x.name)).toEqual(['Topik Satu', 'Topik Dua'])
      for (const q of ['', '?chapterId=abc', '?chapterId=999999']) expect((await a.get(`/guru/topics${q}`)).body).toEqual([])
      expect(fieldsOf(await a.post('/guru/topics', {}))).toEqual({ name: CLASS_MESSAGES.topicName, chapterId: CLASS_MESSAGES.topicParent })
      expect(fieldsOf(await a.post('/guru/topics', { name: 'T', chapterId: '999999' }))).toEqual({ chapterId: CLASS_MESSAGES.topicParent })
      expect(fieldsOf(await a.post('/guru/topics', { name: ' ', chapterId }))).toEqual({ name: CLASS_MESSAGES.topicName })
    })

    it('the writes need the teacher role and CSRF', async () => {
      const student = await client(t, STUDENT_1)
      errorIs(await student.post('/guru/chapters', {}), 403, 'FORBIDDEN', 'This action is unauthorized.')
      const res = await a.who.agent.post('/api/guru/topics').send({ name: 'T', chapterId: '1' })
      expect(res.status).toBe(403)
      expect(res.body.error.code).toBe('CSRF_INVALID')
    })
  })

  describe('contributions and gallery', () => {
    it('contributions: tiers reached and the breakdown folds the rest into "Lain"', async () => {
      // BE-09 ports were set in the dashboard test of this file: 12 contributed questions.
      const body = TeacherContributionsSchema.parse((await a.get('/guru/contributions')).body)
      expect(body.stats).toEqual({ total: 12, approved: 7, pending: 3, used: 2 })
      expect(body.tiers.filter((x) => x.reached).map((x) => x.name)).toEqual(['Penyumbang Baru'])
      expect(body.nextTier).toEqual({ name: 'Penyumbang Aktif', threshold: 100 })
    })

    it('galeri-rajah: empty folders, empty images with a folder', async () => {
      expect(TeacherGallerySchema.parse((await a.get('/guru/galeri-rajah')).body)).toEqual({ folders: [] })
      expect((await a.get('/guru/galeri-rajah?folder=x')).body).toEqual({ images: [] })
      expect((await a.get('/guru/galeri-rajah?folder=%20')).body).toEqual({ folders: [] })
      expect((await a.get('/guru/galeri-rajah?folder=a&folder=b')).body).toEqual({ images: [] })
    })
  })
})
