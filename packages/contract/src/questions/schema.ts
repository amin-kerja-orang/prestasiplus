import { z } from '../zod'
import { PageQuerySchema } from '../common/envelope'
import { IdSchema } from '../common/ids'
import { TimestampSchema } from '../common/time'
import {
  QuestionCurriculumTagSchema,
  QuestionPartSchema,
  QuestionPublicPartSchema,
  QuestionStatusSchema,
  QuestionStimulusGroupSchema,
} from './parts'

export * from './parts'

/**
 * M04 question bank core wire (BE-09, contract-only). The mock's flat objective shape
 * (`src/modules/m04-question-bank/api/questions.ts`) is kept so the screens keep working; the v2
 * part tree (`parts`, `tag`, `stimulusGroup`) rides along as optional fields (see ./parts). Ids are
 * opaque strings, timestamps are +08:00, `legacy_*` never appears. Deviations are listed in the
 * BE-09 report: statuses (D54a), no PKSK fields, ids, `status` flash kept as a module envelope.
 */

/** Mock copy (UNVERIFIED COPY, SRS 8). */
export const QUESTION_MESSAGES = {
  added: 'Soalan berjaya ditambah.',
  updated: 'Soalan berjaya dikemaskini.',
  deleted: 'Soalan berjaya dipadam.',
  bulkUpdated: (n: number): string => `${String(n)} soalan berjaya dikemaskini.`,
  bulkNoAction: 'Sila pilih tindakan terlebih dahulu.',
  bulkBadAction: 'Tindakan tidak sah.',
  bulkNoIds: 'Sila pilih sekurang-kurangnya satu soalan.',
  bulkBadIds: 'Senarai soalan tidak sah.',
  subject: 'Sila pilih subjek.',
  level: 'Sila pilih tahap pendidikan.',
  difficulty: 'Sila pilih tahap kesukaran.',
  type: 'Jenis soalan tidak sah.',
  text: 'Teks soalan mesti sekurang-kurangnya 10 aksara.',
  image: 'Gambar mesti jenis JPG, PNG atau WebP dan tidak melebihi 2MB.',
  options: 'Sila isi semua pilihan jawapan.',
  correctAnswer: 'Sila pilih jawapan betul.',
  answerText: 'Sila masukkan jawapan betul.',
  tfAnswer: 'Jawapan betul atau salah tidak sah.',
  points: 'Nilai mata mesti sekurang-kurangnya 1.',
  language: 'Bahasa tidak sah.',
  sp: 'SP DSKP tidak sah.',
  /** Guru routes (m10 MSG). */
  guruText: 'Sila isi soalan.',
  guruTextLong: 'Soalan tidak boleh melebihi 2000 aksara.',
  guruTf: 'Sila pilih betul atau salah.',
  guruChapter: 'Bab tidak sah.',
  guruTopic: 'Topik tidak sah.',
  guruScript: 'Jenis tulisan tidak sah.',
} as const

export const QUESTION_TYPES = ['mcq', 'true_false', 'short_answer', 'fill_blank', 'essay'] as const
export const QuestionTypeSchema = z.enum(QUESTION_TYPES, QUESTION_MESSAGES.type).meta({ id: 'QuestionType' })
export const QuestionComplianceStatusSchema = z
  .enum(['verified', 'pending_mapping', 'quarantined', 'rejected', 'draft'])
  .meta({ id: 'QuestionComplianceStatus' })
export const QuestionSourceTypeSchema = z
  .enum(['textbook', 'dskp', 'trial', 'marking_scheme', 'ai_generated'])
  .meta({ id: 'QuestionSourceType' })
const Language = z.enum(['bm', 'en'], QUESTION_MESSAGES.language)
const ScriptType = z.enum(['rumi', 'arab', 'jawi', 'mixed'])
const Difficulty = z.number().int().min(1).max(5)

/** Questions-local `{ id, name }` of a subject or level (curriculum is owned by BE-08). */
export const QuestionNamedRefSchema = z.object({ id: IdSchema, name: z.string() }).meta({ id: 'QuestionNamedRef' })
const Ref = QuestionNamedRefSchema.nullable()

/** `{ data, status }`: mutations carry the BM flash text (mock E3; not part of the common envelope). */
export function mutationEnvelopeOf<T extends z.ZodType>(data: T) {
  return z.object({ data, status: z.string() })
}

/* ------------------------------------------------------------------------------- list, summary */

