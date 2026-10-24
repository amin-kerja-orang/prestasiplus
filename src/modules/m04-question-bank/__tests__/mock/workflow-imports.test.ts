/**
 * M04-T2: question imports (SRS §7 #9–#11, BR-M04-10, FR-M04-53…58, E2E-M04-30…33): admin guards,
 * multipart and JSON upload, the file rules (extension, MIME, 5 MB), per-row failures, defaults, the
 * all-or-nothing transaction, the template, the S5h history and the ImportRun anchor counts.
 */

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

import type { MockRuntime } from '@/mock/index'

import type { QuestionImportResponse, QuestionImportRun } from '../../api/imports'
import { importRuns, questions } from '../../mock'
import {
  IMPORT_DIFFICULTY_MESSAGE,
  IMPORT_FILE_MESSAGE,
  IMPORT_FILE_REQUIRED,
  IMPORT_LEVEL_MESSAGE,
  IMPORT_NO_DATA,
  IMPORT_SUBJECT_MESSAGE,
  importedText,
  missingColumnsText,
} from '../../mock/handlers/imports'
import { IMPORT_HEADER } from '../../mock/import/csv'
import {
  ADMIN,
  bootM04,
  callAs,
  csvFile,
  form,
  GURU,
  IBU_BAPA,
  ADMIN_SEKOLAH,
  PELAJAR,
  type Call,
  type ErrorBody,
} from './workflow-helpers'

const HEADER = IMPORT_HEADER.join(',')
const THREE_ROWS = [
  HEADER,
  '"Soalan pertama untuk import",A1,B1,C1,D1,A,3,11,2,1,"Penjelasan satu"',
  '"Soalan kedua tanpa subjek",A2,B2,C2,D2,B,,11,3,,',
  '"Soalan ketiga untuk import",A3,B3,C3,,C,3,11,4,2,',
].join('\n')

let runtime: MockRuntime
let call: Call
let dirty = false

beforeAll(async () => {
  runtime = await bootM04()
  call = callAs(runtime)
}, 180_000)

afterEach(async () => {
  if (dirty) await runtime.reset()
  dirty = false
}, 180_000)

afterAll(async () => {
  await runtime.reset()
})

const post = (body: unknown, as: number | null = ADMIN) =>
  call<QuestionImportResponse | ErrorBody>('POST', '/api/question-imports', as, body)
const fieldsOf = (r: { body: unknown }) => (r.body as ErrorBody).error.fields
const upload = (text: string, fields: Record<string, string | number> = {}, name = 'soalan.csv') =>
  post(form(fields, { csvFile: csvFile(text, name) }))
const runOf = (r: { body: unknown }) => (r.body as QuestionImportResponse).data

describe('admin guards (SEC-M04-01)', () => {
  const endpoints: ['GET' | 'POST', string][] = [
    ['POST', '/api/question-imports'],
    ['GET', '/api/question-imports'],
    ['GET', '/api/question-imports/template'],
  ]

  it.each(endpoints)('%s %s: 401 without a session', async (method, url) => {
    expect((await call(method, url, null)).status).toBe(401)
  })

  it.each(endpoints)('%s %s: 403 for a student and a teacher', async (method, url) => {
    expect((await call(method, url, PELAJAR)).status).toBe(403)
    expect((await call(method, url, GURU)).status).toBe(403)
    expect((await call(method, url, IBU_BAPA)).status).toBe(403)
    expect((await call(method, url, ADMIN_SEKOLAH)).status).toBe(403)
  })

  it('a refused import writes nothing', async () => {
    const before = importRuns.count('Q-IMPORT-RUNS')
    await post(form({}, { csvFile: csvFile(THREE_ROWS) }), PELAJAR)
    expect(importRuns.count('Q-IMPORT-RUNS')).toBe(before)
  })
})

