/**
 * M04 question import (SRS §7 #9–#11, BR-M04-10, FR-M04-53…58). Admin-only.
 *
 * | # | Route | Notes |
 * |---|---|---|
 * | 9 | `POST /api/question-imports` | multipart `csvFile` + defaults; 201 `{data: ImportRun, status}`; 422 |
 * | 10 | `GET /api/question-imports` | S5h, newest first, 20 per page |
 * | 11 | `GET /api/question-imports/template` | `template-import-soalan.csv` |
 *
 * The file is simulated: its extension (`.csv` / `.txt`), MIME type and size (5 MB) are checked and
 * its text is read, nothing is stored. The whole import (every question and the run) is one
 * transaction. INFERRED (URS FN-M04-2.1.9, live POST outcome not observed): the 422 messages other
 * than the SRS §5 file message, that a file lacking a required column or without data rows is
 * refused, and that a default that is not a valid subject / level / difficulty is a 422.
 */

import type { SourcePaperDetail, SourcePaperRow } from '@pp/contract'

import {
  blob,
  created,
  notFound,
  ok,
  paged,
  pageParams,
  paginate,
  str,
  validationError,
  route,
  type MockContext,
  type MockRequest,
  type MockResponse,
  type RouteDef,
} from '@/mock/define'
import { curriculum } from '@/modules/m03-curriculum/mock'

import { importRunsRepo } from '../repository/import-runs'
import { questionsRepo } from '../repository/questions'
import {
  IMPORT_REQUIRED_COLUMNS,
  IMPORT_TEMPLATE_CSV,
  planImport,
  type ImportDefaults,
} from '../import/csv'
import { adminOnly, bodyOf, CSV_MAX_BYTES, optionalId, uploadedFile } from './workflow-common'

/** SRS §5 (UNVERIFIED COPY). */
export const IMPORT_FILE_MESSAGE = 'Fail mesti jenis CSV atau TXT dan tidak melebihi 5MB.'
export const IMPORT_FILE_REQUIRED = 'Sila pilih fail CSV.'
export const IMPORT_NO_DATA = 'Fail CSV tiada baris data.'
export const IMPORT_SUBJECT_MESSAGE = 'Sila pilih subjek.'
export const IMPORT_LEVEL_MESSAGE = 'Sila pilih tahap pendidikan.'
export const IMPORT_DIFFICULTY_MESSAGE = 'Sila pilih tahap kesukaran.'
export const IMPORT_TEMPLATE_NAME = 'template-import-soalan.csv'

/** Accepted declared MIME types of a CSV / TXT upload (an empty type is judged by the extension). */
const CSV_MIMES: readonly string[] = [
  '',
  'text/csv',
  'text/plain',
  'text/x-csv',
  'application/csv',
  'application/vnd.ms-excel',
]

/** FR-M04-56 flash (UNVERIFIED COPY, §8). */
export function importedText(imported: number, failed: number): string {
  return `Import selesai: ${String(imported)} soalan diimport, ${String(failed)} gagal.`
}

/** Missing-columns message (INFERRED). */
export function missingColumnsText(): string {
  return `Fail CSV mesti mempunyai kolum ${IMPORT_REQUIRED_COLUMNS.join(', ')}.`
}

/** The text and name of the `csvFile` field, or the 422 message. */
async function readCsv(value: unknown): Promise<{ name: string; text: string } | string> {
  if (value === undefined || value === null || value === '') return IMPORT_FILE_REQUIRED
  // JSON bodies (tests, scripts) may carry the file's text.
  if (typeof value === 'string') {
    const bytes = new TextEncoder().encode(value).length
    return bytes > CSV_MAX_BYTES ? IMPORT_FILE_MESSAGE : { name: 'import.csv', text: value }
  }
  const file = uploadedFile(value)
  if (!file) return IMPORT_FILE_REQUIRED
  if (
    !/\.(csv|txt)$/i.test(file.name) ||
    !CSV_MIMES.includes(file.mime) ||
    file.size > CSV_MAX_BYTES
  ) {
    return IMPORT_FILE_MESSAGE
  }
  return { name: file.name, text: await file.blob.text() }
}