export const QuestionRowSchema = z
  .object({
    id: IdSchema,
    questionText: z.string(),
    subject: Ref,
    level: Ref,
    difficultyLevel: Difficulty,
    status: QuestionStatusSchema,
    isActive: z.boolean(),
    complianceStatus: QuestionComplianceStatusSchema,
    aiVerified: z.boolean(),
    dskpTagged: z.boolean(),
    sourceType: QuestionSourceTypeSchema.nullable(),
    sourceFile: z.string().nullable(),
  })
  .meta({ id: 'QuestionRow' })

/** Unknown filter values match nothing (empty page) except `status`, which is validated (D54a, 422). */
export const QuestionListQuerySchema = PageQuerySchema.extend({
  subjectId: IdSchema.optional(),
  educationLevelId: IdSchema.optional(),
  difficultyLevel: z.string().optional(),
  status: QuestionStatusSchema.optional(),
  dskpFilter: z.string().optional().meta({ description: 'tagged | untagged' }),
  complianceFilter: z.string().optional().meta({ description: 'missing_source | verified_generated | a compliance status' }),
  sourceFilter: z.string().optional().meta({ description: 'textbook | dskp | trial | marking_scheme' }),
  search: z.string().optional(),
}).meta({ id: 'QuestionListQuery' })

export const QuestionSummarySchema = z
  .object({
    total: z.number().int().min(0),
    subjects: z.array(
      z.object({
        id: IdSchema,
        name: z.string(),
        icon: z.string().nullable(),
        group: z.enum(['teras', 'elektif']),
        total: z.number().int().min(0),
        /** Questions with status `published` (the mock's "approved" meant live). */
        approved: z.number().int().min(0),
      }),
    ),
  })
  .meta({ id: 'QuestionSummary' })

/* ------------------------------------------------------------------------------ question, detail */

/** Admin/editor view: carries the answer key (`correctAnswer`, `tfAnswer`, `correctAnswerText`, `parts[].key`). */
export const QuestionSchema = z
  .object({
    id: IdSchema,
    subjectId: IdSchema.nullable(),
    educationLevelId: IdSchema.nullable(),
    difficultyLevel: Difficulty,
    questionType: QuestionTypeSchema,
    questionText: z.string(),
    questionImage: z.string().nullable(),
    options: z.array(z.string()).nullable(),
    optionImages: z.array(z.string().nullable()),
    correctAnswer: z.number().int().min(0).max(3).nullable(),
    tfAnswer: z.boolean().nullable(),
    correctAnswerText: z.string().nullable(),
    altAnswers: z.array(z.string()),
    modelAnswer: z.string().nullable(),
    explanation: z.string().nullable(),
    aiExplanation: z.object({ markdown: z.string(), generatedAt: TimestampSchema }).nullable(),
    language: Language,
    pointsValue: z.number().int().min(1),
    status: QuestionStatusSchema,
    isActive: z.boolean(),
    complianceStatus: QuestionComplianceStatusSchema,
    aiVerified: z.boolean(),
    sourceType: QuestionSourceTypeSchema.nullable(),
    sourceFile: z.string().nullable(),
    sourcePage: z.number().int().nullable(),
    sourceSet: z.string().nullable(),
    qualityScore: z.number().int().min(0).max(100).nullable(),
    needsDiagram: z.boolean(),
    spmPool: z.boolean(),
    dskpSpId: IdSchema.nullable(),
    curriculumChapterId: IdSchema.nullable(),
    curriculumTopicId: IdSchema.nullable(),
    chapterLabel: z.string().nullable(),
    scriptType: ScriptType,
    textDirection: z.enum(['ltr', 'rtl']),
    createdBy: IdSchema,
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema,
    usage: z.object({ attempts: z.number().int().min(0), correct: z.number().int().min(0) }),
    /** v2 additions (BE-09 AC 1 to 3, 12): absent on rows that only have the flat shape. */
    parts: z.array(QuestionPartSchema).min(1).max(20).optional(),
    tag: QuestionCurriculumTagSchema.optional(),
    stimulusGroup: QuestionStimulusGroupSchema.nullable().optional(),
  })
  .meta({ id: 'Question' })

const DskpRef = z.object({ id: IdSchema, code: z.string(), description: z.string() })
export const QuestionDetailSchema = QuestionSchema.omit({ createdBy: true })
  .extend({
    subject: Ref,
    level: Ref,
    dskp: z
      .object({
        bidang: z.object({ id: IdSchema, code: z.string().nullable(), name: z.string() }),
        sk: DskpRef,
        sp: DskpRef,
      })
      .nullable(),
    createdBy: z.object({ id: IdSchema, name: z.string().nullable() }),
  })
  .meta({ id: 'QuestionDetail' })

