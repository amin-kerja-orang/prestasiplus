import {
  QUESTION_IMPORT_ERROR_CSV_FILENAME,
  QUESTION_IMPORT_ERROR_CSV_HEADER,
  QUESTION_IMPORT_CODE_HEADER,
  QUESTION_IMPORT_TEMPLATE_CONTENT_TYPE,
  QUESTION_IMPORT_TEMPLATE_CSV,
  QUESTION_IMPORT_TEMPLATE_FILENAME,
  QuestionImportCreatedSchema,
  QuestionImportGuruResultSchema,
  QuestionImportRunSchema,
  listEnvelopeOf,
} from '@pp/contract'
import { crc32, deflateRawSync, deflateSync } from 'node:zlib'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { ApiError } from '../../src/common/errors/api-error'
import { FILE_STORAGE, type FileStorage } from '../../src/modules/files'
import { StimuliService } from '../../src/modules/questions'
import { buildCsv, parseCsv, readZipFiles } from '../../src/modules/questions/workflow/imports/csv'
import { IMPORT_ZIP } from '../../src/modules/questions/workflow/imports/imports.constants'

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
    it('admin template: file name, content type, CRLF bytes equal to the mock template, header equals the code header of Q-11', async () => {
      const res = await c.admin.get('/api/question-imports/template')
      expect(res.status).toBe(200)
      expect(res.headers['content-type']).toContain(QUESTION_IMPORT_TEMPLATE_CONTENT_TYPE)
      expect(res.headers['content-disposition']).toBe(`attachment; filename="${QUESTION_IMPORT_TEMPLATE_FILENAME}"`)
      expect(res.headers['cache-control']).toBe('no-store')
      const text = res.text
      expect(text).toBe(QUESTION_IMPORT_TEMPLATE_CSV)
      expect(text.split('\r\n')[0]).toBe(QUESTION_IMPORT_CODE_HEADER.join(','))
      expect(text.endsWith('\r\n')).toBe(true)
    })

    it('Guru template has the same bytes; an admin may download it too', async () => {
      const a = await c.admin.get('/api/question-imports/template')
      const g = await c.teacher.get('/api/guru/questions/template')
      const ag = await c.admin.get('/api/guru/questions/template')
      expect(g.status).toBe(200)
      expect(g.headers['content-disposition']).toBe(`attachment; filename="${QUESTION_IMPORT_TEMPLATE_FILENAME}"`)
      expect(g.text).toBe(a.text)
      expect(ag.text).toBe(a.text)
      expect(a.text).toBe(QUESTION_IMPORT_TEMPLATE_CSV)
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

  describe('POST /api/guru/questions/import', () => {
    it('creates review questions owned by the caller, answers 200 { imported, failed } with no flash, and stores the run', async () => {
      const before = created().length
      const runsBefore = await runs()
      const res = await teacher.upload('/api/guru/questions/import', { name: 'guru.csv', body: fixture('import-mixed.csv', ids) })
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(res.body.status).toBeUndefined()
      const data = parseData(res, QuestionImportGuruResultSchema)
      expect(data.imported).toBe(2)
      expect(data.failed.map((f) => f.row)).toEqual([3, 4, 5, 6, 7])
      const made = created().slice(before).map((x) => x.args[0] as Record<string, unknown>)
      expect(made).toHaveLength(2)
      expect(made.every((m) => m.status === 'review' && m.createdById === teacher.userId)).toBe(true)
      expect(await runs()).toBe(runsBefore + 1)
    })

    it('has no form defaults: a file without subject columns fails every row', async () => {
      const res = await teacher.upload('/api/guru/questions/import', { name: 'guru.csv', body: fixture('import-defaults.csv', ids) }, { defaultSubjectId: ids.subject })
      expect(res.status).toBe(200)
      expect(res.body.data).toEqual({
        imported: 0,
        failed: [{ row: 2, message: 'Subjek tidak sah.' }, { row: 3, message: 'Subjek tidak sah.' }],
      })
    })

    it('applies the length caps and orders failures by file row', async () => {
      const head = 'question_text,option_a,option_b,option_c,correct_answer,subject_id,education_level_id,difficulty_level'
      const tail = `${ids.subject},${ids.level},1`
      const file = [
        head,
        `"${'x'.repeat(2001)}",A,B,C,A,${tail}`,
        `"ok",A,B,C,Z,${tail}`,
        `"ok",${'y'.repeat(501)},B,C,A,${tail}`,
        `"${'x'.repeat(2000)}",${'y'.repeat(500)},B,C,A,${tail}`,
      ].join('\n')
      const res = await teacher.upload('/api/guru/questions/import', { name: 'had.csv', body: file })
      expect(res.body.data.imported).toBe(1)
      expect(res.body.data.failed).toEqual([
        { row: 2, message: 'Soalan tidak boleh melebihi 2000 aksara.' },
        { row: 3, message: 'Jawapan betul mesti A, B, C atau D.' },
        { row: 4, message: 'Pilihan jawapan tidak boleh melebihi 500 aksara.' },
      ])
    })

    it('an admin may use it; the questions are owned by the admin and saved as review', async () => {
      const before = created().length
      const res = await admin.upload('/api/guru/questions/import', { name: 'a.csv', body: fixture('import-mixed.csv', ids) })
      expect(res.status).toBe(200)
      expect(created().slice(before).every((x) => (x.args[0] as { createdById: string }).createdById === admin.userId)).toBe(true)
    })

    it('422 csvFile for a missing file, a wrong type, missing columns and no data rows', async () => {
      expect((await teacher.upload('/api/guru/questions/import', null)).body.error.fields.csvFile).toBe('Sila pilih fail CSV.')
      expect((await teacher.upload('/api/guru/questions/import', { name: 'a.pdf', body: 'x' })).body.error.fields.csvFile).toBe(FILE_TYPE)
      expect((await teacher.upload('/api/guru/questions/import', { name: 'a.csv', body: fixture('import-no-columns.csv', ids) })).status).toBe(422)
      expect((await teacher.upload('/api/guru/questions/import', { name: 'a.csv', body: fixture('import-header-only.csv', ids) })).body.error.fields.csvFile).toBe('Fail CSV tiada baris data.')
    })

    it('roles: 401, CSRF 403, Admin Sekolah and student 403', async () => {
      const file = { name: 'x.csv', body: fixture('import-mixed.csv', ids) }
      const before = created().length
      expectError(await t.agent().post('/api/guru/questions/import').attach('csvFile', Buffer.from('a'), 'x.csv'), 'UNAUTHORIZED')
      expectCsrfInvalid(await teacher.upload('/api/guru/questions/import', file, {}, false))
      expectError(await schoolAdmin.upload('/api/guru/questions/import', file), 'FORBIDDEN')
      expectError(await student.upload('/api/guru/questions/import', file), 'FORBIDDEN')
      expect(created().length).toBe(before)
    })
  })
})


