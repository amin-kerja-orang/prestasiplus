import { z } from '../zod'
import { IdSchema } from '../common/ids'
import { TimestampSchema } from '../common/time'
import {
  SpmHeroClassSchema,
  SpmMockGradeSchema,
  SpmMockPaperNumberSchema,
  SpmMockStatusSchema,
  SpmMockSubjectSchema,
} from './shared'
import { count } from './util'

/**
 * SPM mock exams (M06-08 to M06-12). A mock is generated from the SPM pool (Paper 1, 30 objective
 * items of 1 mark) or from visible structured questions (Paper 2, 6 items of 10 marks), sat once,
 * submitted and graded. Only the owner can open a mock (anyone else gets 404 "Not Found.").
 * The mock id is an opaque string (the card plans a uuid; open question 4). Nothing is written to
 * practice, mastery, the revision queue or the wallet.
 */

/** Largest answer kept per item; a longer answer is truncated, not rejected. */
export const SPM_MOCK_ANSWER_MAX_CHARS = 5000
/** Items of a Paper 1 mock and of a Paper 2 mock. */
export const SPM_MOCK_PAPER1_ITEMS = 30
export const SPM_MOCK_PAPER2_ITEMS = 6

const mockId = IdSchema.meta({ description: 'Mock exam id; only its owner may use it, any other caller gets 404.' })

// ---------------------------------------------------------------------------------------------
// M06-08 list
// ---------------------------------------------------------------------------------------------

/**
 * A row of `GET /spm-mocks`: the caller's mocks, newest first. The response is a bare
 * `{ data: [...] }` with no `meta`. `score`, `percent` and `grade` are null while `in_progress`.
 */
export const SpmMockListItemSchema = z
  .strictObject({
    id: mockId,
    subject: z.string().min(1).meta({ description: 'The subject label chosen at creation (one of SpmMockSubject).' }),
    paperNumber: SpmMockPaperNumberSchema,
    status: SpmMockStatusSchema,
    createdAt: TimestampSchema,
    score: count.nullable(),
    maxScore: count,
    percent: z.number().min(0).max(100).nullable().meta({ description: '2 decimals.' }),
    grade: SpmMockGradeSchema.nullable(),
  })
  .meta({ id: 'SpmMockListItem' })
export type SpmMockListItem = z.infer<typeof SpmMockListItemSchema>

// ---------------------------------------------------------------------------------------------
// M06-09 create
// ---------------------------------------------------------------------------------------------

/**
 * `POST /spm-mocks` body. A `subject` outside the ten options is 422 `fields.subject`
 * "Sila pilih subjek."; `paperNumber` absent or null means 1, anything but 1 or 2 is 422
 * `fields.paperNumber` "Paper mesti 1 atau 2." (the mock also accepts a numeric string such as "2").
 */
export const SpmMockCreateRequestSchema = z
  .object({
    subject: SpmMockSubjectSchema,
    paperNumber: SpmMockPaperNumberSchema.nullish(),
  })
  .meta({ id: 'SpmMockCreateRequest' })
export type SpmMockCreateRequest = z.infer<typeof SpmMockCreateRequestSchema>

/** `data` of the 201 answer of `POST /spm-mocks`. */
export const SpmMockCreatedSchema = z.strictObject({ id: mockId }).meta({ id: 'SpmMockCreated' })
export type SpmMockCreated = z.infer<typeof SpmMockCreatedSchema>

// ---------------------------------------------------------------------------------------------
// M06-10 exam paper (no answer keys)
// ---------------------------------------------------------------------------------------------

/**
 * An item of the paper to sit. Strict on purpose: the paper never carries `modelAnswer`,
 * `studentAnswer`, `marks`, `feedback`, `topic` or `questionId`.
 */
