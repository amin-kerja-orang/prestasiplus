import { RemedialMineResponseSchema, RemedialPreviewSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { QuestionsService } from '../../src/modules/questions'
import {
  ADMIN, STUDENT_1, STUDENT_2, TEACHER_A, TEACHER_B, TEACHER_C,
  bootMissionsApp, client, errorIs, idOfEmail, insertRemedial, loadWorld, publishedMcq,
  type Client, type MissionsTestApp, type World,
} from './helpers'

describe('remedial tests: student reads and the teacher preview (M05 #20, #20b)', () => {
  let t: MissionsTestApp
  let w: World
  let s1: Client
  let s2: Client
  let teacherA: Client
  let qs: string[]
  let teacherBId: string

  beforeAll(async () => {
    t = await bootMissionsApp()
    w = await loadWorld(t)
    s1 = await client(t, STUDENT_1)
    s2 = await client(t, STUDENT_2)
    teacherA = await client(t, TEACHER_A)
    teacherBId = await idOfEmail(t, TEACHER_B)
    qs = [await publishedMcq(t, w, { text: 'Soalan satu' }), await publishedMcq(t, w, { text: 'Soalan dua' }), await publishedMcq(t, w, { text: 'Soalan tiga' })]
  }, 120_000)
  afterAll(async () => {
    await t.close()
  })

  describe('GET /api/remedial-tests/mine', () => {
    it('401 for an anonymous caller', async () => {
      errorIs(await t.http().get('/api/remedial-tests/mine'), 401, 'UNAUTHORIZED', 'Unauthenticated.')
    })

    it('is an empty single-page list before any test exists', async () => {
      const res = await s1.get('/remedial-tests/mine')
      expect(res.status).toBe(200)
      expect(res.headers['cache-control']).toBe('no-store')
      expect(RemedialMineResponseSchema.parse(res.body).data).toEqual([])
    })

    it('lists the caller\'s active and completed tests newest first, never a cancelled one or another pupil\'s', async () => {
      const oldest = await insertRemedial(t, w, { teacherId: w.teacherA, studentId: w.student1, status: 'completed', questionIds: qs.slice(0, 2), createdAt: '2026-10-01T09:00:00+08:00' })
      const newest = await insertRemedial(t, w, { teacherId: teacherBId, studentId: w.student1, status: 'active', questionIds: qs, createdAt: '2026-10-18T09:00:00+08:00' })
      const middle = await insertRemedial(t, w, { teacherId: w.teacherC, studentId: w.student1, status: 'active', questionIds: qs.slice(0, 1), createdAt: '2026-10-10T09:00:00+08:00' })
      const cancelled = await insertRemedial(t, w, { teacherId: w.teacherA, studentId: w.student1, status: 'cancelled', questionIds: qs, createdAt: '2026-10-19T08:00:00+08:00' })
      const others = await insertRemedial(t, w, { teacherId: w.teacherA, studentId: w.student2, status: 'active', questionIds: qs })
      const data = RemedialMineResponseSchema.parse((await s1.get('/remedial-tests/mine')).body).data
      expect(data.map((r) => r.id)).toEqual([newest, middle, oldest])
      expect(data.map((r) => r.id)).not.toContain(cancelled)
      expect(data.map((r) => r.id)).not.toContain(others)
      expect(data[0]).toEqual({
        id: newest,
        subjectName: w.subjectName,
        totalQuestions: 3,
        status: 'active',
        createdAt: '2026-10-18T09:00:00.000+08:00',
        teacherName: expect.stringMatching(/\S/),
      })
      expect(data[2]?.status).toBe('completed')
      const other = RemedialMineResponseSchema.parse((await s2.get('/remedial-tests/mine')).body).data
      expect(other.map((r) => r.id)).toEqual([others])
    })

    it('hides tests written under Mod Pelajar (is_test) from a real pupil', async () => {
      const hidden = await insertRemedial(t, w, { teacherId: w.teacherA, studentId: w.student1, status: 'completed', questionIds: qs, isTest: true })
      const ids = RemedialMineResponseSchema.parse((await s1.get('/remedial-tests/mine')).body).data.map((r) => r.id)
      expect(ids).not.toContain(hidden)
    })

    it('"mine" is not read as an id: any signed-in role gets the list', async () => {
      for (const who of [TEACHER_A, ADMIN]) {
        const res = await (await client(t, who)).get('/remedial-tests/mine')
        expect(res.status).toBe(200)
        expect(res.body.data).toEqual([])
      }
    })
  })

  describe('GET /api/remedial-tests/:id (preview with the answer key)', () => {
    let test: string

    beforeAll(async () => {
      // Stored order differs from id order: position decides.
      test = await insertRemedial(t, w, { teacherId: w.teacherA, studentId: w.student1, questionIds: [qs[2] as string, qs[0] as string, qs[1] as string], createdAt: '2026-10-17T09:00:00+08:00' })
    })

    it('401 for an anonymous caller', async () => {
      errorIs(await t.http().get(`/api/remedial-tests/${test}`), 401, 'UNAUTHORIZED', 'Unauthenticated.')
    })

    it('the owner teacher reads it: questions in position order, options and the key, no-store', async () => {
      const res = await teacherA.get(`/remedial-tests/${test}`)
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(res.headers['cache-control']).toBe('no-store')
      const data = RemedialPreviewSchema.parse(res.body.data)
      expect(data).toMatchObject({ id: test, subjectName: w.subjectName, status: 'active', totalQuestions: 3, createdAt: '2026-10-17T09:00:00.000+08:00' })
      expect(data.teacherName).not.toBe('')
      expect(data.studentName).not.toBe('')
      expect(data.questions.map((q) => q.id)).toEqual([qs[2], qs[0], qs[1]])
      expect(data.questions.map((q) => q.questionText)).toEqual(['Soalan tiga', 'Soalan satu', 'Soalan dua'])
      expect(data.questions[0]).toMatchObject({
        textDirection: 'ltr',
        scriptType: 'rumi',
        correctOptionId: 1,
        options: [
          { id: 0, label: 'A', text: 'Satu' },
          { id: 1, label: 'B', text: 'Dua' },
          { id: 2, label: 'C', text: 'Tiga' },
          { id: 3, label: 'D', text: 'Empat' },
        ],
      })
    })

    it('an admin reads any test', async () => {
      const res = await (await client(t, ADMIN)).get(`/remedial-tests/${test}`)
      expect(res.status).toBe(200)
      expect(res.body.data.id).toBe(test)
    })

    it('404 "Not Found." for the assigned pupil, another pupil, a teacher of the same school and a teacher of another school', async () => {
      for (const who of [s1, s2, await client(t, TEACHER_B), await client(t, TEACHER_C)]) {
        errorIs(await who.get(`/remedial-tests/${test}`), 404, 'NOT_FOUND', 'Not Found.')
      }
    })

    it('404 "Not Found." for an unknown or malformed id, also for an admin', async () => {
      const admin = await client(t, ADMIN)
      for (const id of ['987654321', '0', 'abc', '1.5']) {
        errorIs(await teacherA.get(`/remedial-tests/${id}`), 404, 'NOT_FOUND', 'Not Found.')
        errorIs(await admin.get(`/remedial-tests/${id}`), 404, 'NOT_FOUND', 'Not Found.')
      }
    })

    it('shows a question that was withdrawn later (its latest version) and writes nothing', async () => {
      const svc = t.get(QuestionsService)
      const before = (await t.db.query<{ n: number }>(`select count(*)::int n from remedial_test_items`))[0]?.n
      await svc.setStatus(qs[0] as string, 'archived', w.admin)
      const data = RemedialPreviewSchema.parse((await teacherA.get(`/remedial-tests/${test}`)).body.data)
      expect(data.questions.map((q) => q.id)).toEqual([qs[2], qs[0], qs[1]])
      expect((await t.db.query<{ n: number }>(`select count(*)::int n from remedial_test_items`))[0]?.n).toBe(before)
    })
  })
})
