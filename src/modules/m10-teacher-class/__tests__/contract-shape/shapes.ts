/**
 * The server shapes of API-GUR-18 (teacher questions) and API-GUR-17 (paper upload), mirrored from the S6-T06 contract:
 * `packages/contract/src/questions/schema.ts` (`QuestionGuruCreateRequestSchema`, `QuestionGuruUpdateRequestSchema`,
 * `QuestionGuruSummarySchema`, `QuestionGuruDetailSchema`; branch of be-s1) and
 * `packages/contract/src/classes/question-sets/schema.ts` (`QuestionSetPaperFieldsSchema`; branch of be).
 * Those branches are not merged into this base yet, so the schemas are written out here; once they are merged, replace
 * this file by `import { ... } from '@pp/contract'`. A body the FE builds must pass the request schemas exactly as the
 * server validates it (ids as strings, an int difficulty, four options, a key, the DSKP fields).
 */
import { z } from 'zod'

const COGNITIVE = [
  'mengingat',
  'memahami',
  'mengaplikasi',
  'menganalisis',
  'menilai',
  'mencipta',
] as const
const GuruId = z.string().trim().min(1).max(64)
const keyIndex = (v: unknown): boolean =>
  typeof v === 'number'
    ? Number.isInteger(v) && v >= 0 && v <= 3
    : typeof v === 'string' && /^([0-3]|[A-Da-d])$/.test(v.trim())

const guruBody = () =>
  z
    .object({
      subjectId: GuruId,
      educationLevelId: GuruId,
      chapterId: z.string().max(64).nullable().optional(),
      spIds: z.array(z.string().min(1).max(64)).max(3).nullable().optional(),
      tp: z.number().int().min(1).max(6).nullable().optional(),
      cognitiveLevel: z.enum(COGNITIVE).nullable().optional(),
      difficultyLevel: z.number().int().min(1).max(5),
      questionType: z.literal('mcq').default('mcq'),
      questionText: z.string().trim().min(1).max(2000),
      options: z.array(z.string().trim().min(1).max(500)).length(4),
      correctAnswer: z.union([z.number(), z.string()]).optional(),
      correctOptionId: z.union([z.number(), z.string()]).optional(),
      explanation: z.string().max(2000).nullable().optional(),
    })
    .strict()
    .refine((v) => keyIndex(v.correctAnswer ?? v.correctOptionId), { path: ['correctAnswer'] })

export const QuestionGuruCreateRequestSchema = guruBody()
/** PUT is the same form and rules as the create. */
export const QuestionGuruUpdateRequestSchema = guruBody()

const Id = z.string().min(1).or(z.number())
export const QuestionGuruSummarySchema = z
  .object({
    id: Id,
    questionType: z.literal('mcq'),
    questionText: z.string(),
    subjectId: Id.nullable(),
    subjectName: z.string(),
    educationLevelId: Id.nullable(),
    levelName: z.string(),
    difficultyLevel: z.number().int().min(1).max(5),
    difficultyLabel: z.string(),
    dskpTagged: z.boolean(),
    status: z.enum(['pending', 'approved', 'rejected']),
    statusLabel: z.string(),
    rejectionReason: z.string().nullable(),
    editable: z.boolean(),
    options: z.array(z.string()),
    correctAnswer: z.number().int().min(0).max(3),
    explanation: z.string().nullable(),
    createdAt: z.string(),
  })
  .strict()

export const QuestionGuruDetailSchema = QuestionGuruSummarySchema.extend({
  chapterId: Id.nullable(),
  spIds: z.array(Id),
  tp: z.number().int().min(1).max(6).nullable(),
  cognitiveLevel: z.enum(COGNITIVE).nullable(),
}).strict()

export const PAPER_TYPES = [
  'umum',
  'trial',
  'dskp',
  'buku_teks',
  'buku_latihan',
  'peperiksaan',
  'lain',
] as const

/** The text fields of `POST /guru/question-papers` as multipart strings (`QuestionSetPaperFieldsSchema`). */
export const QuestionSetPaperFieldsSchema = z
  .object({
    paperType: z.enum(PAPER_TYPES),
    subject: z.string().trim().min(1).max(100),
    levelId: z
      .string()
      .regex(/^[1-5]$/)
      .nullish(),
    year: z
      .string()
      .regex(/^20\d\d$/)
      .nullish(),
    preparedBy: z.string().trim().max(150).nullish(),
    note: z.string().trim().max(1000).nullish(),
    answerSchemeConfirmed: z.enum(['true', '1', 'on']),
  })
  .strict()