describe('#9 import (BR-M04-10)', () => {
  it('imports a 3-row file with one row missing subject_id: 2 imported, 1 failed (E2E-M04-31)', async () => {
    dirty = true
    const r = await upload(THREE_ROWS, { defaultDifficultyLevel: 2 })
    expect(r.status).toBe(201)
    const body = r.body as QuestionImportResponse
    expect(body.status).toBe('Import selesai: 2 soalan diimport, 1 gagal.')
    expect(body.status).toBe(importedText(2, 1))
    expect(body.data).toMatchObject({
      id: 1124,
      fileName: 'soalan.csv',
      importedCount: 2,
      failedCount: 1,
      failures: [{ row: 3, message: 'Subjek tidak sah.' }],
      defaults: { subjectId: null, educationLevelId: null, difficultyLevel: 2 },
      createdBy: ADMIN,
      createdAt: '2026-09-25T15:40:00+08:00',
      createdMonth: '2026-09',
    })
    expect(questions.countWhere({ status: 'draft' })).toBe(2)
  })

  it('with "Subjek Lalai" set the same file imports 3 (E2E-M04-31)', async () => {
    dirty = true
    const r = await upload(THREE_ROWS, { defaultSubjectId: 3, defaultDifficultyLevel: 2 })
    expect(r.status).toBe(201)
    expect(runOf(r)).toMatchObject({ importedCount: 3, failedCount: 0, failures: [] })
    expect(runOf(r).defaults).toEqual({ subjectId: 3, educationLevelId: null, difficultyLevel: 2 })
  })

  it('saves each valid row as a draft, active MCQ with the runtime id range and the BR-M04-10 fields', async () => {
    dirty = true
    const poolBefore = questions.count('Q-SPM-POOL', 3)
    const eligibleBefore = questions.count('Q-ELIGIBLE')
    const r = await upload(THREE_ROWS, { defaultSubjectId: 3 })
    expect(runOf(r)).toMatchObject({ importedCount: 3, failedCount: 0 })
    const drafts = questions.adminList({ status: 'draft' }).rows
    expect(drafts).toHaveLength(3)
    for (const q of drafts) {
      expect(q.id).toBeGreaterThanOrEqual(9_000_001)
      expect(q).toMatchObject({
        questionType: 'mcq',
        status: 'draft',
        isActive: true,
        complianceStatus: 'draft',
        aiVerified: false,
        sourceType: null,
        needsDiagram: false,
        qualityScore: null,
        createdBy: ADMIN,
        language: 'bm',
        subjectId: 3,
        educationLevelId: 11,
        // BR-M04-32: T5 of a pool subject is a pool row, but only once approved.
        spmPool: true,
      })
    }
    const first = drafts.find((q) => q.questionText === 'Soalan pertama untuk import')
    expect(first).toMatchObject({
      options: ['A1', 'B1', 'C1', 'D1'],
      correctAnswer: 0,
      difficultyLevel: 2,
      pointsValue: 1,
      explanation: 'Penjelasan satu',
    })
    const third = drafts.find((q) => q.questionText === 'Soalan ketiga untuk import')
    expect(third).toMatchObject({
      options: ['A3', 'B3', 'C3', ''],
      correctAnswer: 2,
      pointsValue: 2,
    })
    // A draft is outside practice and the pool until it is approved.
    expect(questions.getEligible((first as { id: number }).id)).toBeNull()
    expect(questions.count('Q-ELIGIBLE')).toBe(eligibleBefore)
    expect(questions.count('Q-SPM-POOL', 3)).toBe(poolBefore)
    questions.bulkAction(
      'approve',
      [(first as { id: number }).id],
      Date.parse('2026-09-25T16:00:00+08:00'),
    )
    expect(questions.getEligible((first as { id: number }).id)).not.toBeNull()
    expect(questions.count('Q-SPM-POOL', 3)).toBe(poolBefore + 1)
  })

  it('an accepted file with only bad rows still answers 201 and records the run', async () => {
    dirty = true
    const r = await upload(`${HEADER}\n"Soalan sepuluh aksara",A,B,C,D,Z,3,4,1,1,\n,,,,,,,,,,`)
    expect(r.status).toBe(201)
    expect(runOf(r)).toMatchObject({
      importedCount: 0,
      failedCount: 1,
      failures: [{ row: 2, message: 'Jawapan betul mesti A, B, C atau D.' }],
    })
    expect(questions.countWhere({ status: 'draft' })).toBe(0)
  })

  it('also reads the file text sent in a JSON body', async () => {
    dirty = true
    const r = await post({ csvFile: THREE_ROWS, defaultSubjectId: 3, defaultDifficultyLevel: '2' })
    expect(r.status).toBe(201)
    expect(runOf(r)).toMatchObject({ fileName: 'import.csv', importedCount: 3 })
  })

  it('accepts a .txt file, and the spreadsheet MIME type of a CSV', async () => {
    dirty = true
    expect(
      (
        await post(
          form({ defaultSubjectId: 3 }, { csvFile: csvFile(THREE_ROWS, 'a.txt', 'text/plain') }),
        )
      ).status,
    ).toBe(201)
    expect(
      (
        await post(
          form(
            { defaultSubjectId: 3 },
            { csvFile: csvFile(THREE_ROWS, 'b.csv', 'application/vnd.ms-excel') },
          ),
        )
      ).status,
    ).toBe(201)
    // The browser may send no type at all: the extension decides.
    expect(
      (await post(form({ defaultSubjectId: 3 }, { csvFile: csvFile(THREE_ROWS, 'c.csv', '') })))
        .status,
    ).toBe(201)
  })

  it('runs the import in one transaction: a refused file changes nothing', async () => {
    const runs = importRuns.count('Q-IMPORT-RUNS')
    const drafts = questions.countWhere({ status: 'draft' })
    expect((await upload(HEADER)).status).toBe(422)
    expect(importRuns.count('Q-IMPORT-RUNS')).toBe(runs)
    expect(questions.countWhere({ status: 'draft' })).toBe(drafts)
  })
})

