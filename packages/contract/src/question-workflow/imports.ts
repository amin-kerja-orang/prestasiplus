import { z } from '../zod'
import { IdSchema } from '../common/ids'
import { TimestampSchema } from '../common/time'
import { QUESTION_WORKFLOW_CSV_MAX_BYTES, questionWorkflowFile, questionWorkflowMutationOf } from './common'

/**
 * CSV question import (mock `handlers/imports.ts`, `import/csv.ts`; SRS BR-M04-10) and the Guru
 * contribution import (mock `m10-teacher-class/mock/handlers/{questions,csv}.ts`, same parser and
 * template, "one store, one format"). Routes: `GET/POST /question-imports`,
 * `GET /question-imports/template`, `GET /guru/questions/template`, `POST /guru/questions/import`.
 *
 * PDF and AI imports are BE-38 and are not described here. The v2 Excel template of
 * v2-question-bank 4.3 is Open question 4 of the card (OQ-25): the contract keeps the mock's CSV.
 *
 * Differences from the mock: ids are strings (UD-1); every valid row becomes a `draft` question
 * (D54a; the Guru import saves `review`, as the Guru create in BE-09, because the mock saves it
 * `pending_review`).
 */

export const QUESTION_IMPORT_MESSAGES = {
  fileRequired: 'Sila pilih fail CSV.',
  fileType: 'Fail mesti jenis CSV atau TXT dan tidak melebihi 5MB.',
  noData: 'Fail CSV tiada baris data.',
  subject: 'Sila pilih subjek.',
  level: 'Sila pilih tahap pendidikan.',
  difficulty: 'Sila pilih tahap kesukaran.',
  /** `Fail CSV mesti mempunyai kolum question_text, option_a, option_b, correct_answer.` */
  missingColumns: (columns: readonly string[]): string => `Fail CSV mesti mempunyai kolum ${columns.join(', ')}.`,
  /** Flash of `POST /question-imports`. */
  imported: (imported: number, failed: number): string =>
    `Import selesai: ${String(imported)} soalan diimport, ${String(failed)} gagal.`,
} as const

/** Row failure messages (`failures[].message`), exact copy of `import/csv.ts` and the Guru caps. */
export const QUESTION_IMPORT_ROW_MESSAGES = {
  incomplete: 'Baris tidak lengkap.',
  answer: 'Jawapan betul mesti A, B, C atau D.',
  answerEmptyOption: 'Jawapan betul merujuk pilihan yang kosong.',
  subject: 'Subjek tidak sah.',
  level: 'Tahap pendidikan tidak sah.',
  difficulty: 'Tahap kesukaran mesti 1 hingga 5.',
  marks: 'Markah mesti nombor bulat sekurang-kurangnya 1.',
  kertas: 'Kertas tidak sah.',
  /** Guru import only (SRS M10 S22 caps). */
  textTooLong: 'Soalan tidak boleh melebihi 2000 aksara.',
  optionTooLong: 'Pilihan jawapan tidak boleh melebihi 500 aksara.',
} as const

/** Template header (AC-M04-13.6). */
export const QUESTION_IMPORT_HEADER = [
  'question_text',
  'option_a',
  'option_b',
  'option_c',
  'option_d',
  'correct_answer',
  'subject_id',
  'education_level_id',
  'difficulty_level',
  'marks',
  'explanation',
  /** Optional column: 1, 2 or 3 (empty = none). The paper builder uses it to find the question. */
  'kertas',
] as const

/** Columns the file must have; subject, level and difficulty may come from the form defaults. */
export const QUESTION_IMPORT_REQUIRED_COLUMNS = ['question_text', 'option_a', 'option_b', 'correct_answer'] as const

/**
 * Template file text: header plus two sample rows, CRLF, trailing CRLF (`IMPORT_TEMPLATE_CSV`). The
 * sample `subject_id` / `education_level_id` cells are the mock's numeric ids; the real API writes
 * the ids of its own seed rows (decimal strings), which is why the sample cells are not asserted.
 */
export const QUESTION_IMPORT_TEMPLATE_CSV = [
  QUESTION_IMPORT_HEADER.join(','),
  '"Apakah ibu negara Malaysia?",Kuala Lumpur,Putrajaya,Johor Bahru,Ipoh,A,1,7,1,1,"Kuala Lumpur ialah ibu negara.",',
  '"2 + 3 = ?",4,5,6,7,B,3,10,1,1,,1',
  '',
].join('\r\n')

export const QUESTION_IMPORT_TEMPLATE_FILENAME = 'template-import-soalan.csv'
export const QUESTION_IMPORT_TEMPLATE_CONTENT_TYPE = 'text/csv'
/** History page size (fixed; no `pageSize` override). */
export const QUESTION_IMPORT_PAGE_SIZE = 20
/** The mock has no row limit; only the size limit applies (Open question 5). */
export const QUESTION_IMPORT_MAX_BYTES = QUESTION_WORKFLOW_CSV_MAX_BYTES

/** Declared MIME types of an accepted CSV / TXT upload (an empty type is judged by the extension). */
export const QUESTION_IMPORT_MIME_TYPES = [
  'text/csv',
  'text/plain',
  'text/x-csv',
  'application/csv',
  'application/vnd.ms-excel',
] as const

