import { z } from '../zod'
import { ListMetaSchema } from '../common/envelope'
import { ClientUuidSchema, IdSchema } from '../common/ids'
import { TimestampSchema } from '../common/time'

/**
 * M05 practice write path (BE-12): start, check-answer, submit, history.
 *
 * The frontend mock (`src/modules/m05-practice`) is the wire spec; differences are listed in the
 * BE-12 contract report. Ids of questions, chapters, levels, missions... are opaque strings
 * (`Id`); the practice session id is a uuid (data model `practice_sessions`). Option ids stay the
 * mock's zero-based index (open question: label vs index).
 */

/** Practice modes stored on a session (OD-24: unknown values are rejected, never defaulted). */
export const PRACTICE_MODES = [
  'random',
  'chapter',
  'revision',
  'past_year',
  'latih_tubi',
  'ramalan',
  'mission',
  'remedial',
  'question_set',
  'pksk',
] as const
export const PracticeModeSchema = z.enum(PRACTICE_MODES).meta({ id: 'PracticeMode' })
export type PracticeMode = z.infer<typeof PracticeModeSchema>

/** Modes `POST /practice/sessions` accepts: `pksk` sessions are created by M07, not here (422). */
export const PRACTICE_START_MODES = PRACTICE_MODES.filter((m) => m !== 'pksk') as unknown as readonly [
  Exclude<PracticeMode, 'pksk'>,
  ...Exclude<PracticeMode, 'pksk'>[],
]
export const PracticeStartModeSchema = z.enum(PRACTICE_START_MODES).meta({ id: 'PracticeStartMode' })

export const PracticeSessionIdSchema = z.uuid().meta({
  id: 'PracticeSessionId',
  description: 'Practice session id (uuid).',
})

/** Option counts a random or chapter session offers (SRS M05 section 5). */
export const PRACTICE_COUNT_OPTIONS = [5, 10, 15, 20] as const
/** Revision session length (BR-14). */
export const PRACTICE_REVISION_LENGTH = 20
/** Trial allowance of a user without a subscription (provisional M19 rule, BR-07). */
export const PRACTICE_TRIAL_LIMIT = 50

/** Error codes of the practice endpoints (module codes; generic ones are in `ErrorCode`). */
export const PRACTICE_ERROR_CODES = [
  'TRIAL_EXHAUSTED',
  'CHAPTER_LOCKED',
  'NOT_ENOUGH_QUESTIONS',
  'SET_NOT_READY',
  'NO_WRONG_QUESTIONS',
  'ALREADY_COMPLETED',
  'NO_ATTEMPTS_LEFT',
  'ALREADY_SUBMITTED',
] as const
export const PracticeErrorCodeSchema = z.enum(PRACTICE_ERROR_CODES).meta({ id: 'PracticeErrorCode' })
export type PracticeErrorCode = z.infer<typeof PracticeErrorCodeSchema>

/** Exact status and BM message the mock produces for each module code (`ALREADY_COMPLETED` has two). */
export const PRACTICE_ERRORS = {
  TRIAL_EXHAUSTED: { status: 402, messages: ['Baki percubaan percuma anda telah habis.'] },
  CHAPTER_LOCKED: { status: 409, messages: ['Bab ini masih dikunci.'] },
  NOT_ENOUGH_QUESTIONS: { status: 422, messages: ['Soalan tidak mencukupi.'] },
  SET_NOT_READY: { status: 422, messages: ['Soalan tidak mencukupi.'] },
  NO_WRONG_QUESTIONS: { status: 422, messages: ['Maaf, terdapat masalah memuatkan kuiz ulang kaji.'] },
  ALREADY_COMPLETED: {
    status: 409,
    messages: ['Misi ini sudah diselesaikan.', 'Ujian ini sudah selesai.'],
  },
  NO_ATTEMPTS_LEFT: { status: 409, messages: ['Tiada percubaan lagi untuk set ini.'] },
  ALREADY_SUBMITTED: { status: 409, messages: ['Sesi ini sudah dihantar.'] },
} as const satisfies Record<PracticeErrorCode, { status: number; messages: readonly string[] }>

/** Messages of the generic codes the practice endpoints raise. */
export const PRACTICE_MESSAGES = {
  notFound: 'Rekod tidak dijumpai.',
  invalidValue: 'Nilai tidak sah.',
  invalidAnswer: 'Jawapan tidak sah.',
  invalidModes: 'Mod tidak sah.',
} as const

