import { GURU_SET_MESSAGES, GuruSetBankResponseSchema, GuruSetListResponseSchema, GuruSetResultsResponseSchema, QuestionSetSchema, envelopeOf } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  ADMIN,
  STUDENT_1,
  STUDENT_2,
  TEACHER_A,
  TEACHER_C,
  bootQsApp,
  classWith,
  client,
  errorIs,
  fieldsOf,
  firstSubject,
  idOfEmail,
  type Client,
  type QsTestApp,
} from '../missions/qs-helpers'

/** S6-T14, API-GUR-16: the teacher Set Soalan routes against a real database (AC-GUR-8b-1..5, -8..12). */

const SetBody = envelopeOf(QuestionSetSchema)
const NOT_FOUND = 'Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?'

describe('teacher Set Soalan (S6-T14)', () => {
  let t: QsTestApp
  let a: Client
  let c: Client
  let s1: Client
  let s2: Client
  let s1Id: string
  let s2Id: string
  let subjectId: string
  let bankIds: string[]
  let clsA: { id: string }
  let clsB: { id: string }
  let seq = 0
  let teacherIdOfA: string

  const body = (over: Record<string, unknown> = {}) => ({
    title: `Ujian ${String((seq += 1))}`,
    subjectId,
    questionIds: bankIds.slice(0, 3),
    classroomIds: [clsA.id],
    status: 'draft',
    ...over,
  })
  const make = async (over: Record<string, unknown> = {}) => {
    const res = await a.post('/guru/question-sets', body(over))
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    return SetBody.parse(res.body).data
  }
  const complete = async (setId: string, userId: string, correct: number, total: number, at = '2026-10-19T09:00:00+08:00') => {
    await t.db.query(
      `insert into practice_sessions (user_id, mode, question_set_id, question_count, correct_count, status, started_at, completed_at)
       values ($1, 'question_set', $2, $3, $4, 'completed', $5::timestamptz, $5::timestamptz)`,
      [userId, setId, total, correct, at],
    )
  }

  beforeAll(async () => {
    t = await bootQsApp()
    a = await client(t, TEACHER_A)
    c = await client(t, TEACHER_C)
    s1 = await client(t, STUDENT_1)
    s2 = await client(t, STUDENT_2)
    teacherIdOfA = await idOfEmail(t, TEACHER_A)
    s1Id = await idOfEmail(t, STUDENT_1)
    s2Id = await idOfEmail(t, STUDENT_2)
    subjectId = (await firstSubject(t)).id
    clsA = await classWith(t, a, [s1], '5 Bestari')
    clsB = await classWith(t, a, [s2], '5 Cekap')
    const bank = await a.get('/guru/question-sets/bank')
    expect(bank.status, JSON.stringify(bank.body)).toBe(200)
    bankIds = GuruSetBankResponseSchema.parse(bank.body).data.units.filter((u) => u.kind === 'question').flatMap((u) => u.questionIds)
    expect(bankIds.length).toBeGreaterThanOrEqual(4)
  }, 180_000)
  afterAll(async () => {
    await t.close()
  })

  describe('guards', () => {
    it('401 without a session, 403 for a pupil and for the admin, no-store answers', async () => {
      for (const [m, p] of [['get', '/api/guru/question-sets'], ['get', '/api/guru/question-sets/bank'], ['post', '/api/guru/question-sets'], ['get', '/api/guru/question-sets/1/results']] as const) {
        errorIs(await t.http()[m](p), 401, 'UNAUTHORIZED', 'Sesi anda telah tamat. Sila log masuk semula.')
      }
      for (const who of [s1, await client(t, ADMIN)]) {
        errorIs(await who.get('/guru/question-sets'), 403, 'FORBIDDEN', 'Anda tidak dibenarkan melakukan tindakan ini.')
        errorIs(await who.post('/guru/question-sets', body()), 403, 'FORBIDDEN', 'Anda tidak dibenarkan melakukan tindakan ini.')
      }
      expect((await a.get('/guru/question-sets')).headers['cache-control']).toMatch(/no-store/)
    })

    it('a write without the CSRF header is 403 CSRF_INVALID and writes nothing', async () => {
      const res = await a.who.agent.post('/api/guru/question-sets').send(body({ title: 'Tanpa CSRF' }))
      expect(res.status).toBe(403)
      expect(await t.db.query(`select 1 from question_sets where title = 'Tanpa CSRF'`)).toHaveLength(0)
    })

    it("another teacher's set, an unknown or a malformed id is a plain 404 on every route", async () => {
      const own = await make()
      const id = own.id
      for (const res of [
        await c.get(`/guru/question-sets/${id}`),
        await c.put(`/guru/question-sets/${id}`, body()),
        await c.del(`/guru/question-sets/${id}`),
        await c.post(`/guru/question-sets/${id}/status`, { status: 'draft' }),
        await c.post(`/guru/question-sets/${id}/copy`, { classroomIds: [clsA.id] }),
        await c.get(`/guru/question-sets/${id}/results`),
      ]) {
        errorIs(res, 404, 'NOT_FOUND', NOT_FOUND)
      }
      expect(await t.db.query(`select 1 from question_sets where id = $1`, [id])).toHaveLength(1)
      for (const id of ['99999999', 'abc', '0']) errorIs(await a.get(`/guru/question-sets/${id}`), 404, 'NOT_FOUND', NOT_FOUND)
    })

    it('a migrated header (needs a rebuild, no subject) is a 404 like in the list', async () => {
      const [h] = await t.db.query<{ id: string }>(`insert into question_sets (teacher_id, title, legacy_source, legacy_id, needs_rebuild) values ($1, 'Header Migrasi', 'cloud', 'gs-1', true) returning id::text id`, [teacherIdOfA])
      errorIs(await a.get(`/guru/question-sets/${h?.id}`), 404, 'NOT_FOUND', NOT_FOUND)
    })

    it('a teacher paper (kind kertas) is not a set here: 404', async () => {
      const own = await make()
      await t.db.query(`update question_sets set kind = 'kertas' where id = $1`, [own.id])
      errorIs(await a.get(`/guru/question-sets/${own.id}`), 404, 'NOT_FOUND', NOT_FOUND)
      const rows = GuruSetListResponseSchema.parse((await a.get('/guru/question-sets')).body).data.rows
      expect(rows.map((r) => r.id)).not.toContain(own.id)
    })
  })

  describe('create and update', () => {
    it('AC-GUR-8b-1: a draft with 3 questions and no class is saved and listed as Draf with "3 soalan"', async () => {
      const res = await a.post('/guru/question-sets', body({ title: '  Ujian 1  ', classroomIds: [], educationLevelId: null }))
      expect(res.status, JSON.stringify(res.body)).toBe(201)
      const set = SetBody.parse(res.body).data
      expect(set).toMatchObject({ title: 'Ujian 1', status: 'draft', subjectId, educationLevelId: null, classroomIds: [], locked: false })
      expect(set.questionIds).toEqual(bankIds.slice(0, 3))
      const [row] = await t.db.query<{ kind: string; max_attempts: number; classroom_id: string | null }>(`select kind, max_attempts, classroom_id::text from question_sets where id = $1`, [set.id])
      expect(row).toEqual({ kind: 'set', max_attempts: 0, classroom_id: null })
      const list = GuruSetListResponseSchema.parse((await a.get('/guru/question-sets')).body).data
      expect(list.rows.find((r) => r.id === set.id)).toMatchObject({ status: 'draft', questionCount: 3, siap: 0, classrooms: [] })
    })

    it('AC-GUR-8b-8: publishing with no class is 422 fields.classroomIds and nothing is saved', async () => {
      const res = await a.post('/guru/question-sets', body({ title: 'Tiada Kelas', classroomIds: [], status: 'published' }))
      expect(fieldsOf(res)).toEqual({ classroomIds: GURU_SET_MESSAGES.classRequiredToPublish })
      expect(await t.db.query(`select 1 from question_sets where title = 'Tiada Kelas'`)).toHaveLength(0)
    })

    it('publishes to several own classes (FR-GUR-8b-3), rows in question_set_classrooms, assigned_by the teacher', async () => {
      const set = await make({ status: 'published', classroomIds: [clsA.id, clsB.id] })
      expect(set.status).toBe('published')
      expect(set.classroomIds.sort()).toEqual([clsA.id, clsB.id].sort())
      const rows = await t.db.query<{ assigned_by: string }>(`select assigned_by::text from question_set_classrooms where question_set_id = $1`, [set.id])
      expect(rows).toHaveLength(2)
      expect(rows.every((r) => r.assigned_by === (teacherIdOfA))).toBe(true)
    })

    it('a class that is not own, unknown, or not active is refused (fields.classroomIds); others are left alone', async () => {
      const other = await classWith(t, c, [], 'Kelas Guru Lain')
      expect(fieldsOf(await a.post('/guru/question-sets', body({ classroomIds: [other.id] })))).toEqual({ classroomIds: GURU_SET_MESSAGES.invalid })
      expect(fieldsOf(await a.post('/guru/question-sets', body({ classroomIds: ['999999'] })))).toEqual({ classroomIds: GURU_SET_MESSAGES.invalid })
    })

    it('reports title, subject, question list limits together with the PRD texts', async () => {
      const res = await a.post('/guru/question-sets', { classroomIds: [], status: 'draft' })
      expect(fieldsOf(res)).toEqual({ title: GURU_SET_MESSAGES.titleRequired, subjectId: GURU_SET_MESSAGES.subjectRequired, questionIds: GURU_SET_MESSAGES.questionsRequired })
      expect(fieldsOf(await a.post('/guru/question-sets', body({ title: 'x'.repeat(151) })))).toEqual({ title: GURU_SET_MESSAGES.titleTooLong })
      const many = Array.from({ length: 101 }, (_, i) => String(i + 1))
      expect(fieldsOf(await a.post('/guru/question-sets', body({ questionIds: many })))).toEqual({ questionIds: GURU_SET_MESSAGES.questionsTooMany })
      expect(fieldsOf(await a.post('/guru/question-sets', body({ subjectId: '999999' })))).toEqual({ subjectId: GURU_SET_MESSAGES.subjectRequired })
      expect(fieldsOf(await a.post('/guru/question-sets', body({ status: 'scheduled' })))).toEqual({ status: GURU_SET_MESSAGES.statusInvalid })
    })

    it('only approved, servable questions: an unknown, a draft or a duplicate id is fields.questionIds', async () => {
      expect(fieldsOf(await a.post('/guru/question-sets', body({ questionIds: ['999999'] })))).toEqual({ questionIds: GURU_SET_MESSAGES.invalid })
      expect(fieldsOf(await a.post('/guru/question-sets', body({ questionIds: [bankIds[0], bankIds[0]] })))).toEqual({ questionIds: GURU_SET_MESSAGES.invalid })
      const [draft] = await t.db.query<{ id: string }>(
        `select q.id::text id from questions q join question_versions v on v.question_id = q.id and v.version_no = q.latest_version_no where v.status <> 'approved' limit 1`,
      )
      if (draft) expect(fieldsOf(await a.post('/guru/question-sets', body({ questionIds: [draft.id] })))).toEqual({ questionIds: GURU_SET_MESSAGES.invalid })
    })

    it('Tingkatan (pilihan): an education level of Tingkatan 1-5 is kept, any other is refused', async () => {
      const [t4] = await t.db.query<{ id: string }>(`select id::text from education_levels where grade = 10 and stage <> 'primary' limit 1`)
      const [p3] = await t.db.query<{ id: string }>(`select id::text from education_levels where stage = 'primary' limit 1`)
      const set = await make({ educationLevelId: t4?.id })
      expect(set.educationLevelId).toBe(t4?.id)
      if (p3) expect(fieldsOf(await a.post('/guru/question-sets', body({ educationLevelId: p3.id })))).toEqual({ educationLevelId: GURU_SET_MESSAGES.invalid })
    })

    it('unknown keys are refused (strict body)', async () => {
      expect(fieldsOf(await a.post('/guru/question-sets', body({ teacherId: '1' })))).toEqual({ teacherId: 'The teacherId field is not allowed.' })
    })

    it('edit: title, classes and status save and the item order follows the list (no lock yet)', async () => {
      const set = await make()
      const res = await a.put(`/guru/question-sets/${set.id}`, body({ title: 'Tajuk Baharu', questionIds: [bankIds[3], bankIds[0]], classroomIds: [clsB.id], status: 'published' }))
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(SetBody.parse(res.body).data).toMatchObject({ id: set.id, title: 'Tajuk Baharu', status: 'published', questionIds: [bankIds[3], bankIds[0]], classroomIds: [clsB.id], locked: false })
      const items = await t.db.query<{ question_id: string; position: number; question_version_no: number }>(`select question_id::text, position, question_version_no from question_set_items where question_set_id = $1 order by position`, [set.id])
      expect(items.map((i) => [i.question_id, i.position])).toEqual([[bankIds[3], 0], [bankIds[0], 1]])
      expect(items.every((i) => i.question_version_no >= 1)).toBe(true)
    })

    it('AC-GUR-8b-12: once a pupil has a session, a changed question list is 409 locked, title and classes still save, the same list passes', async () => {
      const set = await make({ status: 'published' })
      await complete(set.id, s1Id, 4, 5)
      const got = SetBody.parse((await a.get(`/guru/question-sets/${set.id}`)).body).data
      expect(got.locked).toBe(true)
      const res = await a.put(`/guru/question-sets/${set.id}`, body({ title: 'Tajuk Dikunci', questionIds: bankIds.slice(0, 2), classroomIds: [clsA.id, clsB.id], status: 'published' }))
      expect(res.status).toBe(409)
      expect(res.body.error.code).toBe('CONFLICT')
      expect(res.body.error.message).toBe(GURU_SET_MESSAGES.locked)
      const after = SetBody.parse((await a.get(`/guru/question-sets/${set.id}`)).body).data
      expect(after).toMatchObject({ title: 'Tajuk Dikunci', questionIds: set.questionIds, locked: true })
      expect(after.classroomIds.sort()).toEqual([clsA.id, clsB.id].sort())
      const same = await a.put(`/guru/question-sets/${set.id}`, body({ title: 'Tajuk Sama', questionIds: set.questionIds, classroomIds: [clsA.id], status: 'published' }))
      expect(same.status, JSON.stringify(same.body)).toBe(200)
      expect(SetBody.parse(same.body).data.title).toBe('Tajuk Sama')
    })
  })

  describe('status, copy, delete', () => {
    it('AC-GUR-8b-2: Terbitkan needs a class; Jadikan Draf keeps attempts', async () => {
      const set = await make({ classroomIds: [] })
      expect(fieldsOf(await a.post(`/guru/question-sets/${set.id}/status`, { status: 'published' }))).toEqual({ classroomIds: GURU_SET_MESSAGES.classRequiredToPublish })
      await a.put(`/guru/question-sets/${set.id}`, body({ title: set.title, classroomIds: [clsA.id] }))
      const pub = await a.post(`/guru/question-sets/${set.id}/status`, { status: 'published' })
      expect(pub.status, JSON.stringify(pub.body)).toBe(200)
      expect(SetBody.parse(pub.body).data.status).toBe('published')
      await complete(set.id, s1Id, 3, 3)
      const draft = await a.post(`/guru/question-sets/${set.id}/status`, { status: 'draft' })
      expect(SetBody.parse(draft.body).data.status).toBe('draft')
      expect(await t.db.query(`select 1 from practice_sessions where question_set_id = $1`, [set.id])).toHaveLength(1)
      expect(fieldsOf(await a.post(`/guru/question-sets/${set.id}/status`, { status: 'scheduled' }))).toEqual({ status: GURU_SET_MESSAGES.statusInvalid })
    })

    it('AC-GUR-8b-4, -13: Salin makes a draft "{title} (Salinan)" with every question, assigned to the chosen class only', async () => {
      const set = await make({ title: 'Ujian 1', status: 'published', classroomIds: [clsA.id] })
      const res = await a.post(`/guru/question-sets/${set.id}/copy`, { classroomIds: [clsB.id] })
      expect(res.status, JSON.stringify(res.body)).toBe(201)
      const copy = SetBody.parse(res.body).data
      expect(copy).toMatchObject({ title: 'Ujian 1 (Salinan)', status: 'draft', classroomIds: [clsB.id], locked: false })
      expect(copy.id).not.toBe(set.id)
      expect(copy.questionIds).toEqual(set.questionIds)
      const other = await classWith(t, c, [], 'Kelas Lain Salin')
      expect(fieldsOf(await a.post(`/guru/question-sets/${set.id}/copy`, { classroomIds: [other.id] }))).toEqual({ classroomIds: GURU_SET_MESSAGES.classRequiredToCopy })
      expect(fieldsOf(await a.post(`/guru/question-sets/${set.id}/copy`, { classroomIds: [] }))).toEqual({ classroomIds: GURU_SET_MESSAGES.classRequiredToCopy })
    })

    it('FR-GUR-8b-6: Padam removes the set, its items and classes; the pupils sessions stay', async () => {
      const set = await make({ status: 'published' })
      await complete(set.id, s1Id, 1, 3)
      const res = await a.del(`/guru/question-sets/${set.id}`)
      expect(res.status).toBe(200)
      expect(res.body).toEqual({ data: { deleted: 1 } })
      errorIs(await a.get(`/guru/question-sets/${set.id}`), 404, 'NOT_FOUND', NOT_FOUND)
      expect(await t.db.query(`select 1 from question_set_items where question_set_id = $1`, [set.id])).toHaveLength(0)
      expect(await t.db.query(`select 1 from question_set_classrooms where question_set_id = $1`, [set.id])).toHaveLength(0)
      expect(await t.db.query(`select 1 from practice_sessions where question_set_id = $1`, [set.id])).toHaveLength(1)
    })
  })

  describe('list', () => {
    it('own sets only, newest update first, counters, summary and the class filter', async () => {
      const first = await make({ title: 'Senarai Satu', status: 'published', classroomIds: [clsA.id] })
      t.clock.advance(60_000)
      await t.db.query(`update question_sets set updated_at = now() + interval '1 hour' where id = $1`, [first.id])
      const second = await make({ title: 'Senarai Dua', status: 'draft', classroomIds: [clsB.id] })
      await complete(first.id, s1Id, 2, 3)
      await complete(first.id, s2Id, 3, 3)
      await complete(second.id, s1Id, 1, 3)
      const list = GuruSetListResponseSchema.parse((await a.get('/guru/question-sets')).body)
      expect(list.data.rows[0]?.id).toBe(first.id)
      expect(list.data.rows.find((r) => r.id === first.id)).toMatchObject({ siap: 2, status: 'published', subjectName: expect.any(String) })
      expect(list.data.counters.published).toBeGreaterThanOrEqual(1)
      expect(list.data.counters.draft).toBeGreaterThanOrEqual(1)
      expect(list.data.counters.participation).toBe(2)
      expect(list.meta).toMatchObject({ page: 1, pageSize: 20 })
      const filtered = GuruSetListResponseSchema.parse((await a.get(`/guru/question-sets?classroomId=${clsB.id}`)).body).data
      expect(filtered.rows.every((r) => r.classrooms.some((k) => k.id === clsB.id))).toBe(true)
      expect(filtered.rows.map((r) => r.id)).toContain(second.id)
      expect(filtered.rows.map((r) => r.id)).not.toContain(first.id)
      expect(filtered.summary.total).toBe(filtered.rows.length)
      expect(GuruSetListResponseSchema.parse((await c.get('/guru/question-sets')).body).data.rows).toEqual([])
    })

    it('paginates 20 per page and a scheduled or migrated-header set is ignored', async () => {
      await t.db.query(
        `insert into question_sets (teacher_id, subject_id, title, status, scheduled_at) values ($1, $2, 'Berjadual', 'scheduled', now() + interval '1 day')`,
        [await idOfEmail(t, TEACHER_A), subjectId],
      )
      const res = GuruSetListResponseSchema.parse((await a.get('/guru/question-sets?pageSize=2&page=2')).body)
      expect(res.meta).toMatchObject({ page: 2, pageSize: 2 })
      expect(res.data.rows.length).toBeLessThanOrEqual(2)
      expect(GuruSetListResponseSchema.parse((await a.get('/guru/question-sets?pageSize=100')).body).data.rows.map((r) => r.title)).not.toContain('Berjadual')
    })

    it('AC-GUR-8b-5: an archived question drops out of the count, not of the stored list', async () => {
      const set = await make({ title: 'Arkib Soalan', status: 'published' })
      await t.db.query(`update questions set is_active = false where id = $1`, [set.questionIds[0]])
      try {
        const row = GuruSetListResponseSchema.parse((await a.get('/guru/question-sets')).body).data.rows.find((r) => r.id === set.id)
        expect(row?.questionCount).toBe(2)
        expect(SetBody.parse((await a.get(`/guru/question-sets/${set.id}`)).body).data.questionIds).toEqual(set.questionIds)
      } finally {
        await t.db.query(`update questions set is_active = true where id = $1`, [set.questionIds[0]])
      }
    })
  })

  describe('results', () => {
    it('AC-GUR-8b-3, -10: cards, rows newest first, accuracy one decimal, class filter by active enrolment', async () => {
      const set = await make({ title: 'Keputusan', status: 'published', classroomIds: [clsA.id, clsB.id] })
      const empty = GuruSetResultsResponseSchema.parse((await a.get(`/guru/question-sets/${set.id}/results`)).body)
      expect(empty.data).toEqual({ summary: { penyertaan: 0, skorPurata: null, jumlahPercubaan: 0 }, rows: [] })
      await complete(set.id, s1Id, 4, 5, '2026-10-19T09:00:00+08:00')
      await complete(set.id, s2Id, 3, 5, '2026-10-20T09:00:00+08:00')
      await t.db.query(
        `insert into practice_sessions (user_id, mode, question_set_id, question_count, correct_count, status, started_at, completed_at, is_test) values ($1, 'question_set', $2, 5, 5, 'completed', now(), now(), true)`,
        [s1Id, set.id],
      )
      const all = GuruSetResultsResponseSchema.parse((await a.get(`/guru/question-sets/${set.id}/results`)).body)
      expect(all.data.summary).toEqual({ penyertaan: 2, skorPurata: 70, jumlahPercubaan: 2 })
      expect(all.data.rows.map((r) => [r.correct, r.total, r.accuracy])).toEqual([[3, 5, 60], [4, 5, 80]])
      expect(all.data.rows[0]?.pupil.id).toBe(s2Id)
      expect(all.meta).toMatchObject({ page: 1, pageSize: 25, totalItems: 2 })
      const clsOnly = GuruSetResultsResponseSchema.parse((await a.get(`/guru/question-sets/${set.id}/results?classroomId=${clsB.id}`)).body)
      expect(clsOnly.data.summary).toEqual({ penyertaan: 1, skorPurata: 60, jumlahPercubaan: 1 })
      const foreign = await classWith(t, c, [s1], 'Kelas Asing Keputusan')
      const none = GuruSetResultsResponseSchema.parse((await a.get(`/guru/question-sets/${set.id}/results?classroomId=${foreign.id}`)).body)
      expect(none.data.rows).toEqual([])
      expect(none.data.summary.penyertaan).toBe(0)
    })

    it('rounds the mean half up and shows one decimal per row; 25 per page', async () => {
      const set = await make({ title: 'Bundar', status: 'published' })
      await complete(set.id, s1Id, 1, 3) // 33.3
      await complete(set.id, s2Id, 2, 3) // 66.7  -> mean 50
      for (let i = 0; i < 25; i++) await complete(set.id, s1Id, 3, 3, `2026-11-01T09:${String(i).padStart(2, '0')}:00+08:00`)
      const p1 = GuruSetResultsResponseSchema.parse((await a.get(`/guru/question-sets/${set.id}/results`)).body)
      expect(p1.data.rows).toHaveLength(25)
      const p2 = GuruSetResultsResponseSchema.parse((await a.get(`/guru/question-sets/${set.id}/results?page=2`)).body)
      expect(p2.data.rows.map((r) => r.accuracy).sort()).toEqual([33.3, 66.7])
      expect(p2.meta).toMatchObject({ page: 2, totalItems: 27, totalPages: 2 })
    })
  })

  describe('bank picker', () => {
    it('50 per call by keyset cursor, newest first, the stored contract shape', async () => {
      const res = GuruSetBankResponseSchema.parse((await a.get('/guru/question-sets/bank')).body)
      const rep = res.data.units.map((u) => u.questionIds.map(BigInt).reduce((m, x) => (x > m ? x : m)))
      expect([...rep].sort((x, y) => (x < y ? 1 : -1))).toEqual(rep)
      for (const u of res.data.units) {
        expect(u.preview.length).toBeLessThanOrEqual(123)
        expect(u.questionIds.length).toBeGreaterThanOrEqual(1)
        expect(u.difficulty).toBeGreaterThanOrEqual(1)
      }
    })

    it('q shorter than 2 characters is 422 fields.q; q filters by the stem; a filter with no match is empty', async () => {
      expect(fieldsOf(await a.get('/guru/question-sets/bank?q=a'))).toEqual({ q: GURU_SET_MESSAGES.searchTooShort })
      const none = GuruSetBankResponseSchema.parse((await a.get('/guru/question-sets/bank?q=zzzzqqqq')).body)
      expect(none.data).toEqual({ units: [], nextCursor: null })
      const [stem] = await t.db.query<{ w: string }>(`select split_part(stem_ms, ' ', 1) w from question_versions where stem_ms is not null and length(split_part(stem_ms, ' ', 1)) > 3 limit 1`)
      if (stem) expect(GuruSetBankResponseSchema.parse((await a.get(`/guru/question-sets/bank?q=${encodeURIComponent(stem.w)}`)).body).data.units.length).toBeGreaterThanOrEqual(1)
    })

    it('a stimulus group is ONE unit with all its members, and a partial pick is 422 groupSplit (AC-GUR-8b-9)', async () => {
      const members = bankIds.slice(0, 3)
      const [stim] = await t.db.query<{ id: string }>(`insert into stimuli (kind, label, body_ms) values ('passage', 'Petikan Set', 'Petikan untuk set soalan guru.') returning id::text id`)
      const [group] = await t.db.query<{ id: string }>(`insert into stimulus_groups (scope) values ('section') returning id::text id`)
      await t.db.query(`insert into stimulus_group_stimuli (group_id, stimulus_id, position) values ($1::bigint, $2::bigint, 1)`, [group?.id, stim?.id])
      await t.db.query(`update questions set group_id = $1::bigint, group_position = array_position($3::bigint[], id) where id = any($2::bigint[])`, [group?.id, members, members.map(BigInt).map(String)])
      try {
        const bank = GuruSetBankResponseSchema.parse((await a.get('/guru/question-sets/bank')).body).data
        const unit = bank.units.find((u) => u.id === group?.id)
        expect(unit).toMatchObject({ kind: 'group' })
        expect([...(unit?.questionIds ?? [])].sort()).toEqual([...members].sort())
        expect(unit?.stimulus).toMatchObject({ kind: 'passage', body: { ms: 'Petikan untuk set soalan guru.' } })
        expect(bank.units.filter((u) => u.questionIds.some((q) => members.includes(q)))).toHaveLength(1)
        const partial = await a.post('/guru/question-sets', body({ questionIds: members.slice(0, 2) }))
        expect(fieldsOf(partial)).toEqual({ questionIds: GURU_SET_MESSAGES.groupSplit })
        expect(await t.db.query(`select 1 from question_set_items i join question_sets s on s.id = i.question_set_id where s.title like 'Ujian %' and i.question_id = $1::bigint and not exists (select 1 from question_set_items j where j.question_set_id = i.question_set_id and j.question_id = $2::bigint)`, [members[0], members[2]])).toHaveLength(0)
        const whole = await a.post('/guru/question-sets', body({ questionIds: members }))
        expect(whole.status, JSON.stringify(whole.body)).toBe(201)
      } finally {
        await t.db.query(`update questions set group_id = null, group_position = null where id = any($1::bigint[])`, [members])
        await t.db.query(`delete from stimulus_group_stimuli where group_id = $1::bigint`, [group?.id])
        await t.db.query(`delete from stimulus_groups where id = $1::bigint`, [group?.id])
        await t.db.query(`delete from stimuli where id = $1::bigint`, [stim?.id])
      }
    })
  })
})
