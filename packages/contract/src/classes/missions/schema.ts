import { z } from '../../zod'
import { listEnvelopeOf } from '../../common/envelope'
import { IdSchema } from '../../common/ids'
import { TimestampSchema } from '../../common/time'

/**
 * M10 part B wire contract (BE-18, contract-only), missions and remedial half: the student reads
 * (`/missions/today`, `/remedial-tests/mine`, `/remedial-tests/:id`), the teacher remedial progress
 * and the Command Center remedial trio (scan, generate, cancel). Source: m10 mock handlers
 * `command-center`, `command-center-remedial`, `dashboard`, repository `remedial`, M05 `assigned.ts`,
 * and the typed clients `api/types.ts`, `api/command-center-types.ts`. Ids are opaque strings,
 * timestamps are `+08:00`, `legacy_*` never appears.
 * The teacher mission create and list (SRS FR-M10-52, FR-M10-58) are NOT in this contract: the mock
 * has no route (card open question 1). Question sets and DSKP picks are in `../question-sets`.
 * `POST /guru/question-papers` is BE-37 (source document upload for intake).
 */

// --- Copy (exact BM text of the mock, `REMEDIAL_MSG` in command-center-rules.ts) ------------------

export const REMEDIAL_MESSAGES = {
  noQuestions: 'Tiada soalan untuk topik lemah',
  noSubject: 'Subjek tidak sah.',
  alreadyOpen: 'Ujian remedial aktif sudah wujud untuk pelajar ini. Batalkan dahulu.',
  notYourStudent: 'Pelajar ini bukan murid anda.',
  testNotFound: 'Ujian remedial tidak dijumpai.',
  testNotActive: 'Ujian remedial ini tidak aktif.',
  studentId: 'ID pelajar tidak sah.',
  subject: 'Sila pilih subjek.',
  quizId: 'ID ujian tidak sah.',
} as const

/** Generic texts of the mock guards (401, 403, 404 on a malformed or unknown route). */
export const MISSION_GUARD_MESSAGES = {
  unauthenticated: 'Unauthenticated.',
  forbidden: 'This action is unauthorized.',
  notFound: 'Not Found.',
} as const

/**
 * An id in a request body. The mock reads `intOf`: a JSON number or a digit string; v2 ids are
 * opaque strings, so a non-blank string (any content) or a number is accepted. A blank string or a
 * number below 1 gives the field's BM message. The server normalises the value to a string id.
 */
const idInput = (message: string) =>
  z.union([z.string().trim().min(1, message), z.number().int().min(1, message)], { error: message })

/** Required trimmed text; blank, missing or non-string gives `message` (mock `textOf` + `=== ''`). */
const text = (message: string) => z.string({ error: message }).trim().min(1, message)

const accuracy = z.number().meta({ description: 'Percent with 1 decimal; not bounded by the contract.' })

// --- Missions (student read, M05 #21) ------------------------------------------------------------

export const MISSION_TYPES = ['latih_tubi', 'tracking_a', 'youtube'] as const
export const MissionTypeSchema = z.enum(MISSION_TYPES).meta({ id: 'MissionType' })

/** INFERRED labels of the mission types (M10 S12), as `MISSION_TYPE_LABELS` of the mock. */
export const MISSION_TYPE_LABELS: Readonly<Record<(typeof MISSION_TYPES)[number], string>> = {
  latih_tubi: 'Latih Tubi SPM',
  tracking_a: 'Tracking A',
  youtube: 'Soalan & Rujukan',
}

/** Q-SESS-LINK status: a completed session beats an in-progress one; none gives `new`. */
export const MissionStatusSchema = z.enum(['new', 'in_progress', 'completed']).meta({ id: 'MissionStatus' })

/**
 * One row of `GET /missions/today`. No answer key and no question list: the questions are served by
 * the practice session started with `missionId` (BE-12).
 */
export const MissionTodaySchema = z
  .object({
    id: IdSchema,
    title: z.string(),
    typeLabel: z.string().meta({ description: 'Label of the mission type, "" for an unknown type.' }),
    subjectName: z.string().meta({ description: '"" when the subject is unknown.' }),
    questionCount: z.number().int(),
    coinsPerCorrect: z.number().int().meta({ description: 'Reward text of the form, 3 for every mission (BR-M10-17).' }),
    resourceTitle: z.string().nullable(),
    resourceUrl: z.string().nullable(),
    resourceNote: z.string().nullable(),
    status: MissionStatusSchema,
  })
  .meta({ id: 'MissionToday' })