// ---------------------------------------------------------------------------------------------
// POST /practice/sessions
// ---------------------------------------------------------------------------------------------

const intId = (description: string) => IdSchema.meta({ description })

/**
 * One flat body for every mode (SRS M05 section 7 #4). Which fields a mode needs is decided by the
 * server (a missing subject, chapter, mission... is 404 `NOT_FOUND`; a bad `count`, `levelId`,
 * `difficulty`, `targetQuestionId` or `mode` is 422 `VALIDATION_ERROR` with `fields`).
 */
export const StartSessionRequestSchema = z
  .object({
    mode: PracticeStartModeSchema,
    subjectCode: z.string().min(1).max(32).optional(),
    levelId: IdSchema.nullable().optional(),
    difficulty: z.number().int().min(1).max(5).nullable().optional(),
    count: z.number().int().min(1).optional().meta({
      description: 'random/chapter 5|10|15|20; revision absent or 20; past_year 5|10|20; latih_tubi per subject target.',
    }),
    chapterId: intId('chapter mode').optional(),
    year: z.number().int().optional().meta({ description: 'ramalan mode.' }),
    setNo: z.number().int().optional().meta({ description: 'ramalan mode.' }),
    targetQuestionId: IdSchema.nullable().optional().meta({ description: 'latih_tubi "Buka Soalan Sama"; needs count 1.' }),
    missionId: intId('mission mode').optional(),
    remedialTestId: intId('remedial mode').optional(),
    questionSetId: intId('question_set mode').optional(),
    clientUuid: ClientUuidSchema.optional().meta({
      description: 'Idempotency key: replaying a start with the same clientUuid returns the same session.',
    }),
  })
  .meta({ id: 'StartSessionRequest' })
export type StartSessionRequest = z.infer<typeof StartSessionRequestSchema>

export const PracticeTextDirectionSchema = z.enum(['ltr', 'rtl']).meta({ id: 'PracticeTextDirection' })
export const PracticeScriptTypeSchema = z.enum(['rumi', 'arab', 'jawi', 'mixed']).meta({ id: 'PracticeScriptType' })

/** One answer option as served: the key is never part of it. */
export const PracticeQuizOptionSchema = z
  .strictObject({
    id: z.number().int().min(0).meta({ description: 'Zero-based option index; sent back as selectedOptionId.' }),
    label: z.string().min(1).max(4),
    text: z.string(),
  })
  .meta({ id: 'PracticeQuizOption' })

/** Served question. Strict on purpose: `correctAnswer`/`explanation` must never appear before a check. */
export const PracticeQuizQuestionSchema = z
  .strictObject({
    id: IdSchema,
    questionText: z.string(),
    textDirection: PracticeTextDirectionSchema,
    scriptType: PracticeScriptTypeSchema,
    wrongTimes: z.number().int().min(0).meta({ description: 'From the caller revision queue.' }),
    hasDskp: z.boolean(),
    contributor: z
      .strictObject({ name: z.string().min(1), profileUrl: z.string().nullable() })
      .nullable()
      .meta({ description: 'Teacher who wrote the question ("Soalan oleh:"), else null.' }),
    options: z.array(PracticeQuizOptionSchema),
  })
  .meta({ id: 'PracticeQuizQuestion' })
export type PracticeQuizQuestion = z.infer<typeof PracticeQuizQuestionSchema>

export const StartSessionResponseSchema = z
  .strictObject({
    sessionId: PracticeSessionIdSchema,
    mode: PracticeModeSchema,
    subject: z.strictObject({ code: z.string(), name: z.string(), color: z.string() }).nullable(),
    chapter: z
      .strictObject({ id: IdSchema, number: z.number().int().nullable(), name: z.string().nullable() })
      .optional(),
    questions: z.array(PracticeQuizQuestionSchema),
    revisionMeta: z
      .strictObject({ selected: z.number().int().min(0), totalWrong: z.number().int().min(0) })
      .optional()
      .meta({ description: 'revision mode only.' }),
    timeLimitSec: z.number().int().min(0).nullable().optional().meta({ description: 'question_set mode only.' }),
  })
  .meta({ id: 'StartSessionResponse' })
export type StartSessionResponse = z.infer<typeof StartSessionResponseSchema>

// ---------------------------------------------------------------------------------------------
// POST /practice/sessions/:id/check-answer
// ---------------------------------------------------------------------------------------------

export const PracticeSessionParamsSchema = z.object({ id: PracticeSessionIdSchema })

