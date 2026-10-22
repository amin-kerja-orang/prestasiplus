import { RemedialProgressSchema, RemedialScanSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { ClassesRepository } from '../../src/modules/classes'
import {
  ADMIN, STUDENT_1, TEACHER_A, TEACHER_B, TEACHER_C,
  addAnswers, bootMissionsApp, client, errorIs, idOfEmail, insertRemedial, loadWorld, makeClass, publishedMcq,
  type Client, type MissionsTestApp, type World,
} from './helpers'

describe('teacher remedial progress and Command Center scan (S3, BR-M10-11, BR-M10-13)', () => {
  let t: MissionsTestApp
  let w: World
  let teacherA: Client
  let teacherC: Client
  let student: Client

  beforeAll(async () => {
    t = await bootMissionsApp()
    w = await loadWorld(t)
    teacherA = await client(t, TEACHER_A)
    teacherC = await client(t, TEACHER_C)
    student = await client(t, STUDENT_1)
  }, 120_000)
  afterAll(async () => {
    await t.close()
  })

  describe('guards', () => {
    const routes = ['/guru/remedial-progress', '/guru/command-center/remedial/scan']

    it('401 anonymous and 403 "This action is unauthorized." for a pupil on both reads', async () => {
      for (const path of routes) {
        errorIs(await t.http().get(`/api${path}`), 401, 'UNAUTHORIZED', 'Unauthenticated.')
        errorIs(await student.get(path), 403, 'FORBIDDEN', 'This action is unauthorized.')
      }
    })

    it('403 for a school admin; an admin is allowed (teacher or admin)', async () => {
      const schoolAdmin = await client(t, 'adminsekolah@demo.test')
      const admin = await client(t, ADMIN)
      for (const path of routes) {
        errorIs(await schoolAdmin.get(path), 403, 'FORBIDDEN', 'This action is unauthorized.')
        expect((await admin.get(path)).status).toBe(200)
      }
    })

    it('answers no-store', async () => {
      for (const path of routes) expect((await teacherA.get(path)).headers['cache-control']).toBe('no-store')
    })
  })

  describe('GET /guru/remedial-progress', () => {
    it('is zero and empty for a teacher without tests, bare body (no data envelope)', async () => {
      const res = await teacherA.get('/guru/remedial-progress')
      expect(res.status).toBe(200)
      expect(res.body).toEqual({ stats: { total: 0, completed: 0, students: 0, avgImprovement: 0 }, rows: [] })
    })

    it('counts the caller\'s tests: cancelled ones are listed but not counted, newest first, average gain rounded', async () => {
      const q = await publishedMcq(t, w)
      const a = await insertRemedial(t, w, { teacherId: w.teacherA, studentId: w.student1, status: 'completed', before: 40, after: 70, questionIds: [q], createdAt: '2026-10-01T09:00:00+08:00' })
      const b = await insertRemedial(t, w, { teacherId: w.teacherA, studentId: w.student2, status: 'completed', before: 50.5, after: 61, questionIds: [q], createdAt: '2026-10-05T09:00:00+08:00' })
      const c = await insertRemedial(t, w, { teacherId: w.teacherA, studentId: w.student1, status: 'active', before: 30, questionIds: [q], createdAt: '2026-10-10T09:00:00+08:00' })
      const d = await insertRemedial(t, w, { teacherId: w.teacherA, studentId: w.student2, status: 'cancelled', before: 20, questionIds: [q], createdAt: '2026-10-15T09:00:00+08:00' })
      const foreign = await insertRemedial(t, w, { teacherId: w.teacherC, studentId: w.studentOther, status: 'completed', before: 10, after: 90, questionIds: [q] })
      const body = RemedialProgressSchema.parse((await teacherA.get('/guru/remedial-progress')).body)
      // gains 30 and 10.5, mean 20.25 -> 20
      expect(body.stats).toEqual({ total: 3, completed: 2, students: 2, avgImprovement: 20 })
      expect(body.rows.map((r) => r.id)).toEqual([d, c, b, a])
      expect(body.rows.map((r) => r.id)).not.toContain(foreign)
      expect(body.rows[0]).toEqual({ id: d, studentName: expect.stringMatching(/\S/), subjectName: w.subjectName, status: 'cancelled', beforeAccuracy: 20, afterAccuracy: null })
      expect(body.rows[2]).toMatchObject({ id: b, status: 'completed', beforeAccuracy: 50.5, afterAccuracy: 61 })
      // the other teacher sees only their own, an admin owns none
      expect(RemedialProgressSchema.parse((await teacherC.get('/guru/remedial-progress')).body).rows.map((r) => r.id)).toEqual([foreign])
      expect((await (await client(t, ADMIN)).get('/guru/remedial-progress')).body.rows).toEqual([])
    })

    it('a negative mean improvement stays negative', async () => {
      const q = await publishedMcq(t, w)
      const teacherB = await client(t, TEACHER_B)
      const teacherBId = await idOfEmail(t, TEACHER_B)
      await insertRemedial(t, w, { teacherId: teacherBId, studentId: w.student1, status: 'completed', before: 90, after: 40, questionIds: [q] })
      const stats = RemedialProgressSchema.parse((await teacherB.get('/guru/remedial-progress')).body).stats
      expect(stats).toEqual({ total: 1, completed: 1, students: 1, avgImprovement: -50 })
    })
  })

  describe('GET /guru/command-center/remedial/scan (BR-M10-11)', () => {
    let spB: string
    let spC: string
    let qx: string[]
    let qy: string[]
    let qz: string[]
    let chapter: { id: string; name: string }
    let existing: string

    beforeAll(async () => {
      await t.db.query(`delete from remedial_tests`)
      const sps = await t.db.query<{ id: string }>(
        `select id::text from curriculum_nodes where kind = 'sp' and subject_id = $1 and education_level_id = $2 and id <> $3 order by id limit 2`,
        [w.tag.subjectId, w.tag.levelId, w.tag.spId],
      )
      spB = sps[0]?.id as string
      spC = sps[1]?.id as string
      expect(spB && spC).toBeTruthy()
      qx = [await publishedMcq(t, w), await publishedMcq(t, w), await publishedMcq(t, w), await publishedMcq(t, w)] // SP A
      qy = [await publishedMcq(t, w, { spId: spB }), await publishedMcq(t, w, { spId: spB })]
      qz = [await publishedMcq(t, w, { spId: spC }), await publishedMcq(t, w, { spId: spC })]
      chapter = (await t.db.query<{ id: string; name: string }>(`select id::text, name from chapters where subject_id = $1 and in_tree and name is not null order by id limit 1`, [w.tag.subjectId]))[0] as { id: string; name: string }
      await makeClass(t, w, w.teacherA, [w.student1, w.student2])
      await makeClass(t, w, w.teacherC, [w.studentOther], 'Kelas Lain')
      // student 1: SP A 1/4 = 25 (weak), SP B 0/2 = 0 (weak), SP C 1/2 = 50 (not weak), chapter topic 0/2 (weak)
      await addAnswers(t, w, w.student1, [
        { questionId: qx[0] as string, correct: true }, { questionId: qx[1] as string, correct: false }, { questionId: qx[2] as string, correct: false }, { questionId: qx[3] as string, correct: false },
        { questionId: qy[0] as string, correct: false }, { questionId: qy[1] as string, correct: false },
        { questionId: qz[0] as string, correct: true }, { questionId: qz[1] as string, correct: false },
        { questionId: null, correct: false, chapterId: chapter.id }, { questionId: null, correct: false, chapterId: chapter.id },
        // under Mod Pelajar: never read for a real teacher
        { questionId: qz[0] as string, correct: false, isTest: true }, { questionId: qz[1] as string, correct: false, isTest: true },
      ])
      // student 2: SP A 1/3 = 33.3 (weak); one lone wrong answer on SP C (below the minimum of 2)
      await addAnswers(t, w, w.student2, [
        { questionId: qx[0] as string, correct: true }, { questionId: qx[1] as string, correct: false }, { questionId: qx[2] as string, correct: false },
        { questionId: qz[0] as string, correct: false },
      ])
      // another teacher's pupil is weak too
      await addAnswers(t, w, w.studentOther, [{ questionId: qx[0] as string, correct: false }, { questionId: qx[1] as string, correct: false }])
      existing = await insertRemedial(t, w, { teacherId: w.teacherA, studentId: w.student1, status: 'active', questionIds: [qx[0] as string], createdAt: '2026-10-18T09:00:00+08:00' })
      await insertRemedial(t, w, { teacherId: w.teacherA, studentId: w.student2, status: 'cancelled', questionIds: [qx[0] as string] })
    })

    it('lists weak students by weakest accuracy then id, weak topics ascending, with SP and chapter names', async () => {
      const res = await teacherA.get('/guru/command-center/remedial/scan')
      expect(res.status).toBe(200)
      const body = RemedialScanSchema.parse(res.body)
      expect(body.weakStudents.map((s) => s.studentId)).toEqual([w.student1, w.student2])
      const [one, two] = body.weakStudents
      expect(one?.weakestAccuracy).toBe(0)
      expect(one?.weakTopics.map((x) => x.accuracy)).toEqual([0, 0, 25])
      expect(one?.weakTopics.every((x) => x.subject === w.subjectName)).toBe(true)
      const names = (await t.db.query<{ id: string; title: string }>(`select id::text, title from curriculum_nodes where id = any($1::bigint[])`, [[w.tag.spId, spB]]))
      const titleOf = (id: string) => names.find((n) => n.id === id)?.title
      expect(one?.weakTopics.map((x) => x.topicName)).toContain(chapter.name)
      expect(one?.weakTopics.map((x) => x.topicName)).toContain(titleOf(spB))
      expect(one?.weakTopics.at(-1)?.topicName).toBe(titleOf(w.tag.spId))
      // SP C is exactly 50 (not weak) and the lone wrong answer of student 2 is below the minimum
      expect(two?.weakTopics).toEqual([{ subject: w.subjectName, topicName: titleOf(w.tag.spId), accuracy: 33.3 }])
      expect(two?.weakestAccuracy).toBe(33.3)
    })

    it('lists the caller\'s active and completed tests only, newest first (cancelled never)', async () => {
      const done = await insertRemedial(t, w, { teacherId: w.teacherA, studentId: w.student2, status: 'completed', before: 20, after: 60, questionIds: [qx[0] as string, qx[1] as string], createdAt: '2026-10-19T08:00:00+08:00' })
      const body = RemedialScanSchema.parse((await teacherA.get('/guru/command-center/remedial/scan')).body)
      expect(body.existingRemedials).toEqual([
        { id: done, studentId: w.student2, status: 'completed', totalQuestions: 2, afterAccuracy: 60 },
        { id: existing, studentId: w.student1, status: 'active', totalQuestions: 1, afterAccuracy: null },
      ])
    })

    it('sees only its own students: the other teacher gets their own pupil, an admin gets nothing', async () => {
      const other = RemedialScanSchema.parse((await teacherC.get('/guru/command-center/remedial/scan')).body)
      expect(other.weakStudents.map((s) => s.studentId)).toEqual([w.studentOther])
      expect(other.weakStudents[0]?.weakTopics[0]?.accuracy).toBe(0)
      expect(other.existingRemedials).toEqual([])
      expect((await (await client(t, ADMIN)).get('/guru/command-center/remedial/scan')).body).toEqual({ weakStudents: [], existingRemedials: [] })
    })

    it('a pupil removed from the class is no longer scanned', async () => {
      const classes = t.get(ClassesRepository)
      const own = await classes.forTeacher(w.teacherA)
      const roster = own[0]
      expect(roster).toBeDefined()
      await classes.unenrol((roster as { id: string }).id, w.student2, new Date())
      const body = RemedialScanSchema.parse((await teacherA.get('/guru/command-center/remedial/scan')).body)
      expect(body.weakStudents.map((s) => s.studentId)).toEqual([w.student1])
    })
  })
})