/* ------------------------------------------------------------------------------------- requests */

/** An id field whose every failure (missing, not a string, empty) gives one BM message. */
const idWith = (message: string) => z.string({ error: message }).min(1, message).max(64, message)

const baseInput = z.object({
  subjectId: idWith(QUESTION_MESSAGES.subject),
  educationLevelId: idWith(QUESTION_MESSAGES.level),
  difficultyLevel: z.coerce.number({ error: QUESTION_MESSAGES.difficulty }).int(QUESTION_MESSAGES.difficulty).min(1, QUESTION_MESSAGES.difficulty).max(5, QUESTION_MESSAGES.difficulty),
  questionText: z.string({ error: QUESTION_MESSAGES.text }).trim().min(10, QUESTION_MESSAGES.text),
  dskpSpId: idWith(QUESTION_MESSAGES.sp).nullable().optional(),
  /** MCQ: four texts A to D. */
  options: z
    .array(z.string({ error: QUESTION_MESSAGES.options }).trim().min(1, QUESTION_MESSAGES.options), { error: QUESTION_MESSAGES.options })
    .length(4, QUESTION_MESSAGES.options)
    .optional(),
  correctAnswer: z.coerce.number({ error: QUESTION_MESSAGES.correctAnswer }).int(QUESTION_MESSAGES.correctAnswer).min(0, QUESTION_MESSAGES.correctAnswer).max(3, QUESTION_MESSAGES.correctAnswer).optional(),
  tfAnswer: z.boolean({ error: QUESTION_MESSAGES.tfAnswer }).nullable().optional(),
  correctAnswerText: z.string().trim().nullable().optional(),
  altAnswers: z.array(z.string()).optional(),
  modelAnswer: z.string().nullable().optional(),
  explanation: z.string().nullable().optional(),
  language: Language.optional(),
  pointsValue: z.coerce.number({ error: QUESTION_MESSAGES.points }).int(QUESTION_MESSAGES.points).min(1, QUESTION_MESSAGES.points).optional(),
  removeQuestionImage: z.boolean().optional(),
  removeOptionImage: z.array(z.boolean()).max(4).optional(),
  parts: z.array(QuestionPartSchema).min(1).optional(),
  tag: QuestionCurriculumTagSchema.optional(),
  stimulusGroupId: IdSchema.nullable().optional(),
})

/**
 * POST body (JSON; images arrive as multipart files `questionImage`, `optionImages[i]`, BE-04). `status`
 * defaults to `draft`; `published` is refused with 422 unless subject, level, unit, SP and TP are set.
 */
export const QuestionCreateRequestSchema = baseInput
  .extend({ questionType: QuestionTypeSchema, status: QuestionStatusSchema.optional() })
  .superRefine((v, ctx) => {
    const bad = (path: string, message: string) => ctx.addIssue({ code: 'custom', path: [path], message })
    if (v.questionType === 'mcq') {
      if (!v.options) bad('options', QUESTION_MESSAGES.options)
      if (v.correctAnswer === undefined) bad('correctAnswer', QUESTION_MESSAGES.correctAnswer)
    }
    if ((v.questionType === 'short_answer' || v.questionType === 'fill_blank') && !v.correctAnswerText?.trim()) {
      bad('correctAnswerText', QUESTION_MESSAGES.answerText)
    }
  })
  .meta({ id: 'QuestionCreateRequest' })

/** PUT body: the four required fields must be sent; other fields are a patch (`''`/null clears). `questionType` is ignored. */
export const QuestionUpdateRequestSchema = baseInput.meta({ id: 'QuestionUpdateRequest' })

/** D54a: an action is the target lifecycle code, or `delete`. The mock verbs approve/reject/pending_review are gone. */
export const QUESTION_BULK_ACTIONS = ['draft', 'review', 'approved', 'published', 'archived', 'delete'] as const
export const QuestionBulkRequestSchema = z
  .object({
    action: z.enum(QUESTION_BULK_ACTIONS, {
      error: (iss) =>
        iss.input === undefined || (typeof iss.input === 'string' && iss.input.trim() === '')
          ? QUESTION_MESSAGES.bulkNoAction
          : QUESTION_MESSAGES.bulkBadAction,
    }),
    ids: z
      .array(z.string({ error: QUESTION_MESSAGES.bulkBadIds }).min(1, QUESTION_MESSAGES.bulkBadIds).max(64, QUESTION_MESSAGES.bulkBadIds), {
        error: (iss) => (iss.input === undefined ? QUESTION_MESSAGES.bulkNoIds : QUESTION_MESSAGES.bulkBadIds),
      })
      .min(1, QUESTION_MESSAGES.bulkNoIds),
  })
  .meta({ id: 'QuestionBulkRequest' })

