import { z } from '../zod'
import { PageQuerySchema } from '../common/envelope'
import { IdSchema } from '../common/ids'
import { TimestampSchema } from '../common/time'
import {
  QUESTION_STATUS_MESSAGE,
  QuestionCognitiveLevelSchema,
  QuestionCurriculumTagSchema,
  QuestionEssayTopicSchema,
  QuestionKbatLevelSchema,
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
  /** A `failed[]` entry of `POST /questions/bulk-action` for an id that does not exist ([PROPOSED] copy). */
  notFound: 'Soalan tidak dijumpai.',
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
  guruOptionLong: 'Pilihan jawapan tidak boleh melebihi 500 aksara.',
  guruAnswerLong: 'Jawapan betul tidak boleh melebihi 500 aksara.',
  status: QUESTION_STATUS_MESSAGE,
  guruChapter: 'Bab tidak sah.',
  /** The chapter exists but is not of the question's subject and level (copy approved, Q1). */
  chapterMismatch: 'Bab tidak sepadan dengan subjek dan tahap.',
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
    /** R1-B05: DSKP complete (unit, SP, a TP and a cognitive level on every leaf). `false` is the badge "Belum ditanda DSKP". */
    dskpComplete: z.boolean().optional(),
    sourceType: QuestionSourceTypeSchema.nullable(),
    sourceFile: z.string().nullable(),
    /** R1-H-A7: present only on an `essay_choice` (esei pilihan) question: its 2 to 6 topics. `questionType` stays `essay`. */
    essayTopics: z.array(QuestionEssayTopicSchema).optional(),
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
  /** BJS-06 (15.7): only questions flagged "Perlu semakan tag". */
  tagReview: z.enum(['true']).optional(),
  /** BJS-06 (15.7): questions with at least one leaf part lacking this EFFECTIVE value (after inheritance). */
  missing: z.enum(['unit', 'tp', 'marks', 'key']).optional(),
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
        /** Questions whose live version is `approved` (ADR-0027: approved = served). */
        approved: z.number().int().min(0),
      }),
    ),
  })
  .meta({ id: 'QuestionSummary' })

/** Kertas of a question for the paper builder (stored as the trailing digit of `paper_code`, e.g. `MATH/2`). */
export const QuestionKertasSchema = z.enum(['1', '2', '3'], 'Kertas tidak sah.').meta({ id: 'QuestionKertas' })

/** Id of an already uploaded `question_image` file (`POST /files?purpose=question_image`); never a client URL. */
const ImageFileId = IdSchema.nullable()

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
    /** Public file token of the stem image (an image stimulus of the version; download at `/api/files/<token>`), or null. */
    questionImage: z.string().nullable(),
    options: z.array(z.string()).nullable(),
    optionImages: z.array(z.string().nullable()),
    correctAnswer: z.number().int().min(0).max(3).nullable(),
    tfAnswer: z.boolean().nullable(),
    correctAnswerText: z.string().nullable(),
    altAnswers: z.array(z.string()),
    modelAnswer: z.string().nullable(),
    explanation: z.string().nullable(),
    /** Kertas for the paper builder (trailing digit of the paper code); null when not set. */
    kertas: QuestionKertasSchema.nullable().optional(),
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
    /** R1-H-A7: present only on an `essay_choice` (esei pilihan) question: its 2 to 6 topics. `questionType` stays `essay`. */
    essayTopics: z.array(QuestionEssayTopicSchema).optional(),
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
    /** BJS-06: question-level KBAT (null = Bukan KBAT), "Perlu semakan tag" flag and the catalogue the tag was made against. */
    kbat: QuestionKbatLevelSchema.nullable().optional(),
    tagReview: z.boolean().optional(),
    catalogueVersion: z.string().nullable().optional(),
    stimulusGroup: QuestionStimulusGroupSchema.nullable().optional(),
    numberLabel: z.string().nullable().optional(),
  })
  .meta({ id: 'Question' })

const DskpRef = z.object({ id: IdSchema, code: z.string(), description: z.string() })

