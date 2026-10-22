import { QuestionSetStudentListSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { QuestionSetAssignments } from '../../src/modules/classes/question-sets'
import {
  STUDENT_1,
  STUDENT_2,
  TEACHER_A,
  TEACHER_C,
  bootQsApp,
  classWith,
  client,
  eligibleQuestionIds,
  expectNoStore,
  idOfEmail,
  insertSet,
  insertSession,
  type Client,
  type QsTestApp,
} from './qs-helpers'

describe('BE-18 B: GET /set-soalan-saya and QuestionSetAssignments', () => {
  let t: QsTestApp
  let teacher: Client
  let s1: Client
  let s2: Client
  let teacherId: string
  let s1Id: string
  let s2Id: string
  let qs: string[]
  let cls: { id: string }
  let other: { id: string }
  const NOW = '2026-10-19T09:00:00+08:00'

  beforeAll(async () => {
    t = await bootQsApp()
    teacher = await client(t, TEACHER_A)
    s1 = await client(t, STUDENT_1)
    s2 = await client(t, STUDENT_2)
    teacherId = await idOfEmail(t, TEACHER_A)
    s1Id = await idOfEmail(t, STUDENT_1)
    s2Id = await idOfEmail(t, STUDENT_2)
    qs = await eligibleQuestionIds(t, 6)
    cls = await classWith(t, teacher, [s1], 'Kelas Satu')
    other = await classWith(t, teacher, [s2], 'Kelas Dua')
  })
  afterAll(async () => {
    await t.close()
  })

  const list = async (c: Client) => {
    const res = await c.get('/set-soalan-saya')
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    return QuestionSetStudentListSchema.parse(res.body).data
  }

  it('shows the sets of the caller\'s own active classes only, oldest first, with the contract shape', async () => {
    const second = await insertSet(t, { teacherId, classroomId: cls.id, title: 'Set Kedua', createdAt: '2026-10-02T10:00:00+08:00', questionIds: qs.slice(0, 2), timeLimitMinutes: 30, maxAttempts: 2 })
    const first = await insertSet(t, { teacherId, classroomId: cls.id, title: 'Set Pertama', createdAt: '2026-10-01T10:00:00+08:00', questionIds: qs.slice(0, 3), maxAttempts: 0 })
    await insertSet(t, { teacherId, classroomId: other.id, title: 'Set Kelas Lain', questionIds: qs.slice(0, 1) })
    const res = await s1.get('/set-soalan-saya')
    expectNoStore(res)
    expect(res.body.meta).toMatchObject({ page: 1, totalItems: 2 })
    const rows = await list(s1)
    expect(rows.map((r) => r.id)).toEqual([first, second])
    expect(rows[0]).toEqual({ id: first, title: 'Set Pertama', teacherName: expect.any(String), questionCount: 3, timeLimitMinutes: null, attemptsLeft: null })
    expect(rows[1]).toMatchObject({ id: second, questionCount: 2, timeLimitMinutes: 30, attemptsLeft: 2 })
    // the other student sees only her own class
    expect((await list(s2)).map((r) => r.title)).toEqual(['Set Kelas Lain'])
  })

  it('hides a set of a class after the enrolment was removed', async () => {
    const c = await classWith(t, teacher, [s1], 'Kelas Keluar')
    await insertSet(t, { teacherId, classroomId: c.id, title: 'Set Keluar', questionIds: qs.slice(0, 1) })
    expect((await list(s1)).map((r) => r.title)).toContain('Set Keluar')
    await t.db.query(`update enrolments set status = 'removed' where classroom_id = $1 and student_id = $2`, [c.id, s1Id])
    expect((await list(s1)).map((r) => r.title)).not.toContain('Set Keluar')
  })

  it('never shows a draft; shows a scheduled set only once due', async () => {
    const c = await classWith(t, teacher, [s2], 'Kelas Jadual')
    await insertSet(t, { teacherId, classroomId: c.id, title: 'Draf', status: 'draft', questionIds: qs.slice(0, 1) })
    await insertSet(t, { teacherId, classroomId: c.id, title: 'Belum Tiba', status: 'scheduled', scheduledAt: '2026-10-19T09:10:00+08:00', questionIds: qs.slice(0, 1) })
    await insertSet(t, { teacherId, classroomId: c.id, title: 'Sudah Tiba', status: 'scheduled', scheduledAt: '2026-10-19T09:00:00+08:00', questionIds: qs.slice(0, 1) })
    await insertSet(t, { teacherId, classroomId: c.id, title: 'Terbit', status: 'published', questionIds: qs.slice(0, 1) })
    const titles = (await list(s2)).map((r) => r.title)
    expect(titles).toContain('Sudah Tiba')
    expect(titles).toContain('Terbit')
    expect(titles).not.toContain('Draf')
    expect(titles).not.toContain('Belum Tiba')
    t.clock.advance(11 * 60 * 1000)
    expect((await list(s2)).map((r) => r.title)).toContain('Belum Tiba')
    t.clock.set(NOW)
  })

  it('attemptsLeft = maxAttempts minus completed sessions, floored at 0, null when unlimited; in-progress does not count', async () => {
    const c = await classWith(t, teacher, [s1], 'Kelas Cubaan')
    const set = await insertSet(t, { teacherId, classroomId: c.id, title: 'Cubaan', maxAttempts: 3, questionIds: qs.slice(0, 2) })
    const find = async () => (await list(s1)).find((r) => r.id === set)
    expect((await find())?.attemptsLeft).toBe(3)
    await insertSession(t, { userId: s1Id, setId: set, status: 'completed' })
    await insertSession(t, { userId: s1Id, setId: set, status: 'in_progress' })
    expect((await find())?.attemptsLeft).toBe(2)
    await insertSession(t, { userId: s1Id, setId: set, status: 'completed' })
    await insertSession(t, { userId: s1Id, setId: set, status: 'completed' })
    await insertSession(t, { userId: s1Id, setId: set, status: 'completed' })
    expect((await find())?.attemptsLeft).toBe(0)
    // another student's attempts are not mine
    expect((await list(s2)).find((r) => r.id === set)).toBeUndefined()
  })

  it('a migrated set (needs_rebuild) keeps its header with questionCount 0', async () => {
    const c = await classWith(t, teacher, [s1], 'Kelas Migrasi')
    const set = await insertSet(t, { teacherId, classroomId: c.id, title: 'Migrasi', needsRebuild: true, questionIds: qs.slice(0, 2) })
    const row = (await list(s1)).find((r) => r.id === set)
    expect(row).toMatchObject({ title: 'Migrasi', questionCount: 0 })
  })

  it('a deactivated question is skipped in the count and the serving, never deleted from the set', async () => {
    const c = await classWith(t, teacher, [s1], 'Kelas Nyahaktif')
    const set = await insertSet(t, { teacherId, classroomId: c.id, title: 'Nyahaktif', questionIds: qs.slice(0, 4) })
    await t.db.query(`update questions set is_active = false where id = $1`, [qs[1]])
    expect((await list(s1)).find((r) => r.id === set)?.questionCount).toBe(3)
    const resolved = await t.get(QuestionSetAssignments).resolve({ userId: s1Id, id: set, at: new Date(NOW) })
    expect(resolved).toMatchObject({ status: 'ok', questionIds: [qs[0], qs[2], qs[3]] })
    const stored = await t.db.query(`select 1 from question_set_items where question_set_id = $1`, [set])
    expect(stored).toHaveLength(4)
    await t.db.query(`update questions set is_active = true where id = $1`, [qs[1]])
    // a question whose live version is not published is skipped too
    await t.db.query(`update question_versions set status = 'draft' where question_id = $1 and version_no = 1`, [qs[0]])
    expect((await list(s1)).find((r) => r.id === set)?.questionCount).toBe(3)
    await t.db.query(`update question_versions set status = 'published' where question_id = $1 and version_no = 1`, [qs[0]])
  })

  describe('QuestionSetAssignments.resolve', () => {
    const at = new Date(NOW)
    it('ok with eligible ids in position order, timeLimitSec and maxAttempts', async () => {
      const set = await insertSet(t, { teacherId, classroomId: cls.id, title: 'Urutan', timeLimitMinutes: 15, maxAttempts: 4, questionIds: [qs[3] as string, qs[0] as string, qs[2] as string] })
      const r = await t.get(QuestionSetAssignments).resolve({ userId: s1Id, id: set, at })
      expect(r).toEqual({ status: 'ok', subjectId: null, questionIds: [qs[3], qs[0], qs[2]], timeLimitSec: 900, maxAttempts: 4 })
    })

    it('null time limit gives null seconds; unlimited attempts is 0; the subject id is passed through', async () => {
      const subj = (await t.db.query<{ id: string }>(`select id::text id from subjects order by id limit 1`))[0]?.id as string
      const set = await insertSet(t, { teacherId, classroomId: cls.id, title: 'Tanpa had', timeLimitMinutes: null, maxAttempts: 0, subjectId: subj, questionIds: [qs[0] as string] })
      expect(await t.get(QuestionSetAssignments).resolve({ userId: s1Id, id: set, at })).toMatchObject({ status: 'ok', subjectId: subj, timeLimitSec: null, maxAttempts: 0 })
    })

    it('not_found for a non-member, another class, a draft, a not-due set, an unknown or malformed id', async () => {
      const a = t.get(QuestionSetAssignments)
      const draft = await insertSet(t, { teacherId, classroomId: cls.id, status: 'draft', questionIds: [qs[0] as string] })
      const future = await insertSet(t, { teacherId, classroomId: cls.id, status: 'scheduled', scheduledAt: '2026-10-25T09:00:00+08:00', questionIds: [qs[0] as string] })
      const mine = await insertSet(t, { teacherId, classroomId: cls.id, questionIds: [qs[0] as string] })
      expect(await a.resolve({ userId: s1Id, id: draft, at })).toEqual({ status: 'not_found' })
      expect(await a.resolve({ userId: s1Id, id: future, at })).toEqual({ status: 'not_found' })
      expect(await a.resolve({ userId: s1Id, id: mine, at: new Date('2026-10-26T09:00:00+08:00') })).toMatchObject({ status: 'ok' })
      expect(await a.resolve({ userId: s1Id, id: future, at: new Date('2026-10-26T09:00:00+08:00') })).toMatchObject({ status: 'ok' })
      // s2 is not in `cls`
      expect(await a.resolve({ userId: s2Id, id: mine, at })).toEqual({ status: 'not_found' })
      expect(await a.resolve({ userId: s1Id, id: '999999999', at })).toEqual({ status: 'not_found' })
      expect(await a.resolve({ userId: s1Id, id: 'abc', at })).toEqual({ status: 'not_found' })
      // a removed enrolment is not a member
      const c = await classWith(t, teacher, [s2], 'Kelas Resolve')
      const set = await insertSet(t, { teacherId, classroomId: c.id, questionIds: [qs[0] as string] })
      expect(await a.resolve({ userId: s2Id, id: set, at })).toMatchObject({ status: 'ok' })
      await t.db.query(`update enrolments set status = 'removed' where classroom_id = $1 and student_id = $2`, [c.id, s2Id])
      expect(await a.resolve({ userId: s2Id, id: set, at })).toEqual({ status: 'not_found' })
    })

    it('a migrated set resolves with no questions', async () => {
      const set = await insertSet(t, { teacherId, classroomId: cls.id, needsRebuild: true, questionIds: [qs[0] as string] })
      expect(await t.get(QuestionSetAssignments).resolve({ userId: s1Id, id: set, at })).toMatchObject({ status: 'ok', questionIds: [] })
    })
  })

  describe('guards', () => {
    it('anonymous is 401 with the Laravel text', async () => {
      const res = await t.http().get('/api/set-soalan-saya')
      expect(res.status).toBe(401)
      expect(res.body.error).toMatchObject({ code: 'UNAUTHORIZED', message: 'Unauthenticated.' })
    })

    it('any signed-in role may call it (teacher and other-school teacher get their own, empty, list)', async () => {
      const res = await teacher.get('/set-soalan-saya')
      expect(res.status).toBe(200)
      expect(res.body.data).toEqual([])
      const c = await client(t, TEACHER_C)
      expect((await c.get('/set-soalan-saya')).status).toBe(200)
    })
  })
})