describe('#9 validation (SRS §5, 422 with fields)', () => {
  it('requires the file', async () => {
    const r = await post(form({ defaultSubjectId: 3 }))
    expect(r.status).toBe(422)
    expect((r.body as ErrorBody).error.code).toBe('VALIDATION_ERROR')
    expect(fieldsOf(r)).toEqual({ csvFile: IMPORT_FILE_REQUIRED })
    expect(fieldsOf(await post({}))).toEqual({ csvFile: IMPORT_FILE_REQUIRED })
  })

  it('refuses another extension, another MIME type and a file over 5 MB with the SRS message', async () => {
    expect(IMPORT_FILE_MESSAGE).toBe('Fail mesti jenis CSV atau TXT dan tidak melebihi 5MB.')
    expect(fieldsOf(await upload(THREE_ROWS, {}, 'soalan.pdf'))).toEqual({
      csvFile: IMPORT_FILE_MESSAGE,
    })
    expect(fieldsOf(await upload(THREE_ROWS, {}, 'soalan.csv.exe'))).toEqual({
      csvFile: IMPORT_FILE_MESSAGE,
    })
    const wrongType = await post(
      form({}, { csvFile: csvFile(THREE_ROWS, 'soalan.csv', 'application/pdf') }),
    )
    expect(wrongType.status).toBe(422)
    expect(fieldsOf(wrongType)).toEqual({ csvFile: IMPORT_FILE_MESSAGE })
    const big = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'besar.csv', { type: 'text/csv' })
    expect(fieldsOf(await post(form({}, { csvFile: big })))).toEqual({
      csvFile: IMPORT_FILE_MESSAGE,
    })
    const exactly = new File(
      [`${THREE_ROWS}\n${' '.repeat(5 * 1024 * 1024 - THREE_ROWS.length - 1)}`],
      'tepat.csv',
      {
        type: 'text/csv',
      },
    )
    expect(exactly.size).toBe(5 * 1024 * 1024)
    dirty = true
    expect((await post(form({ defaultSubjectId: 3 }, { csvFile: exactly }))).status).toBe(201)
  })

  it('refuses a JSON text over 5 MB', async () => {
    expect(fieldsOf(await post({ csvFile: 'x'.repeat(5 * 1024 * 1024 + 1) }))).toEqual({
      csvFile: IMPORT_FILE_MESSAGE,
    })
  })

  it('refuses a file without a required column and a file without data rows', async () => {
    expect(fieldsOf(await upload('question_text,option_a\nx,y'))).toEqual({
      csvFile: missingColumnsText(),
    })
    expect(fieldsOf(await upload(HEADER))).toEqual({ csvFile: IMPORT_NO_DATA })
    expect(fieldsOf(await upload(`${HEADER}\n\n,,,,\n`))).toEqual({ csvFile: IMPORT_NO_DATA })
  })

  it('refuses defaults that are not a subject, a level or a difficulty', async () => {
    const r = await upload(THREE_ROWS, {
      defaultSubjectId: 999,
      defaultEducationLevelId: 99,
      defaultDifficultyLevel: 6,
    })
    expect(r.status).toBe(422)
    expect(fieldsOf(r)).toEqual({
      defaultSubjectId: IMPORT_SUBJECT_MESSAGE,
      defaultEducationLevelId: IMPORT_LEVEL_MESSAGE,
      defaultDifficultyLevel: IMPORT_DIFFICULTY_MESSAGE,
    })
    expect(fieldsOf(await upload(THREE_ROWS, { defaultSubjectId: 'x' }))).toEqual({
      defaultSubjectId: IMPORT_SUBJECT_MESSAGE,
    })
    expect(fieldsOf(await upload(THREE_ROWS, { defaultDifficultyLevel: 0 }))).toEqual({
      defaultDifficultyLevel: IMPORT_DIFFICULTY_MESSAGE,
    })
  })

  it('reports every failing field together', async () => {
    const r = await upload('nothing', { defaultSubjectId: 999 }, 'a.pdf')
    expect(Object.keys(fieldsOf(r) ?? {}).sort()).toEqual(['csvFile', 'defaultSubjectId'])
  })
})

