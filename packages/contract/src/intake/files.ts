import { z } from '../zod'
import { IdSchema } from '../common/ids'
import { ListMetaSchema } from '../common/envelope'
import { TimestampSchema } from '../common/time'

/**
 * BE-37 (contract): the intake SUBMISSION (batch) with its declaration, the stored PDF files, the page
 * list with text and blocks, figure references and the processing status. `intake_batches` IS the
 * question-paper Submission (D53/OWN-1). The extracted items and the review workflow are BE-38
 * (`items.ts`, `review.ts`); the AI adapter types are BE-36 (`ai/`).
 *
 * No storage key, no sha256 and no internal file id appears on this wire: images and the original are
 * read through the routes below, scope-checked (owner Guru or Admin Pusat). Everything the prototype
 * does not define is `[PROPOSED]`.
 */

/* ------------------------------------------------------------------------------------------ */
/* Enums                                                                                       */
/* ------------------------------------------------------------------------------------------ */

/** Submission status. Prototype labels: Dihantar / Sedang diproses / Sedia untuk semakan / Gagal; `cancelled` is [PROPOSED]. */
export const INTAKE_BATCH_STATUSES = ['submitted', 'processing', 'ready_for_review', 'failed', 'cancelled'] as const
export const IntakeBatchStatusSchema = z.enum(INTAKE_BATCH_STATUSES).meta({
  id: 'IntakeBatchStatus',
  description:
    'Processing status of a submission (card BE-37): submitted = Dihantar, processing = Sedang diproses, ready_for_review = Sedia untuk semakan, failed = Gagal, cancelled = Dibatalkan [PROPOSED].',
})
export type IntakeBatchStatus = z.infer<typeof IntakeBatchStatusSchema>

export const INTAKE_BATCH_STATUS_LABELS = {
  submitted: 'Dihantar',
  processing: 'Sedang diproses',
  ready_for_review: 'Sedia untuk semakan',
  failed: 'Gagal',
  cancelled: 'Dibatalkan',
} as const satisfies Record<IntakeBatchStatus, string>

export const INTAKE_FILE_STATUSES = ['uploaded', 'processing', 'done', 'failed', 'cancelled'] as const
export const IntakeFileStatusSchema = z.enum(INTAKE_FILE_STATUSES).meta({
  id: 'IntakeFileStatus',
  description: '[PROPOSED] Processing status of one stored PDF.',
})
export type IntakeFileStatus = z.infer<typeof IntakeFileStatusSchema>

export const INTAKE_PAGE_OCR_STATUSES = ['pending', 'not_needed', 'done', 'failed'] as const
export const IntakePageOcrStatusSchema = z.enum(INTAKE_PAGE_OCR_STATUSES).meta({
  id: 'IntakePageOcrStatus',
  description: '[PROPOSED] pending = not processed yet, not_needed = the page has a text layer, done = read by OCR, failed = see `errorCode`.',
})
export type IntakePageOcrStatus = z.infer<typeof IntakePageOcrStatusSchema>

export const INTAKE_TEXT_SOURCES = ['text-layer', 'ocr'] as const
export const IntakeTextSourceSchema = z.enum(INTAKE_TEXT_SOURCES).meta({
  id: 'IntakeTextSource',
  description: '`text-layer` = digital-born PDF, `ocr` = scanned page read by Tesseract. Same values as the BE-36 `AiPageText.source`.',
})
export type IntakeTextSource = z.infer<typeof IntakeTextSourceSchema>

/** Prototype PAPER_TYPES (`admin/intake/types.ts`). */
export const INTAKE_PAPER_TYPE_CODES = ['trial', 'general', 'exam', 'exercise_book', 'other'] as const
export const IntakePaperTypeSchema = z.enum(INTAKE_PAPER_TYPE_CODES).meta({
  id: 'IntakePaperType',
  description: 'Paper type (prototype PAPER_TYPES): trial = Percubaan SPM, general = Soalan Umum, exam = Peperiksaan Sebenar, exercise_book = Buku Latihan, other = Lain-lain.',
})
export type IntakePaperType = z.infer<typeof IntakePaperTypeSchema>