/**
 * Neutralises a spreadsheet formula in a cell of any CSV the API generates (BE-10 AC 5): a value
 * starting with `=`, `+`, `-` or `@` (or a tab / carriage return) is prefixed with `'`.
 */
export function neutraliseQuestionImportCsvCell(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
}

/* --------------------------------------------------------------------------------------- run */

export const QuestionImportFailureSchema = z
  .strictObject({
    row: z.number().int().min(1).meta({ description: '1-based line of the file where the record starts; the header is line 1.' }),
    message: z.string().min(1),
  })
  .meta({ id: 'QuestionImportFailure' })
export type QuestionImportFailure = z.infer<typeof QuestionImportFailureSchema>

export const QuestionImportDefaultsSchema = z
  .strictObject({
    subjectId: IdSchema.nullable(),
    educationLevelId: IdSchema.nullable(),
    difficultyLevel: z.number().int().min(1).max(5).nullable(),
  })
  .meta({ id: 'QuestionImportDefaults' })

export const QuestionImportRunSchema = z
  .strictObject({
    id: IdSchema,
    fileName: z.string(),
    importedCount: z.number().int().min(0),
    failedCount: z.number().int().min(0),
    failures: z.array(QuestionImportFailureSchema),
    defaults: QuestionImportDefaultsSchema,
    createdBy: IdSchema,
    createdAt: TimestampSchema,
    createdMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).meta({ description: 'YYYY-MM of createdAt.' }),
  })
  .meta({ id: 'QuestionImportRun' })
export type QuestionImportRun = z.infer<typeof QuestionImportRunSchema>

/* ------------------------------------------------------------------------------------ requests */

const csvFile = questionWorkflowFile({
  maxBytes: QUESTION_WORKFLOW_CSV_MAX_BYTES,
  mimes: QUESTION_IMPORT_MIME_TYPES,
  extensions: ['csv', 'txt'],
  description: 'CSV or TXT file, UTF-8, at most 5 MB. Storage: BE-04.',
})

/**
 * Body of `POST /question-imports`, `multipart/form-data`. `csvFile` is the file part (the mock also
 * accepts the file text as a JSON string; that is a script/test convenience, not part of the
 * contract). The three defaults fill a row whose own cell is empty; they arrive as text.
 * 422 `fields`: `csvFile` (missing "Sila pilih fail CSV."; wrong extension, MIME or size "Fail mesti
 * jenis CSV atau TXT dan tidak melebihi 5MB."; missing required columns; no data rows),
 * `defaultSubjectId`, `defaultEducationLevelId` ("Sila pilih subjek." / "Sila pilih tahap
 * pendidikan." when not a known id), `defaultDifficultyLevel` ("Sila pilih tahap kesukaran." above 5).
 */
export const QuestionImportCreateRequestSchema = z
  .object({
    csvFile,
    defaultSubjectId: IdSchema.optional(),
    defaultEducationLevelId: IdSchema.optional(),
    defaultDifficultyLevel: z.coerce.number(QUESTION_IMPORT_MESSAGES.difficulty).int(QUESTION_IMPORT_MESSAGES.difficulty).min(1, QUESTION_IMPORT_MESSAGES.difficulty).max(5, QUESTION_IMPORT_MESSAGES.difficulty).optional(),
  })
  .meta({ id: 'QuestionImportCreateRequest' })

/** 201 body `{ data, status }`, `status` = "Import selesai: <x> soalan diimport, <y> gagal.". Whole import is one transaction. */
export const QuestionImportCreatedSchema = questionWorkflowMutationOf(QuestionImportRunSchema).meta({
  id: 'QuestionImportCreated',
})

export const QuestionImportListQuerySchema = z
  .object({ page: z.coerce.number().int().min(1).optional().meta({ description: 'Invalid or missing means 1. Page size is fixed at 20.' }) })
  .meta({ id: 'QuestionImportListQuery' })

/* --------------------------------------------------------------------------------- Guru import */

const guruCsvFile = questionWorkflowFile({
  maxBytes: QUESTION_WORKFLOW_CSV_MAX_BYTES,
  mimes: QUESTION_IMPORT_MIME_TYPES,
  extensions: ['csv', 'txt'],
  description: 'CSV or TXT file, UTF-8, at most 5 MB. Every row must carry subject_id, education_level_id and difficulty_level.',
})

/**
 * Body of `POST /guru/questions/import`, `multipart/form-data`. There are no form defaults, so each
 * row must carry `subject_id`, `education_level_id` and `difficulty_level`; the Guru caps apply on
 * top (question text up to 2000, each option up to 500 characters). Same `csvFile` 422 messages.
 */
export const QuestionImportGuruRequestSchema = z.object({ csvFile: guruCsvFile }).meta({ id: 'QuestionImportGuruRequest' })

/** `data` of the Guru import (200, not 201): valid rows are created, bad rows listed ordered by file row. */
export const QuestionImportGuruResultSchema = z
  .strictObject({
    imported: z.number().int().min(0),
    failed: z.array(QuestionImportFailureSchema),
  })
  .meta({ id: 'QuestionImportGuruResult' })
export type QuestionImportGuruResult = z.infer<typeof QuestionImportGuruResultSchema>