export type MissionToday = z.infer<typeof MissionTodaySchema>

/** `{ data, meta }`; single page (the mock `unpaged`): the missions of today for the caller, oldest first. */
export const MissionTodayResponseSchema = listEnvelopeOf(MissionTodaySchema).meta({ id: 'MissionTodayResponse' })

// --- Remedial: shared -----------------------------------------------------------------------------

export const REMEDIAL_STATUSES = ['active', 'completed', 'cancelled'] as const
export const RemedialStatusSchema = z.enum(REMEDIAL_STATUSES).meta({ id: 'RemedialStatus' })

// --- Remedial: student reads (M05 #20, #20b) -----------------------------------------------------

/** Only `active` and `completed` tests are listed (BR-32); newest first. */
export const RemedialMineItemSchema = z
  .object({
    id: IdSchema,
    subjectName: z.string(),
    totalQuestions: z.number().int(),
    status: z.enum(['active', 'completed']),
    createdAt: TimestampSchema,
    teacherName: z.string().meta({ description: '"" when the teacher is unknown.' }),
  })
  .meta({ id: 'RemedialMineItem' })
export type RemedialMineItem = z.infer<typeof RemedialMineItemSchema>

export const RemedialMineResponseSchema = listEnvelopeOf(RemedialMineItemSchema).meta({ id: 'RemedialMineResponse' })

const RemedialPreviewOptionSchema = z
  .object({
    id: z.number().int().meta({ description: 'Option position (0 to 3), not an entity id.' }),
    label: z.string(),
    text: z.string(),
  })
  .meta({ id: 'RemedialPreviewOption' })

/**
 * SECURITY: unlike every student-facing schema, this one carries the answer key (`correctOptionId`).
 * It is by design of the mock (the Q4 read-only preview, FR-M05-141) and the route answers only the
 * test's own teacher and an admin; the assigned student gets 404 (they start a session instead).
 */
export const RemedialPreviewQuestionSchema = z
  .object({
    id: IdSchema,
    questionText: z.string(),
    textDirection: z.enum(['ltr', 'rtl']),
    scriptType: z.enum(['rumi', 'arab', 'jawi', 'mixed']),
    options: z.array(RemedialPreviewOptionSchema),
    correctOptionId: z.number().int().nullable().meta({ description: 'Position of the correct option; ANSWER KEY, teacher and admin only.' }),
  })
  .meta({ id: 'RemedialPreviewQuestion' })

export const RemedialPreviewSchema = z
  .object({
    id: IdSchema,
    subjectName: z.string(),
    status: RemedialStatusSchema,
    totalQuestions: z.number().int(),
    createdAt: TimestampSchema,
    teacherName: z.string(),
    studentName: z.string(),
    questions: z.array(RemedialPreviewQuestionSchema).meta({
      description: 'In stored order (`remedial_test_items.position`); a question the bank no longer has is skipped.',
    }),
  })
  .meta({ id: 'RemedialPreview' })
export type RemedialPreview = z.infer<typeof RemedialPreviewSchema>

// --- Remedial: teacher progress (S3, BR-M10-13) ---------------------------------------------------

/** Bare body (no `{ data }`), as the mock `raw(200, ...)`. */
export const RemedialProgressSchema = z
  .object({
    stats: z.object({
      total: z.number().int().meta({ description: 'Tests of the caller that are not cancelled.' }),
      completed: z.number().int(),
      students: z.number().int().meta({ description: 'Distinct students of the counted tests.' }),
      avgImprovement: z.number().int().meta({ description: 'Rounded mean of (after - before) over completed tests; 0 when none. May be negative.' }),
    }),
    rows: z.array(
      z.object({
        id: IdSchema,
        studentName: z.string(),
        subjectName: z.string(),
        status: RemedialStatusSchema,
        beforeAccuracy: accuracy,
        afterAccuracy: accuracy.nullable(),
      }),
    ).meta({ description: 'Every test of the caller, cancelled ones included, newest first.' }),
  })
  .meta({ id: 'RemedialProgress' })
export type RemedialProgress = z.infer<typeof RemedialProgressSchema>

// --- Remedial: Command Center scan, generate, cancel (S2) -----------------------------------------