export const QuestionDeleteResultSchema = z.object({ deleted: z.literal(1) }).meta({ id: 'QuestionDeleteResult' })
export const QuestionBulkResultSchema = z.object({ affected: z.number().int().min(0) }).meta({ id: 'QuestionBulkResult' })

/* ------------------------------------------------------------------------- structured (admin reads) */

export const QuestionStructuredRowSchema = z
  .object({
    id: IdSchema,
    stimulusExcerpt: z.string(),
    subject: Ref,
    level: Ref,
    kbatLevel: z.number().int(),
    totalMarks: z.number().int(),
    subCount: z.number().int().min(0),
  })
  .meta({ id: 'QuestionStructuredRow' })

export const QuestionStructuredListQuerySchema = z
  .object({
    subjectId: IdSchema.optional(),
    educationLevelId: IdSchema.optional(),
    kbatLevel: z.string().optional(),
    page: z.coerce.number().int().min(1).default(1),
  })
  .meta({ id: 'QuestionStructuredListQuery' })

/** `meta.stats` is over the whole store, not the filter. */
export const QuestionStructuredStatsSchema = z.object({
  total: z.number().int().min(0),
  published: z.number().int().min(0),
  bySubject: z.array(z.object({ name: z.string(), count: z.number().int().min(1) })),
})

export const QuestionStructuredSubSchema = z
  .object({
    id: IdSchema,
    structuredQuestionId: IdSchema,
    partLabel: z.string(),
    questionText: z.string(),
    marks: z.number().int(),
    answerType: z.enum(['text', 'numeric']),
    expectedNumeric: z.number().nullable(),
    numericTolerance: z.number().nullable(),
    rubrics: z.array(z.object({ konstruk: z.string(), keyword: z.string(), marks: z.number() })),
    modelAnswer: z.string(),
    parentSubId: IdSchema.nullable(),
    order: z.number().int(),
  })
  .meta({ id: 'QuestionStructuredSub' })

export const QuestionStructuredDetailSchema = z
  .object({
    id: IdSchema,
    subjectId: IdSchema,
    educationLevelId: IdSchema,
    subject: Ref,
    level: Ref,
    kbatLevel: z.number().int(),
    status: QuestionStatusSchema,
    isActive: z.boolean(),
    needsDiagram: z.boolean(),
    estimatedMinutes: z.number().int(),
    isTrial: z.boolean(),
    topic: z.string().nullable(),
    questionNumber: z.number().int().nullable(),
    stimulus: z.string(),
    stimulusImage: z.string().nullable(),
    totalMarks: z.number().int(),
    visibility: z.literal('public'),
    complianceStatus: z.string(),
    sourceFile: z.string().nullable(),
    sourcePage: z.number().int().nullable(),
    sourceSet: z.string().nullable(),
    curriculumChapterId: IdSchema.nullable(),
    curriculumTopicId: IdSchema.nullable(),
    dskpSpId: IdSchema.nullable(),
    scriptType: z.string(),
    textDirection: z.string(),
    questionTemplate: z.literal('eksperimen').nullable(),
    subQuestions: z.array(QuestionStructuredSubSchema),
    createdBy: z.object({ id: IdSchema, name: z.string().nullable() }),
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema,
  })
  .meta({ id: 'QuestionStructuredDetail' })

/* ---------------------------------------------------------------------------------- Guru routes */

/** Owner-only contribution views; the owning teacher sees their own key by design. */
export const QuestionGuruSummarySchema = z
  .object({
    id: IdSchema,
    questionType: QuestionTypeSchema,
    questionText: z.string(),
    subjectId: IdSchema.nullable(),
    subjectName: z.string(),
    educationLevelId: IdSchema.nullable(),
    levelName: z.string(),
    difficultyLevel: Difficulty,
    difficultyLabel: z.string(),
    dskpTagged: z.boolean(),
    status: QuestionStatusSchema,
    /** BM label of the status (Draf, Semakan, Lulus, Diterbitkan, Diarkib). */
    statusLabel: z.string(),
    isActive: z.boolean(),
    options: z.array(z.string()).nullable(),
    correctAnswer: z.number().int().min(0).max(3).nullable(),
    explanation: z.string().nullable(),
    source: z.string().nullable(),
    createdAt: TimestampSchema,
  })
  .meta({ id: 'QuestionGuruSummary' })

