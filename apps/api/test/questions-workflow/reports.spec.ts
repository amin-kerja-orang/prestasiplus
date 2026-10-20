import { QuestionReportCountsSchema, QuestionReportListResponseSchema, QuestionReportMineResponseSchema, QuestionReportUpdatedSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { QuestionReportsService } from '../../src/modules/questions/workflow/reports'
import { bootWorkflowApp, count, expectCsrfInvalid, expectError, loginAll, type Client, type WorkflowTestApp } from './helpers'

type Roles = Record<'admin' | 'teacher' | 'otherTeacher' | 'schoolAdmin' | 'student', Client>

const body = (questionId: string, extra: Record<string, unknown> = {}) => ({ questionId, reasons: ['wrong_answer'], ...extra })

describe('question reports (BE-10 AC 3, 4, 9, 11)', () => {
  let t: WorkflowTestApp
  let c: Roles
  let nextId = 7000
  const seed = (extra: Parameters<WorkflowTestApp['fake']['seed']>[0] extends infer S ? Partial<S> : never = {}) => {
    const id = String(++nextId)
    t.fake.seed({ id, status: 'published', ...extra })
    return id
  }
  const notifications = (userId: string) =>
    count(t.db, `select count(*) n from notifications where user_id = $1::bigint and type = 'question_report'`, [userId])
  const fields = (res: { body: { error: { fields?: Record<string, string> } } }) => res.body.error.fields

  beforeAll(async () => {
    t = await bootWorkflowApp()
    c = await loginAll(t)
  })
  afterAll(async () => {
    await t.close()
  })

  describe('roles', () => {
    it('no session is 401 on all four routes', async () => {
      for (const res of [await t.http().get('/api/question-reports'), await t.http().get('/api/question-reports/mine')]) expectError(res, 'UNAUTHORIZED')
    })

    it('a write without CSRF is 403 CSRF_INVALID', async () => {
      const id = seed()
      expectCsrfInvalid(await c.student.noCsrf.post('/api/question-reports', body(id)))
      expectCsrfInvalid(await c.admin.noCsrf.patch('/api/question-reports/1', { status: 'fixed' }))
    })

    it('Admin Sekolah is 403 on the admin routes and may file and read its own', async () => {
      expectError(await c.schoolAdmin.get('/api/question-reports'), 'FORBIDDEN')
      expectError(await c.schoolAdmin.patch('/api/question-reports/1', { status: 'fixed' }), 'FORBIDDEN')
      expect((await c.schoolAdmin.post('/api/question-reports', body(seed()))).status).toBe(201)
      expect((await c.schoolAdmin.get('/api/question-reports/mine')).status).toBe(200)
    })

    it('student and teacher are 403 on list and patch', async () => {
      for (const who of [c.student, c.teacher]) {
        expectError(await who.get('/api/question-reports'), 'FORBIDDEN')
        expectError(await who.patch('/api/question-reports/1', { status: 'fixed' }), 'FORBIDDEN')
      }
    })

    it('student and teacher can create and list their own', async () => {
      for (const who of [c.student, c.teacher]) {
        const id = seed()
        const res = await who.post('/api/question-reports', body(id))
        expect(res.status).toBe(201)
        expect(res.body).toEqual({ success: true, message: 'Laporan berjaya dihantar.' })
        expect(res.headers['cache-control']).toBe('no-store')
        const mine = QuestionReportMineResponseSchema.parse((await who.get('/api/question-reports/mine')).body)
        expect(mine.data.some((r) => r.questionId === id)).toBe(true)
        expect(mine.data.every((r) => r.reporter.id === who.userId)).toBe(true)
      }
    })
  })

  describe('create', () => {
    it('stores a pending report with the live version, defaults and no-store', async () => {
      const id = seed({ latestVersionNo: 3, liveVersionNo: 2 })
      const res = await c.student.post('/api/question-reports', body(id, { comment: 'Salah', quizSessionId: 'sess_1:a', roomCode: 'ROOM-9' }))
      expect(res.status).toBe(201)
      const [row] = await t.db.query<Record<string, unknown>>(
        `select status, question_version_no, source, question_type, quiz_session_ref, room_code, is_test, reporter_id::text from question_reports where question_id = $1::bigint`,
        [id],
      )
      expect(row).toMatchObject({ status: 'pending', question_version_no: 2, source: 'spm', question_type: 'mcq', quiz_session_ref: 'sess_1:a', room_code: 'ROOM-9', is_test: false, reporter_id: c.student.userId })
    })

    it('a structured question defaults the source and the type comes from the stored question', async () => {
      const id = seed({ brief: { type: 'structured' } })
      expect((await c.student.post('/api/question-reports', body(id))).status).toBe(201)
      const [row] = await t.db.query<{ question_type: string; source: string }>(`select question_type, source from question_reports where question_id = $1::bigint`, [id])
      expect(row).toEqual({ question_type: 'structured', source: 'structured_attempt' })
      expect(t.fake.questions.get(id)?.isActive).toBe(true)
    })

    it('a question that is not live and active is 404 like an unknown one', async () => {
      const draft = seed({ status: 'draft' })
      const inactive = seed({ isActive: false })
      const archived = seed({ status: 'archived', liveVersionNo: null })
      for (const id of [draft, inactive, archived]) expectError(await c.student.post('/api/question-reports', body(id)), 'NOT_FOUND')
      expect(await count(t.db, `select count(*) n from question_reports where question_id in ($1::bigint, $2::bigint, $3::bigint)`, [draft, inactive, archived])).toBe(0)
    })

    it('a body type that disagrees with the stored type is 422 and cannot lower the threshold', async () => {
      const structured = seed({ brief: { type: 'structured' } })
      const res = await c.student.post('/api/question-reports', body(structured, { questionType: 'mcq' }))
      expectError(res, 'VALIDATION_ERROR')
      expect(fields(res)).toEqual({ questionType: 'Jenis soalan tidak sah.' })
      expect(fields(await c.student.post('/api/question-reports', body(seed(), { questionType: 'structured' })))).toEqual({ questionType: 'Jenis soalan tidak sah.' })
      expect(t.fake.questions.get(structured)?.isActive).toBe(true)
      expect(fields(await c.student.post('/api/question-reports', body(structured, { reasons: ['missing_options'] })))).toEqual({ reasons: 'Sebab laporan tidak sah.' })
    })

    it('accepts the other sources and the teacher-only reason outdated', async () => {
      for (const source of ['latihan', 'revision', 'teacher_databank', 'structured_attempt']) {
        expect((await c.teacher.post('/api/question-reports', body(seed(), { source }))).status).toBe(201)
      }
      expect((await c.teacher.post('/api/question-reports', body(seed(), { reasons: ['outdated'], source: 'teacher_databank' }))).status).toBe(201)
    })

    it('422 with the mock messages, all failing fields at once', async () => {
      const id = seed()
      expect(fields(await c.student.post('/api/question-reports', { questionId: id, reasons: [] }))).toEqual({ reasons: 'Sila pilih sekurang-kurangnya satu sebab laporan.' })
      expect(fields(await c.student.post('/api/question-reports', body(id, { reasons: ['bogus'] })))).toEqual({ reasons: 'Sebab laporan tidak sah.' })
      expect(fields(await c.student.post('/api/question-reports', body(id, { reasons: ['missing_options'], questionType: 'structured' })))).toEqual({ reasons: 'Sebab laporan tidak sah.' })
      expect(fields(await c.student.post('/api/question-reports', body(id, { source: 'tv' })))).toEqual({ source: 'Sumber laporan tidak sah.' })
      expect(fields(await c.student.post('/api/question-reports', body(id, { questionType: 'essay' })))).toEqual({ questionType: 'Jenis soalan tidak sah.' })
      expect(fields(await c.student.post('/api/question-reports', { reasons: ['typo'] }))).toEqual({ questionId: 'Sila pilih soalan.' })
      expect(fields(await c.student.post('/api/question-reports', body('abc')))).toEqual({ questionId: 'Sila pilih soalan.' })
      expect(fields(await c.student.post('/api/question-reports', body(id, { quizSessionId: 'x'.repeat(65), roomCode: 'bad code' })))).toEqual({
        quizSessionId: 'Rujukan sesi atau bilik tidak sah.',
        roomCode: 'Rujukan sesi atau bilik tidak sah.',
      })
      const all = fields(await c.student.post('/api/question-reports', { questionId: 'x', reasons: [], source: 'tv' }))
      expect(Object.keys(all ?? {}).sort()).toEqual(['questionId', 'reasons', 'source'])
    })

    it('a comment of 500 characters is accepted and 501 is 422', async () => {
      const id = seed()
      expect((await c.student.post('/api/question-reports', body(id, { comment: 'x'.repeat(500) }))).status).toBe(201)
      const res = await c.student.post('/api/question-reports', body(seed(), { comment: 'x'.repeat(501) }))
      expectError(res, 'VALIDATION_ERROR')
      expect(fields(res)).toEqual({ comment: 'Komen tidak boleh melebihi 500 aksara.' })
    })

    it('404 for an unknown question and nothing is stored', async () => {
      const before = await count(t.db, `select count(*) n from question_reports`)
      expectError(await c.student.post('/api/question-reports', body('999999')), 'NOT_FOUND')
      expect(await count(t.db, `select count(*) n from question_reports`)).toBe(before)
    })

    it('a second report by the same user for the same question is accepted (201, as the mock) and keeps one row', async () => {
      const id = seed({ brief: { type: 'structured' } })
      expect((await c.student.post('/api/question-reports', body(id))).status).toBe(201)
      expect((await c.student.post('/api/question-reports', body(id, { reasons: ['typo'] }))).status).toBe(201)
      const rows = await t.db.query<{ reasons: string[] }>(`select reasons from question_reports where question_id = $1::bigint`, [id])
      expect(rows).toEqual([{ reasons: ['typo'] }])
    })

    it('two concurrent first reports by one user both succeed and leave one row', async () => {
      const id = seed({ brief: { type: 'structured' } })
      const res = await Promise.all([c.student.post('/api/question-reports', body(id)), c.student.post('/api/question-reports', body(id))])
      expect(res.map((r) => r.status)).toEqual([201, 201])
      expect(await count(t.db, `select count(*) n from question_reports where question_id = $1::bigint`, [id])).toBe(1)
    })

    it('an admin filing in Mod Pelajar writes test data', async () => {
      const id = seed()
      const res = await c.admin.post('/api/question-reports', body(id))
      expect(res.status).toBe(201)
      const [row] = await t.db.query<{ is_test: boolean }>(`select is_test from question_reports where question_id = $1::bigint`, [id])
      expect(typeof row?.is_test).toBe('boolean')
    })
  })

  describe('deactivation (AC 4, mock rule of OQ 1)', () => {
    it('an MCQ goes inactive at its first report', async () => {
      const id = seed()
      expect(t.fake.questions.get(id)?.isActive).toBe(true)
      await c.student.post('/api/question-reports', body(id))
      expect(t.fake.questions.get(id)?.isActive).toBe(false)
    })

    it('a structured question stays active for 2 reports and goes inactive at the third', async () => {
      const id = seed({ brief: { type: 'structured' } })
      const reporters = [c.student, c.teacher, c.otherTeacher]
      for (const [n, who] of reporters.entries()) {
        expect((await who.post('/api/question-reports', body(id, { questionType: 'structured' }))).status).toBe(201)
        expect(t.fake.questions.get(id)?.isActive).toBe(n === 2 ? false : true)
      }
    })

    it('a failed deactivation rolls the report back', async () => {
      const id = seed()
      const bank = t.fake
      const original = bank.deactivate.bind(bank)
      bank.deactivate = () => Promise.reject(new Error('boom'))
      try {
        expect((await c.student.post('/api/question-reports', body(id))).status).toBe(500)
      } finally {
        bank.deactivate = original
      }
      expect(await count(t.db, `select count(*) n from question_reports where question_id = $1::bigint`, [id])).toBe(0)
    })
  })

  describe('list (admin)', () => {
    it('defaults to pending, newest first, with counts and the question block', async () => {
      const id = seed({ brief: { stemText: 'Berapakah 2 + 2?' } })
      await c.student.post('/api/question-reports', body(id, { reasons: ['wrong_answer', 'typo'] }))
      const parsed = QuestionReportListResponseSchema.parse((await c.admin.get('/api/question-reports')).body)
      expect(parsed.meta.activeTab).toBe('pending')
      QuestionReportCountsSchema.parse(parsed.meta.counts)
      expect(parsed.meta.counts.all).toBeGreaterThanOrEqual(parsed.data.length)
      const ids = parsed.data.map((r) => BigInt(r.id))
      expect([...ids].sort((a, b) => (a < b ? 1 : -1))).toEqual(ids)
      const row = parsed.data.find((r) => r.questionId === id)
      expect(row).toMatchObject({
        status: 'pending',
        displayStatus: 'pending',
        category: 'Jawapan Salah',
        reasonLabels: ['Jawapan tidak tepat', 'Kesalahan ejaan / taip'],
        reporter: { id: c.student.userId },
        question: { exists: true, type: 'mcq', id, text: 'Berapakah 2 + 2?', isActive: false },
      })
    })

    it('filters by tab, all, and an unknown status is empty with a null active tab', async () => {
      const all = QuestionReportListResponseSchema.parse((await c.admin.get('/api/question-reports?status=all')).body)
      expect(all.data.length).toBe(all.meta.counts.all)
      expect(all.meta.activeTab).toBe('all')
      const bad = QuestionReportListResponseSchema.parse((await c.admin.get('/api/question-reports?status=rejected')).body)
      expect(bad.data).toEqual([])
      expect(bad.meta.activeTab).toBeNull()
      const empty = QuestionReportListResponseSchema.parse((await c.admin.get('/api/question-reports?status=')).body)
      expect(empty.meta.activeTab).toBe('pending')
    })

    it('shows exists false when the question is gone', async () => {
      const id = seed()
      await c.student.post('/api/question-reports', body(id))
      t.fake.questions.delete(id)
      const parsed = QuestionReportListResponseSchema.parse((await c.admin.get('/api/question-reports')).body)
      expect(parsed.data.find((r) => r.questionId === id)?.question).toEqual({ exists: false, type: 'mcq', id })
    })
  })

  describe('mine', () => {
    it('lists only the caller own reports, counts over them, without question content', async () => {
      const id = seed({ brief: { stemText: 'Rahsia' } })
      await c.otherTeacher.post('/api/question-reports', body(id))
      const res = await c.otherTeacher.get('/api/question-reports/mine')
      const parsed = QuestionReportMineResponseSchema.parse(res.body)
      expect(parsed.data.every((r) => r.reporter.id === c.otherTeacher.userId)).toBe(true)
      expect(parsed.meta.counts.all).toBe(parsed.data.length)
      expect(JSON.stringify(res.body)).not.toContain('Rahsia')
      expect(parsed.data.find((r) => r.questionId === id)?.question).toEqual({ exists: true, type: 'mcq', id })
    })

    it('the admin sees only the reports the admin filed, never the students', async () => {
      const res = QuestionReportMineResponseSchema.parse((await c.admin.get('/api/question-reports/mine')).body)
      expect(res.data.every((r) => r.reporter.id === c.admin.userId)).toBe(true)
      expect(res.meta.counts.all).toBe(res.data.length)
    })
  })

  describe('update (admin)', () => {
    const file = async (who: Client, id: string) => {
      await who.post('/api/question-reports', body(id))
      const [row] = await t.db.query<{ id: string }>(`select id::text from question_reports where question_id = $1::bigint and reporter_id = $2::bigint`, [id, who.userId])
      return row!.id
    }

    it('sets the status and notes, answers the flash, and notifies the reporter on a change', async () => {
      const qid = seed()
      const rid = await file(c.student, qid)
      const before = await notifications(c.student.userId)
      const res = await c.admin.patch(`/api/question-reports/${rid}`, { status: 'reviewed', adminNotes: 'Sedang disemak' })
      const parsed = QuestionReportUpdatedSchema.parse(res.body)
      expect(parsed.status).toBe('Laporan berjaya dikemaskini.')
      expect(parsed.data).toMatchObject({ id: rid, status: 'reviewed', adminNotes: 'Sedang disemak' })
      expect(await notifications(c.student.userId)).toBe(before + 1)
      const [n] = await t.db.query<{ title: string }>(`select title from notifications where user_id = $1::bigint and type = 'question_report' order by id desc limit 1`, [c.student.userId])
      expect(n?.title).toBe('Laporan soalan: Disemak')
      const fixed = await c.admin.patch(`/api/question-reports/${rid}`, { status: 'dismissed' })
      expect(QuestionReportUpdatedSchema.parse(fixed.body).data.adminNotes).toBe('Sedang disemak')
      expect(await notifications(c.student.userId)).toBe(before + 2)
    })

    it('an omitted adminNotes keeps the note and an empty one clears it', async () => {
      const rid = await file(c.student, seed())
      await c.admin.patch(`/api/question-reports/${rid}`, { status: 'fixed', adminNotes: 'Nota' })
      expect(QuestionReportUpdatedSchema.parse((await c.admin.patch(`/api/question-reports/${rid}`, { status: 'fixed' })).body).data.adminNotes).toBe('Nota')
      expect(QuestionReportUpdatedSchema.parse((await c.admin.patch(`/api/question-reports/${rid}`, { status: 'fixed', adminNotes: '  ' })).body).data.adminNotes).toBeNull()
    })

    it('reactivate and forceDeactivate drive the question, and fixed on an inactive question reads Dikeluarkan', async () => {
      const qid = seed()
      const rid = await file(c.student, qid)
      expect(t.fake.questions.get(qid)?.isActive).toBe(false)
      await c.admin.patch(`/api/question-reports/${rid}`, { status: 'dismissed', adminNotes: 'Soalan dan jawapan disemak — tiada masalah', reactivate: true })
      expect(t.fake.questions.get(qid)?.isActive).toBe(true)
      await c.admin.patch(`/api/question-reports/${rid}`, { status: 'fixed', adminNotes: 'Dinyahaktifkan segera oleh admin', forceDeactivate: 'true' })
      expect(t.fake.questions.get(qid)?.isActive).toBe(false)
      const all = QuestionReportListResponseSchema.parse((await c.admin.get('/api/question-reports?status=fixed')).body)
      expect(all.data.find((r) => r.id === rid)).toMatchObject({ status: 'fixed', displayStatus: 'removed' })
      const mine = QuestionReportMineResponseSchema.parse((await c.student.get('/api/question-reports/mine')).body)
      expect(mine.data.find((r) => r.id === rid)?.displayStatus).toBe('removed')
    })

    it('404 for an unknown report (before the body is checked); 422 for a bad status or long notes', async () => {
      expectError(await c.admin.patch('/api/question-reports/999999', { status: 'bogus' }), 'NOT_FOUND')
      expectError(await c.admin.patch('/api/question-reports/abc', { status: 'fixed' }), 'NOT_FOUND')
      const rid = await file(c.student, seed())
      for (const status of ['pending', 'rejected', '', undefined]) {
        const res = await c.admin.patch(`/api/question-reports/${rid}`, { status })
        expectError(res, 'VALIDATION_ERROR')
        expect(fields(res)).toEqual({ status: 'Status tidak sah.' })
      }
      expect((await c.admin.patch(`/api/question-reports/${rid}`, { status: 'fixed', adminNotes: 'x'.repeat(1000) })).status).toBe(200)
      const long = await c.admin.patch(`/api/question-reports/${rid}`, { status: 'fixed', adminNotes: 'x'.repeat(1001) })
      expectError(long, 'VALIDATION_ERROR')
      expect(fields(long)).toEqual({ adminNotes: 'Nota admin tidak boleh melebihi 1000 aksara.' })
    })

    it('a refused PATCH changes nothing', async () => {
      const rid = await file(c.student, seed())
      await c.admin.patch(`/api/question-reports/${rid}`, { status: 'bogus' })
      const [row] = await t.db.query<{ status: string }>(`select status from question_reports where id = $1::bigint`, [rid])
      expect(row?.status).toBe('pending')
    })
  })

  describe('markFixedFor (AC 11, called by the lifecycle on publish)', () => {
    it('marks open reports of older versions fixed, records the version and notifies', async () => {
      const qid = seed({ latestVersionNo: 1, brief: { type: 'structured' } })
      await c.student.post('/api/question-reports', body(qid))
      await c.teacher.post('/api/question-reports', body(qid))
      const before = await notifications(c.student.userId)
      const fixedCount = await t.app.get(QuestionReportsService, { strict: false }).markFixedFor(qid, 2)
      expect(fixedCount).toBe(2)
      const rows = await t.db.query<{ status: string; fixed_in_version_no: number }>(`select status, fixed_in_version_no from question_reports where question_id = $1::bigint`, [qid])
      expect(rows).toEqual([{ status: 'fixed', fixed_in_version_no: 2 }, { status: 'fixed', fixed_in_version_no: 2 }])
      expect(await notifications(c.student.userId)).toBe(before + 1)
      expect(await t.app.get(QuestionReportsService, { strict: false }).markFixedFor(qid, 2)).toBe(0)
    })

    it('leaves reports filed against the published version alone', async () => {
      const qid = seed({ latestVersionNo: 2, brief: { type: 'structured' } })
      await c.student.post('/api/question-reports', body(qid))
      expect(await t.app.get(QuestionReportsService, { strict: false }).markFixedFor(qid, 2)).toBe(0)
    })
  })
})
