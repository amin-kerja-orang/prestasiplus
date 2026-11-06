import { z } from '../zod'
import { IdSchema } from '../common/ids'
import { TimestampSchema } from '../common/time'
import { questionWorkflowListMetaOf, questionWorkflowMutationOf } from './common'
import { QuestionWorkflowStatusSchema } from './lifecycle'

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
  /** REQ-B-046 REP-N2 [PROPOSED]: at most QUESTION_REPORT_REASONS_MAX reasons in one report. */
  reasonsTooMany: 'Terlalu banyak sebab laporan dipilih.',
  source: 'Sumber laporan tidak sah.',
  type: 'Jenis soalan tidak sah.',
  question: 'Sila pilih soalan.',
  reference: 'Rujukan sesi atau bilik tidak sah.',
  /** R1-T42: the attempt is unknown, not the reporter's, or the id is malformed (one answer: no existence oracle). */
  attempt: 'Rujukan percubaan tidak sah.',
  attemptQuestion: 'Soalan ini bukan sebahagian daripada percubaan itu.',
  paper: 'Kertas tidak sepadan dengan percubaan itu.',
  /** REQ-B-031 (D98) [PROPOSED]: a pupil may report only a question served to them; an MCQ needs an attempt or practice session of theirs that served it, a structured question needs nothing more than being live (the structured practice keeps no session and the report is offered before the first submit). */
  contextRequired: 'Anda hanya boleh melapor soalan yang dipaparkan kepada anda.',
  /** REQ-B-031: `quizSessionId` is not the pupil's own practice session (unknown and someone else's answer alike). */
  session: 'Rujukan sesi tidak sah.',
  sessionQuestion: 'Soalan ini bukan sebahagian daripada sesi itu.',
  /** FR-MUR-54-10 (AC-MUR-54-5): 409 when this reporter already reported this question version (every reporter, a Guru too). */
  duplicate: 'Anda sudah melaporkan soalan ini.',
  /** REQ-B-031: 429 when a reporter files the 21st new report of the Malaysia day. */
  dailyCap: 'Anda telah mencapai had 20 laporan sehari. Sila cuba lagi esok.',
  comment: 'Komen tidak boleh melebihi 500 aksara.',
  status: 'Status tidak sah.',
  expectedVersionNo: 'Versi soalan tidak sah.',
  adminNotes: 'Nota admin tidak boleh melebihi 1000 aksara.',
  created: 'Laporan berjaya dihantar.',
  updated: 'Laporan berjaya dikemaskini.',
  /** H-A13 (D94 approved copy): shown to the admin after "Arkib" when published papers place the archived question. */
  archivedOnPapers: 'Soalan ini ada dalam kertas yang telah diterbitkan. Murid tidak boleh memulakan percubaan baharu pada kertas itu sehingga soalan diganti.',
  /** 409 on "Arkib" from a report row: the question has moved past the reported version (REQ-B-018). */
  archiveStaleVersion: 'Soalan ini sudah mempunyai versi yang lebih baharu daripada yang dilaporkan. Arkib dibatalkan; semak versi terkini dahulu.',
  /** Shown by the screen when the request itself fails (FR-M04-69). */
  failure: 'Ralat. Sila cuba lagi.',
} as const

export const QUESTION_REPORT_COMMENT_MAX = 500
/** REQ-B-031 (D98): new reports one reporter may file per Malaysia day (a repeat of a report is 409, not a new one). */
export const QUESTION_REPORT_DAILY_CAP = 20
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

/** REQ-B-046 REP-N2: the longest `reasons` list a report may carry (the MCQ set has 8 reasons). */
export const QUESTION_REPORT_REASONS_MAX = 8

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
 * R1-T42 (R1-18.1): where the pupil filed the report. The attempt (`exam_attempts` uuid, a Bijak sitting or its Semakan) is the proof:
 * the server checks it is the reporter's and holds the question, and takes the paper from it. `paperId` is optional and, when sent, must be
 * the paper of that attempt. A strict object: nothing else is read; a malformed value is a 422 on `attemptId` / `paperId`.
 */
export const QuestionReportContextSchema = z
  .strictObject({
    attemptId: z.uuid(QUESTION_REPORT_MESSAGES.attempt),
    paperId: IdSchema.optional().meta({ description: 'Optional; must equal the paper of the attempt (422 `paperId` otherwise). The stored paper always comes from the attempt.' }),
  })
  .meta({ id: 'QuestionReportContext' })
export type QuestionReportContext = z.infer<typeof QuestionReportContextSchema>

/**
 * POST body (JSON). `reasons` must be non-empty and every reason must belong to the set of the
 * question type. 422 `fields` use the messages in `QUESTION_REPORT_MESSAGES`; `questionId` that is
 * missing or not an id answers `fields.questionId` = "Sila pilih soalan.". A question that does not
 * exist answers 404. One report per reporter, question and version: a second one is 409 `duplicate`
 * ("Anda sudah melaporkan soalan ini."), for a pupil and a Guru alike, before the daily cap is counted.
 *
 * REQ-B-031 (D98): a report never deactivates the question; Laporan Soalan is where the admin decides (Arkib / Tolak). A pupil (active role
 * student, Mod Pelajar included) must have been served the question: an MCQ report needs `attemptId` (own Bijak attempt that holds the
 * question) or `quizSessionId` (own practice session that served it), else 403 with `QUESTION_REPORT_MESSAGES.contextRequired` (also for a question
 * that is not live, so the answer is not an existence oracle; a malformed id stays 422); a live structured question needs no proof (REQ-B-046). A Guru is
 * not asked. Roles: student and teacher only (403 otherwise). `reporterRole` is set from the session role (never the body). At most
 * QUESTION_REPORT_DAILY_CAP new reports per reporter per Malaysia day: 429.
 */
