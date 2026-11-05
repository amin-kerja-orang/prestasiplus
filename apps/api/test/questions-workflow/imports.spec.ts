import {
  QUESTION_IMPORT_GURU_HEADER,
  QUESTION_IMPORT_GURU_TEMPLATE_CSV,
  QUESTION_IMPORT_GURU_TEMPLATE_FILENAME,
  QUESTION_IMPORT_HEADER,
  QUESTION_IMPORT_TEMPLATE_CONTENT_TYPE,
  QUESTION_IMPORT_TEMPLATE_CSV,
  QUESTION_IMPORT_TEMPLATE_FILENAME,
  QuestionImportCreatedSchema,
  QuestionImportGuruResultSchema,
  QuestionImportRunSchema,
  listEnvelopeOf,
} from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { expectCsrfInvalid, expectError, bootWorkflowApp, loginAll, parseData, count, type Client, type WorkflowTestApp } from './helpers'
import { curriculumIds, fixture, uploadClient, type UploadClient } from './imports-support'

const FILE_TYPE = 'Fail mesti jenis CSV atau TXT dan tidak melebihi 5MB.'

describe('question imports (BE-10 AC 5, 9)', () => {
  let t: WorkflowTestApp
  let c: Record<'admin' | 'teacher' | 'otherTeacher' | 'schoolAdmin' | 'student', Client>
  let admin: UploadClient
  let teacher: UploadClient
  let schoolAdmin: UploadClient
  let student: UploadClient
  let ids: { subject: string; level: string }
  const runs = () => count(t.db, 'select count(*) as n from question_imports')
  const created = () => t.fake.calls.filter((x) => x.method === 'create')

  beforeAll(async () => {
    t = await bootWorkflowApp()
    c = await loginAll(t)
    admin = await uploadClient(t, 'admin')
    teacher = await uploadClient(t, 'teacher')
    schoolAdmin = await uploadClient(t, 'schoolAdmin')
    student = await uploadClient(t, 'student')
    ids = await curriculumIds(t)
  })
  afterAll(async () => {
    await t.close()
  })

  describe('templates', () => {
    it('admin template: file name, content type, CRLF bytes equal to the mock template, header equals the contract header', async () => {
      const res = await c.admin.get('/api/question-imports/template')
      expect(res.status).toBe(200)
      expect(res.headers['content-type']).toContain(QUESTION_IMPORT_TEMPLATE_CONTENT_TYPE)
      expect(res.headers['content-disposition']).toBe(`attachment; filename="${QUESTION_IMPORT_TEMPLATE_FILENAME}"`)
      expect(res.headers['cache-control']).toBe('no-store')
      const text = res.text
      expect(text).toBe(QUESTION_IMPORT_TEMPLATE_CSV)
      expect(text.split('\r\n')[0]).toBe(QUESTION_IMPORT_HEADER.join(','))
      expect(text.endsWith('\r\n')).toBe(true)
    })

    it('Guru template is templat-soalan.csv with the BM header and the PRD example row; an admin may download it too', async () => {
      const g = await c.teacher.get('/api/guru/questions/template')
      const ag = await c.admin.get('/api/guru/questions/template')
      expect(g.status).toBe(200)
      expect(g.headers['content-disposition']).toBe(`attachment; filename="${QUESTION_IMPORT_GURU_TEMPLATE_FILENAME}"`)
      expect(g.text).toBe(QUESTION_IMPORT_GURU_TEMPLATE_CSV)
      expect(g.text.split('\r\n')[0]).toBe(QUESTION_IMPORT_GURU_HEADER.join(','))
      expect(ag.text).toBe(g.text)
    })

    it('template roles: 401, Admin Sekolah, student and (admin route) Guru are 403', async () => {
      expectError(await t.http().get('/api/question-imports/template'), 'UNAUTHORIZED')
      expectError(await t.http().get('/api/guru/questions/template'), 'UNAUTHORIZED')
      expectError(await c.schoolAdmin.get('/api/question-imports/template'), 'FORBIDDEN')
      expectError(await c.student.get('/api/question-imports/template'), 'FORBIDDEN')
      expectError(await c.teacher.get('/api/question-imports/template'), 'FORBIDDEN')
      expectError(await c.schoolAdmin.get('/api/guru/questions/template'), 'FORBIDDEN')
      expectError(await c.student.get('/api/guru/questions/template'), 'FORBIDDEN')
    })
  })

  describe('POST /api/question-imports (admin)', () => {
    it('imports the valid rows as draft, reports the bad rows with file lines, stores the run, answers 201 with the flash', async () => {
      const before = created().length
      const res = await admin.upload('/api/question-imports', { name: 'campur.csv', body: fixture('import-mixed.csv', ids) })
      expect(res.status, JSON.stringify(res.body)).toBe(201)
      const body = QuestionImportCreatedSchema.parse(res.body)
      expect(body.status).toBe('Import selesai: 2 soalan diimport, 5 gagal.')
      expect(body.data).toMatchObject({ fileName: 'campur.csv', importedCount: 2, failedCount: 5, createdBy: admin.userId, defaults: { subjectId: null, educationLevelId: null, difficultyLevel: null } })
      expect(body.data.failures).toEqual([
        { row: 3, message: 'Baris tidak lengkap.' },
        { row: 4, message: 'Jawapan betul mesti A, B, C atau D.' },
        { row: 5, message: 'Subjek tidak sah.' },
        { row: 6, message: 'Tahap kesukaran mesti 1 hingga 5.' },
        { row: 7, message: 'Markah mesti nombor bulat sekurang-kurangnya 1.' },
      ])
      const made = created().slice(before).map((x) => x.args[0] as Record<string, unknown>)
      expect(made).toHaveLength(2)
      expect(made.every((m) => m.status === 'draft' && m.createdById === admin.userId && m.sourceType === 'excel')).toBe(true)
      expect(made[0]).toMatchObject({ stemMs: 'Apakah ibu negara Malaysia?', correctLabel: 'A', difficultyLevel: 2, subjectId: ids.subject, educationLevelId: ids.level })
      expect(made[1]).toMatchObject({ stemMs: 'Soalan dua baris\nbersambung', correctLabel: 'B', marks: 2 })
      // The creation status events (from null to draft) are recorded.
      expect(await count(t.db, `select count(*) as n from question_status_events where from_status is null and to_status = 'draft'`)).toBeGreaterThanOrEqual(2)
      expect(await count(t.db, 'select count(*) as n from question_imports where id = $1', [body.data.id])).toBe(1)
    })

    it('form defaults fill the cells the file leaves out', async () => {
      const before = created().length
      const res = await admin.upload(
        '/api/question-imports',
        { name: 'lalai.csv', body: fixture('import-defaults.csv', ids), type: 'text/plain' },
        { defaultSubjectId: ids.subject, defaultEducationLevelId: ids.level, defaultDifficultyLevel: '3' },
      )
      const run = parseData(res, QuestionImportCreatedSchema.shape.data)
      expect(run).toMatchObject({ importedCount: 2, failedCount: 0, defaults: { subjectId: ids.subject, educationLevelId: ids.level, difficultyLevel: 3 } })
      expect(created().slice(before).map((x) => (x.args[0] as { difficultyLevel: number }).difficultyLevel)).toEqual([3, 3])
    })

    it('without the defaults the same file fails every row (subject missing) but is still accepted', async () => {
      const before = created().length
      const res = await admin.upload('/api/question-imports', { name: 'tanpa.csv', body: fixture('import-defaults.csv', ids) })
      expect(res.status).toBe(201)
      expect(res.body.status).toBe('Import selesai: 0 soalan diimport, 2 gagal.')
      expect(created().length).toBe(before)
    })

    it('422 csvFile: missing file, wrong extension, wrong MIME, over 5 MB', async () => {
      const csv = fixture('import-defaults.csv', ids)
      const before = await runs()
      let res = await admin.upload('/api/question-imports', null)
      expectError(res, 'VALIDATION_ERROR')
      expect(res.body.error.fields.csvFile).toBe('Sila pilih fail CSV.')
      res = await admin.upload('/api/question-imports', { name: 'soalan.xlsx', body: csv })
      expect(res.body.error.fields.csvFile).toBe(FILE_TYPE)
      expect(res.status).toBe(422)
      res = await admin.upload('/api/question-imports', { name: 'soalan.csv', body: csv, type: 'application/pdf' })
      expect(res.status).toBe(422)
      expect(res.body.error.fields.csvFile).toBe(FILE_TYPE)
      res = await admin.upload('/api/question-imports', { name: 'besar.csv', body: Buffer.alloc(5 * 1024 * 1024 + 1024, 'a') })
      expect(res.status).toBe(422)
      expect(res.body.error.fields.csvFile).toBe(FILE_TYPE)
      expect(await runs()).toBe(before)
    })

    it('422 csvFile: missing required columns and no data rows', async () => {
      let res = await admin.upload('/api/question-imports', { name: 'x.csv', body: fixture('import-no-columns.csv', ids) })
      expect(res.status).toBe(422)
      expect(res.body.error.fields.csvFile).toBe('Fail CSV mesti mempunyai kolum option_b, correct_answer.')
      res = await admin.upload('/api/question-imports', { name: 'x.csv', body: fixture('import-header-only.csv', ids) })
      expect(res.status).toBe(422)
      expect(res.body.error.fields.csvFile).toBe('Fail CSV tiada baris data.')
      res = await admin.upload('/api/question-imports', { name: 'kosong.csv', body: '' })
      expect(res.status).toBe(422)
    })

    it('422 on an unknown or malformed default subject, level and difficulty', async () => {
      const file = { name: 'x.csv', body: fixture('import-defaults.csv', ids) }
      const res = await admin.upload('/api/question-imports', file, { defaultSubjectId: '999999', defaultEducationLevelId: 'abc', defaultDifficultyLevel: '6' })
      expect(res.status).toBe(422)
      expect(res.body.error.fields).toEqual({
        defaultSubjectId: 'Sila pilih subjek.',
        defaultEducationLevelId: 'Sila pilih tahap pendidikan.',
        defaultDifficultyLevel: 'Sila pilih tahap kesukaran.',
      })
    })

    it('nothing partial is kept when a create fails: no run row is stored', async () => {
      const before = await runs()
      const original = t.fake.create.bind(t.fake)
      let n = 0
      t.fake.create = async (input) => {
        if (++n === 2) throw new Error('boom')
        return original(input)
      }
      try {
        const res = await admin.upload('/api/question-imports', { name: 'gagal.csv', body: fixture('import-mixed.csv', ids) })
        expect(res.status).toBe(500)
      } finally {
        t.fake.create = original
      }
      expect(await runs()).toBe(before)
    })

    it('roles: 401, CSRF 403, Guru, Admin Sekolah and student 403', async () => {
      const file = { name: 'x.csv', body: fixture('import-defaults.csv', ids) }
      const before = await runs()
      expectError(await t.agent().post('/api/question-imports').attach('csvFile', Buffer.from('a'), 'x.csv'), 'UNAUTHORIZED')
      expectCsrfInvalid(await admin.upload('/api/question-imports', file, {}, false))
      expectError(await teacher.upload('/api/question-imports', file), 'FORBIDDEN')
      expectError(await schoolAdmin.upload('/api/question-imports', file), 'FORBIDDEN')
      expectError(await student.upload('/api/question-imports', file), 'FORBIDDEN')
      expect(await runs()).toBe(before)
    })
  })

  describe('GET /api/question-imports (history)', () => {
    it('lists the runs newest first, 20 per page, in the contract shape', async () => {
      const res = await c.admin.get('/api/question-imports')
      expect(res.status).toBe(200)
      const parsed = listEnvelopeOf(QuestionImportRunSchema).parse(res.body)
      expect(parsed.meta).toMatchObject({ page: 1, pageSize: 20, totalItems: await runs() })
      const stamps = parsed.data.map((r) => r.createdAt)
      expect([...stamps].sort().reverse()).toEqual(stamps)
      expect(parsed.data[0]?.createdMonth).toBe(parsed.data[0]?.createdAt.slice(0, 7))
      const page2 = await c.admin.get('/api/question-imports?page=2')
      expect(page2.status).toBe(200)
      expect(page2.body.data).toEqual([])
      expect((await c.admin.get('/api/question-imports?page=abc')).body.meta.page).toBe(1)
    })

    it('roles: 401, Guru, Admin Sekolah and student 403', async () => {
      expectError(await t.http().get('/api/question-imports'), 'UNAUTHORIZED')
      expectError(await c.teacher.get('/api/question-imports'), 'FORBIDDEN')
      expectError(await c.schoolAdmin.get('/api/question-imports'), 'FORBIDDEN')
      expectError(await c.student.get('/api/question-imports'), 'FORBIDDEN')
    })
  })

  describe('POST /api/guru/questions/import (S6-T06, API-GUR-19)', () => {
    const HEAD = QUESTION_IMPORT_GURU_HEADER.join(',')
    const row = (over: string[] = []): string => ['Matematik', '4', '', '', '', '', '2', 'Soalan?', 'a', 'b', 'c', 'd', 'A', '', ...over].slice(0, 14).join(',')
    const itemsOf = async (owner: string) =>
      t.db.query<{ batch: string; state: string }>(`select i.batch_id::text batch, i.review_state state from intake_items i join intake_batches b on b.id = i.batch_id where b.source = 'guru' and b.owner_user_id = $1`, [owner])

    it('valid rows become items of ONE guru batch ("Menunggu Semakan"); a bad row is reported and does not block the rest', async () => {
      const before = (await itemsOf(teacher.userId)).length
      const bankBefore = created().length
      const file = [HEAD, row(), row().replace(',A,', ',E,'), row()].join('\r\n')
      const res = await teacher.upload('/api/guru/questions/import', { name: 'guru.csv', body: file })
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(res.body.status).toBeUndefined()
      expect(parseData(res, QuestionImportGuruResultSchema)).toEqual({ imported: 2, errors: [{ row: 3, message: 'Jawapan mesti A, B, C atau D.' }] })
      const items = (await itemsOf(teacher.userId)).slice(before)
      expect(items).toHaveLength(2)
      expect(new Set(items.map((i) => i.batch)).size).toBe(1)
      expect(items.every((i) => i.state === 'needs_review')).toBe(true)
      expect(created().length).toBe(bankBefore) // no bank.create: the rows are intake items
    })

    it('only the teacher caps apply: more than 500 rows is "Fail melebihi 500 baris." and nothing is created', async () => {
      const before = (await itemsOf(teacher.userId)).length
      const file = [HEAD, ...Array.from({ length: 501 }, () => row())].join('\n')
      const res = await teacher.upload('/api/guru/questions/import', { name: 'besar.csv', body: file })
      expect(expectError(res, 'VALIDATION_ERROR').fields?.csvFile).toBe('Fail melebihi 500 baris.')
      expect((await itemsOf(teacher.userId)).length).toBe(before)
    })

    it('accepts the JSON field csv; 500 rows exactly is accepted', async () => {
      const res = await c.teacher.post('/api/guru/questions/import', { csv: [HEAD, ...Array.from({ length: 500 }, () => row())].join('\n') })
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(res.body.data).toEqual({ imported: 500, errors: [] })
    })

    it('an admin may use it too', async () => {
      const res = await admin.upload('/api/guru/questions/import', { name: 'a.csv', body: [HEAD, row()].join('\n') })
      expect(res.status).toBe(200)
      expect(res.body.data.imported).toBe(1)
    })

    it('422 csvFile for none chosen, a non-CSV file, over 2 MB, a missing column and no data rows', async () => {
      const f = async (r: Promise<{ body: { error: { fields: { csvFile: string } } } }>) => (await r).body.error.fields.csvFile
      expect(await f(teacher.upload('/api/guru/questions/import', null))).toBe('Sila pilih fail.')
      expect(await f(teacher.upload('/api/guru/questions/import', { name: 'a.xlsx', body: 'x' }))).toBe('Jenis fail tidak disokong. Format dibenarkan: CSV.')
      expect(await f(teacher.upload('/api/guru/questions/import', { name: 'a.csv', body: 'x'.repeat(2 * 1024 * 1024 + 1) }))).toBe('Fail melebihi saiz maksimum 2 MB.')
      expect(await f(teacher.upload('/api/guru/questions/import', { name: 'a.csv', body: 'subjek,tingkatan\nMatematik,4' }))).toMatch(/^Lajur wajib tiada: .*soalan.*\. Gunakan templat yang disediakan\.$/)
      expect(await f(teacher.upload('/api/guru/questions/import', { name: 'a.csv', body: HEAD }))).toBe('Fail CSV tiada baris data.')
    })

    it('roles: 401, CSRF 403, Admin Sekolah and student 403', async () => {
      const file = { name: 'x.csv', body: [HEAD, row()].join('\n') }
      const before = (await itemsOf(teacher.userId)).length
      expectError(await t.agent().post('/api/guru/questions/import').attach('csvFile', Buffer.from('a'), 'x.csv'), 'UNAUTHORIZED')
      expectCsrfInvalid(await teacher.upload('/api/guru/questions/import', file, {}, false))
      expectError(await schoolAdmin.upload('/api/guru/questions/import', file), 'FORBIDDEN')
      expectError(await student.upload('/api/guru/questions/import', file), 'FORBIDDEN')
      expect((await itemsOf(teacher.userId)).length).toBe(before)
    })
  })
})