export const INTAKE_PAPER_TYPE_LABELS = {
  trial: 'Percubaan SPM',
  general: 'Soalan Umum',
  exam: 'Peperiksaan Sebenar',
  exercise_book: 'Buku Latihan',
  other: 'Lain-lain',
} as const satisfies Record<IntakePaperType, string>

/** Prototype COPYRIGHT_OPTIONS values, identical on the wire. The database stores own, official_lpm, third_party. */
export const INTAKE_COPYRIGHT_CODES = ['sendiri', 'rasmi', 'pihak-ketiga'] as const
export const IntakeCopyrightSchema = z.enum(INTAKE_COPYRIGHT_CODES).meta({
  id: 'IntakeCopyright',
  description: 'Rights declaration (prototype COPYRIGHT_OPTIONS): sendiri = own work, rasmi = official (LPM), pihak-ketiga = third party.',
})
export type IntakeCopyright = z.infer<typeof IntakeCopyrightSchema>

/** Error codes of a file or a page. A page code is never shown to a provider; the UI maps it to BM copy. */
export const INTAKE_FILE_ERROR_CODES = [
  'ENCRYPTED',
  'CORRUPT',
  'TOO_MANY_PAGES',
  'TOO_COMPLEX',
  'OCR_TIMEOUT',
  'OCR_FAILED',
  'OCR_UNAVAILABLE',
  'RENDER_FAILED',
  'CANCELLED',
] as const
export const IntakeFileErrorCodeSchema = z.enum(INTAKE_FILE_ERROR_CODES).meta({
  id: 'IntakeFileErrorCode',
  description:
    '[PROPOSED] Why a file or page failed: ENCRYPTED, CORRUPT, TOO_MANY_PAGES, TOO_COMPLEX (bomb, memory or time limit while reading), OCR_TIMEOUT, OCR_FAILED, OCR_UNAVAILABLE (scanned page and no OCR engine configured), RENDER_FAILED, CANCELLED.',
})
export type IntakeFileErrorCode = z.infer<typeof IntakeFileErrorCodeSchema>

/* ------------------------------------------------------------------------------------------ */
/* Messages (BM)                                                                               */
/* ------------------------------------------------------------------------------------------ */

/**
 * Upload rejections (422 VALIDATION_ERROR, `fields.files`) and the two other upload failures. The
 * prototype has only "Fail melebihi had 20 MB."; every other line is new copy, [PROPOSED] (card open
 * question 1, the lead approves it). The {N} messages are functions.
 */
export const INTAKE_FILE_MESSAGES = {
  type: 'Jenis fail tidak disokong. Gunakan PDF.',
  size: (mb: number) => `Fail melebihi had ${mb} MB.`,
  pages: (n: number) => `Fail melebihi had ${n} halaman.`,
  encrypted: 'Fail PDF dilindungi kata laluan dan tidak boleh dibaca.',
  corrupt: 'Fail PDF rosak atau tidak boleh dibaca.',
  tooComplex: 'Fail PDF terlalu kompleks untuk diproses.',
  duplicate: 'Fail ini telah diimport dalam kelompok lain.',
  tooManyFiles: (n: number) => `Maksimum ${n} fail bagi setiap kelompok.`,
  quota: 'Had kuota muat naik harian telah dicapai. Cuba lagi esok.',
  batchClosed: 'Kelompok ini tidak lagi menerima fail.',
} as const

/* ------------------------------------------------------------------------------------------ */
/* Requests                                                                                    */
/* ------------------------------------------------------------------------------------------ */

export const INTAKE_SOURCE_MAX = 200
export const INTAKE_NOTES_MAX = 1000
export const INTAKE_BATCH_PAGE_SIZE_MAX = 100
export const INTAKE_UPLOAD_FIELD = 'files'

/** Prototype IntakeMeta (paperType, subject, kertas, year, source, copyright, notes) plus the declaration tick. */
export const IntakeBatchCreateSchema = z
  .strictObject({
    paperType: IntakePaperTypeSchema,
    subject: z.string().regex(/^[A-Z0-9]{2,32}$/).meta({ description: 'Subject code (upper-case), e.g. MAT.', example: 'MAT' }),
    kertas: z.union([z.literal(1), z.literal(2)]),
    year: z.number().int().min(1990).max(2100),
    source: z.string().trim().min(1).max(INTAKE_SOURCE_MAX).meta({ description: 'Source declaration text (max 200).' }),
    copyright: IntakeCopyrightSchema,
    notes: z.string().max(INTAKE_NOTES_MAX).optional().meta({ description: 'Uploader notes (max 1000). Never sent to an AI provider.' }),
    declaration: z.literal(true).meta({ description: 'The uploader confirms the declaration; must be `true`.' }),
  })
  .meta({ id: 'IntakeBatchCreate', description: '[PROPOSED] Declaration of a submission (prototype IntakeMeta).' })
