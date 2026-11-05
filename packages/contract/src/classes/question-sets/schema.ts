import { z } from '../../zod'
import { listEnvelopeOf } from '../../common/envelope'
import { IdSchema } from '../../common/ids'
import { TimestampSchema } from '../../common/time'

/**
 * M10 part B wire contract (BE-18, contract-only), question sets half: the student list of teacher
 * sets, the teacher question paper upload, the Audio KBAT template downloads and the teacher DSKP
 * picks (bidang, SK, SP). Source: m10 mock handlers `student-side`, `extras`, `lookups`, repositories
 * `question-sets` and `dskp`, and `api/types.ts`. Ids are opaque strings, timestamps are `+08:00`,
 * `legacy_*` never appears. Remedial and missions are in `../missions`.
 * Placement: the card gives no home for DSKP picks, so they sit here with the question tools.
 */

/** Generic texts of the mock guards (401, 403, 404 on a malformed or unknown route). */
export const QUESTION_SET_GUARD_MESSAGES = {
  unauthenticated: 'Sesi anda telah tamat. Sila log masuk semula.',
  forbidden: 'Anda tidak dibenarkan melakukan tindakan ini.',
  notFound: 'Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?',
} as const

/**
 * Texts of the paper upload 422 (PRD-20 44-F4, 40-cross-cutting X10): ERR-REQ-04 with "PDF, DOCX, XLSX", ERR-REQ-05 with 20,
 * ERR-REQ-07, the teacher text of ERR-QUOTA-03, and the field messages of the 44-F4 table.
 */
export const QUESTION_SET_PAPER_MESSAGES = {
  type: 'Sila pilih jenis soalan.',
  subject: 'Sila isi matapelajaran.',
  subjectLong: 'Matapelajaran tidak boleh melebihi 100 aksara.',
  level: 'Tingkatan tidak sah.',
  year: 'Tahun mesti antara 2000 dan 2099.',
  author: 'Disediakan oleh tidak boleh melebihi 150 aksara.',
  note: 'Catatan tambahan tidak boleh melebihi 1000 aksara.',
  confirm: 'Sila sahkan skema jawapan disertakan.',
  files: 'Sila pilih fail.',
  tooMany: 'Maksimum 5 fail, saiz maksimum 20MB setiap fail',
  fileType: 'Jenis fail tidak disokong. Format dibenarkan: PDF, DOCX, XLSX.',
  fileSize: 'Fail melebihi saiz maksimum 20 MB.',
  scanned: 'PDF imbasan imej tidak diterima — teks mesti boleh disalin.',
} as const

/** Exact copy of the mock `MSG` for the DSKP inline creates (`200 { error }`), UNVERIFIED COPY. */
export const DSKP_MESSAGES = {
  bidangName: 'Nama bidang diperlukan.',
  bidangParent: 'Subjek atau tahap tidak sah.',
  skFields: 'Kod dan keterangan SK diperlukan.',
  skParent: 'Bidang tidak sah.',
  spFields: 'Kod dan keterangan SP diperlukan.',
  spParent: 'SK tidak sah.',
} as const

/** An id in a request body: a non-blank string, or a number of at least 1 (the mock reads digit strings and numbers). */
const idInput = (message: string) =>
  z.union([z.string().trim().min(1, message), z.number().int().min(1, message)], { error: message })

/** The length rule of the mock is by code point (`[...text].length`), not by UTF-16 unit. */
const within = (max: number) => (value: string) => [...value].length <= max

/** The mock `required(value, max)`: trimmed, not blank, at most `max` code points; one message for all three. */
const requiredText = (message: string, max: number) =>
  z.string({ error: message }).trim().min(1, message).refine(within(max), message)

// --- Student list "Set Soalan Guru" (S34, BR-M10-18) ---------------------------------------------

/**
 * One set the caller may start: draft never, scheduled once due. A migrated set keeps its header
 * only and has no items (Q4 default): how the empty state shows is open (card open question 2).
 */