/** Bare body. A weak topic: at least 2 answers and accuracy below 50 (BR-M10-11). */
export const RemedialScanSchema = z
  .object({
    weakStudents: z.array(
      z.object({
        studentId: IdSchema,
        name: z.string(),
        weakTopics: z.array(
          z.object({
            subject: z.string().meta({ description: 'Subject name; `generate` accepts it back as `subject`.' }),
            topicName: z.string(),
            accuracy,
          }),
        ),
        weakestAccuracy: accuracy,
      }),
    ),
    existingRemedials: z.array(
      z.object({
        id: IdSchema,
        studentId: IdSchema,
        status: z.enum(['active', 'completed']).meta({ description: 'Cancelled tests are not listed.' }),
        totalQuestions: z.number().int(),
        afterAccuracy: accuracy.nullable(),
      }),
    ),
  })
  .meta({ id: 'RemedialScan' })
export type RemedialScan = z.infer<typeof RemedialScanSchema>

/**
 * `POST /guru/command-center/remedial/generate` body. `studentId`: a non-blank id string or a number
 * of at least 1 (the mock also reads digit strings). `subject`: a subject id, code or name,
 * case-insensitive; blank gives the field message. Both fields report together (`fields`).
 */
export const RemedialGenerateRequestSchema = z
  .object({
    studentId: idInput(REMEDIAL_MESSAGES.studentId),
    subject: text(REMEDIAL_MESSAGES.subject),
  })
  .meta({ id: 'RemedialGenerateRequest' })
export type RemedialGenerateRequest = z.infer<typeof RemedialGenerateRequestSchema>

export const RemedialGenerateResponseSchema = z
  .object({ quizId: IdSchema, totalQuestions: z.number().int() })
  .meta({ id: 'RemedialGenerateResponse' })

/** `POST /guru/command-center/remedial/cancel` body. */
export const RemedialCancelRequestSchema = z
  .object({ quizId: idInput(REMEDIAL_MESSAGES.quizId) })
  .meta({ id: 'RemedialCancelRequest' })
export type RemedialCancelRequest = z.infer<typeof RemedialCancelRequestSchema>

export const RemedialCancelResponseSchema = z
  .object({ success: z.literal(true) })
  .meta({ id: 'RemedialCancelResponse' })

// --- Remedial: typed refusals the schema cannot know (state dependent) ----------------------------

const typedError = (code: string, messages: readonly [string, ...string[]], fields?: z.ZodType) =>
  z.object({
    error: z.object({
      code: z.literal(code),
      message: z.enum(messages),
      ...(fields ? { fields } : {}),
    }),
  })

/** 422 with `fields` from the body check or the unknown subject; `message` is the Laravel summary (first field text plus "(and N more error(s))"). */
export const RemedialGenerateFieldErrorSchema = z
  .object({
    error: z.object({
      code: z.literal('VALIDATION_ERROR'),
      message: z.string(),
      fields: z.object({
        studentId: z.literal(REMEDIAL_MESSAGES.studentId).optional(),
        subject: z.enum([REMEDIAL_MESSAGES.subject, REMEDIAL_MESSAGES.noSubject]).optional(),
      }),
    }),
  })
  .meta({ id: 'RemedialGenerateFieldError' })

/** 422 without `fields`: an active test for the same student and subject exists, or no weak topic / no question. */
export const RemedialGenerateRefusedSchema = typedError('VALIDATION_ERROR', [
  REMEDIAL_MESSAGES.alreadyOpen,
  REMEDIAL_MESSAGES.noQuestions,
]).meta({ id: 'RemedialGenerateRefused' })

/** 403: the student is not one of the caller's own students (BR-M10-12). */
export const RemedialNotYourStudentSchema = typedError('FORBIDDEN', [REMEDIAL_MESSAGES.notYourStudent]).meta({
  id: 'RemedialNotYourStudent',
})

export const RemedialCancelFieldErrorSchema = z
  .object({
    error: z.object({
      code: z.literal('VALIDATION_ERROR'),
      message: z.literal(REMEDIAL_MESSAGES.quizId),
      fields: z.object({ quizId: z.literal(REMEDIAL_MESSAGES.quizId) }),
    }),
  })
  .meta({ id: 'RemedialCancelFieldError' })

/** 404: unknown test, or another teacher's test (answers alike so ids cannot be probed). */
export const RemedialTestNotFoundSchema = typedError('NOT_FOUND', [REMEDIAL_MESSAGES.testNotFound]).meta({
  id: 'RemedialTestNotFound',
})

/** 409: the test is not active (already cancelled or completed). A second cancel is NOT idempotent in the mock. */
export const RemedialTestNotActiveSchema = typedError('CONFLICT', [REMEDIAL_MESSAGES.testNotActive]).meta({
  id: 'RemedialTestNotActive',
})