export const QuestionReportCreateRequestSchema = z
  .object({
    questionId: IdSchema.meta({ description: QUESTION_REPORT_MESSAGES.question }),
    questionType: QuestionReportQuestionTypeSchema.optional(),
    reasons: z
      .array(z.string(QUESTION_REPORT_MESSAGES.reasonInvalid), QUESTION_REPORT_MESSAGES.reasonsRequired)
      .min(1, QUESTION_REPORT_MESSAGES.reasonsRequired)
      .max(QUESTION_REPORT_REASONS_MAX, QUESTION_REPORT_MESSAGES.reasonsTooMany),
    comment: z.string(QUESTION_REPORT_MESSAGES.comment).max(QUESTION_REPORT_COMMENT_MAX, QUESTION_REPORT_MESSAGES.comment).nullable().optional(),
    source: QuestionReportSourceSchema.optional(),
    quizSessionId: RefField,
    roomCode: RefField,
    attemptId: z.string().nullable().optional().meta({ description: 'R1-T42: uuid of the attempt the pupil reported from; see QuestionReportContext. 422 `attemptId` when unknown, not the reporter\'s, or the question is not in it.' }),
    paperId: IdSchema.nullable().optional().meta({ description: 'R1-T42: optional; must be the paper of `attemptId`; sent without `attemptId` is 422 `attemptId`.' }),
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
  /** REQ-C-018: lifecycle status of the question (its LATEST version: draft | review | approved | archived), so the row can hide "Arkib" on an archived question. */
  status: QuestionWorkflowStatusSchema.optional(),
  /** REQ-C-018: the version served to pupils; `null` when none is live (for example after "Arkib" with a newer revision in Semakan). */
  liveVersionNo: z.number().int().min(1).nullable().optional(),
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
  /** R1-T42: the paper the report was filed from; `null` when it was filed outside an attempt. `id` is null once the paper is deleted (the label stays). */
  paper: z.object({ id: IdSchema.nullable(), label: z.string(), attemptId: z.string().nullable() }).nullable().optional(),
  status: QuestionReportStatusSchema,
  displayStatus: QuestionReportDisplayStatusSchema,
  adminNotes: z.string().nullable(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  /** DM-82: the role the reporter filed under (from the session; a user holding both roles reports as the active one). */
  reporterRole: z.enum(['murid', 'guru']),
  reporter: z.object({ id: IdSchema, name: z.string().nullable() }),
}

/** Admin row (`GET /question-reports`). */
export const QuestionReportViewSchema = z
  .object({ ...reportRow, question: QuestionReportQuestionViewSchema })
  .meta({ id: 'QuestionReportView' })
export type QuestionReportView = z.infer<typeof QuestionReportViewSchema>

/** Reporter row (`GET /question-reports/mine`): the `question` block carries only `{ exists, type, id }`. */
export const QuestionReportMineViewSchema = z
  .object({
    ...reportRow,
    question: QuestionReportQuestionRefSchema,
    /** DD1 (pupil card): subject of the reported version; `null` when unknown, for a Guru row or when the question is gone. */
    subject: z.object({ id: IdSchema, name: z.string() }).nullable().optional(),
    /** DD1: plain-text preview (at most 200 characters) of the reported version's stem; `null` for a Guru row or when the version is gone. */
    questionText: z.string().nullable().optional(),
  })
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
 * it inactive. Which reports deactivate a question is BE-10 Open question 1. `archive` (R1-B17, the "Arkib" action of
 * the report row) archives the question through the real lifecycle (status archived, one status event), applied last: an
 * archived question leaves every activity, unlike a deactivation, which only switches `is_active`.
 */
export const QuestionReportUpdateRequestSchema = z
  .object({
    status: z.enum(QUESTION_REPORT_UPDATE_STATUSES, QUESTION_REPORT_MESSAGES.status),
    adminNotes: z.string(QUESTION_REPORT_MESSAGES.adminNotes).max(QUESTION_REPORT_NOTES_MAX, QUESTION_REPORT_MESSAGES.adminNotes).nullable().optional(),
    reactivate: FlagSchema.optional(),
    forceDeactivate: FlagSchema.optional(),
    archive: FlagSchema.optional(),
    expectedVersionNo: z
      .number(QUESTION_REPORT_MESSAGES.expectedVersionNo)
      .int()
      .min(1)
      .optional()
      .meta({ description: 'The reported question version the admin is looking at. With `archive`: it must be the version the report was filed against (else 409), and the archive is refused with 409 when the question has moved on to a newer version than the reported one (REQ-B-018).' }),
  })
  .meta({ id: 'QuestionReportUpdateRequest' })
export type QuestionReportUpdateRequest = z.infer<typeof QuestionReportUpdateRequestSchema>

export const QuestionReportUpdateResultSchema = z
  .strictObject({
    id: IdSchema,
    status: QuestionReportStatusSchema,
    adminNotes: z.string().nullable(),
    updatedAt: TimestampSchema,
    /** H-A13: only after `archive`: the published Kertas Pilihan that place the question, so the screen can warn. */
    papers: z.array(z.strictObject({ id: IdSchema, title: z.string() })).optional(),
    /** H-A13: the warning line when `papers` is not empty. */
    warning: z.string().optional(),
  })
  .meta({ id: 'QuestionReportUpdateResult' })

/** 200 body `{ data, status }` with the flash "Laporan berjaya dikemaskini.". */
export const QuestionReportUpdatedSchema = questionWorkflowMutationOf(QuestionReportUpdateResultSchema).meta({
  id: 'QuestionReportUpdated',
})
