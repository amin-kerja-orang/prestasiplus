import { z } from '../zod'
import { IdSchema } from '../common/ids'
import { TimestampSchema } from '../common/time'
import { questionWorkflowListMetaOf, questionWorkflowMutationOf } from './common'

/**
 * Student question reports (mock `m04-question-bank/mock/handlers/reports.ts`, SRS BR-M04-11 to 16,
 * v2-question-bank 4.7). Routes: `GET/POST /question-reports`, `GET /question-reports/mine`,
 * `PATCH /question-reports/{id}`.
 *
 * Differences from the mock: ids are strings (UD-1); `ReportView.questionVersion` is added (BE-10
 * AC 11, optional because the mock has none); the S13 "mine" rows use a narrower `question` block
 * (existence only, never text or answers); `source` accepts the five values the mock handler
 * accepts (the TS client type also lists `quiz` and `papan_bijak`, which the handler rejects).
 */

/** Exact BM copy of the mock (422 `fields` messages and the flashes). */
export const QUESTION_REPORT_MESSAGES = {
  reasonsRequired: 'Sila pilih sekurang-kurangnya satu sebab laporan.',
  reasonInvalid: 'Sebab laporan tidak sah.',
  source: 'Sumber laporan tidak sah.',
  type: 'Jenis soalan tidak sah.',
  question: 'Sila pilih soalan.',
  reference: 'Rujukan sesi atau bilik tidak sah.',
  comment: 'Komen tidak boleh melebihi 500 aksara.',
  status: 'Status tidak sah.',
  adminNotes: 'Nota admin tidak boleh melebihi 1000 aksara.',
  created: 'Laporan berjaya dihantar.',
  updated: 'Laporan berjaya dikemaskini.',
  /** Shown by the screen when the request itself fails (FR-M04-69). */
  failure: 'Ralat. Sila cuba lagi.',
} as const

export const QUESTION_REPORT_COMMENT_MAX = 500
export const QUESTION_REPORT_NOTES_MAX = 1000
/** `quizSessionId` and `roomCode`: 1 to 64 of letters, digits, `.`, `_`, `:`, `-`; empty = not given. */
export const QUESTION_REPORT_REF_PATTERN = /^[A-Za-z0-9._:-]{1,64}$/

export const QUESTION_REPORT_QUESTION_TYPES = ['mcq', 'structured'] as const
export const QuestionReportQuestionTypeSchema = z
  .enum(QUESTION_REPORT_QUESTION_TYPES, QUESTION_REPORT_MESSAGES.type)
  .meta({ id: 'QuestionReportQuestionType', description: 'mcq = objective question, structured = subjective question.' })

/** Reason sets per question type (BR-M04-15). `outdated` is sent only by the teacher databank. */
export const QUESTION_REPORT_MCQ_REASONS = [
  'wrong_answer',
  'confusing_question',
  'wrong_options',
  'missing_options',
  'duplicate',
  'typo',
  'other',
  'outdated',
] as const
export const QUESTION_REPORT_STRUCTURED_REASONS = [
  'wrong_answer',
  'confusing_question',
  'wrong_options',
  'typo',
  'other',
] as const

export const QUESTION_REPORT_SOURCES = ['spm', 'structured_attempt', 'latihan', 'revision', 'teacher_databank'] as const
export const QuestionReportSourceSchema = z
  .enum(QUESTION_REPORT_SOURCES, QUESTION_REPORT_MESSAGES.source)
  .meta({ id: 'QuestionReportSource', description: 'Where the report was filed. Default spm (mcq) or structured_attempt (structured).' })

export const QUESTION_REPORT_STATUSES = ['pending', 'reviewed', 'fixed', 'dismissed'] as const
export const QuestionReportStatusSchema = z.enum(QUESTION_REPORT_STATUSES).meta({ id: 'QuestionReportStatus' })
export type QuestionReportStatus = z.infer<typeof QuestionReportStatusSchema>

/** `removed` = status fixed, the question exists and is inactive (BR-M04-14). */
export const QUESTION_REPORT_DISPLAY_STATUSES = ['pending', 'reviewed', 'fixed', 'removed', 'dismissed'] as const
export const QuestionReportDisplayStatusSchema = z.enum(QUESTION_REPORT_DISPLAY_STATUSES).meta({ id: 'QuestionReportDisplayStatus' })

/** BM badge label of each display status (BR-M04-14). */
export const QUESTION_REPORT_DISPLAY_LABELS = {
  pending: 'Menunggu',
  reviewed: 'Disemak',
  fixed: 'Diperbaiki',
  removed: 'Dikeluarkan',
  dismissed: 'Ditolak',
} as const satisfies Record<(typeof QUESTION_REPORT_DISPLAY_STATUSES)[number], string>