export const CheckAnswerRequestSchema = z
  .object({
    questionId: IdSchema,
    selectedOptionId: z.number().int().min(0).meta({ description: 'Zero-based option index; must exist on the question.' }),
  })
  .meta({ id: 'CheckAnswerRequest' })
export type CheckAnswerRequest = z.infer<typeof CheckAnswerRequestSchema>

export const CheckAnswerResponseSchema = z
  .strictObject({
    isCorrect: z.boolean(),
    correctOptionId: z.number().int().min(0),
    feedback: z.string().min(1).meta({
      description: 'revision: "Betul! Kali ini berjaya!" / "Masih belum tepat"; other modes: "Betul!" / "Salah".',
    }),
    explanation: z.string().nullable(),
  })
  .meta({ id: 'CheckAnswerResponse' })
export type CheckAnswerResponse = z.infer<typeof CheckAnswerResponseSchema>

// ---------------------------------------------------------------------------------------------
// POST /practice/sessions/:id/submit
// ---------------------------------------------------------------------------------------------

export const SubmitSessionRequestSchema = z
  .object({
    timeSpent: z.unknown().optional().meta({
      description:
        'Seconds (number). Never rejected: a non-number counts as 0; the stored value is round(timeSpent) clamped to [0, 180 x questionCount]. Answers are not sent.',
    }),
  })
  .meta({ id: 'SubmitSessionRequest' })
export type SubmitSessionRequest = z.infer<typeof SubmitSessionRequestSchema>

export const PracticeGamificationSchema = z
  .strictObject({
    coinsEarned: z.number().int().min(0),
    streakCount: z.number().int().min(0),
    pointsEarned: z.number().int().min(0),
    totalBalance: z.number().int().min(0),
  })
  .meta({ id: 'PracticeGamification' })

export const SubmitSessionResponseSchema = z
  .strictObject({
    results: z.strictObject({
      score: z.number().int().min(0),
      total: z.number().int().min(0),
      gamification: PracticeGamificationSchema,
    }),
  })
  .meta({ id: 'SubmitSessionResponse' })
export type SubmitSessionResponse = z.infer<typeof SubmitSessionResponseSchema>

// ---------------------------------------------------------------------------------------------
// GET /practice/sessions
// ---------------------------------------------------------------------------------------------

export const ListSessionsQuerySchema = z
  .object({
    modes: z.string().min(1).meta({ description: 'Comma list of PracticeMode; empty or any unknown value is 422.' }),
    type: z.string().optional().meta({ description: 'One mode inside modes to narrow the rows; otherwise ignored.' }),
    page: z.coerce.number().int().min(1).optional(),
    pageSize: z.coerce.number().int().min(1).max(100).optional().meta({
      description: 'Default 15 when page is given. With neither page nor pageSize the list is not paged.',
    }),
  })
  .meta({ id: 'ListSessionsQuery' })

export const SessionListItemSchema = z
  .strictObject({
    id: PracticeSessionIdSchema,
    mode: PracticeModeSchema,
    subjectId: IdSchema.nullable(),
    subjectCode: z.string().nullable().meta({ description: '"UMUM" for mixed free practice (no subject).' }),
    questionCount: z.number().int().min(0),
    correctCount: z.number().int().min(0),
    percent: z.number().int().min(0).max(100),
    coinsEarned: z.number().int().min(0),
    timeSpent: z.number().int().min(0),
    completedAt: TimestampSchema.nullable(),
  })
  .meta({ id: 'SessionListItem' })
export type SessionListItem = z.infer<typeof SessionListItemSchema>

export const SessionListStatsSchema = z
  .strictObject({
    sessions: z.number().int().min(0),
    avgAccuracyPct: z.number().min(0).max(100),
    coins: z.number().int().min(0),
    answered: z.number().int().min(0),
  })
  .meta({ id: 'SessionListStats' })

/** Standard list meta plus `activeType` and `stats` (stats cover every row of `modes`, not only `type`). */
export const SessionListMetaSchema = ListMetaSchema.extend({
  activeType: PracticeModeSchema.nullable(),
  stats: SessionListStatsSchema,
}).meta({ id: 'SessionListMeta' })

export const SessionListResponseSchema = z
  .object({ data: z.array(SessionListItemSchema), meta: SessionListMetaSchema })
  .meta({ id: 'SessionListResponse' })
export type SessionListResponse = z.infer<typeof SessionListResponseSchema>