export const SpmMockExamItemSchema = z
  .strictObject({
    no: z.number().int().min(1),
    text: z.string(),
    options: z.array(z.string()).optional().meta({ description: 'Paper 1 only.' }),
    maxMarks: z.number().int().min(1),
  })
  .meta({ id: 'SpmMockExamItem' })
export type SpmMockExamItem = z.infer<typeof SpmMockExamItemSchema>

/** `GET /spm-mocks/{id}` data: the exam paper without answer keys. */
export const SpmMockExamViewSchema = z
  .strictObject({
    id: mockId,
    subject: z.string().min(1),
    paperNumber: SpmMockPaperNumberSchema,
    status: SpmMockStatusSchema,
    createdAt: TimestampSchema,
    items: z.array(SpmMockExamItemSchema).min(1),
  })
  .meta({ id: 'SpmMockExamView' })
export type SpmMockExamView = z.infer<typeof SpmMockExamViewSchema>

// ---------------------------------------------------------------------------------------------
// M06-11 submit / M06-12 result
// ---------------------------------------------------------------------------------------------

/**
 * One answer of `POST /spm-mocks/{id}/submit`. `no` is an integer from 1 to the item count of the
 * mock (checked against the stored mock); a missing or null `answer` counts as empty; the text is
 * trimmed and truncated to 5000 characters.
 */
export const SpmMockAnswerInputSchema = z
  .object({
    no: z.number().int().min(1),
    answer: z.string().nullish(),
  })
  .meta({ id: 'SpmMockAnswerInput' })
export type SpmMockAnswerInput = z.infer<typeof SpmMockAnswerInputSchema>

/** `POST /spm-mocks/{id}/submit` body. Anything else is 422 `fields.answers` "Jawapan tidak sah.". */
export const SpmMockSubmitRequestSchema = z
  .object({ answers: z.array(SpmMockAnswerInputSchema) })
  .meta({ id: 'SpmMockSubmitRequest' })
export type SpmMockSubmitRequest = z.infer<typeof SpmMockSubmitRequestSchema>

/**
 * A graded item. Paper 1: `modelAnswer` is the correct letter and `marks` is 1 or 0; Paper 2:
 * `modelAnswer` is the model text and `marks` comes from the simulated marker.
 */
export const SpmMockItemSchema = z
  .strictObject({
    no: z.number().int().min(1),
    questionId: IdSchema,
    text: z.string(),
    options: z.array(z.string()).optional().meta({ description: 'Paper 1 only.' }),
    modelAnswer: z.string(),
    studentAnswer: z.string().nullable(),
    marks: count.nullable(),
    maxMarks: z.number().int().min(1),
    feedback: z.string().nullable(),
    topic: z.string(),
  })
  .meta({ id: 'SpmMockItem' })
export type SpmMockItem = z.infer<typeof SpmMockItemSchema>

/** A topic with at least one item below full marks. */
export const SpmMockWeakTopicSchema = z
  .strictObject({ topic: z.string(), wrongCount: z.number().int().min(1) })
  .meta({ id: 'SpmMockWeakTopic' })
export type SpmMockWeakTopic = z.infer<typeof SpmMockWeakTopicSchema>

/**
 * `data` of `POST /spm-mocks/{id}/submit` (200) and `GET /spm-mocks/{id}/result`. `percent` has 2
 * decimals; `weakTopics` is ordered by count descending then topic name (`ms` locale).
 */
export const SpmMockResultSchema = z
  .strictObject({
    id: mockId,
    subject: z.string().min(1),
    paperNumber: SpmMockPaperNumberSchema,
    score: count,
    maxScore: count,
    percent: z.number().min(0).max(100),
    grade: SpmMockGradeSchema,
    heroClass: SpmHeroClassSchema,
    weakTopics: z.array(SpmMockWeakTopicSchema),
    items: z.array(SpmMockItemSchema),
  })
  .meta({ id: 'SpmMockResult' })
export type SpmMockResult = z.infer<typeof SpmMockResultSchema>
