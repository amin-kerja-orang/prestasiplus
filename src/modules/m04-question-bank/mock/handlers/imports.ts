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

import {
  blob,
  created,
  paged,
  pageParams,
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

export const importRoutes: RouteDef[] = [
  route('POST', '/api/question-imports', [adminOnly], importQuestions),
  route('GET', '/api/question-imports/template', [adminOnly], () =>
    blob(new Blob([IMPORT_TEMPLATE_CSV], { type: 'text/csv' }), IMPORT_TEMPLATE_NAME),
  ),
  route('GET', '/api/question-imports', [adminOnly], (req) => {
    const page = pageParams(req.query, { pageSize: 20 })
    return paged(importRunsRepo.list(page.page, page.pageSize), page)
  }),
]