export const QuestionGuruDetailSchema = QuestionGuruSummarySchema.extend({
  questionImage: z.string().nullable(),
  optionImages: z.array(z.string().nullable()),
  tfAnswer: z.boolean().nullable(),
  correctAnswerText: z.string().nullable(),
  altAnswers: z.array(z.string()),
  modelAnswer: z.string().nullable(),
  language: Language,
  scriptType: ScriptType,
  textDirection: z.enum(['ltr', 'rtl']),
  curriculumChapterId: IdSchema.nullable(),
  curriculumTopicId: IdSchema.nullable(),
  dskpSpId: IdSchema.nullable(),
  usage: z.object({ attempts: z.number().int().min(0), correct: z.number().int().min(0), accuracy: z.number().int().min(0).max(100) }),
}).meta({ id: 'QuestionGuruDetail' })

const OptionInput = z.union([z.string(), z.object({ text: z.string() }), z.object({ optionText: z.string() })])

/** POST /guru/questions: always saved as `review` (was pending_review), owner = caller. Difficulty may be easy/medium/hard (2/3/4). */
export const QuestionGuruCreateRequestSchema = z
  .object({
    educationLevelId: IdSchema,
    subjectId: IdSchema,
    questionType: QuestionTypeSchema,
    difficultyLevel: z.union([z.enum(['easy', 'medium', 'hard']), z.coerce.number().int().min(1).max(5)]),
    questionText: z.string().trim().min(1, QUESTION_MESSAGES.guruText).max(2000, QUESTION_MESSAGES.guruTextLong),
    options: z.array(OptionInput).length(4, QUESTION_MESSAGES.options).optional(),
    correctAnswer: z.union([z.coerce.number().int().min(0).max(3), z.string().regex(/^[A-Da-d]$/), z.string().max(500)]).optional(),
    tfAnswer: z.boolean().optional(),
    correctAnswerText: z.string().max(500).optional(),
    altAnswers: z.union([z.string(), z.array(z.string())]).optional(),
    modelAnswer: z.string().optional(),
    explanation: z.string().optional(),
    questionImageUrl: z.string().optional(),
    curriculumChapterId: IdSchema.nullable().optional(),
    curriculumTopicId: IdSchema.nullable().optional(),
    dskpSpId: IdSchema.nullable().optional(),
    scriptType: ScriptType.optional(),
    parts: z.array(QuestionPartSchema).min(1).optional(),
    tag: QuestionCurriculumTagSchema.optional(),
  })
  .meta({ id: 'QuestionGuruCreateRequest' })

/** PUT /guru/questions/:id (own only). MCQ options are `{ id: 0..3, optionText }`. */
export const QuestionGuruUpdateRequestSchema = z
  .object({
    questionText: z.string().trim().min(1, QUESTION_MESSAGES.guruText).max(2000, QUESTION_MESSAGES.guruTextLong),
    difficultyLevel: z.union([z.enum(['easy', 'medium', 'hard']), z.coerce.number().int().min(1).max(5)]).optional(),
    options: z.array(z.object({ id: z.number().int().min(0).max(3), optionText: z.string().trim().min(1).max(500) })).length(4, QUESTION_MESSAGES.options).optional(),
    correctOptionId: z.union([z.coerce.number().int().min(0).max(3), z.string().regex(/^[A-Da-d]$/)]).optional(),
    explanation: z.string().nullable().optional(),
  })
  .meta({ id: 'QuestionGuruUpdateRequest' })

export const QuestionGuruQuerySchema = z.object({ page: z.coerce.number().int().min(1).default(1) }).meta({ id: 'QuestionGuruQuery' })
export const QuestionGuruRemoveResultSchema = z.object({ removed: z.literal(1) }).meta({ id: 'QuestionGuruRemoveResult' })

/* ----------------------------------------------------------------------- student-facing projection */

/**
 * What a student (or any non-editor) may receive for a published question: no key, no explanation,
 * no model answer, no source file. Zod strips the omitted keys if a full admin object is parsed
 * with this schema, so a handler can never leak them by passing the wrong object.
 */
export const QuestionPublicSchema = z
  .object({
    id: IdSchema,
    questionText: z.string(),
    questionType: QuestionTypeSchema,
    options: z.array(z.string()).nullable(),
    language: Language,
    textDirection: z.enum(['ltr', 'rtl']),
    scriptType: ScriptType,
    pointsValue: z.number().int().min(1),
    parts: z.array(QuestionPublicPartSchema).optional(),
  })
  .meta({ id: 'QuestionPublic' })