export type IntakeBatchCreate = z.infer<typeof IntakeBatchCreateSchema>

export const IntakeBatchListQuerySchema = z
  .strictObject({
    status: IntakeBatchStatusSchema.optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(INTAKE_BATCH_PAGE_SIZE_MAX).default(20),
  })
  .meta({ id: 'IntakeBatchListQuery', description: '[PROPOSED] Filters of GET /intake/batches. Newest first.' })
export type IntakeBatchListQuery = z.infer<typeof IntakeBatchListQuerySchema>

/** `multipart/form-data` body: one or more `files` parts. */
export const IntakeUploadMultipartSchema = z
  .strictObject({
    files: z
      .array(z.string().meta({ format: 'binary' }))
      .min(1)
      .meta({ description: 'One or more PDF parts, all named `files`.' }),
  })
  .meta({ id: 'IntakeUploadMultipartRequest' })

/* ------------------------------------------------------------------------------------------ */
/* Responses                                                                                   */
/* ------------------------------------------------------------------------------------------ */

export const IntakeOwnerRefSchema = z
  .strictObject({ id: IdSchema, name: z.string() })
  .meta({ id: 'IntakeOwnerRef', description: 'The uploader. The whole `owner` is null when the account was deleted.' })
export type IntakeOwnerRef = z.infer<typeof IntakeOwnerRefSchema>

export const IntakeFileProgressSchema = z
  .strictObject({
    total: z.number().int().min(0),
    done: z.number().int().min(0),
    failed: z.number().int().min(0),
  })
  .meta({ id: 'IntakeFileProgress', description: '[PROPOSED] Pages of one file: total, finished (done or not needed) and failed.' })
export type IntakeFileProgress = z.infer<typeof IntakeFileProgressSchema>

export const IntakeFileSummarySchema = z
  .strictObject({
    id: IdSchema,
    originalName: z.string().meta({ description: 'Sanitised client file name (display only).' }),
    sizeBytes: z.number().int().min(1),
    pageCount: z.number().int().min(1).nullable(),
    status: IntakeFileStatusSchema,
    errorCode: IntakeFileErrorCodeSchema.nullable(),
    progress: IntakeFileProgressSchema,
  })
  .meta({ id: 'IntakeFileSummary', description: '[PROPOSED] One stored PDF of a submission and its progress.' })
export type IntakeFileSummary = z.infer<typeof IntakeFileSummarySchema>

export const IntakeBatchSummarySchema = z
  .strictObject({
    id: IdSchema,
    status: IntakeBatchStatusSchema,
    statusLabel: z.string().meta({ description: 'BM label of `status` (INTAKE_BATCH_STATUS_LABELS).' }),
    paperType: IntakePaperTypeSchema,
    subject: z.string(),
    kertas: z.union([z.literal(1), z.literal(2)]),
    year: z.number().int(),
    source: z.string(),
    copyright: IntakeCopyrightSchema,
    notes: z.string().nullable(),
    adminNotes: z.string().nullable().meta({ description: 'Set by Admin Pusat (max 1000).' }),
    fileCount: z.number().int().min(0),
    pageCount: z.number().int().min(0).meta({ description: 'Sum of the page counts of the files read so far.' }),
    owner: IntakeOwnerRefSchema.nullable(),
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema,
    submittedAt: TimestampSchema.nullable(),
  })
  .meta({ id: 'IntakeBatchSummary', description: '[PROPOSED] A submission (batch) with its declaration and counts.' })
export type IntakeBatchSummary = z.infer<typeof IntakeBatchSummarySchema>