export const QUESTION_REPORT_FILTERS = ['pending', 'reviewed', 'fixed', 'dismissed', 'all'] as const
export const QuestionReportFilterSchema = z.enum(QUESTION_REPORT_FILTERS).meta({ id: 'QuestionReportFilter' })

export const QUESTION_REPORT_CATEGORIES = ['Jawapan Salah', 'Tak Jelas', 'Lain-lain'] as const
export const QuestionReportCategorySchema = z
  .enum(QUESTION_REPORT_CATEGORIES)
  .meta({ id: 'QuestionReportCategory', description: 'Badge from the first reason (BR-M04-15).' })

/** Statuses an admin may set (never back to pending). */
export const QUESTION_REPORT_UPDATE_STATUSES = ['fixed', 'dismissed', 'reviewed'] as const

/* -------------------------------------------------------------------------------------- create */

/** A boolean flag: the mock reads `true`, `1`, `'1'`, `'true'` as true and everything else as false. */
const FlagSchema = z.union([z.boolean(), z.literal(1), z.literal(0), z.literal('1'), z.literal('0'), z.literal('true'), z.literal('false')])

const RefField = z
  .string(QUESTION_REPORT_MESSAGES.reference)
  .regex(/^([A-Za-z0-9._:-]{1,64})?$/, QUESTION_REPORT_MESSAGES.reference)
  .nullable()
  .optional()

/**
 * POST body (JSON). `reasons` must be non-empty and every reason must belong to the set of the
 * question type. 422 `fields` use the messages in `QUESTION_REPORT_MESSAGES`; `questionId` that is
 * missing or not an id answers `fields.questionId` = "Sila pilih soalan.". A question that does not
 * exist answers 404. There is no duplicate-open-report check (the mock has none): a second report
 * by the same user for the same question is accepted exactly like the first.
 */
export const QuestionReportCreateRequestSchema = z
  .object({
    questionId: IdSchema.meta({ description: QUESTION_REPORT_MESSAGES.question }),
    questionType: QuestionReportQuestionTypeSchema.optional(),
    reasons: z
      .array(z.string(QUESTION_REPORT_MESSAGES.reasonInvalid), QUESTION_REPORT_MESSAGES.reasonsRequired)
      .min(1, QUESTION_REPORT_MESSAGES.reasonsRequired),
    comment: z.string(QUESTION_REPORT_MESSAGES.comment).max(QUESTION_REPORT_COMMENT_MAX, QUESTION_REPORT_MESSAGES.comment).nullable().optional(),
    source: QuestionReportSourceSchema.optional(),
    quizSessionId: RefField,
    roomCode: RefField,
  })
  .superRefine((v, ctx) => {
    const allowed: readonly string[] =
      v.questionType === 'structured' ? QUESTION_REPORT_STRUCTURED_REASONS : QUESTION_REPORT_MCQ_REASONS
    if (v.reasons.some((r) => !allowed.includes(r))) {
      ctx.addIssue({ code: 'custom', path: ['reasons'], message: QUESTION_REPORT_MESSAGES.reasonInvalid })
    }
  })
  .meta({ id: 'QuestionReportCreateRequest' })
export type QuestionReportCreateRequest = z.infer<typeof QuestionReportCreateRequestSchema>

/** 201 body. RAW, no `data` envelope (mock `raw(201, ...)`). */
export const QuestionReportCreatedSchema = z
  .strictObject({ success: z.literal(true), message: z.literal(QUESTION_REPORT_MESSAGES.created) })
  .meta({ id: 'QuestionReportCreated' })

/* --------------------------------------------------------------------------------------- views */

/** The question block of a report row for the reporter (S13): existence only. */
export const QuestionReportQuestionRefSchema = z
  .object({ exists: z.boolean(), type: QuestionReportQuestionTypeSchema, id: IdSchema })
  .meta({ id: 'QuestionReportQuestionRef' })

/** The question block for the admin (S7). `exists: false` when the question is gone; the extra keys are then absent. */
export const QuestionReportQuestionViewSchema = QuestionReportQuestionRefSchema.extend({
  /** MCQ text, or the structured stimulus. */
  text: z.string().optional(),
  options: z.array(z.string()).optional(),
  correctAnswer: z.number().int().min(0).max(3).nullable().optional(),
  subjectName: z.string().nullable().optional(),
  levelName: z.string().nullable().optional(),
  complianceStatus: z.string().optional(),
  isActive: z.boolean().optional(),
  /** "Buka Soalan Sama"; `null` when the subject has no code. */
  practiceUrl: z.string().nullable().optional(),
}).meta({ id: 'QuestionReportQuestionView' })