/**
 * S1-T05 part 1 over HTTP on the REAL bank: the new header with codes, the DSKP fields that make a row publishable (QE6.3, AC-ADM-QE6.2,
 * AC-ADM-Q11.1), the 2,000-row cap on both routes, partial success per question and the error CSV (FR-ADM-QE6.2).
 */
describe('S1-T05 part 1: CSV with DSKP codes (real bank)', () => {
  let t: WorkflowTestApp
  let c: Record<'admin' | 'teacher' | 'otherTeacher' | 'schoolAdmin' | 'student', Client>
  let admin: UploadClient
  let teacher: UploadClient
  let tag: { subjectId: string; levelId: string; subject: string; tingkatan: string; unit: string; sp: string; bab: string; topik: string; chapterId: string; topicId: string }

  const HEAD = 'question_key,type,prompt_ms,option_a,option_b,option_c,option_d,correct,marks,subject_code,tingkatan,kertas,number_label,unit_code,sp_kod,tp,aras,kbat,bab_kod,topik_kod,difficulty'
  const line = (over: Record<string, string> = {}): string => {
    const base: Record<string, string> = {
      question_key: 'S1', type: 'mcq', prompt_ms: 'Berapakah hasil tambah dua dan tiga?', option_a: '4', option_b: '5', option_c: '6', option_d: '7', correct: 'B', marks: '2',
      subject_code: tag.subject, tingkatan: tag.tingkatan, kertas: '1', number_label: '12A', unit_code: tag.unit, sp_kod: tag.sp, tp: '3', aras: 'mengaplikasi', kbat: '',
      bab_kod: tag.bab, topik_kod: tag.topik, difficulty: '3',
    }
    return HEAD.split(',').map((col) => (over[col] ?? base[col] ?? '').replace(/^(.*[",\n].*)$/s, (v) => `"${v.replaceAll('"', '""')}"`)).join(',')
  }
  const csvOf = (...rows: string[]) => [HEAD, ...rows].join('\n')
  const importAdmin = (body: string, name = 'kod.csv') => admin.upload('/api/question-imports', { name, body })
  const runs = () => count(t.db, 'select count(*) as n from question_imports')

  beforeAll(async () => {
    t = await bootWorkflowApp({ bank: 'real', env: { THROTTLE_QUESTIONS_WRITE_PER_MINUTE: '100000' } })
    c = await loginAll(t)
    admin = await uploadClient(t, 'admin')
    teacher = await uploadClient(t, 'teacher')
    const [row] = await t.db.query<{ subject_id: string; education_level_id: string; unit_node_id: string; sp: string }>(
      `select v.subject_id::text, v.education_level_id::text, v.unit_node_id::text,
              (select node_id::text from question_version_sp_nodes where question_version_id = v.id limit 1) as sp
         from question_versions v where v.number_label = 'SEED-MCQ-MATH-T4'`,
    )
    const [names] = await t.db.query<{ subject: string; level: string; unit: string; sp: string }>(
      `select (select code from subjects where id = $1::bigint) as subject, (select code from education_levels where id = $2::bigint) as level,
              (select code from curriculum_nodes where id = $3::bigint) as unit, (select code from curriculum_nodes where id = $4::bigint) as sp`,
      [row!.subject_id, row!.education_level_id, row!.unit_node_id, row!.sp],
    )
    const [chapter] = await t.db.query<{ id: string }>(
      `insert into chapters (subject_id, education_level_id, name, chapter_number, is_active) values ($1::bigint, $2::bigint, 'Bab S1-T05', 955, true) returning id::text`,
      [row!.subject_id, row!.education_level_id],
    )
    const [topic] = await t.db.query<{ id: string }>(`insert into topics (chapter_id, name, topic_number, is_active) values ($1::bigint, 'Topik S1-T05', '2', true) returning id::text`, [chapter!.id])
    tag = {
      subjectId: row!.subject_id,
      levelId: row!.education_level_id,
      subject: names!.subject,
      tingkatan: names!.level.replace(/^T/, ''),
      unit: names!.unit,
      sp: names!.sp,
      bab: '955',
      topik: '2',
      chapterId: chapter!.id,
      topicId: topic!.id,
    }
  })
  afterAll(async () => {
    await t.close()
  })

  it('[CI] a row with every DSKP column imports with its unit, SP, TP, aras, chapter and topic and passes the publish gate through the existing approve route', async () => {
    const res = await importAdmin(csvOf(line({ question_key: 'PUB1' })))
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    expect(res.body.status).toBe('Import selesai: 1 soalan diimport, 0 gagal.')
    expect(res.body.warnings).toBeUndefined()
    const [v] = await t.db.query<{ question_id: string; status: string; unit_node_id: string; difficulty_tp: number; difficulty_level: number; chapter_id: string; topic_id: string; paper_code: string | null; number_label: string; cognitive: string | null; part_kbat: string | null }>(
      `select question_id::text, status, unit_node_id::text, difficulty_tp, difficulty_level, chapter_id::text, topic_id::text, paper_code, number_label,
              (select cognitive_level from question_parts where question_version_id = v.id limit 1) as cognitive,
              (select kbat from question_parts where question_version_id = v.id limit 1) as part_kbat
         from question_versions v order by id desc limit 1`,
    )
    expect(v).toMatchObject({ status: 'draft', difficulty_tp: 3, difficulty_level: 3, chapter_id: tag.chapterId, topic_id: tag.topicId, number_label: '12A' })
    expect(v!.unit_node_id).not.toBeNull()
    expect(v!.cognitive).toBe('mengaplikasi')
    expect(v!.paper_code).toMatch(/1$/)
    const sps = await t.db.query<{ code: string }>(`select n.code from question_version_sp_nodes q join curriculum_nodes n on n.id = q.node_id where q.question_version_id = (select id from question_versions order by id desc limit 1)`)
    expect(sps.map((r) => r.code)).toEqual([tag.sp])
    // Terbitkan: no wizard step, no 422.
    const submit = await c.admin.post(`/api/questions/${v!.question_id}/status`, { to: 'review' })
    expect(submit.status, JSON.stringify(submit.body)).toBe(200)
    const approve = await c.admin.post(`/api/questions/${v!.question_id}/status`, { to: 'approved' })
    expect(approve.status, JSON.stringify(approve.body)).toBe(200)
    const [after] = await t.db.query<{ status: string }>('select status from question_versions where question_id = $1::bigint order by version_no desc limit 1', [v!.question_id])
    expect(after!.status).toBe('approved')
  })

  it('[CI] an explicit kbat is kept on the leaf', async () => {
    const res = await importAdmin(csvOf(line({ question_key: 'KB1', kbat: 'bukan' })))
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const [v] = await t.db.query<{ kbat: string | null }>('select kbat from question_parts where question_version_id = (select id from question_versions order by id desc limit 1)')
    expect(v!.kbat).toBe('bukan')
  })

  it('[CI] partial success per question: valid questions are imported, an invalid one is skipped whole, and the failures carry key, field, code and the exact text', async () => {
    const before = await count(t.db, 'select count(*) as n from questions')
    const res = await importAdmin(
      csvOf(line({ question_key: 'OK1' }), line({ question_key: 'BAD1', tp: '9', aras: 'pandai' }), line({ question_key: 'OK2', number_label: '13' }), line({ question_key: 'BAD2', sp_kod: '1;2;3;4' })),
    )
    expect(res.status).toBe(201)
    const body = QuestionImportCreatedSchema.parse(res.body)
    expect(body.status).toBe('Import selesai: 2 soalan diimport, 2 gagal.')
    expect(body.data.failures).toEqual([
      { row: 3, message: 'Baris 3: TP mesti antara 1 dan 6.', questionKey: 'BAD1', field: 'tp', code: 'TP_RANGE' },
      { row: 3, message: 'Baris 3: Aras pemikiran tidak sah.', questionKey: 'BAD1', field: 'aras', code: 'ARAS_INVALID' },
      { row: 5, message: 'Baris 5: Pilih paling banyak 3 SP.', questionKey: 'BAD2', field: 'sp_kod', code: 'SP_TOO_MANY' },
    ])
    expect(await count(t.db, 'select count(*) as n from questions')).toBe(before + 2)
  })

  it('[CI] unknown header cells give a warning in the answer, and the legacy header gives none', async () => {
    const res = await importAdmin(`${HEAD},Warna\n${line({ question_key: 'W1' })},merah`)
    expect(res.status).toBe(201)
    expect(res.body.warnings).toEqual(['Kolum Warna tidak dikenali dan diabaikan.'])
    const legacy = await admin.upload('/api/question-imports', { name: 'lama.csv', body: fixture('import-defaults.csv', { subject: tag.subjectId, level: tag.levelId }) }, { defaultSubjectId: tag.subjectId, defaultEducationLevelId: tag.levelId, defaultDifficultyLevel: '2' })
    expect(legacy.status).toBe(201)
    expect(legacy.body.warnings).toBeUndefined()
    expect(legacy.body.data.failures).toEqual([])
  })

  it('[CI] the new header works on the Guru route: review questions, Guru caps, warnings', async () => {
    const res = await teacher.upload('/api/guru/questions/import', {
      name: 'guru-kod.csv',
      body: csvOf(line({ question_key: 'G1' }), line({ question_key: 'G2', prompt_ms: 'x'.repeat(2001) }), line({ question_key: 'G3', option_a: 'y'.repeat(501) })),
    })
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    const data = QuestionImportGuruResultSchema.parse(res.body.data)
    expect(data.imported).toBe(1)
    expect(data.failed.map((f) => [f.row, f.message])).toEqual([
      [3, 'Baris 3: Soalan tidak boleh melebihi 2000 aksara.'],
      [4, 'Baris 4: Pilihan jawapan tidak boleh melebihi 500 aksara.'],
    ])
    const [v] = await t.db.query<{ status: string; created_by_id: string }>(
      `select v.status, q.created_by_id::text from question_versions v join questions q on q.id = v.question_id order by v.id desc limit 1`,
    )
    expect(v).toEqual({ status: 'review', created_by_id: teacher.userId })
  })

  it('[CI] more than 2,000 data rows is refused whole with 422 on the admin and the Guru route, for both headers, and nothing is stored', async () => {
    const message = 'Fail melebihi 2,000 baris. Pecahkan fail kepada beberapa bahagian.'
    const questions = await count(t.db, 'select count(*) as n from questions')
    const before = await runs()
    const codeRows = Array.from({ length: 2001 }, (_, i) => line({ question_key: `R${String(i)}` }))
    const legacyHead = 'question_text,option_a,option_b,option_c,option_d,correct_answer,subject_id,education_level_id,difficulty_level,marks'
    const legacyRows = Array.from({ length: 2001 }, () => `"Soalan sepuluh aksara",A,B,C,D,A,${tag.subjectId},${tag.levelId},1,1`)
    for (const body of [csvOf(...codeRows), [legacyHead, ...legacyRows].join('\n')]) {
      for (const [client, url] of [[admin, '/api/question-imports'], [teacher, '/api/guru/questions/import']] as const) {
        const res = await client.upload(url, { name: 'besar.csv', body })
        expect(res.status).toBe(422)
        expect(res.body.error.fields.csvFile).toBe(message)
      }
    }
    expect(await runs()).toBe(before)
    expect(await count(t.db, 'select count(*) as n from questions')).toBe(questions)
  })

  describe('groups and stimuli (S1-T05 part 2)', () => {
    const GHEAD = `${HEAD},group_key,group_order,group_id,stimulus_label,stimulus_kind,stimulus_text,part_stimulus`
    const gline = (over: Record<string, string> = {}): string => {
      const extra = GHEAD.split(',').slice(HEAD.split(',').length)
      return `${line(over)},${extra.map((c) => (over[c] ?? '').replace(/^(.*[",\n].*)$/s, (v) => `"${v.replaceAll('"', '""')}"`)).join(',')}`
    }
    const FIRST = { group_key: 'G1', stimulus_label: 'Rajah 1', stimulus_kind: 'passage', stimulus_text: 'Petikan ringkas tentang pasar raya.' }
    const gcsv = (...rows: string[]) => [GHEAD, ...rows].join('\n')
    const groupCount = () => count(t.db, 'select count(*) as n from stimulus_groups')

    it('[CI] a CSV of one group of 3 yields one group with 3 members in group_order and one stimulus, all drafts, in the same import', async () => {
      const groups = await groupCount()
      const stimuli = await count(t.db, 'select count(*) as n from stimuli')
      const res = await importAdmin(
        gcsv(
          gline({ question_key: 'GA', group_order: '3', ...FIRST, prompt_ms: 'Soalan ketiga dalam kumpulan ini?' }),
          gline({ question_key: 'GB', group_order: '1', group_key: 'G1', prompt_ms: 'Soalan pertama dalam kumpulan ini?' }),
          gline({ question_key: 'GC', group_order: '2', group_key: 'G1', prompt_ms: 'Soalan kedua dalam kumpulan ini?' }),
        ),
        'kumpulan.csv',
      )
      expect(res.status, JSON.stringify(res.body)).toBe(201)
      expect(res.body.status).toBe('Import selesai: 3 soalan diimport, 0 gagal.')
      expect(await groupCount()).toBe(groups + 1)
      expect(await count(t.db, 'select count(*) as n from stimuli')).toBe(stimuli + 1)
      const members = await t.db.query<{ stem: string; status: string }>(
        `select v.stem_ms as stem, v.status from question_versions v join questions q on q.id = v.question_id
          where q.group_id = (select max(id) from stimulus_groups) order by q.group_position`,
      )
      expect(members.map((m) => m.stem)).toEqual(['Soalan pertama dalam kumpulan ini?', 'Soalan kedua dalam kumpulan ini?', 'Soalan ketiga dalam kumpulan ini?'])
      expect(members.every((m) => m.status === 'draft')).toBe(true)
      const [g] = await t.db.query<{ subject_id: string | null; education_level_id: string | null }>('select subject_id::text, education_level_id::text from stimulus_groups order by id desc limit 1')
      expect(g).toEqual({ subject_id: tag.subjectId, education_level_id: tag.levelId })
    })

    it('[CI] a group whose creation fails is skipped whole (nothing of it is kept) while the other questions still import', async () => {
      // An existing group of ANOTHER subject: the planner accepts group_id, the S1-T01 member rule refuses at execute time.
      const [other] = await t.db.query<{ id: string }>('select id::text from subjects where id <> $1::bigint order by id limit 1', [tag.subjectId])
      const stimuliSvc = t.app.get(StimuliService)
      const made = await stimuliSvc.createStimulus({ kind: 'passage', label: 'Lain', body: { ms: 'Petikan subjek lain.' } })
      const other_g = await stimuliSvc.createGroup({ stimulusIds: [made.result.id], questionIds: [], subjectId: other!.id })
      const before = await count(t.db, 'select count(*) as n from questions')
      const res = await importAdmin(
        gcsv(
          gline({ question_key: 'OKA', prompt_ms: 'Soalan biasa pertama sebelum kumpulan?' }),
          gline({ question_key: 'GJ1', group_id: other_g.result.id, prompt_ms: 'Ahli kumpulan yang akan ditolak?' }),
          gline({ question_key: 'GJ2', group_id: '', group_key: '', prompt_ms: 'Soalan biasa kedua selepas kumpulan?' }),
        ),
      )
      expect(res.status, JSON.stringify(res.body)).toBe(201)
      expect(res.body.status).toBe('Import selesai: 2 soalan diimport, 1 gagal.')
      expect(res.body.data.failures).toEqual([
        { row: 3, message: 'Baris 3: Subjek dan Tingkatan ahli mesti sama dengan kumpulan.', questionKey: 'GJ1', field: 'group_key', code: 'GROUP_REJECTED' },
      ])
      expect(await count(t.db, 'select count(*) as n from questions')).toBe(before + 2)
    })

    it('[CI] group_id of a group with a member shown to pupils gives "Kumpulan tidak dijumpai atau sedang dipaparkan kepada murid."', async () => {
      const made = await importAdmin(gcsv(gline({ question_key: 'SV1', ...FIRST, group_key: 'GS', prompt_ms: 'Soalan untuk kumpulan yang diterbitkan?' })))
      expect(made.status, JSON.stringify(made.body)).toBe(201)
      const [g] = await t.db.query<{ id: string }>('select max(id)::text as id from stimulus_groups')
      const [member] = await t.db.query<{ id: string }>('select id::text from questions where group_id = $1::bigint', [g!.id])
      expect((await c.admin.post(`/api/questions/${member!.id}/status`, { to: 'review' })).status).toBe(200)
      const published = await c.admin.post(`/api/stimulus-groups/${g!.id}/publish`, {})
      expect(published.status, JSON.stringify(published.body)).toBeLessThan(300)
      const res = await importAdmin(gcsv(gline({ question_key: 'SV2', group_key: '', group_id: g!.id, prompt_ms: 'Soalan yang mahu menyertai kumpulan itu?' })))
      expect(res.status).toBe(201)
      expect(res.body.data.failures).toEqual([
        { row: 2, message: 'Baris 2: Kumpulan tidak dijumpai atau sedang dipaparkan kepada murid.', questionKey: 'SV2', field: 'group_id', code: 'GROUP_UNAVAILABLE' },
      ])
    })

    it('[CI] a URL stimulus_image is a row error and nothing of the group is created', async () => {
      const groups = await groupCount()
      const res = await importAdmin(
        [`${GHEAD},stimulus_image,stimulus_alt`, `${gline({ question_key: 'IM1', ...FIRST, stimulus_kind: 'image' })},https://contoh.test/a.png,Gambar`].join('\n'),
      )
      expect(res.status).toBe(201)
      expect(res.body.data.failures.map((f: { message: string }) => f.message)).toEqual(['Baris 2: Imej rangsangan tidak dapat dimuat turun.'])
      expect(await groupCount()).toBe(groups)
    })

    it('[CI] the error CSV keeps the group texts and caps a 500-character group key', async () => {
      const key = 'M'.repeat(500)
      const res = await importAdmin(gcsv(gline({ question_key: 'MX1', ...FIRST, group_key: key }), gline({ question_key: 'MX2', group_key: key, kertas: '2' })), 'campur.csv')
      expect(res.status).toBe(201)
      const csv = await c.admin.get(`/api/question-imports/${res.body.data.id as string}/errors`)
      expect(csv.text.split('\r\n')[1]).toBe(`3,MX2,group_key,GROUP_MIXED,Baris 3: kumpulan ${'M'.repeat(40)} bercampur subjek atau kertas.`)
      expect(csv.text).not.toContain('M'.repeat(41))
      expect(csv.text).not.toContain('Petikan ringkas')
    })
  })

  describe('GET /api/question-imports/:id/errors', () => {
    let runId: string
    beforeAll(async () => {
      const res = await importAdmin(
        csvOf(
          line({ question_key: 'E-OK' }),
          line({ question_key: '=SUM(1)', subject_code: 'XYZ', prompt_ms: 'RAHSIA-ISI-SOALAN-123', option_a: 'RAHSIA-PILIHAN-A' }),
          line({ question_key: 'E3', unit_code: '9.9' }),
        ),
        'ralat.csv',
      )
      expect(res.status, JSON.stringify(res.body)).toBe(201)
      runId = res.body.data.id as string
    })

    it('[CI] returns a CSV with the five columns, one line per row error, the Q-11 messages, formula-safe cells and no cell values of the file', async () => {
      const res = await c.admin.get(`/api/question-imports/${runId}/errors`)
      expect(res.status).toBe(200)
      expect(res.headers['content-type']).toContain('text/csv')
      expect(res.headers['content-disposition']).toBe(`attachment; filename="${QUESTION_IMPORT_ERROR_CSV_FILENAME}"`)
      expect(res.headers['cache-control']).toBe('no-store')
      const lines = res.text.split('\r\n')
      expect(lines[0]).toBe(QUESTION_IMPORT_ERROR_CSV_HEADER.join(','))
      expect(lines[0]).toBe('baris,question_key,medan,kod_ralat,mesej')
      expect(lines.slice(1)).toEqual([
        "3,'=SUM(1),subject_code,SUBJECT_UNKNOWN,Baris 3: Kod subjek tidak dikenali.",
        '4,E3,unit_code,UNIT_UNKNOWN,Baris 4: Kod unit tiada dalam senarai kurikulum.',
        '',
      ])
      for (const secret of ['RAHSIA', 'Berapakah', tag.subject, tag.sp]) expect(res.text).not.toContain(secret)
    })

    it('[CI] a 500-character key or SP code is capped at 40 characters in the stored failure and in the error CSV', async () => {
      const res = await importAdmin(csvOf(line({ question_key: 'L1', sp_kod: 'z'.repeat(500) }), line({ question_key: 'L'.repeat(500) }), line({ question_key: 'L'.repeat(500) })), 'panjang.csv')
      expect(res.status).toBe(201)
      const csv = await c.admin.get(`/api/question-imports/${res.body.data.id as string}/errors`)
      expect(csv.text).toContain(`SP ""${'z'.repeat(40)}"" tiada dalam senarai kurikulum.`)
      expect(csv.text).toContain(`Kunci soalan ${'L'.repeat(40)} berulang dalam fail.`)
      expect(csv.text).not.toContain('z'.repeat(41))
      expect(csv.text).not.toContain('L'.repeat(41))
      expect(JSON.stringify(res.body)).not.toContain('z'.repeat(41))
    })

    it('404 for an unknown or malformed run id; 401, Guru, Admin Sekolah and student 403', async () => {
      expectError(await c.admin.get('/api/question-imports/99999999/errors'), 'NOT_FOUND')
      expectError(await c.admin.get('/api/question-imports/abc/errors'), 'NOT_FOUND')
      expectError(await t.http().get(`/api/question-imports/${runId}/errors`), 'UNAUTHORIZED')
      expectError(await c.teacher.get(`/api/question-imports/${runId}/errors`), 'FORBIDDEN')
      expectError(await c.schoolAdmin.get(`/api/question-imports/${runId}/errors`), 'FORBIDDEN')
      expectError(await c.student.get(`/api/question-imports/${runId}/errors`), 'FORBIDDEN')
    })

    it('a run of the legacy header gives the header and its lines with empty key, field and code', async () => {
      const res = await admin.upload('/api/question-imports', { name: 'lama.csv', body: fixture('import-mixed.csv', { subject: tag.subjectId, level: tag.levelId }) })
      const csv = await c.admin.get(`/api/question-imports/${res.body.data.id as string}/errors`)
      expect(csv.text.split('\r\n').slice(0, 3)).toEqual(['baris,question_key,medan,kod_ralat,mesej', '3,,,,Baris tidak lengkap.', '4,,,,Jawapan betul mesti A, B, C atau D.'.replace(/^(.*,)(Jawapan.*)$/, '$1"$2"')])
    })
  })
})

/* ---------------------------------------------------------------------------------------- S1-T05 part 3: the image ZIP and the template */

interface ZipEntry { name: string; data: Buffer; store?: boolean; declared?: number }

/** A ZIP built by hand so a test can lie in the headers (`declared` is the uncompressed size the headers claim). */
function buildZip(entries: ZipEntry[]): Buffer {
  const locals: Buffer[] = []
  const central: Buffer[] = []
  let offset = 0
  for (const e of entries) {
    const name = Buffer.from(e.name, 'utf8')
    const body = e.store ? e.data : deflateRawSync(e.data)
    const declared = e.declared ?? e.data.length
    const lh = Buffer.alloc(30)
    lh.writeUInt32LE(0x04034b50, 0)
    lh.writeUInt16LE(20, 4)
    lh.writeUInt16LE(0x800, 6)
    lh.writeUInt16LE(e.store ? 0 : 8, 8)
    lh.writeUInt32LE(crc32(e.data), 14)
    lh.writeUInt32LE(body.length, 18)
    lh.writeUInt32LE(declared, 22)
    lh.writeUInt16LE(name.length, 26)
    locals.push(lh, name, body)
    const ch = Buffer.alloc(46)
    ch.writeUInt32LE(0x02014b50, 0)
    ch.writeUInt16LE(20, 4)
    ch.writeUInt16LE(20, 6)
    ch.writeUInt16LE(0x800, 8)
    ch.writeUInt16LE(e.store ? 0 : 8, 10)
    ch.writeUInt32LE(crc32(e.data), 16)
    ch.writeUInt32LE(body.length, 20)
    ch.writeUInt32LE(declared, 24)
    ch.writeUInt16LE(name.length, 28)
    ch.writeUInt32LE(offset, 42)
    central.push(ch, name)
    offset += 30 + name.length + body.length
  }
  const cd = Buffer.concat(central)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(cd.length, 12)
  end.writeUInt32LE(offset, 16)
  return Buffer.concat([...locals, cd, end])
}

const pngChunk = (type: string, data: Buffer): Buffer => {
  const head = Buffer.alloc(8)
  head.writeUInt32BE(data.length, 0)
  head.write(type, 4, 'latin1')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0)
  return Buffer.concat([head, data, crc])
}
/** A real 1 x 1 PNG (passes the same content inspection as POST /files). */
function tinyPng(): Buffer {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(1, 0)
  ihdr.writeUInt32BE(1, 4)
  ihdr.set([8, 6, 0, 0, 0], 8)
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), pngChunk('IHDR', ihdr), pngChunk('IDAT', deflateSync(Buffer.from([0, 255, 0, 0, 255]))), pngChunk('IEND', Buffer.alloc(0))])
}