export const IntakeBatchDetailSchema = IntakeBatchSummarySchema.extend({
  files: z.array(IntakeFileSummarySchema),
}).meta({ id: 'IntakeBatchDetail', description: '[PROPOSED] A submission with its files and per-file progress.' })
export type IntakeBatchDetail = z.infer<typeof IntakeBatchDetailSchema>

export const IntakeUploadResultSchema = z
  .strictObject({ files: z.array(IntakeFileSummarySchema) })
  .meta({ id: 'IntakeUploadResult', description: '[PROPOSED] The files stored by one upload request, in upload order.' })
export type IntakeUploadResult = z.infer<typeof IntakeUploadResultSchema>

const FractionSchema = z.number().min(0).max(1)
export const IntakeBboxSchema = z
  .strictObject({ x: FractionSchema, y: FractionSchema, w: FractionSchema, h: FractionSchema })
  .meta({ id: 'IntakeBbox', description: 'Rectangle as fractions of the page (0..1), so it survives re-rendering.' })
export type IntakeBbox = z.infer<typeof IntakeBboxSchema>

export const IntakeTextBlockSchema = z
  .strictObject({
    text: z.string(),
    bbox: IntakeBboxSchema,
    confidence: z.number().min(0).max(100).nullable().meta({ description: 'OCR confidence 0-100; null for a text-layer block.' }),
  })
  .meta({ id: 'IntakeTextBlock', description: '[PROPOSED] A text block of a page with its position.' })
export type IntakeTextBlock = z.infer<typeof IntakeTextBlockSchema>

export const IntakeFigureRefSchema = z
  .strictObject({
    id: IdSchema,
    bbox: IntakeBboxSchema,
    altTextSuggestion: z.string().max(500).nullable(),
  })
  .meta({ id: 'IntakeFigureRef', description: '[PROPOSED] A figure cropped from a page; the image is GET /intake/figures/{id}/image.' })
export type IntakeFigureRef = z.infer<typeof IntakeFigureRefSchema>

export const IntakePageInfoSchema = z
  .strictObject({
    pageNo: z.number().int().min(1),
    width: z.number().int().min(1).nullable().meta({ description: 'Pixels of the page image; null until rendered.' }),
    height: z.number().int().min(1).nullable(),
    textSource: IntakeTextSourceSchema.nullable(),
    text: z.string().nullable(),
    ocrConfidence: z.number().min(0).max(100).nullable(),
    ocrStatus: IntakePageOcrStatusSchema,
    errorCode: IntakeFileErrorCodeSchema.nullable(),
    hasImage: z.boolean().meta({ description: 'true when GET /intake/files/{id}/pages/{n}/image has an image.' }),
    blocks: z.array(IntakeTextBlockSchema),
    figures: z.array(IntakeFigureRefSchema),
  })
  .meta({ id: 'IntakePageInfo', description: '[PROPOSED] One page: text, source, blocks, figures and status.' })
export type IntakePageInfo = z.infer<typeof IntakePageInfoSchema>

export const IntakePageListSchema = z
  .strictObject({ fileId: IdSchema, pages: z.array(IntakePageInfoSchema) })
  .meta({ id: 'IntakePageList', description: '[PROPOSED] All pages of one file, in page order.' })
export type IntakePageList = z.infer<typeof IntakePageListSchema>

/* Envelopes (`{ data }` and the list shape `{ data, meta }`). */
export const IntakeBatchSummaryEnvelopeSchema = z.object({ data: IntakeBatchSummarySchema }).meta({ id: 'IntakeBatchSummaryEnvelope' })
export const IntakeBatchDetailEnvelopeSchema = z.object({ data: IntakeBatchDetailSchema }).meta({ id: 'IntakeBatchDetailEnvelope' })
export const IntakeBatchListResponseSchema = z
  .object({ data: z.array(IntakeBatchSummarySchema), meta: ListMetaSchema })
  .meta({ id: 'IntakeBatchListResponse' })
export type IntakeBatchListResponse = z.infer<typeof IntakeBatchListResponseSchema>
export const IntakeUploadResultEnvelopeSchema = z.object({ data: IntakeUploadResultSchema }).meta({ id: 'IntakeUploadResultEnvelope' })
export const IntakePageListEnvelopeSchema = z.object({ data: IntakePageListSchema }).meta({ id: 'IntakePageListEnvelope' })