describe('#11 template (FR-M04-57, E2E-M04-32)', () => {
  it('downloads template-import-soalan.csv with the documented header and two sample rows', async () => {
    const r = await call<Blob>('GET', '/api/question-imports/template', ADMIN)
    expect(r.status).toBe(200)
    expect(r.headers['content-type']).toBe('text/csv')
    expect(r.headers['content-disposition']).toContain('template-import-soalan.csv')
    const text = await r.body.text()
    const lines = text.split('\r\n').filter((l) => l !== '')
    expect(lines[0]).toBe(
      'question_text,option_a,option_b,option_c,option_d,correct_answer,subject_id,education_level_id,difficulty_level,marks,explanation',
    )
    expect(lines).toHaveLength(3)
    expect(lines[1]).toBe(
      '"Apakah ibu negara Malaysia?",Kuala Lumpur,Putrajaya,Johor Bahru,Ipoh,A,1,4,1,1,"Kuala Lumpur ialah ibu negara."',
    )
    expect(lines[2]).toBe('"2 + 3 = ?",4,5,6,7,B,3,1,1,1,')
  })

  it('the template imports cleanly', async () => {
    dirty = true
    const t = await call<Blob>('GET', '/api/question-imports/template', ADMIN)
    const r = await upload(await t.body.text(), {}, 'template-import-soalan.csv')
    expect(runOf(r)).toMatchObject({ importedCount: 2, failedCount: 0 })
  })
})

describe('#10 history and the ImportRun anchors (E2E-M04-33, E2E-M04-69)', () => {
  it('lists the 1,123 seeded runs newest first, 20 per page, the anchor run first', async () => {
    const r = await call<{ data: QuestionImportRun[]; meta: Record<string, number | null> }>(
      'GET',
      '/api/question-imports',
      ADMIN,
    )
    expect(r.status).toBe(200)
    expect(r.body.meta).toMatchObject({
      page: 1,
      pageSize: 20,
      totalItems: 1123,
      totalPages: 57,
      from: 1,
      to: 20,
    })
    expect(r.body.data).toHaveLength(20)
    expect(r.body.data[0]).toMatchObject({
      id: 1123,
      fileName: 'soalan-bm-d3.csv',
      importedCount: 12,
      failedCount: 1,
      createdAt: '2026-07-20T10:30:00+08:00',
    })
    const dates = r.body.data.map((x) => x.createdAt)
    expect([...dates].sort().reverse()).toEqual(dates)
    const last = await call<{ data: QuestionImportRun[]; meta: { page: number; from: number } }>(
      'GET',
      '/api/question-imports?page=57',
      ADMIN,
    )
    expect(last.body.data).toHaveLength(3)
    expect(last.body.meta).toMatchObject({ page: 57, from: 1121 })
    const beyond = await call<{ data: unknown[] }>('GET', '/api/question-imports?page=99', ADMIN)
    expect(beyond.body.data).toEqual([])
  })

  it('counts: 1,123 runs, Σ imported 31,101, none in August or September 2026', () => {
    expect(importRuns.count('Q-IMPORT-RUNS')).toBe(1123)
    expect(importRuns.importedTotal()).toBe(31_101)
    expect(importRuns.countByMonth('2026-08')).toBe(0)
    expect(importRuns.countByMonth('2026-09')).toBe(0)
  })

  it('a new import is the first history row and moves the counts', async () => {
    dirty = true
    await upload(THREE_ROWS, { defaultSubjectId: 3 })
    const r = await call<{ data: QuestionImportRun[]; meta: { totalItems: number } }>(
      'GET',
      '/api/question-imports',
      ADMIN,
    )
    expect(r.body.meta.totalItems).toBe(1124)
    expect(r.body.data[0]).toMatchObject({ id: 1124, importedCount: 3, createdMonth: '2026-09' })
    expect(importRuns.importedTotal()).toBe(31_104)
    expect(importRuns.countByMonth('2026-09')).toBe(1)
  })
})

describe('S5h empty state (override importRuns: [])', () => {
  it('lists no run', async () => {
    await runtime.reset({ importRuns: [] })
    const r = await call<{ data: unknown[]; meta: { totalItems: number; from: number | null } }>(
      'GET',
      '/api/question-imports',
      ADMIN,
    )
    expect(r.body.data).toEqual([])
    expect(r.body.meta).toMatchObject({ totalItems: 0, totalPages: 1, from: null })
    await runtime.reset()
  }, 180_000)
})