describe('S1-T05 part 3: image ZIP reader (bomb and slip limits)', () => {
  const limits = { maxEntries: IMPORT_ZIP.maxEntries, maxTotalBytes: IMPORT_ZIP.maxTotalBytes, maxEntryBytes: IMPORT_ZIP.maxEntryBytes }
  it('[CI] the limits are 20 MB ZIP, 100 entries, 40 MB unpacked, 2 MB an image', () => {
    expect(IMPORT_ZIP).toEqual({ maxBytes: 20 * 1024 * 1024, maxEntries: 100, maxTotalBytes: 40 * 1024 * 1024, maxEntryBytes: 2 * 1024 * 1024 })
  })

  it('[CI] zip slip: an entry named ../x.png, /abs.png, a drive path or with a NUL is dropped; a safe entry is keyed by its base name', () => {
    const png = tinyPng()
    const files = readZipFiles(
      buildZip([
        { name: '../x.png', data: png },
        { name: '/abs.png', data: png },
        { name: 'C:\\win.png', data: png },
        { name: 'a/../../y.png', data: png },
        { name: 'bad\0.png', data: png },
        { name: 'folder/sub/ok.png', data: png },
      ]),
      limits,
    )
    expect([...files.keys()]).toEqual(['ok.png'])
    expect(files.get('ok.png')?.equals(png)).toBe(true)
  })

  it('[CI] zip bomb by count: more than 100 entries is refused before anything is inflated', () => {
    expect(() => readZipFiles(buildZip(Array.from({ length: 101 }, (_, i) => ({ name: `f${String(i)}.png`, data: Buffer.from('a') }))), limits)).toThrow()
    expect(readZipFiles(buildZip(Array.from({ length: 100 }, (_, i) => ({ name: `f${String(i)}.png`, data: Buffer.from('a') }))), limits).size).toBe(100)
  })

  it('[CI] zip bomb by declared size: a central directory that claims more than 40 MB unpacked is refused', () => {
    const zip = buildZip([
      { name: 'a.png', data: Buffer.from('a'), declared: 30 * 1024 * 1024 },
      { name: 'b.png', data: Buffer.from('b'), declared: 30 * 1024 * 1024 },
    ])
    expect(() => readZipFiles(zip, limits)).toThrow()
  })

  it('[CI] lying sizes: an entry that inflates past 2 MB is unusable although its header says 10 bytes, and the running total is capped too', () => {
    const lying = readZipFiles(buildZip([{ name: 'big.png', data: Buffer.alloc(5 * 1024 * 1024), declared: 10 }]), limits)
    expect(lying.get('big.png')).toBeNull()
    const many = Array.from({ length: 30 }, (_, i) => ({ name: `z${String(i)}.png`, data: Buffer.alloc(1_900_000), declared: 10 }))
    expect(() => readZipFiles(buildZip(many), limits)).toThrow()
  })

  it('[CI] a file that is not a ZIP is refused', () => {
    expect(() => readZipFiles(Buffer.from('bukan zip sama sekali, hanya teks biasa'), limits)).toThrow()
  })
})

