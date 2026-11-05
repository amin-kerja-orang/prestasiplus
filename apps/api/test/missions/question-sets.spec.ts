import { QuestionSetStudentListSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { QuestionSetAssignments } from '../../src/modules/classes/question-sets'
import { QuestionSetsRepository } from '../../src/modules/classes/question-sets/question-sets.repository'
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

  it('never shows a draft; a scheduled set is never shown (R1 produces only draft and published, DM-46)', async () => {
    const c = await classWith(t, teacher, [s2], 'Kelas Jadual')
    await insertSet(t, { teacherId, classroomId: c.id, title: 'Draf', status: 'draft', questionIds: qs.slice(0, 1) })
    await insertSet(t, { teacherId, classroomId: c.id, title: 'Belum Tiba', status: 'scheduled', scheduledAt: '2026-10-19T09:10:00+08:00', questionIds: qs.slice(0, 1) })
    await insertSet(t, { teacherId, classroomId: c.id, title: 'Sudah Tiba', status: 'scheduled', scheduledAt: '2026-10-19T09:00:00+08:00', questionIds: qs.slice(0, 1) })
    await insertSet(t, { teacherId, classroomId: c.id, title: 'Terbit', status: 'published', questionIds: qs.slice(0, 1) })
    const titles = (await list(s2)).map((r) => r.title)
    expect(titles).toContain('Terbit')
    expect(titles).not.toContain('Draf')
    expect(titles).not.toContain('Sudah Tiba')
    expect(titles).not.toContain('Belum Tiba')
    t.clock.advance(11 * 60 * 1000)
    expect((await list(s2)).map((r) => r.title)).not.toContain('Belum Tiba')
    t.clock.set(NOW)
  })

  describe('assignment through question_set_classrooms (S6-T14, DM-46)', () => {
    it('a set assigned to two classes shows once to a pupil of either, never to a pupil of a third class', async () => {
      const c1 = await classWith(t, teacher, [s1], 'Kelas Tugas Satu')
      const c2 = await classWith(t, teacher, [s2], 'Kelas Tugas Dua')
      const c3 = await classWith(t, teacher, [], 'Kelas Tugas Tiga')
      await t.db.query(`insert into enrolments (classroom_id, student_id, status, source) values ($1, $2, 'active', 'teacher')`, [c1.id, s2Id])
      await insertSet(t, { teacherId, classroomId: null, classroomIds: [c1.id, c2.id], title: 'Set Dua Kelas', questionIds: qs.slice(0, 2) })
      await insertSet(t, { teacherId, classroomId: null, classroomIds: [c3.id], title: 'Set Kelas Ketiga', questionIds: qs.slice(0, 1) })
      const forS2 = (await list(s2)).map((r) => r.title)
      expect(forS2.filter((x) => x === 'Set Dua Kelas')).toHaveLength(1)
      expect(forS2).not.toContain('Set Kelas Ketiga')
      expect((await list(s1)).map((r) => r.title)).toContain('Set Dua Kelas')
    })

    it('the legacy question_sets.classroom_id is not read: a row without an assignment is not shown or resolved', async () => {
      const c = await classWith(t, teacher, [s1], 'Kelas Warisan')
      const id = await insertSet(t, { teacherId, classroomId: c.id, classroomIds: [], title: 'Set Warisan', questionIds: qs.slice(0, 1) })
      expect((await list(s1)).map((r) => r.title)).not.toContain('Set Warisan')
      expect(await t.get(QuestionSetAssignments).resolve({ userId: s1Id, id, at: new Date(NOW) })).toEqual({ status: 'not_found' })
    })

    it('resolve works for a member of any assigned class and for kind kertas', async () => {
      const c1 = await classWith(t, teacher, [], 'Kelas Resolve Satu')
      const c2 = await classWith(t, teacher, [s1], 'Kelas Resolve Dua')
      const id = await insertSet(t, { teacherId, classroomId: null, classroomIds: [c1.id, c2.id], questionIds: qs.slice(0, 1) })
      expect(await t.get(QuestionSetAssignments).resolve({ userId: s1Id, id, at: new Date(NOW) })).toMatchObject({ status: 'ok' })
      const paper = await insertSet(t, { teacherId, classroomId: null, classroomIds: [c2.id], title: 'Kertas Kongsi', questionIds: qs.slice(0, 1) })
      await t.db.query(`update question_sets set kind = 'kertas' where id = $1`, [paper])
      expect((await list(s1)).map((r) => r.title)).toContain('Kertas Kongsi')
    })
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
    await t.db.query(`update question_versions set status = 'approved' where question_id = $1 and version_no = 1`, [qs[0]])
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
      // scheduled is never produced in R1 (DM-46): not served even when its time has passed
      expect(await a.resolve({ userId: s1Id, id: future, at: new Date('2026-10-26T09:00:00+08:00') })).toEqual({ status: 'not_found' })
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

  describe('a migrated header without a class (AZ-31, Q4 A, migration 0042)', () => {
    const at = new Date(NOW)
    let n = 0
    const header = (over: Partial<Parameters<typeof insertSet>[1]> = {}) =>
      insertSet(t, { teacherId, classroomId: null, title: 'Set Migrasi Tanpa Kelas', status: 'draft', needsRebuild: true, legacy: { source: 'cloud', id: `qs-${String(++n)}` }, ...over })

    it('the database accepts a NULL class for a header and for a draft (check dropped by 0201, S6-T14)', async () => {
      const ok = await header()
      expect((await t.db.query<{ classroom_id: string | null }>(`select classroom_id from question_sets where id = $1`, [ok]))[0]?.classroom_id).toBeNull()
      // A draft has no class now: the service rule "publish needs a class" replaces ck_question_sets_classroom_or_migrated.
      await expect(insertSet(t, { teacherId, classroomId: null, title: 'Draf tanpa kelas' })).resolves.toBeTruthy()
      await expect(t.db.query(`select 1 from pg_constraint where conname = 'ck_question_sets_classroom_or_migrated'`)).resolves.toHaveLength(0)
    })

    it('the repository maps the missing class to null', async () => {
      const id = await header()
      expect(await t.get(QuestionSetsRepository).get(id)).toMatchObject({ id, teacherId, classroomId: null, needsRebuild: true, status: 'draft' })
    })

    it('is never listed to a student or the teacher on /set-soalan-saya, whatever its status', async () => {
      const draft = await header()
      const published = await header({ status: 'published' })
      for (const c of [s1, s2, teacher]) {
        const ids = (await list(c)).map((r) => r.id)
        expect(ids).not.toContain(draft)
        expect(ids).not.toContain(published)
      }
    })

    it('never resolves for practice (not_found), even published and with items, until it is rebuilt into a class', async () => {
      const id = await header({ status: 'published', questionIds: [qs[0] as string] })
      const a = t.get(QuestionSetAssignments)
      for (const userId of [s1Id, s2Id, teacherId]) expect(await a.resolve({ userId, id, at })).toEqual({ status: 'not_found' })
      // a rebuild assigns it to a class (DM-46: a row in question_set_classrooms): from then on the normal rules apply
      await t.db.query(`update question_sets set needs_rebuild = false where id = $1`, [id])
      await t.db.query(`insert into question_set_classrooms (question_set_id, classroom_id, assigned_by) values ($1, $2, $3)`, [id, cls.id, teacherId])
      expect(await a.resolve({ userId: s1Id, id, at })).toMatchObject({ status: 'ok', questionIds: [qs[0]] })
    })
  })

  describe('guards', () => {
    it('anonymous is 401 with the Laravel text', async () => {
      const res = await t.http().get('/api/set-soalan-saya')
      expect(res.status).toBe(401)
      expect(res.body.error).toMatchObject({ code: 'UNAUTHORIZED', message: 'Sesi anda telah tamat. Sila log masuk semula.' })
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