export const QuestionSetStudentItemSchema = z
  .object({
    id: IdSchema,
    title: z.string(),
    teacherName: z.string().nullable(),
    questionCount: z.number().int().meta({ description: 'Number of questions in the set.' }),
    timeLimitMinutes: z.number().int().nullable().meta({ description: 'null = no limit.' }),
    attemptsLeft: z.number().int().nullable().meta({
      description: 'maxAttempts minus the caller\'s completed question_set sessions of the set, floored at 0; null when attempts are unlimited (maxAttempts 0).',
    }),
  })
  .meta({ id: 'QuestionSetStudentItem' })
export type QuestionSetStudentItem = z.infer<typeof QuestionSetStudentItemSchema>

/** `{ data, meta }`; single page (the mock `unpaged`), oldest created first. */
export const QuestionSetStudentListSchema = listEnvelopeOf(QuestionSetStudentItemSchema).meta({
  id: 'QuestionSetStudentList',
})

// --- Teacher question paper upload (S22, BR-M10-25, FR-M10-98) ------------------------------------

/** OPT-JENIS-HANTARAN stored slugs (the select labels are "Soalan Umum", "Trial Paper", "Soalan DSKP", "Buku Teks", "Buku Latihan", "Soalan Peperiksaan", "Lain-lain"). */
export const QUESTION_SET_PAPER_TYPES = ['umum', 'trial', 'dskp', 'buku_teks', 'buku_latihan', 'peperiksaan', 'lain'] as const
export const QUESTION_SET_PAPER_MAX_FILES = 5
export const QUESTION_SET_PAPER_MAX_FILE_BYTES = 20 * 1024 * 1024
/** Allowed extensions, case-insensitive, matched at the end of the file name (images and the old .doc/.xls are not accepted). */
export const QUESTION_SET_PAPER_FILE_PATTERN = /\.(pdf|docx|xlsx)$/i

/** The mock `intOf`: a safe integer, or a string of digits with an optional minus and surrounding spaces. */
function wholeNumber(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isSafeInteger(value) ? value : undefined
  if (typeof value === 'string' && /^\s*-?\d+\s*$/.test(value)) {
    const n = Number(value)
    return Number.isSafeInteger(n) ? n : undefined
  }
  return undefined
}
/** Empty values the mock treats as "not given": absent, null and the empty string. */
const isEmpty = (value: unknown): boolean => value === undefined || value === null || value === ''

const numberOrText = (message: string) => z.union([z.number(), z.string()], { error: message })

/**
 * The text fields of `POST /guru/question-papers` (multipart, so every value arrives as a string;
 * numbers are also accepted as the mock does). The field names are the Malay form names.
 */