describe('S1-T05 part 3: stimulus images from the ZIP and the template (real bank)', () => {
  let t: WorkflowTestApp
  let c: Record<'admin' | 'teacher' | 'otherTeacher' | 'schoolAdmin' | 'student', Client>
  let admin: UploadClient
  let tag: { subjectId: string; levelId: string; subject: string; tingkatan: string; unit: string; sp: string }
  const png = tinyPng()
  const GHEAD =
    'question_key,type,prompt_ms,option_a,option_b,option_c,option_d,correct,marks,subject_code,tingkatan,kertas,unit_code,sp_kod,tp,aras,difficulty,group_key,stimulus_label,stimulus_kind,stimulus_image,stimulus_alt'
  const imageRow = (image: string, key = 'ZP1'): string => {
    const v: Record<string, string> = {
      question_key: key, type: 'mcq', prompt_ms: 'Apakah yang ditunjukkan oleh rajah itu?', option_a: 'A1', option_b: 'B1', option_c: 'C1', option_d: 'D1', correct: 'B', marks: '1',
      subject_code: tag.subject, tingkatan: tag.tingkatan, kertas: '1', unit_code: tag.unit, sp_kod: tag.sp, tp: '3', aras: 'mengaplikasi', difficulty: '3',
      group_key: `G-${key}`, stimulus_label: 'Rajah 1', stimulus_kind: 'image', stimulus_image: image, stimulus_alt: 'Gambar sebuah pasar',
    }
    return GHEAD.split(',').map((col) => v[col] ?? '').join(',')
  }
  const post = (rows: string[], zip: Buffer | null, name = 'imej.csv') =>
    admin.upload('/api/question-imports', { name, body: [GHEAD, ...rows].join('\n') }, {}, true, zip === null ? undefined : { name: 'imej.zip', body: zip })
  const counts = async () => ({
    groups: await count(t.db, 'select count(*) as n from stimulus_groups'),
    files: await count(t.db, `select count(*) as n from files where purpose = 'question_image'`),
  })

  beforeAll(async () => {
    t = await bootWorkflowApp({ bank: 'real', env: { THROTTLE_QUESTIONS_WRITE_PER_MINUTE: '100000' } })
    c = await loginAll(t)
    admin = await uploadClient(t, 'admin')
    const [row] = await t.db.query<{ subject_id: string; education_level_id: string; unit_node_id: string; sp: string }>(
      `select v.subject_id::text, v.education_level_id::text, v.unit_node_id::text,
              (select node_id::text from question_version_sp_nodes where question_version_id = v.id limit 1) as sp
         from question_versions v where v.number_label = 'SEED-MCQ-MATH-T4'`,
    )
    const [names] = await t.db.query<{ subject: string; level: string; unit: string; sp: string }>(
      `select (select code from subjects where id = $1::bigint) as subject, (select code from education_levels where id = $2::bigint) as level,
              (select code from curriculum_nodes where id = $3::bigint) as unit, (select code from curriculum_nodes where id = $4::bigint) as sp`,
      [row!.subject_id, row!.education_level_id, row!.unit_node_id, row!.sp],
    )
    tag = { subjectId: row!.subject_id, levelId: row!.education_level_id, subject: names!.subject, tingkatan: names!.level.replace(/^T/, ''), unit: names!.unit, sp: names!.sp }
  })
  afterAll(async () => {
    await t.close()
  })

  it('[CI] happy path: the image named by stimulus_image is read from the ZIP, stored as a question_image file and linked to the group stimulus', async () => {
    const before = await counts()
    const res = await post([imageRow('rajah.png')], buildZip([{ name: 'gambar/rajah.png', data: png }, { name: 'lain.png', data: png }]))
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    expect(res.body.status).toBe('Import selesai: 1 soalan diimport, 0 gagal.')
    const after = await counts()
    expect(after.groups).toBe(before.groups + 1)
    expect(after.files).toBe(before.files + 1)
    const [s] = await t.db.query<{ kind: string; alt_text: string; purpose: string; mime: string; owner: string }>(
      `select s.kind, s.alt_text, f.purpose, f.mime, f.owner_user_id::text as owner from stimuli s join files f on f.id = s.asset_file_id order by s.id desc limit 1`,
    )
    expect(s).toEqual({ kind: 'image', alt_text: 'Gambar sebuah pasar', purpose: 'question_image', mime: 'image/png', owner: admin.userId })
  })

  it('[CI] an image missing from the ZIP, and a CSV with no ZIP at all, give the Q-11 "cannot be downloaded" text and create nothing', async () => {
    const before = await counts()
    for (const zip of [buildZip([{ name: 'lain.png', data: png }]), null]) {
      const res = await post([imageRow('tiada.png')], zip)
      expect(res.status).toBe(201)
      expect(res.body.data.failures).toEqual([{ row: 2, message: 'Baris 2: Imej rangsangan tidak dapat dimuat turun.', questionKey: 'ZP1', field: 'stimulus_image', code: 'STIMULUS_IMAGE_UNAVAILABLE' }])
    }
    expect(await counts()).toEqual(before)
  })

  it('[CI] a URL stimulus_image stays a row error even when a ZIP is sent', async () => {
    const res = await post([imageRow('https://contoh.test/rajah.png')], buildZip([{ name: 'rajah.png', data: png }]))
    expect(res.body.data.failures.map((f: { message: string }) => f.message)).toEqual(['Baris 2: Imej rangsangan tidak dapat dimuat turun.'])
  })

  it('[CI] a non-image disguised as .png, and an image over 2 MB, give the 11-02 text; nothing is stored', async () => {
    const before = await counts()
    const big = Buffer.concat([png, Buffer.alloc(IMPORT_ZIP.maxEntryBytes + 10)])
    const res = await post(
      [imageRow('palsu.png', 'ZP2'), imageRow('besar.png', 'ZP3'), imageRow('dalam.png', 'ZP4')],
      buildZip([{ name: 'palsu.png', data: Buffer.from('ini hanyalah teks, bukan gambar') }, { name: 'besar.png', data: big }, { name: 'dalam.png', data: Buffer.alloc(5 * 1024 * 1024), }]),
    )
    expect(res.status).toBe(201)
    expect(res.body.data.failures.map((f: { message: string; code: string }) => [f.message, f.code])).toEqual([
      ['Baris 2: Gambar mesti jenis JPG, PNG atau WebP dan tidak melebihi 2MB.', 'STIMULUS_IMAGE_INVALID'],
      ['Baris 3: Gambar mesti jenis JPG, PNG atau WebP dan tidak melebihi 2MB.', 'STIMULUS_IMAGE_INVALID'],
      ['Baris 4: Gambar mesti jenis JPG, PNG atau WebP dan tidak melebihi 2MB.', 'STIMULUS_IMAGE_INVALID'],
    ])
    expect(await counts()).toEqual(before)
  })

  it('[CI] zip slip over HTTP: a ../x.png or /abs.png entry is never found by the name x.png or abs.png', async () => {
    const res = await post([imageRow('x.png', 'ZP5'), imageRow('abs.png', 'ZP6')], buildZip([{ name: '../x.png', data: png }, { name: '/abs.png', data: png }]))
    expect(res.body.data.failures.map((f: { code: string }) => f.code)).toEqual(['STIMULUS_IMAGE_UNAVAILABLE', 'STIMULUS_IMAGE_UNAVAILABLE'])
  })

  it('[CI] 422 on zipFile for a non-ZIP, an entry-count bomb, a declared-size bomb and lying headers; no run is stored', async () => {
    const runsBefore = await count(t.db, 'select count(*) as n from question_imports')
    const text = Buffer.from('ini bukan fail zip')
    const bombs = [
      text,
      buildZip(Array.from({ length: IMPORT_ZIP.maxEntries + 1 }, (_, i) => ({ name: `f${String(i)}.png`, data: Buffer.from('a') }))),
      buildZip([{ name: 'a.png', data: Buffer.from('a'), declared: 30 * 1024 * 1024 }, { name: 'b.png', data: Buffer.from('b'), declared: 30 * 1024 * 1024 }]),
      buildZip(Array.from({ length: 30 }, (_, i) => ({ name: `z${String(i)}.png`, data: Buffer.alloc(1_900_000), declared: 10 }))),
    ]
    for (const zip of bombs) {
      const res = await post([imageRow('rajah.png')], zip)
      expect(res.status).toBe(422)
      expect(res.body.error.fields.zipFile).toBe('Data yang dihantar tidak sah. Sila semak dan cuba lagi.')
    }
    expect(await count(t.db, 'select count(*) as n from question_imports')).toBe(runsBefore)
  })

  it('[CI] a group rolled back at execute time (after its image was stored) leaves no file row and no stored object, and the other questions stay', async () => {
    const storage = t.app.get<FileStorage>(FILE_STORAGE)
    const keys: string[] = []
    const put = storage.put.bind(storage)
    storage.put = async (key, bytes) => {
      keys.push(key)
      return put(key, bytes)
    }
    const svc = t.app.get(StimuliService)
    const original = svc.createGroup.bind(svc)
    svc.createGroup = async () => {
      throw ApiError.of('VALIDATION_ERROR', { fields: { stimulusIds: 'Ralat ujian kumpulan.' } })
    }
    const before = await counts()
    const questions = await count(t.db, 'select count(*) as n from questions')
    try {
      const single = imageRow('rajah.png', 'RB0').replace(/,G-RB0,.*$/, ',,,,,')
      const res = await post([single, imageRow('rajah.png', 'RB1')], buildZip([{ name: 'rajah.png', data: png }]))
      expect(res.status, JSON.stringify(res.body)).toBe(201)
      expect(res.body.status).toBe('Import selesai: 1 soalan diimport, 1 gagal.')
      expect(res.body.data.failures).toEqual([{ row: 3, message: 'Baris 3: Ralat ujian kumpulan.', questionKey: 'G-RB1', field: 'group_key', code: 'GROUP_REJECTED' }])
    } finally {
      svc.createGroup = original
      storage.put = put
    }
    expect(keys).toHaveLength(1)
    expect(await storage.exists(keys[0] as string)).toBe(false)
    expect(await counts()).toEqual(before)
    expect(await count(t.db, 'select count(*) as n from questions')).toBe(questions + 1)
  })

  it('[CI] the template has the code header, one MCQ and one group, and imports once its codes are replaced by real ones', async () => {
    const res = await c.admin.get('/api/question-imports/template')
    const records = parseCsv(res.text)
    expect(records[0]?.cells).toEqual([...QUESTION_IMPORT_CODE_HEADER])
    expect(records).toHaveLength(4)
    const col = (name: string) => QUESTION_IMPORT_CODE_HEADER.indexOf(name as (typeof QUESTION_IMPORT_CODE_HEADER)[number])
    const rows = records.map((r, n) => {
      if (n === 0) return r.cells
      const cells = [...r.cells]
      cells[col('subject_code')] = tag.subject
      cells[col('tingkatan')] = tag.tingkatan
      cells[col('unit_code')] = tag.unit
      cells[col('sp_kod')] = tag.sp
      cells[col('bab_kod')] = ''
      cells[col('topik_kod')] = ''
      return cells
    })
    const before = await count(t.db, 'select count(*) as n from questions')
    const out = await admin.upload('/api/question-imports', { name: 'templat.csv', body: buildCsv(rows) })
    expect(out.status, JSON.stringify(out.body)).toBe(201)
    expect(out.body.status).toBe('Import selesai: 3 soalan diimport, 0 gagal.')
    expect(out.body.warnings).toBeUndefined()
    expect(await count(t.db, 'select count(*) as n from questions')).toBe(before + 3)
  })

  it('[CI] the Guru route still reads the code header and ignores a zipFile part (no ZIP on that route)', async () => {
    const guru = await uploadClient(t, 'teacher')
    const res = await guru.upload('/api/guru/questions/import', { name: 'g.csv', body: [GHEAD, imageRow('rajah.png', 'GZ1')].join('\n') }, {}, true, { name: 'imej.zip', body: buildZip([{ name: 'rajah.png', data: png }]) })
    expect(res.status).toBe(422)
    expect(res.body.error.fields.csvFile).toBe('Sila pilih fail CSV.')
  })
})