/** R1-B05: what is still missing for "DSKP complete", in the shape of the gate issues (`path` is the `fields` key, `step` the wizard step). */
export const QuestionDskpStatusSchema = z
  .object({
    complete: z.boolean(),
    issues: z.array(z.object({ path: z.string(), code: z.string(), message: z.string(), step: z.number().int().min(1).max(4) })),
  })
  .meta({ id: 'QuestionDskpStatus' })
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
    /** R1-B05: DSKP completeness with the missing items (not the DSKP chain above, which is `dskp`). */
    dskpStatus: QuestionDskpStatusSchema.optional(),
    createdBy: z.object({ id: IdSchema, name: z.string().nullable() }),
  })
  .meta({ id: 'QuestionDetail' })

/* ------------------------------------------------------------------------------------- requests */

/** An id field whose every failure (missing, not a string, empty) gives one BM message. */
const idWith = (message: string) => z.string({ error: message }).min(1, message).max(64, message)

/** Like `idWith` but `''` and null (clear) are allowed, as the mock's optional id fields. */
const idOrBlank = (message: string) => z.string({ error: message }).max(64, message).nullable().optional()

/** An option as sent: a string, `{ text }` or `{ optionText }` (mock `optionText()`). */
const optText = (v: unknown): string => {
  if (typeof v === 'string') return v.trim()
  if (typeof v === 'object' && v !== null) {
    const o = v as { text?: unknown; optionText?: unknown }
    const t = typeof o.optionText === 'string' ? o.optionText : typeof o.text === 'string' ? o.text : ''
    return t.trim()
  }
  return ''
}
const OPTION_MAX = 500
const charLen = (t: string) => [...t].length

/**
 * MCQ option list. Every per-element failure is ONE issue on the list itself, so the `fields` key is
 * `options` exactly as in the mock (never `options.1`). `indexed`: the Guru edit form, items
 * `{ id: 0..3, optionText }` whose four ids must be unique.
 */
const optionList = (o: { long?: string; indexed?: boolean; item: Record<string, unknown> }) =>
  z
    .array(z.unknown(), { error: QUESTION_MESSAGES.options })
    .superRefine((list, ctx) => {
      const fail = (message: string) => ctx.addIssue({ code: 'custom', message })
      const texts = list.map(optText)
      if (o.indexed) {
        const ids = new Set(list.map((e) => (typeof e === 'object' && e !== null ? Number((e as { id?: unknown }).id) : NaN)))
        if (list.length !== 4 || ids.size !== 4 || [...ids].some((i) => !Number.isInteger(i) || i < 0 || i > 3)) return fail(QUESTION_MESSAGES.options)
      } else if (list.length !== 4) return fail(QUESTION_MESSAGES.options)
      if (texts.some((t) => t === '')) return fail(QUESTION_MESSAGES.options)
      if (o.long && texts.some((t) => charLen(t) > OPTION_MAX)) fail(o.long)
    })
    .meta({ type: 'array', minItems: 4, maxItems: 4, items: o.item })

const baseInput = z.object({
  subjectId: idWith(QUESTION_MESSAGES.subject),
  educationLevelId: idWith(QUESTION_MESSAGES.level),
  difficultyLevel: z.coerce.number({ error: QUESTION_MESSAGES.difficulty }).int(QUESTION_MESSAGES.difficulty).min(1, QUESTION_MESSAGES.difficulty).max(5, QUESTION_MESSAGES.difficulty),
  questionText: z.string({ error: QUESTION_MESSAGES.text }).trim().min(10, QUESTION_MESSAGES.text),
  dskpSpId: idOrBlank(QUESTION_MESSAGES.sp),
  /** Bab (chapter) of the subject and level; null or '' clears it; omitted keeps it. Error key `curriculumChapterId`. */
  curriculumChapterId: idOrBlank(QUESTION_MESSAGES.guruChapter),
  /** MCQ: four texts A to D. A bad item is reported once, under `options`. */
  options: optionList({ item: { type: 'string', minLength: 1 } }).optional(),
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
  /** Stem image: uploaded `question_image` file id; null removes it; omitted keeps it. Error key `questionImage`. */
  questionImageFileId: ImageFileId.optional(),
  /** Option images by position A to D; omitted keeps the stored ones. Error keys `optionImages.<i>`. */
  optionImageFileIds: z.array(ImageFileId).max(4).optional(),
  /** Kertas for the paper builder; null clears it; omitted keeps it. Error key `kertas`. */
  kertas: QuestionKertasSchema.nullable().optional(),
  parts: z.array(QuestionPartSchema).min(1).optional(),
  tag: QuestionCurriculumTagSchema.optional(),
  /** V2 `Nombor soalan` (Studio Langkah 1); null clears it, omitted keeps it. */
  numberLabel: z.string().trim().max(32).nullable().optional(),
  /** R1-B05: cognitive level of the single leaf of a flat question (a `parts` body carries it per leaf). */
  cognitiveLevel: QuestionCognitiveLevelSchema.nullable().optional(),
  stimulusGroupId: IdSchema.nullable().optional(),
})