const reportRow = {
  id: IdSchema,
  questionType: QuestionReportQuestionTypeSchema,
  questionId: IdSchema,
  /** Version of the question the report was filed against (BE-10 AC 11; absent in the mock). */
  questionVersion: z.number().int().min(1).optional(),
  reasons: z.array(z.string()),
  reasonLabels: z.array(z.string()),
  category: QuestionReportCategorySchema,
  comment: z.string().nullable(),
  source: QuestionReportSourceSchema,
  quizSessionId: z.string().nullable(),
  roomCode: z.string().nullable(),
  sourceSet: z.string().nullable(),
  status: QuestionReportStatusSchema,
  displayStatus: QuestionReportDisplayStatusSchema,
  adminNotes: z.string().nullable(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  reporter: z.object({ id: IdSchema, name: z.string().nullable() }),
}

/** Admin row (`GET /question-reports`). */
export const QuestionReportViewSchema = z
  .object({ ...reportRow, question: QuestionReportQuestionViewSchema })
  .meta({ id: 'QuestionReportView' })
export type QuestionReportView = z.infer<typeof QuestionReportViewSchema>

/** Reporter row (`GET /question-reports/mine`): the `question` block carries only `{ exists, type, id }`. */
export const QuestionReportMineViewSchema = z
  .object({ ...reportRow, question: QuestionReportQuestionRefSchema })
  .meta({ id: 'QuestionReportMineView' })
export type QuestionReportMineView = z.infer<typeof QuestionReportMineViewSchema>

export const QuestionReportCountsSchema = z
  .strictObject({
    pending: z.number().int().min(0),
    reviewed: z.number().int().min(0),
    fixed: z.number().int().min(0),
    dismissed: z.number().int().min(0),
    all: z.number().int().min(0),
  })
  .meta({ id: 'QuestionReportCounts' })

/** Query of `GET /question-reports`. Absent or empty = `pending`; an unknown value is an empty list (not a 422). */
export const QuestionReportListQuerySchema = z
  .object({ status: z.string().optional().meta({ description: 'pending | reviewed | fixed | dismissed | all. Default pending; unknown = empty list and meta.activeTab null.' }) })
  .meta({ id: 'QuestionReportListQuery' })

/** `meta.activeTab` is `null` for an unknown `status`; `counts` is over all reports regardless of the filter. */
export const QuestionReportListMetaSchema = questionWorkflowListMetaOf({
  activeTab: QuestionReportFilterSchema.nullable(),
  counts: QuestionReportCountsSchema,
}).meta({ id: 'QuestionReportListMeta' })

/** Not paged: newest first (`createdAt` desc, id desc). */
export const QuestionReportListResponseSchema = z
  .object({ data: z.array(QuestionReportViewSchema), meta: QuestionReportListMetaSchema })
  .meta({ id: 'QuestionReportListResponse' })

/** `counts` is over the caller's own reports only. */
export const QuestionReportMineMetaSchema = questionWorkflowListMetaOf({ counts: QuestionReportCountsSchema }).meta({
  id: 'QuestionReportMineMeta',
})

export const QuestionReportMineResponseSchema = z
  .object({ data: z.array(QuestionReportMineViewSchema), meta: QuestionReportMineMetaSchema })
  .meta({ id: 'QuestionReportMineResponse' })

/* --------------------------------------------------------------------------------------- update */

/**
 * PATCH body. `adminNotes`: absent keeps, `null` or blank clears (stored as null), more than 1000
 * characters is 422. `reactivate` sets the question active (applied first); `forceDeactivate` sets
 * it inactive. Which reports deactivate a question is BE-10 Open question 1.
 */
export const QuestionReportUpdateRequestSchema = z
  .object({
    status: z.enum(QUESTION_REPORT_UPDATE_STATUSES, QUESTION_REPORT_MESSAGES.status),
    adminNotes: z.string(QUESTION_REPORT_MESSAGES.adminNotes).max(QUESTION_REPORT_NOTES_MAX, QUESTION_REPORT_MESSAGES.adminNotes).nullable().optional(),
    reactivate: FlagSchema.optional(),
    forceDeactivate: FlagSchema.optional(),
  })
  .meta({ id: 'QuestionReportUpdateRequest' })
export type QuestionReportUpdateRequest = z.infer<typeof QuestionReportUpdateRequestSchema>

export const QuestionReportUpdateResultSchema = z
  .strictObject({
    id: IdSchema,
    status: QuestionReportStatusSchema,
    adminNotes: z.string().nullable(),
    updatedAt: TimestampSchema,
  })
  .meta({ id: 'QuestionReportUpdateResult' })

/** 200 body `{ data, status }` with the flash "Laporan berjaya dikemaskini.". */
export const QuestionReportUpdatedSchema = questionWorkflowMutationOf(QuestionReportUpdateResultSchema).meta({
  id: 'QuestionReportUpdated',
})
