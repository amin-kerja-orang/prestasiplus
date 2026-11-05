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
  /** 422 on `csvFile` when the file has more than `QUESTION_IMPORT_MAX_ROWS` data rows (30 Q-11 row 11-01, 45 section 3.2). */
  tooManyRows: 'Fail melebihi 2,000 baris. Pecahkan fail kepada beberapa bahagian.',
  /** Warning for a header cell of the new header that is not in the header list (30 Q-11, D113). */
  unknownColumn: (name: string): string => `Kolum ${name} tidak dikenali dan diabaikan.`,
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

/** Prefix of every row message of the new (code) header: `Baris 7: ...` (30 Q-11 column "Exact BM error"). */
export const questionImportRowPrefix = (line: number): string => `Baris ${String(line)}: `

/**
 * Row messages of the new (code) header, exact copy of 30 R1-ADM-Q-11 (the error column of the table) and of the texts the
 * publish gate already uses; the caller adds `questionImportRowPrefix`. Entries with a function take the value the text names.
 */
/** A value of the file echoed in a message is cut at this many characters (code points): the report never repeats a long cell. */
export const QUESTION_IMPORT_ECHO_MAX = 40
const echoed = (value: string): string => [...value].slice(0, QUESTION_IMPORT_ECHO_MAX).join('')

export const QUESTION_IMPORT_CODE_ROW_MESSAGES = {
  keyRequired: 'Kunci soalan diperlukan.',
  keyNotConsecutive: 'Baris soalan tidak berturutan.',
  keyDuplicate: (key: string): string => `Kunci soalan ${echoed(key)} berulang dalam fail.`,
  typeInvalid: 'Jenis soalan tidak sah.',
  typeStudio: 'Jenis ini dimasukkan melalui wizard Studio.',
  subject: 'Kod subjek tidak dikenali.',
  tingkatan: 'Tingkatan tidak sah.',
  bahasa: 'Bahasa tidak sah.',
  jenisTulisan: 'Jenis tulisan tidak sah.',
  kertasSpm: 'Sila pilih kertas untuk soalan SPM.',
  numberLabel: 'Nombor soalan tidak sah.',
  unitRequired: 'Sila pilih unit DSKP.',
  unitUnknown: 'Kod unit tiada dalam senarai kurikulum.',
  spRequired: 'Sila pilih sekurang-kurangnya satu SP DSKP.',
  spTooMany: 'Pilih paling banyak 3 SP.',
  spUnknown: (code: string): string => `SP "${echoed(code)}" tiada dalam senarai kurikulum. Pilih SP daripada senarai DSKP.`,
  tpMissing: (label: string): string => `Bahagian (${echoed(label)}) belum ada TP.`,
  tpRange: 'TP mesti antara 1 dan 6.',
  arasMissing: (label: string): string => `Bahagian (${echoed(label)}) belum ada aras pemikiran.`,
  arasInvalid: 'Aras pemikiran tidak sah.',
  kbatInvalid: 'Nilai KBAT tidak sah.',
  chapterMismatch: 'Bab tidak sepadan dengan subjek dan tahap.',
  topicInvalid: 'Topik tidak sah.',
  difficulty: 'Sila pilih tahap kesukaran.',
  promptShort: 'Teks soalan mesti sekurang-kurangnya 10 aksara.',
  optionsBlank: 'Sila isi semua pilihan jawapan.',
  correctRequired: 'Sila pilih jawapan betul.',
  marksMin: 'Nilai mata mesti sekurang-kurangnya 1.',
  marksMax: 'Markah bahagian tidak boleh melebihi 100.',
} as const

/** `failures[].code` of the new header: one stable code per row message (the `kod_ralat` column of the error CSV). */
export const QUESTION_IMPORT_ERROR_CODES = [
  'KEY_REQUIRED', 'KEY_NOT_CONSECUTIVE', 'KEY_DUPLICATE', 'TYPE_INVALID', 'TYPE_STUDIO_ONLY', 'SUBJECT_UNKNOWN', 'TINGKATAN_INVALID',
  'BAHASA_INVALID', 'SCRIPT_INVALID', 'KERTAS_INVALID', 'KERTAS_REQUIRED', 'NUMBER_LABEL_INVALID', 'UNIT_REQUIRED', 'UNIT_UNKNOWN',
  'SP_REQUIRED', 'SP_TOO_MANY', 'SP_UNKNOWN', 'TP_REQUIRED', 'TP_RANGE', 'ARAS_REQUIRED', 'ARAS_INVALID', 'KBAT_INVALID',
  'CHAPTER_MISMATCH', 'TOPIC_INVALID', 'DIFFICULTY_INVALID', 'PROMPT_SHORT', 'PROMPT_LONG', 'OPTIONS_BLANK', 'OPTIONS_MIN', 'OPTION_LONG',
  'CORRECT_REQUIRED', 'MARKS_MIN', 'MARKS_MAX',
] as const
export type QuestionImportErrorCode = (typeof QUESTION_IMPORT_ERROR_CODES)[number]

