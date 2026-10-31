import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { PrismaService } from '../../src/db/prisma.service'
import { ClassesPorts } from '../../src/modules/classes'
import { PracticePorts, type AssignmentResolution } from '../../src/modules/practice'
import { PracticeAssignmentsAdapter } from '../../src/modules/classes/missions/practice-assignments.adapter'
import { QuestionSetAssignments } from '../../src/modules/classes/question-sets'
import { START, TEACHER_B, bootMissionsApp, client, draftMcq, idOfEmail, insertMission, insertRemedial, loadWorld, makeClass, publishedMcq, type MissionsTestApp, type World } from './helpers'

const AT = new Date(START)

describe('BE-12 assignment source (missions, remedial) and the BE-17 missions provider', () => {
  let t: MissionsTestApp
  let w: World
  let adapter: PracticeAssignmentsAdapter
  let eligible: string[]
  let pool: string[]
  let draft: string

  const resolve = (kind: 'mission' | 'remedial' | 'question_set', userId: string, id: string, at = AT): Promise<AssignmentResolution> =>
    adapter.resolve(kind, { userId, id, at })

  beforeAll(async () => {
    t = await bootMissionsApp()
    w = await loadWorld(t)
    adapter = t.get(PracticeAssignmentsAdapter)
    eligible = []
    for (let i = 0; i < 12; i++) eligible.push(await publishedMcq(t, w, { text: `Soalan misi ${String(i)}` }))
    draft = await draftMcq(t, w)
    // Six of them are in the SPM pool, three in one chapter.
    for (const id of eligible.slice(0, 6)) await t.db.query(`insert into question_tags (question_id, kind, code) values ($1, 'pool', 'spm')`, [id])
    // The SPM pool of the subject: every eligible tagged question (a seeded one may be tagged already).
    const tagged = new Set((await t.db.query<{ id: string }>(`select question_id::text id from question_tags where kind = 'pool'`)).map((r) => r.id))
    const ofSubject = await t.db.query<{ id: string }>(
      `select q.id::text id from questions q join question_versions v on v.question_id = q.id and v.version_no = q.live_version_no
        where q.is_active and v.status = 'approved' and v.type = 'mcq' and v.subject_id = $1`,
      [w.tag.subjectId],
    )
    pool = ofSubject.map((r) => r.id).filter((id) => tagged.has(id))
  }, 180_000)
  afterAll(async () => {
    await t.close()
  })

  it('the real app binds the adapter on PracticePorts', () => {
    expect(t.get(PracticePorts).assignments).toBe(adapter)
  })

  describe('mission', () => {
    it('unknown, malformed, not a recipient and wrong day are not_found', async () => {
      const m = await insertMission(t, w, { teacherId: w.teacherA, recipients: [w.student1] })
      const past = await insertMission(t, w, { teacherId: w.teacherA, recipients: [w.student1], day: '2026-10-18' })
      expect(await resolve('mission', w.student2, m)).toEqual({ status: 'not_found' })
      expect(await resolve('mission', w.teacherA, m)).toEqual({ status: 'not_found' })
      expect(await resolve('mission', w.student1, '987654321')).toEqual({ status: 'not_found' })
      for (const id of ['abc', '0', '-1', '1.5', '']) expect(await resolve('mission', w.student1, id)).toEqual({ status: 'not_found' })
      expect(await resolve('mission', w.student1, past)).toEqual({ status: 'not_found' })
      expect(await resolve('mission', w.student1, m, new Date('2026-10-20T00:00:00+08:00'))).toEqual({ status: 'not_found' })
      expect((await resolve('mission', w.student1, m, new Date('2026-10-19T00:00:00+08:00'))).status).toBe('ok')
    })

    it('a recipient gets the subject, the mission coin rate and eligible question ids only, deterministic per (mission, pupil)', async () => {
      const m = await insertMission(t, w, { teacherId: w.teacherA, recipients: [w.student1, w.student2], questionCount: 5 })
      const res = await resolve('mission', w.student1, m)
      expect(res).toMatchObject({ status: 'ok', subjectId: w.tag.subjectId, coinsPerCorrect: 3 })
      if (res.status !== 'ok') throw new Error('unreachable')
      expect(res.questionIds).toHaveLength(5)
      expect(res.questionIds.every((id) => pool.includes(id))).toBe(true) // "Semua Bab": the SPM pool of the subject
      expect(res.questionIds).not.toContain(draft)
      expect(await resolve('mission', w.student1, m)).toEqual(res)
      const other = await resolve('mission', w.student2, m)
      expect(other.status === 'ok' && other.questionIds).toHaveLength(5)
    })

    it('a mission with a chapter draws from that chapter; an empty chapter falls back to the SPM pool', async () => {
      const chapters = await t.db.query<{ id: string }>(`select id::text from chapters where subject_id = $1 and in_tree order by id limit 2`, [w.tag.subjectId])
      const [withQ, empty] = [chapters[0]?.id as string, chapters[1]?.id as string]
      const inChapter = eligible.slice(6, 9)
      for (const id of inChapter) await t.db.query(`update question_versions set chapter_id = $2 where question_id = $1`, [id, withQ])
      const a = await insertMission(t, w, { teacherId: w.teacherA, recipients: [w.student1], chapterId: withQ, questionCount: 10 })
      const ra = await resolve('mission', w.student1, a)
      expect(ra.status === 'ok' && [...ra.questionIds].sort()).toEqual([...inChapter].sort())
      const b = await insertMission(t, w, { teacherId: w.teacherA, recipients: [w.student1], chapterId: empty, questionCount: 10 })
      const rb = await resolve('mission', w.student1, b)
      expect(rb.status === 'ok' && [...rb.questionIds].sort()).toEqual([...pool].sort())
    })

    it('a question taken out of service is not drawn (deactivated or archived)', async () => {
      const m = await insertMission(t, w, { teacherId: w.teacherA, recipients: [w.student1], questionCount: 20 })
      await t.db.query(`update questions set is_active = false where id = $1`, [pool[0]])
      const res = await resolve('mission', w.student1, m)
      expect(res.status === 'ok' && res.questionIds).not.toContain(pool[0])
      expect(res.status === 'ok' && [...res.questionIds].sort()).toEqual(pool.slice(1).sort())
      await t.db.query(`update questions set is_active = true where id = $1`, [pool[0]])
    })

    it('tracking_a and youtube have no question source yet (the mock\'s TODO): ok with an empty list', async () => {
      for (const type of ['tracking_a', 'youtube'] as const) {
        const m = await insertMission(t, w, { teacherId: w.teacherA, recipients: [w.student1], type })
        expect(await resolve('mission', w.student1, m)).toMatchObject({ status: 'ok', questionIds: [] })
      }
    })
  })

  describe('remedial', () => {
    it('only the test\'s own pupil: items in position order; cancelled and unknown are not_found; completed says so', async () => {
      const [a, b, c] = eligible.slice(0, 3) as [string, string, string]
      const active = await insertRemedial(t, w, { teacherId: w.teacherA, studentId: w.student1, questionIds: [c, a, b] })
      const done = await insertRemedial(t, w, { teacherId: w.teacherA, studentId: w.student1, status: 'completed', questionIds: [a, b] })
      const cancelled = await insertRemedial(t, w, { teacherId: w.teacherA, studentId: w.student1, status: 'cancelled', questionIds: [a] })
      expect(await resolve('remedial', w.student1, active)).toEqual({ status: 'ok', subjectId: w.tag.subjectId, questionIds: [c, a, b] })
      expect(await resolve('remedial', w.student1, done)).toEqual({ status: 'ok', subjectId: w.tag.subjectId, questionIds: [a, b], completed: true })
      expect(await resolve('remedial', w.student1, cancelled)).toEqual({ status: 'not_found' })
      expect(await resolve('remedial', w.student2, active)).toEqual({ status: 'not_found' })
      expect(await resolve('remedial', w.teacherA, active)).toEqual({ status: 'not_found' })
      expect(await resolve('remedial', w.student1, '987654321')).toEqual({ status: 'not_found' })
      expect(await resolve('remedial', w.student1, 'abc')).toEqual({ status: 'not_found' })
    })

    it('remedialCompleted writes inside the given transaction: rolled back with it, committed with it', async () => {
      await t.db.query(`delete from remedial_tests`)
      const id = await insertRemedial(t, w, { teacherId: w.teacherA, studentId: w.student1, questionIds: [eligible[0] as string] })
      const prisma = t.get(PrismaService)
      const input = { remedialTestId: id, userId: w.student1, afterAccuracy: 66.666, completedAt: new Date('2026-10-19T09:30:00+08:00'), isTest: false }
      await expect(
        prisma.transaction(async (tx) => {
          await adapter.remedialCompleted(input, tx)
          throw new Error('rollback')
        }),
      ).rejects.toThrow('rollback')
      expect((await t.db.query<{ status: string }>(`select status from remedial_tests where id = $1`, [id]))[0]?.status).toBe('active')
      await prisma.transaction((tx) => adapter.remedialCompleted(input, tx))
      const [row] = await t.db.query<{ status: string; after: number; completed_at: Date }>(`select status, after_accuracy::float8 after, completed_at from remedial_tests where id = $1`, [id])
      expect(row?.status).toBe('completed')
      expect(row?.after).toBe(66.7)
      expect(row?.completed_at.toISOString()).toBe('2026-10-19T01:30:00.000Z')
    })

    it('remedialCompleted never flips a test of the other mode: a Mod Pelajar session leaves a real test active, and a real session a test-mode one', async () => {
      await t.db.query(`delete from remedial_tests`)
      const prisma = t.get(PrismaService)
      const real = await insertRemedial(t, w, { teacherId: w.teacherA, studentId: w.student1, subjectId: w.tag.subjectId, questionIds: [eligible[0] as string] })
      const completedAt = new Date('2026-10-19T10:00:00+08:00')
      await prisma.transaction((tx) => adapter.remedialCompleted({ remedialTestId: real, userId: w.student1, afterAccuracy: 90, completedAt, isTest: true }, tx))
      expect((await t.db.query<{ status: string }>(`select status from remedial_tests where id = $1`, [real]))[0]?.status).toBe('active')
      await prisma.transaction((tx) => adapter.remedialCompleted({ remedialTestId: real, userId: w.student1, afterAccuracy: 90, completedAt, isTest: false }, tx))
      expect((await t.db.query<{ status: string }>(`select status from remedial_tests where id = $1`, [real]))[0]?.status).toBe('completed')
      const test = await insertRemedial(t, w, { teacherId: w.teacherC, studentId: w.student1, isTest: true, questionIds: [eligible[0] as string] })
      await prisma.transaction((tx) => adapter.remedialCompleted({ remedialTestId: test, userId: w.student1, afterAccuracy: 90, completedAt, isTest: false }, tx))
      expect((await t.db.query<{ status: string }>(`select status from remedial_tests where id = $1`, [test]))[0]?.status).toBe('active')
      await prisma.transaction((tx) => adapter.remedialCompleted({ remedialTestId: test, userId: w.student1, afterAccuracy: 90, completedAt, isTest: true }, tx))
      expect((await t.db.query<{ status: string }>(`select status from remedial_tests where id = $1`, [test]))[0]?.status).toBe('completed')
    })

    it('remedialCompleted is idempotent and never touches another pupil\'s, a cancelled or an unknown test', async () => {
      const prisma = t.get(PrismaService)
      const done = await insertRemedial(t, w, { teacherId: w.teacherA, studentId: w.student1, status: 'completed', after: 70, questionIds: [eligible[0] as string] })
      const foreign = await insertRemedial(t, w, { teacherId: w.teacherA, studentId: w.student2, questionIds: [eligible[0] as string] })
      const cancelled = await insertRemedial(t, w, { teacherId: w.teacherA, studentId: w.student1, status: 'cancelled', questionIds: [eligible[0] as string] })
      const completedAt = new Date('2026-10-19T10:00:00+08:00')
      await prisma.transaction(async (tx) => {
        for (const remedialTestId of [done, foreign, cancelled, '987654321', 'abc']) {
          await adapter.remedialCompleted({ remedialTestId, userId: w.student1, afterAccuracy: 10, completedAt, isTest: false }, tx)
        }
      })
      const rows = await t.db.query<{ id: string; status: string; after: number | null }>(`select id::text, status, after_accuracy::float8 after from remedial_tests where id = any($1::bigint[]) order by id`, [[done, foreign, cancelled]])
      expect(rows).toEqual([
        { id: done, status: 'completed', after: 70 },
        { id: foreign, status: 'active', after: null },
        { id: cancelled, status: 'cancelled', after: null },
      ])
    })
  })

  describe('question_set and the teacher missions provider', () => {
    it('question_set is delegated to QuestionSetAssignments.resolve', async () => {
      const spy = vi.spyOn(QuestionSetAssignments.prototype, 'resolve').mockResolvedValue({ status: 'ok', subjectId: '7', questionIds: ['1'], maxAttempts: 2 })
      try {
        expect(await resolve('question_set', w.student1, '5')).toEqual({ status: 'ok', subjectId: '7', questionIds: ['1'], maxAttempts: 2 })
        expect(spy).toHaveBeenCalledWith({ userId: w.student1, id: '5', at: AT })
      } finally {
        spy.mockRestore()
      }
    })

    it('ClassesPorts.missions.hasMission is bound: false until the teacher has a mission, then true (dashboard checklist too)', async () => {
      const teacherB = await idOfEmail(t, TEACHER_B)
      await makeClass(t, w, teacherB, [w.student1])
      const ports = t.get(ClassesPorts)
      const teacher = await client(t, TEACHER_B)
      const before = await teacher.get('/guru/dashboard')
      expect(before.body.data.checklist.hasMission).toBe(false)
      expect(await ports.missions.hasMission(teacherB)).toBe(false)
      await insertMission(t, w, { teacherId: teacherB, recipients: [w.student1] })
      expect(await ports.missions.hasMission(teacherB)).toBe(true)
      expect(await ports.missions.hasMission(w.teacherC)).toBe(false)
      expect(await ports.missions.hasMission('987654321')).toBe(false)
      expect((await teacher.get('/guru/dashboard')).body.data.checklist.hasMission).toBe(true)
    })
  })
})