/**
 * POST body (JSON only; images are ids of files already uploaded with purpose `question_image`: `questionImageFileId`, `optionImageFileIds[i]`). `status`
 * defaults to `draft`; `approved` is refused with 422 unless subject, level, unit, SP and TP are set.
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
export const QUESTION_BULK_ACTIONS = ['draft', 'review', 'approved', 'archived', 'delete'] as const
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
/** Why one requested id of a bulk action was not applied. */
export const QUESTION_BULK_FAILURE_CODES = ['NOT_FOUND', 'CONFLICT', 'VALIDATION_ERROR'] as const
export const QuestionBulkFailureSchema = z
  .object({
    id: IdSchema,
    code: z.enum(QUESTION_BULK_FAILURE_CODES),
    message: z.string().meta({
      description:
        'The BM text for this id. NOT_FOUND: "Soalan tidak dijumpai." [PROPOSED]; CONFLICT: the transition text; VALIDATION_ERROR: the distinct `fields` values in field order, joined by one space (render `fields` for a per-field view).',
    }),
    fields: z.record(z.string(), z.string()).meta({ description: 'The exact gate field messages (VALIDATION_ERROR); `{}` otherwise.' }),
  })
  .meta({ id: 'QuestionBulkFailure' })
export type QuestionBulkFailure = z.infer<typeof QuestionBulkFailureSchema>
export const QuestionBulkResultSchema = z
  .object({
    affected: z.number().int().min(0),
    failed: z
      .array(QuestionBulkFailureSchema)
      .default([])
      .meta({ description: 'One entry per unique requested id that was not applied, in request order; `[]` when all were applied.' }),
  })
  .meta({ id: 'QuestionBulkResult' })

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
    questionTemplate: z.enum(['eksperimen']).nullable(),
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

const GuruDifficulty = z.union([z.enum(['easy', 'medium', 'hard'], QUESTION_MESSAGES.difficulty), z.coerce.number({ error: QUESTION_MESSAGES.difficulty }).int(QUESTION_MESSAGES.difficulty).min(1, QUESTION_MESSAGES.difficulty).max(5, QUESTION_MESSAGES.difficulty)], { error: QUESTION_MESSAGES.difficulty })
const GuruText = z.string({ error: QUESTION_MESSAGES.guruText }).trim().min(1, QUESTION_MESSAGES.guruText).max(2000, QUESTION_MESSAGES.guruTextLong)

/** MCQ key as the mock reads it: index 0..3, a digit string, or a letter A to D. */
const keyIndex = (v: unknown): number | undefined => {
  if (typeof v === 'number') return Number.isInteger(v) && v >= 0 && v <= 3 ? v : undefined
  if (typeof v !== 'string') return undefined
  const t = v.trim().toUpperCase()
  if (/^\d+$/.test(t)) return Number(t) <= 3 ? Number(t) : undefined
  return /^[A-D]$/.test(t) ? t.charCodeAt(0) - 65 : undefined
}
const tfValid = (v: unknown) => v === true || v === false || v === 'true' || v === 'false' || v === '1' || v === '0' || v === 1 || v === 0

const GuruOptionItem = { oneOf: [{ type: 'string' }, { type: 'object', properties: { text: { type: 'string' } } }, { type: 'object', properties: { optionText: { type: 'string' } } }] }

/**
 * POST /guru/questions: saved as `review`, owner = caller. Difficulty may be easy/medium/hard (2/3/4).
 * Rules per type are the mock's `parseCreate`; the issue key is the `fields` key: `options` (empty item,
 * or item over 500), `correctAnswer` (MCQ key; for short_answer/fill_blank the answer text, empty or over
 * 500), `tfAnswer`. Image errors use the key `questionImage` / `optionImages.<i>`. Chapter,
 * topic and SP ownership checks need the curriculum and are service rules (same keys and copy).
 */