/** #9. */
async function importQuestions(req: MockRequest, ctx: MockContext): Promise<MockResponse> {
  const b = bodyOf(req)
  const fields: Record<string, string> = {}

  const file = await readCsv(b.csvFile)
  if (typeof file === 'string') fields.csvFile = file

  const subjectId = optionalId(b, 'defaultSubjectId')
  if (subjectId === null || (subjectId !== undefined && !curriculum.subject(subjectId))) {
    fields.defaultSubjectId = IMPORT_SUBJECT_MESSAGE
  }
  const levelId = optionalId(b, 'defaultEducationLevelId')
  if (levelId === null || (levelId !== undefined && !curriculum.level(levelId))) {
    fields.defaultEducationLevelId = IMPORT_LEVEL_MESSAGE
  }
  const difficulty = optionalId(b, 'defaultDifficultyLevel')
  if (difficulty === null || (difficulty !== undefined && difficulty > 5)) {
    fields.defaultDifficultyLevel = IMPORT_DIFFICULTY_MESSAGE
  }
  if (Object.keys(fields).length > 0) return validationError(fields)

  const source = file as { name: string; text: string }
  const defaults: ImportDefaults = {
    subjectId: subjectId ?? null,
    educationLevelId: levelId ?? null,
    difficultyLevel: difficulty ?? null,
  }
  const plan = planImport(source.text, defaults, {
    subjectExists: (id) => curriculum.subject(id) !== undefined,
    levelExists: (id) => curriculum.level(id) !== undefined,
  })
  if (plan.missingColumns.length > 0) return validationError({ csvFile: missingColumnsText() })
  if (plan.dataRows === 0) return validationError({ csvFile: IMPORT_NO_DATA })

  const now = ctx.clock.now()
  const adminId = req.session?.userId ?? 1
  const run = ctx.transaction(() => {
    for (const row of plan.rows) {
      questionsRepo.create(row.input, { createdBy: adminId, now, status: 'draft' })
    }
    return importRunsRepo.create(
      {
        fileName: source.name,
        importedCount: plan.rows.length,
        failedCount: plan.failures.length,
        failures: plan.failures,
        defaults,
        createdBy: adminId,
      },
      now,
    )
  })
  return created(run, { status: importedText(run.importedCount, run.failedCount) })
}

/* ------------------------------------------------------------------------------------------ */
/* Sumber Kertas (S2-T09, API-Q-23): a small fixed registry, the same shapes as the API.        */
/* ------------------------------------------------------------------------------------------ */

type MockPaperIssue = SourcePaperDetail['issues'][number]
interface MockPaper {
  row: SourcePaperRow
  fileNames: string[]
  issues: MockPaperIssue[]
  questionList: SourcePaperDetail['questionList']
}

const MOCK_SUBJECTS: Record<string, string> = { MAT: 'Matematik', BM: 'Bahasa Melayu', SEJ: 'Sejarah' }

function mockPaper(
  id: number,
  p: Pick<SourcePaperRow, 'subject' | 'year' | 'kertas' | 'negeri' | 'paperType' | 'needsReview' | 'hasScheme'> & { questions: number },
  issues: MockPaperIssue[] = [],
): MockPaper {
  const sid = String(id)
  const name = MOCK_SUBJECTS[p.subject] ?? null
  const title = [name ?? p.subject, String(p.year), ...(p.kertas === null ? [] : [`Kertas ${String(p.kertas)}`])].join(' ')
  return {
    row: {
      id: sid,
      batchId: sid,
      title: p.negeri ? `${title} - ${p.negeri}` : title,
      subjectName: name,
      source: 'intake',
      sourceLabel: 'Import (PDF/DOCX)',
      ...p,
    },
    fileNames: [`kertas-${sid}.pdf`],
    issues,
    questionList: Array.from({ length: p.questions }, (_, i) => ({
      no: String(i + 1),
      questionId: String(9000 + id * 10 + i),
      excerpt: `Soalan contoh ${String(i + 1)} untuk kertas ${sid}.`,
      parts: (i % 3) + 1,
    })),
  }
}