/**
 * Header of the error CSV (`GET /question-imports/{id}/errors`, FR-ADM-QE6.2): one line per row error. It repeats only what Q-11 asks for:
 * the question key and the `{key}` / `{kod}` / `{label}` placeholders of the Q-11 texts, each cut at `QUESTION_IMPORT_ECHO_MAX` characters; never another cell.
 */
export const QUESTION_IMPORT_ERROR_CSV_HEADER = ['baris', 'question_key', 'medan', 'kod_ralat', 'mesej'] as const
export const QUESTION_IMPORT_ERROR_CSV_FILENAME = 'laporan-ralat-import.csv'

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

/**
 * The ONE header list of the new (code) header, in the order of the table in 30 R1-ADM-Q-11 (families expanded). A header cell outside
 * this list (and outside `QUESTION_IMPORT_CODE_ALIAS_COLUMNS`) is ignored with `unknownColumn`. S1-T05 part 1 reads the MCQ columns and the
 * DSKP columns; the group, stimulus and other-type columns are in the list so they raise no warning, and later parts read them.
 */
const familyOf = (prefix: string, suffix: string): string[] => 'abcdefgh'.split('').map((l) => `${prefix}${l}${suffix}`)
export const QUESTION_IMPORT_CODE_HEADER = [
  'question_key', 'type', 'mode', 'part_label', 'subject_code', 'tingkatan', 'bahasa', 'jenis_tulisan', 'kertas', 'bahagian', 'number_label',
  'unit_code', 'sp_kod', 'tp', 'aras', 'kbat', 'bab_kod', 'topik_kod', 'difficulty',
  'group_key', 'group_order', 'group_id',
  'stimulus_label', 'stimulus_kind', 'stimulus_text', 'stimulus_text_en', 'stimulus_image', 'stimulus_alt', 'stimulus_caption', 'stimulus_source',
  'stimulus2_label', 'stimulus2_kind', 'stimulus2_text', 'stimulus2_text_en', 'stimulus2_image', 'stimulus2_alt', 'stimulus2_caption', 'stimulus2_source',
  'stimulus3_label', 'stimulus3_kind', 'stimulus3_text', 'stimulus3_text_en', 'stimulus3_image', 'stimulus3_alt', 'stimulus3_caption', 'stimulus3_source',
  'part_stimulus', 'intro_ms', 'intro_en', 'prompt_ms', 'prompt_en',
  ...familyOf('option_', ''), ...familyOf('option_', '_en'),
  'correct', 'accepted_answers', 'numeric_value', 'numeric_unit', 'tolerance_kind', 'tolerance_value', 'word_min', 'word_max', 'marks', 'scheme',
] as const
/** Columns the new header also accepts: `explanation` (the explanation of the question) and the old name of `difficulty`. */
export const QUESTION_IMPORT_CODE_ALIAS_COLUMNS = ['explanation', 'difficulty_level'] as const
/** Columns the new header must have (a missing one refuses the file); the DSKP and default-able columns are checked per row. */
export const QUESTION_IMPORT_CODE_REQUIRED_COLUMNS = ['question_key', 'type', 'prompt_ms', 'option_a', 'option_b', 'correct', 'marks'] as const
/** Data rows a file may have (header excluded); more is refused whole with 422 on both import routes. */
export const QUESTION_IMPORT_MAX_ROWS = 2000

/** Columns the (legacy) file must have; subject, level and difficulty may come from the form defaults. */
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
    questionKey: z.string().max(40).optional().meta({ description: 'New header only: the `question_key` of the row (cut at 40 characters).' }),
    field: z.string().optional().meta({ description: 'New header only: the column the message is about (`medan` of the error CSV).' }),
    code: z.enum(QUESTION_IMPORT_ERROR_CODES).optional().meta({ description: 'New header only: stable error code (`kod_ralat` of the error CSV).' }),
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
export const QuestionImportCreatedSchema = questionWorkflowMutationOf(QuestionImportRunSchema)
  .extend({ warnings: z.array(z.string()).optional().meta({ description: 'New header only: "Kolum {nama} tidak dikenali dan diabaikan." per unknown header cell. Not stored in the history.' }) })
  .meta({
  id: 'QuestionImportCreated',
})

export const QuestionImportListQuerySchema = z
  .object({ page: z.coerce.number().int().min(1).optional().meta({ description: 'Invalid or missing means 1. Page size is fixed at 20.' }) })
  .meta({ id: 'QuestionImportListQuery' })

/* --------------------------------------------------------------------------------- Guru import */

/**
 * S6-T06 (API-GUR-19, docs/prd/r1/20-guru-admin-sekolah.md 44-F3): the teacher's CSV is its own format (BM columns by NAME, not by id) and
 * its rows become items of ONE `source = 'guru'` intake batch (L-6), "Menunggu Semakan". The admin import above is unchanged.
 */
export const QUESTION_IMPORT_GURU_HEADER = [
  'subjek',
  'tingkatan',
  'bab',
  'sp',
  'tp',
  'aras',
  'kesukaran',
  'soalan',
  'pilihan_a',
  'pilihan_b',
  'pilihan_c',
  'pilihan_d',
  'jawapan',
  'penerangan',
] as const