export const QuestionSetPaperFieldsSchema = z
  .object({
    paperType: z
      .string({ error: QUESTION_SET_PAPER_MESSAGES.type })
      .trim()
      .pipe(z.enum(QUESTION_SET_PAPER_TYPES, { error: QUESTION_SET_PAPER_MESSAGES.type }))
      .meta({ enum: [...QUESTION_SET_PAPER_TYPES], description: 'OPT-JENIS-HANTARAN slug, trimmed.' }),
    subject: z
      .string({ error: QUESTION_SET_PAPER_MESSAGES.subject })
      .trim()
      .min(1, QUESTION_SET_PAPER_MESSAGES.subject)
      .refine(within(100), QUESTION_SET_PAPER_MESSAGES.subjectLong)
      .meta({ maxLength: 100, description: 'Matapelajaran (free text), trimmed, at most 100 characters.' }),
    levelId: numberOrText(QUESTION_SET_PAPER_MESSAGES.level)
      .nullish()
      .refine((v) => {
        if (isEmpty(v)) return true
        const n = wholeNumber(typeof v === 'string' ? v.replace(/^T/i, '') : v)
        return n !== undefined && n >= 1 && n <= 5
      }, QUESTION_SET_PAPER_MESSAGES.level)
      .meta({ description: 'Tingkatan 1 to 5 ("T1" to "T5" is read too), or empty for "Semua / Tidak Pasti".' }),
    year: numberOrText(QUESTION_SET_PAPER_MESSAGES.year)
      .nullish()
      .refine((v) => {
        if (isEmpty(v)) return true
        const n = wholeNumber(v)
        return n !== undefined && n >= 2000 && n <= 2099
      }, QUESTION_SET_PAPER_MESSAGES.year)
      .meta({ description: '2000 to 2099, or empty; empty is stored as the current year (the question bank needs a year).' }),
    preparedBy: z
      .string()
      .trim()
      .refine(within(150), QUESTION_SET_PAPER_MESSAGES.author)
      .nullish()
      .meta({ maxLength: 150, description: 'At most 150 characters; empty is stored as "Kiriman guru".' }),
    note: z
      .string()
      .trim()
      .refine(within(1000), QUESTION_SET_PAPER_MESSAGES.note)
      .nullish()
      .meta({ maxLength: 1000, description: 'At most 1000 characters; empty is stored as null.' }),
    answerSchemeConfirmed: z
      .union([z.boolean(), z.string()], { error: QUESTION_SET_PAPER_MESSAGES.confirm })
      .refine((v) => v === true || (typeof v === 'string' && ['true', '1', 'on'].includes(v.trim().toLowerCase())), QUESTION_SET_PAPER_MESSAGES.confirm)
      .meta({ description: 'The teacher confirms the answer scheme is attached; must be true ("true", "1" or "on" in multipart). Not stored.' }),
  })
  .meta({ id: 'QuestionSetPaperFields' })

/** What the server reads from each uploaded part (the mock `fileOf`): name, byte size, declared type. */
export const QuestionSetPaperFileSchema = z
  .object({ name: z.string(), size: z.number().int().min(0), type: z.string() })
  .meta({ id: 'QuestionSetPaperFile' })

/**
 * The checks on the uploaded parts, named `files` (the client sends the key `files[]`; both are read).
 * Messages: none or missing, more than 5, a bad extension (.pdf .docx .xlsx only), a file over 20 MB. Any invalid file rejects the whole submission.
 */
export const QuestionSetPaperFilesSchema = z
  .array(QuestionSetPaperFileSchema, { error: QUESTION_SET_PAPER_MESSAGES.files })
  .superRefine((files, ctx) => {
    if (files.length === 0) {
      ctx.addIssue({ code: 'custom', message: QUESTION_SET_PAPER_MESSAGES.files })
    } else if (files.length > QUESTION_SET_PAPER_MAX_FILES) {
      ctx.addIssue({ code: 'custom', message: QUESTION_SET_PAPER_MESSAGES.tooMany })
    } else {
      const badType = files.find((f) => !QUESTION_SET_PAPER_FILE_PATTERN.test(f.name))
      if (badType) ctx.addIssue({ code: 'custom', message: QUESTION_SET_PAPER_MESSAGES.fileType })
      else if (files.some((f) => f.size > QUESTION_SET_PAPER_MAX_FILE_BYTES)) ctx.addIssue({ code: 'custom', message: QUESTION_SET_PAPER_MESSAGES.fileSize })
    }
  })
  .meta({ id: 'QuestionSetPaperFiles' })

/** Validation view of the whole form: the text fields plus the file descriptors the server derived. */
export const QuestionSetPaperRequestSchema = QuestionSetPaperFieldsSchema.extend({
  files: QuestionSetPaperFilesSchema,
}).meta({ id: 'QuestionSetPaperRequest' })
export type QuestionSetPaperRequest = z.infer<typeof QuestionSetPaperRequestSchema>