const MOCK_PAPERS: MockPaper[] = [
  mockPaper(301, { subject: 'MAT', year: 2025, kertas: 1, negeri: 'Johor', paperType: 'trial', questions: 3, needsReview: false, hasScheme: true }),
  mockPaper(302, { subject: 'MAT', year: 2024, kertas: 2, negeri: 'Selangor', paperType: 'exam', questions: 2, needsReview: false, hasScheme: false }),
  mockPaper(303, { subject: 'BM', year: 2023, kertas: 1, negeri: null, paperType: 'trial', questions: 1, needsReview: true, hasScheme: true }, [
    { itemId: '5001', where: 'Soalan 2', message: 'Belum selesai disemak (Dijana).' },
  ]),
  mockPaper(304, { subject: 'SEJ', year: 2022, kertas: 2, negeri: 'Perak', paperType: 'exam', questions: 0, needsReview: true, hasScheme: false }, [
    { itemId: null, where: 'Kertas', message: 'Pemprosesan kertas gagal.' },
  ]),
]

const queryText = (req: MockRequest, key: string): string => {
  const v = req.query[key]
  return (Array.isArray(v) ? v[0] : v)?.trim() ?? ''
}

function sourcePaperList(req: MockRequest): MockResponse {
  const q = queryText(req, 'q').toLowerCase()
  const subject = queryText(req, 'subject').toUpperCase()
  const year = queryText(req, 'year')
  const negeri = queryText(req, 'negeri').toLowerCase()
  const kertas = queryText(req, 'kertas')
  const jenis = queryText(req, 'jenis')
  const review = queryText(req, 'needsReview') === 'true'
  const rows = MOCK_PAPERS.map((p) => p.row)
    .filter((r) => (subject === '' || r.subject === subject) && (year === '' || String(r.year) === year))
    .filter((r) => negeri === '' || (r.negeri ?? '').toLowerCase() === negeri)
    .filter((r) => (kertas === '' || String(r.kertas) === kertas) && (jenis === '' || r.paperType === jenis) && (!review || r.needsReview))
    .filter((r) => q === '' || `${r.title} ${r.subject} ${r.year}`.toLowerCase().includes(q))
    .sort((a, b) => b.year - a.year || Number(b.id) - Number(a.id))
  const all = MOCK_PAPERS.map((p) => p.row)
  const options = {
    years: [...new Set(all.map((r) => r.year))].sort((a, b) => b - a),
    negeri: [...new Set(all.flatMap((r) => (r.negeri ? [r.negeri] : [])))].sort(),
    subjects: [...new Set(all.map((r) => r.subject))].sort().map((code) => ({ code, name: MOCK_SUBJECTS[code] ?? null })),
  }
  return paginate(rows, pageParams(req.query, { pageSize: 25 }), {
    totalPapers: all.length,
    needsReviewCount: all.filter((r) => r.needsReview).length,
    options,
  })
}

function sourcePaperOne(req: MockRequest): MockResponse {
  const found = MOCK_PAPERS.find((p) => p.row.id === req.params.id)
  if (!found) return notFound()
  return ok({ ...found.row, fileNames: found.fileNames, issues: found.issues, questionList: found.questionList })
}

export const importRoutes: RouteDef[] = [
  route('GET', '/api/admin/source-papers', [adminOnly], sourcePaperList),
  route('GET', '/api/admin/source-papers/:id', [adminOnly], sourcePaperOne, { params: { id: str() } }),
  route('POST', '/api/question-imports', [adminOnly], importQuestions),
  route('GET', '/api/question-imports/template', [adminOnly], () =>
    blob(new Blob([IMPORT_TEMPLATE_CSV], { type: 'text/csv' }), IMPORT_TEMPLATE_NAME),
  ),
  route('GET', '/api/question-imports', [adminOnly], (req) => {
    const page = pageParams(req.query, { pageSize: 20 })
    return paged(importRunsRepo.list(page.page, page.pageSize), page)
  }),
]