/** Columns the file must have; `bab`, `sp`, `tp`, `aras`, `kesukaran` and `penerangan` may be left out (the admin completes them, D112). */
export const QUESTION_IMPORT_GURU_REQUIRED_COLUMNS = ['subjek', 'tingkatan', 'soalan', 'pilihan_a', 'pilihan_b', 'pilihan_c', 'pilihan_d', 'jawapan'] as const

/** The template file text: the header and the PRD example row, CRLF, trailing CRLF. */
export const QUESTION_IMPORT_GURU_TEMPLATE_CSV = [
  QUESTION_IMPORT_GURU_HEADER.join(','),
  'Matematik,4,Bab 1,1.1.1,3,mengaplikasi,3,Contoh soalan?,A,B,C,D,A,Contoh penerangan',
  '',
].join('\r\n')
export const QUESTION_IMPORT_GURU_TEMPLATE_FILENAME = 'templat-soalan.csv'
/** Teacher caps (44-F3): at most 2 MB and 500 data rows. */
export const QUESTION_IMPORT_GURU_MAX_BYTES = 2 * 1024 * 1024
export const QUESTION_IMPORT_GURU_MAX_ROWS = 500

export const QUESTION_IMPORT_GURU_MESSAGES = {
  /** ERR-REQ-04 with the list "CSV". */
  fileType: 'Jenis fail tidak disokong. Format dibenarkan: CSV.',
  /** ERR-REQ-05 with 2. */
  fileSize: 'Fail melebihi saiz maksimum 2 MB.',
  /** ERR-REQ-07. */
  fileRequired: 'Sila pilih fail.',
  tooManyRows: 'Fail melebihi 500 baris.',
  noData: 'Fail CSV tiada baris data.',
  /** ERR-IMP-02. */
  missingColumns: (columns: readonly string[]): string => `Lajur wajib tiada: ${columns.join(', ')}. Gunakan templat yang disediakan.`,
  /** ERR-IMP-01 (the screen builds it from the counts). */
  imported: (imported: number, failed: number): string => `${String(imported)} soalan diimport, ${String(failed)} baris gagal.`,
} as const

/** Row reasons (`errors[].message`), exact copy of 44-F3 and the next ERR-GUR ids of 40 X10. */
export const QUESTION_IMPORT_GURU_ROW_MESSAGES = {
  subject: 'Subjek tidak dikenali.',
  level: 'Tingkatan mesti antara 1 dan 5.',
  tp: 'Tahap Penguasaan (TP) mesti antara 1 dan 6.',
  cognitive: 'Aras pemikiran tidak sah.',
  difficulty: 'Kesukaran mesti antara 1 dan 5.',
  answer: 'Jawapan mesti A, B, C atau D.',
  chapterNotFound: (value: string): string => `Bab tidak dijumpai: ${value}`,
  spNotFound: (value: string): string => `SP tidak dijumpai: ${value}`,
  text: 'Soalan diperlukan.',
  option: (letter: string): string => `Pilihan ${letter} diperlukan.`,
  textTooLong: 'Soalan tidak boleh melebihi 2000 aksara.',
  optionTooLong: (letter: string): string => `Pilihan ${letter} tidak boleh melebihi 500 aksara.`,
  explanationTooLong: 'Penerangan tidak boleh melebihi 2000 aksara.',
} as const

const guruCsvFile = questionWorkflowFile({
  maxBytes: QUESTION_IMPORT_GURU_MAX_BYTES,
  mimes: QUESTION_IMPORT_MIME_TYPES,
  extensions: ['csv'],
  description: 'CSV file, UTF-8, at most 2 MB and 500 data rows (or the JSON field `csv` with the file text, limited to the default 100 kb JSON body).',
})

/**
 * Body of `POST /guru/questions/import`: `multipart/form-data` with `csvFile`, or JSON `{ csv: "<file text>" }` (the JSON path is limited to the default 100 kb body parser). 422 `fields.csvFile` for:
 * none chosen, not CSV, over 2 MB, over 500 data rows ("Fail melebihi 500 baris."), a missing required column, no data row. A bad ROW never
 * fails the request: it is listed in `errors` and the valid rows still become intake items.
 */
export const QuestionImportGuruRequestSchema = z.object({ csvFile: guruCsvFile }).meta({ id: 'QuestionImportGuruRequest' })

/** `data` of the Guru import (200, not 201): `imported` valid rows became items of one guru batch; bad rows are listed ordered by file row. */
export const QuestionImportGuruResultSchema = z
  .strictObject({
    imported: z.number().int().min(0),
    errors: z.array(QuestionImportFailureSchema),
    /** Unknown header cells of an S1-T05 (code header) file; absent for the teacher's own BM format. */
    warnings: z.array(z.string()).optional(),
  })
  .meta({ id: 'QuestionImportGuruResult' })
export type QuestionImportGuruResult = z.infer<typeof QuestionImportGuruResultSchema>