/** The multipart body as sent on the wire (files are binary parts). Documentation only; validate with the schema above. */
export const QuestionSetPaperUploadSchema = QuestionSetPaperFieldsSchema.extend({
  files: z
    .array(z.string().meta({ format: 'binary' }))
    .min(1)
    .max(QUESTION_SET_PAPER_MAX_FILES)
    .meta({ description: '1 to 5 files (.pdf .docx .xlsx; images are not accepted), each at most 20 MB. A scanned PDF (no text on its first 3 pages) is refused. The mock also reads the key "files[]".' }),
}).meta({ id: 'QuestionSetPaperUpload' })

/** `data` of the 201: the id of the `source = guru` intake batch the files were stored in. */
export const QuestionSetPaperSchema = z.object({ batchId: IdSchema }).meta({ id: 'QuestionSetPaper' })
export type QuestionSetPaper = z.infer<typeof QuestionSetPaperSchema>

/** 422: `fields` holds the first message per field; `message` is the Laravel summary of the first one. */
export const QuestionSetPaperFieldErrorSchema = z
  .object({
    error: z.object({
      code: z.literal('VALIDATION_ERROR'),
      message: z.string(),
      fields: z.object({
        paperType: z.literal(QUESTION_SET_PAPER_MESSAGES.type).optional(),
        subject: z.enum([QUESTION_SET_PAPER_MESSAGES.subject, QUESTION_SET_PAPER_MESSAGES.subjectLong]).optional(),
        levelId: z.literal(QUESTION_SET_PAPER_MESSAGES.level).optional(),
        year: z.literal(QUESTION_SET_PAPER_MESSAGES.year).optional(),
        preparedBy: z.literal(QUESTION_SET_PAPER_MESSAGES.author).optional(),
        note: z.literal(QUESTION_SET_PAPER_MESSAGES.note).optional(),
        answerSchemeConfirmed: z.literal(QUESTION_SET_PAPER_MESSAGES.confirm).optional(),
        files: z.string().optional().meta({
          description: [QUESTION_SET_PAPER_MESSAGES.files, QUESTION_SET_PAPER_MESSAGES.tooMany, QUESTION_SET_PAPER_MESSAGES.fileType, QUESTION_SET_PAPER_MESSAGES.fileSize, QUESTION_SET_PAPER_MESSAGES.scanned].join(' | '),
        }),
      }),
    }),
  })
  .meta({ id: 'QuestionSetPaperFieldError' })

// --- Audio KBAT bulk-import templates (S21, DV-M10-08, D24) ---------------------------------------

