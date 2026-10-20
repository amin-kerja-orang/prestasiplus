import { IdSchema } from '../common/ids'
import { TimestampSchema } from '../common/time'
import { PracticeSessionIdSchema } from '../practice/schema'
import { z } from '../zod'
import {
  PkskBahagianSchema,
  PkskDomainCodeSchema,
  PkskDomainRefSchema,
  PkskGradeSchema,
  PkskLevelSchema,
  PkskPercentSchema,
} from './shared'

/**
 * PKSK student half (BE-42, M07-01 to M07-09). Wire = the frontend mock
 * (`src/modules/m07-pksk/mock/handlers/student.ts`); ids are `IdSchema` strings (UD-1), the mock
 * sends numbers. Every route needs a session (401 UNAUTHORIZED "Unauthenticated."), any role.
 * Routes with `:level` apply the level gate: an unknown level is 404 NOT_FOUND "Not Found." first,
 * then no access to the level is 403 FORBIDDEN "This action is unauthorized." (access: BR-M07-07).
 */

export const PKSK_STUDENT_MESSAGES = {
  /** 422 message and `fields.answers` text of both POST routes (the M05 mock message). */
  answers: 'Jawapan tidak sah.',
  notFound: 'Not Found.',
  forbidden: 'This action is unauthorized.',
  unauthenticated: 'Unauthenticated.',
} as const

const ANSWERS_MESSAGE = PKSK_STUDENT_MESSAGES.answers

/** Minimum length (trimmed) of an essay the simulated marker accepts (D4, "Perlu pengesahan"). */
export const PKSK_ESSAY_MIN_CHARS = 50
/** Planned exam composition (BR-M07-13): 30 A, 70 B, 1 C answers at most. */
export const PKSK_EXAM_MAX_ANSWERS = 101
/** D57 bounds that the mock does not have. */
export const PKSK_ANSWER_TEXT_MAX = 10_000
export const PKSK_OPTION_INDEX_MAX = 5

// ---------------------------------------------------------------------------------------------
// Params
// ---------------------------------------------------------------------------------------------

/**
 * `level` is case-sensitive `T1` or `T4`. Typed as a plain string on purpose: any other value is
 * 404 NOT_FOUND (checked before the access test), never 422.
 */
export const PkskLevelParamsSchema = z
  .object({
    level: z.string().min(1).max(16).meta({
      description: 'T1 or T4, case-sensitive. Any other value answers 404 "Not Found." before the access check.',
    }),
  })
export type PkskLevelParams = z.infer<typeof PkskLevelParamsSchema>

export const PkskDomainParamsSchema = PkskLevelParamsSchema.extend({
  code: z.string().min(1).max(50).meta({
    description: 'Domain code, e.g. PKSK_MATH. An unknown code answers 404 "Not Found." (level checked first).',
  }),
})
export type PkskDomainParams = z.infer<typeof PkskDomainParamsSchema>

// ---------------------------------------------------------------------------------------------
// Responses
// ---------------------------------------------------------------------------------------------

/** M07-01: which levels the caller can use (BR-M07-07). */
export const PkskAccessSchema = z.object({ T1: z.boolean(), T4: z.boolean() }).meta({ id: 'PkskAccess' })
export type PkskAccess = z.infer<typeof PkskAccessSchema>

const masteryPct = z.number().int().min(0).max(100)

export const PkskDashboardDomainSchema = PkskDomainRefSchema.extend({ masteryPct }).meta({
  id: 'PkskDashboardDomain',
})

/** M07-03. */
export const PkskDashboardSchema = z
  .object({
    level: PkskLevelSchema,
    readiness: z.object({
      scorePct: z.number().int().min(0).max(100).meta({ description: 'Rounded mean of the caller attempts (0 with none).' }),
      grade: PkskGradeSchema.meta({ description: 'Grade of the unrounded mean.' }),
    }),
    examCount: z.number().int().min(0),
    bahagianBAvgPct: PkskPercentSchema.meta({ description: 'Mean of the Bahagian B percentages, one decimal.' }),
    domains: z.array(PkskDashboardDomainSchema).max(20).meta({ description: 'Bahagian B domains in order.' }),
  })
  .meta({ id: 'PkskDashboard' })
export type PkskDashboard = z.infer<typeof PkskDashboardSchema>

export const PkskSectionDomainSchema = PkskDomainRefSchema.extend({
  questionCount: z.number().int().min(0).meta({ description: 'Approved questions of the domain at this level.' }),
  masteryPct,
}).meta({ id: 'PkskSectionDomain' })

/** M07-04: one Bahagian section. */
export const PkskDomainSectionSchema = z
  .object({
    bahagian: PkskBahagianSchema,
    name: z.string().min(1).max(100).meta({ example: 'Kecerdasan Intelek' }),
    subtitle: z.string().min(1).max(100).meta({ example: 'Kognitif & penaakulan' }),
    domains: z.array(PkskSectionDomainSchema).max(20),
  })
  .meta({ id: 'PkskDomainSection' })
export type PkskDomainSection = z.infer<typeof PkskDomainSectionSchema>

export const PkskDomainSectionsSchema = z
  .array(PkskDomainSectionSchema)
  .length(3)
  .meta({ id: 'PkskDomainSections', description: 'Sections A, B, C in that order.' })

/** A served question. It never carries a correctness flag (SEC-M07-07). */
export const PkskServedQuestionSchema = z
  .object({
    id: IdSchema,
    questionText: z.string().min(1).max(5000),
    options: z
      .array(z.object({ text: z.string().max(1000) }))
      .max(6)
      .meta({ description: 'Empty for a Bahagian C (essay) question.' }),
  })
  .meta({ id: 'PkskServedQuestion' })
export type PkskServedQuestion = z.infer<typeof PkskServedQuestionSchema>