export const QuestionGuruCreateRequestSchema = z
  .object({
    educationLevelId: idWith(QUESTION_MESSAGES.level),
    subjectId: idWith(QUESTION_MESSAGES.subject),
    questionType: QuestionTypeSchema,
    difficultyLevel: GuruDifficulty,
    questionText: GuruText,
    options: optionList({ long: QUESTION_MESSAGES.guruOptionLong, item: GuruOptionItem }).optional(),
    correctAnswer: z.union([z.number(), z.string()]).optional(),
    tfAnswer: z.union([z.boolean(), z.string(), z.number()]).nullable().optional(),
    correctAnswerText: z.string().optional(),
    altAnswers: z.union([z.string(), z.array(z.string())]).optional(),
    modelAnswer: z.string().optional(),
    explanation: z.string().optional(),
    questionImageUrl: z.string().optional(),
    questionImageFileId: ImageFileId.optional(),
    optionImageFileIds: z.array(ImageFileId).max(4).optional(),
    curriculumChapterId: idOrBlank(QUESTION_MESSAGES.guruChapter),
    curriculumTopicId: idOrBlank(QUESTION_MESSAGES.guruTopic),
    dskpSpId: idOrBlank(QUESTION_MESSAGES.sp),
    scriptType: z.enum(['rumi', 'arab', 'jawi', 'mixed'], QUESTION_MESSAGES.guruScript).optional(),
    parts: z.array(QuestionPartSchema).min(1).optional(),
    tag: QuestionCurriculumTagSchema.optional(),
  })
  .superRefine((v, ctx) => {
    const bad = (path: string, message: string) => ctx.addIssue({ code: 'custom', path: [path], message })
    if (v.questionType === 'mcq') {
      if (v.options === undefined) bad('options', QUESTION_MESSAGES.options)
      if (keyIndex(v.correctAnswer) === undefined) bad('correctAnswer', QUESTION_MESSAGES.correctAnswer)
    } else if (v.questionType === 'true_false') {
      if (!tfValid(v.tfAnswer)) bad('tfAnswer', QUESTION_MESSAGES.guruTf)
    } else if (v.questionType === 'short_answer' || v.questionType === 'fill_blank') {
      const answer = (typeof v.correctAnswerText === 'string' ? v.correctAnswerText : typeof v.correctAnswer === 'string' ? v.correctAnswer : '').trim()
      if (answer === '') bad('correctAnswer', QUESTION_MESSAGES.answerText)
      else if (charLen(answer) > OPTION_MAX) bad('correctAnswer', QUESTION_MESSAGES.guruAnswerLong)
    }
  })
  .meta({ id: 'QuestionGuruCreateRequest' })

/**
 * PUT /guru/questions/:id (own only). MCQ options are `{ id: 0..3, optionText }` with four unique ids.
 * When `options` or `correctOptionId` is sent, both are required (`options`, `correctOptionId` keys);
 * that they apply only to an MCQ is a service rule (the saved type is not in the body).
 */
export const QuestionGuruUpdateRequestSchema = z
  .object({
    questionText: GuruText,
    difficultyLevel: GuruDifficulty.optional(),
    options: optionList({
      long: QUESTION_MESSAGES.guruOptionLong,
      indexed: true,
      item: { type: 'object', required: ['id', 'optionText'], properties: { id: { type: 'integer', minimum: 0, maximum: 3 }, optionText: { type: 'string', minLength: 1, maxLength: 500 } } },
    }).optional(),
    correctOptionId: z.union([z.number(), z.string()]).optional(),
    explanation: z.string().nullable().optional(),
    questionImageFileId: ImageFileId.optional(),
    optionImageFileIds: z.array(ImageFileId).max(4).optional(),
    removeQuestionImage: z.boolean().optional(),
    removeOptionImage: z.array(z.boolean()).max(4).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.options === undefined && v.correctOptionId === undefined) return
    if (v.options === undefined) ctx.addIssue({ code: 'custom', path: ['options'], message: QUESTION_MESSAGES.options })
    if (keyIndex(v.correctOptionId) === undefined) ctx.addIssue({ code: 'custom', path: ['correctOptionId'], message: QUESTION_MESSAGES.correctAnswer })
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