const BOM = String.fromCharCode(0xfeff)
const csvCell = (cell: string): string => (/[\s,"]/.test(cell) ? `"${cell.replaceAll('"', '""')}"` : cell)

/**
 * Fixed content of the two downloads. `/audio-kbat/template` is a CSV (the screen link says XLSX, the
 * mock serves `text/csv`); `/audio-kbat/template-word` is a `.docx` with a title, an intro and a table.
 * Every cell is a fixed constant (no user data), so CSV formula neutralisation does not apply here.
 */
export const QUESTION_SET_AUDIO_KBAT_TEMPLATE = {
  csv: {
    fileName: 'template-audio-kbat.csv',
    contentType: 'text/csv; charset=UTF-8',
    headings: ['tajuk', 'kod_subjek', 'kod_tingkatan', 'nama_fail_audio'],
    example: ['Contoh: KBAT Sains Bab 1', 'SCI', 'T4', 'kbat-sains-1.mp3'],
  },
  word: {
    fileName: 'template-audio-kbat.docx',
    contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    title: 'Template Set Audio KBAT',
    intro: 'Isi satu baris bagi setiap set. Muat naik fail audio melalui borang "Cipta Set" di /guru/audio-kbat.',
    headings: ['Tajuk', 'Kod Subjek', 'Kod Tingkatan', 'Nama Fail Audio'],
    example: ['KBAT Sains Bab 1', 'SCI', 'T4', 'kbat-sains-1.mp3'],
  },
} as const

/** The exact body of the CSV: UTF-8 BOM, the heading row and the example row, `\n` line ends, cells quoted as PHP `fputcsv`. */
export const QUESTION_SET_AUDIO_KBAT_CSV_TEXT = `${BOM}${QUESTION_SET_AUDIO_KBAT_TEMPLATE.csv.headings.join(',')}\n${QUESTION_SET_AUDIO_KBAT_TEMPLATE.csv.example.map(csvCell).join(',')}\n`

// --- DSKP picks (teacher inline creates; the GETs are BE-10) --------------------------------------

/**
 * `POST /guru/dskp/bidang` body. `name` is trimmed, 1 to 255 characters; a name too long or a code
 * over 50 characters both give "Nama bidang diperlukan." (the mock reuses the text). `code` blank is
 * stored as null. The parent ids must exist (state check, see DskpBidangInlineError).
 */
export const DskpBidangCreateRequestSchema = z
  .object({
    name: requiredText(DSKP_MESSAGES.bidangName, 255),
    subjectId: idInput(DSKP_MESSAGES.bidangParent),
    educationLevelId: idInput(DSKP_MESSAGES.bidangParent),
    code: z.string().trim().refine(within(50), DSKP_MESSAGES.bidangName).nullish(),
  })
  .meta({ id: 'DskpBidangCreateRequest' })
export type DskpBidangCreateRequest = z.infer<typeof DskpBidangCreateRequestSchema>

/** `POST /guru/dskp/sk` body: code 1 to 50, description 1 to 2000 (one message for both), the bidang must exist. */
export const DskpSkCreateRequestSchema = z
  .object({
    bidangId: idInput(DSKP_MESSAGES.skParent),
    code: requiredText(DSKP_MESSAGES.skFields, 50),
    description: requiredText(DSKP_MESSAGES.skFields, 2000),
  })
  .meta({ id: 'DskpSkCreateRequest' })
export type DskpSkCreateRequest = z.infer<typeof DskpSkCreateRequestSchema>

/** `POST /guru/dskp/sp` body: code 1 to 50, description 1 to 2000 (one message for both), the SK must exist. */
export const DskpSpCreateRequestSchema = z
  .object({
    skId: idInput(DSKP_MESSAGES.spParent),
    code: requiredText(DSKP_MESSAGES.spFields, 50),
    description: requiredText(DSKP_MESSAGES.spFields, 2000),
  })
  .meta({ id: 'DskpSpCreateRequest' })
export type DskpSpCreateRequest = z.infer<typeof DskpSpCreateRequestSchema>

/** Bare bodies of the 201 answers. */
export const DskpBidangSchema = z
  .object({ id: IdSchema, code: z.string().nullable(), name: z.string() })
  .meta({ id: 'DskpBidang' })
export const DskpSkSchema = z
  .object({ id: IdSchema, code: z.string(), description: z.string() })
  .meta({ id: 'DskpSk' })
export const DskpSpSchema = z
  .object({ id: IdSchema, code: z.string(), description: z.string() })
  .meta({ id: 'DskpSp' })

/**
 * Refusal of an inline create, as live and as the mock: HTTP 200 with a bare `{ error: "<text>" }`
 * (a string, not the standard error object; the S18 alerts show it). Open question for the LEAD:
 * keep this or move to a 422 (BE-17 chose 422 for chapters and topics).
 */
export const DskpBidangInlineErrorSchema = z
  .object({ error: z.enum([DSKP_MESSAGES.bidangName, DSKP_MESSAGES.bidangParent]) })
  .meta({ id: 'DskpBidangInlineError' })
export const DskpSkInlineErrorSchema = z
  .object({ error: z.enum([DSKP_MESSAGES.skFields, DSKP_MESSAGES.skParent]) })
  .meta({ id: 'DskpSkInlineError' })
export const DskpSpInlineErrorSchema = z
  .object({ error: z.enum([DSKP_MESSAGES.spFields, DSKP_MESSAGES.spParent]) })
  .meta({ id: 'DskpSpInlineError' })