/** M07-05 (provisional set: up to 10 random approved questions). */
export const PkskPracticeSchema = z
  .object({
    domain: z.object({
      id: IdSchema,
      code: PkskDomainCodeSchema,
      name: z.string().min(1).max(100),
      bahagian: PkskBahagianSchema,
    }),
    questions: z.array(PkskServedQuestionSchema).max(10),
  })
  .meta({ id: 'PkskPractice' })
export type PkskPractice = z.infer<typeof PkskPracticeSchema>

/** M07-06 item and M07-09 result. */
export const PkskExamAttemptSchema = z
  .object({
    id: IdSchema,
    completedAt: TimestampSchema,
    scorePct: PkskPercentSchema,
    grade: PkskGradeSchema,
  })
  .meta({ id: 'PkskExamAttempt' })
export type PkskExamAttempt = z.infer<typeof PkskExamAttemptSchema>

/** M07-07 result (the M05 session is created with mode `pksk`). */
export const PkskPracticeResultSchema = z
  .object({
    masteryPct: masteryPct.meta({ description: 'round(correct / answered * 100).' }),
    sessionId: PracticeSessionIdSchema,
    gamification: z.object({
      coinsEarned: z.number().int().min(0),
      pointsEarned: z.number().int().min(0),
      streakCount: z.number().int().min(0),
      totalBalance: z.number().int().min(0),
    }),
  })
  .meta({ id: 'PkskPracticeResult' })
export type PkskPracticeResult = z.infer<typeof PkskPracticeResultSchema>

/** M07-08 (provisional exam: 30 A / 70 B / 1 C, fewer when the pool is short). */
export const PkskExamSectionSchema = z
  .object({
    bahagian: PkskBahagianSchema,
    weightPct: z.union([z.literal(20), z.literal(70), z.literal(10)]),
    questions: z.array(PkskServedQuestionSchema).max(70),
  })
  .meta({ id: 'PkskExamSection' })

export const PkskExamSchema = z
  .object({ sections: z.array(PkskExamSectionSchema).length(3).meta({ description: 'A, B, C in that order.' }) })
  .meta({ id: 'PkskExam' })
export type PkskExam = z.infer<typeof PkskExamSchema>

// ---------------------------------------------------------------------------------------------
// Requests (M07-07 and M07-09 share the body)
// ---------------------------------------------------------------------------------------------

const bad = { error: ANSWERS_MESSAGE }

/**
 * One answer. Every check carries the mock message "Jawapan tidak sah.". `questionId` is a decimal
 * string on the wire (the mock sends an integer). The mock only reads `optionIndex` (A and B) or
 * `text` (C); both may be absent or null.
 */
export const PkskAnswerSchema = z
  .strictObject(
    {
      questionId: z.string(bad).regex(/^\d{1,19}$/, bad),
      optionIndex: z.number(bad).int(bad).min(0, bad).max(PKSK_OPTION_INDEX_MAX, bad).nullish(),
      text: z.string(bad).max(PKSK_ANSWER_TEXT_MAX, bad).nullish(),
    },
    bad,
  )
  .meta({ id: 'PkskAnswer' })
export type PkskAnswer = z.infer<typeof PkskAnswerSchema>

/**
 * Body of both POSTs. Non-empty, no duplicate `questionId`, at most 101 answers (30 + 70 + 1), no
 * unknown keys (D57). Every issue, whatever its path (`answers.1.questionId`, ...), is reported as
 * the single field `answers` with "Jawapan tidak sah." (use `pkskStudentFieldsOf`). Whether each
 * question is an approved PKSK question of the right level (and domain, for practice) is a
 * service rule with the same 422 message and field.
 */
export const PkskAnswersRequestSchema = z
  .strictObject(
    {
      answers: z
        .array(PkskAnswerSchema, bad)
        .min(1, bad)
        .max(PKSK_EXAM_MAX_ANSWERS, bad)
        .superRefine((answers, ctx) => {
          const seen = new Set<string>()
          for (const a of answers) {
            if (seen.has(a.questionId)) {
              ctx.addIssue({ code: 'custom', message: ANSWERS_MESSAGE })
              return
            }
            seen.add(a.questionId)
          }
        }),
    },
    bad,
  )
  .meta({ id: 'PkskAnswersRequest' })
export type PkskAnswersRequest = z.infer<typeof PkskAnswersRequestSchema>

/**
 * Collapses the issues of a rejected `PkskAnswersRequestSchema` parse to the mock's error fields:
 * always `{ answers: "Jawapan tidak sah." }` (the mock never reports per-element keys). A body that
 * is not an object, an unknown key and a missing `answers` also map to `answers`.
 */
export function pkskStudentFieldsOf(error: z.ZodError): Record<string, string> {
  return error.issues.length > 0 ? { answers: ANSWERS_MESSAGE } : {}
}

/** Components of this file, keyed by `.meta({ id })`. */
export const PKSK_STUDENT_SCHEMAS = {
  PkskAccess: PkskAccessSchema,
  PkskDashboardDomain: PkskDashboardDomainSchema,
  PkskDashboard: PkskDashboardSchema,
  PkskSectionDomain: PkskSectionDomainSchema,
  PkskDomainSection: PkskDomainSectionSchema,
  PkskDomainSections: PkskDomainSectionsSchema,
  PkskServedQuestion: PkskServedQuestionSchema,
  PkskPractice: PkskPracticeSchema,
  PkskExamAttempt: PkskExamAttemptSchema,
  PkskPracticeResult: PkskPracticeResultSchema,
  PkskExamSection: PkskExamSectionSchema,
  PkskExam: PkskExamSchema,
  PkskAnswer: PkskAnswerSchema,
  PkskAnswersRequest: PkskAnswersRequestSchema,
} as const
