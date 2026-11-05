import { z } from '../zod'
import { PageQuerySchema } from '../common/envelope'
import { IdSchema } from '../common/ids'
import { TimestampSchema } from '../common/time'
import {
  QUESTION_STATUS_MESSAGE,
  QUESTION_COGNITIVE_LEVELS,
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
  /** [PROPOSED] 409 of every hard delete (admin route, bulk `delete`, Guru route): a paper that is still shown to pupils, or still has sittings, places the question (R1-delete-served-guard). */
  deleteRefused: 'Soalan ini tidak boleh dipadam kerana ia terdapat pada kertas yang masih dipaparkan kepada murid atau yang sedang diduduki.',
  /** [PROPOSED] 409 `in_use` of every hard delete: a teacher's set, a remedial test or a battle still uses the question (a foreign key refuses the delete). */
  deleteInUse: 'Soalan ini sedang digunakan dalam set, ujian pemulihan atau pertandingan dan tidak boleh dipadam.',
  bulkUpdated: (n: number): string => `${String(n)} soalan berjaya dikemaskini.`,
  /** Bulk Terbitkan on a row that is already Diterbitkan (R1E2E-10, Mandor Q16): the row is left as it is and listed in `skipped` with this reason [PROPOSED]. */
  bulkAlreadyApproved: 'Soalan ini sudah diterbitkan.',
  /** `POST /questions/:id/edit-as-draft` (REQ-C-012; V2 flash "Draf baharu #{id} dicipta. ..."). */
  editAsDraft: (id: string): string => `Draf baharu #${id} dicipta. Soalan asal kekal diterbitkan sehingga draf ini diterbitkan.`,
  editAsDraftExists: 'Soalan ini sudah mempunyai draf atau semakan yang belum diterbitkan. Sunting draf itu.',
  editAsDraftNotApproved: 'Hanya soalan yang diterbitkan boleh disunting sebagai draf.',
  bulkNoAction: 'Sila pilih tindakan terlebih dahulu.',
  bulkBadAction: 'Tindakan tidak sah.',
  bulkNoIds: 'Sila pilih sekurang-kurangnya satu soalan.',
  bulkBadIds: 'Senarai soalan tidak sah.',
  /** S1-T01 (API-Q-04): a group-aware bulk action. */
  groupSplit: 'Soalan dalam kumpulan rangsangan mesti dipilih bersama.',
  groupArchivedMember: 'Kumpulan mengandungi soalan diarkibkan.',
  bothIdsAndGroup: 'Pilih soalan atau kumpulan, bukan kedua-duanya.',
  /** Filter-based actions (AC-03.3; V2 A11 "Luluskan Hasil Tapisan" / "Arkib Semua"). */
  filterInvalid: 'Nilai penapis tidak sah.',
  filterNeeded: 'Sila pilih sekurang-kurangnya satu penapis (subjek/aras/status/carian) sebelum meluluskan secara pukal.',
  filterBlank: 'Penapis yang dipilih tidak mempunyai nilai. Isi nilai penapis, atau buang penapis itu.',
  filterCountNeeded: 'Sila hantar bilangan soalan hasil tapisan yang dipaparkan (expectedCount).',
  filterCountChanged: (expected: number, actual: number): string =>
    `Bilangan soalan hasil tapisan telah berubah (dijangka ${String(expected)}, kini ${String(actual)}). Muat semula senarai dan semak semula sebelum meneruskan.`,
  filterApproved: (n: number): string => `Berjaya luluskan ${String(n)} soalan (hasil tapisan) — kini kelihatan kepada pelajar.`,
  /** V2 text of "Arkib Semua" (no filter = the whole bank). */
  filterArchivedAll: (n: number): string => `Berjaya arkib ${String(n)} soalan. Bank pelajar kini kosong — luluskan soalan secara manual untuk memaparkannya semula.`,
  filterArchived: (n: number): string => `Berjaya arkib ${String(n)} soalan (hasil tapisan).`,
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
    /** REQ-C-010: V2 Studio columns "Kertas" and "No.": the kertas ('1' to '3', the trailing digit of the paper code) and the printed number label. */
    kertas: z.enum(['1', '2', '3']).nullable(),
    numberLabel: z.string().nullable(),
    /** R1-H-A7: present only on an `essay_choice` (esei pilihan) question: its 2 to 6 topics. `questionType` stays `essay`. */
    essayTopics: z.array(QuestionEssayTopicSchema).optional(),
  })
  .meta({ id: 'QuestionRow' })

/** Exam type of the source paper ("Jenis", V2 aria "jenis peperiksaan"): the `source_papers.exam_type` set. */
export const QUESTION_JENIS = ['sebenar', 'percubaan', 'modul', 'topikal', 'latihan'] as const

/**
 * The filters of the admin question list, shared by `GET /questions` (query string) and the filter-based bulk action (JSON body),
 * so a filter means the same in both. Unknown values of the older filters match nothing (empty page) except `status`, which is
 * validated (D54a, 422). The four V2 Studio filters (R1-21.5, D79) are closed or shaped values and are validated (422
 * "Nilai penapis tidak sah."): Tahun = year of the source paper, Negeri = state or examining body of the source paper
 * (V2 "negeri atau badan peperiksaan", case-insensitive exact match), Kertas = 1, 2 or 3 (the trailing digit of the paper code,
 * as the paper builder reads it), Jenis = exam type of the source paper.
 */
export const questionFilterShape = {
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
  /** V2 "Tahun": exam year of the source paper, four digits. */
  tahun: z.string({ error: QUESTION_MESSAGES.filterInvalid }).regex(/^\d{4}$/, QUESTION_MESSAGES.filterInvalid).optional(),
  /** V2 "Negeri" ("negeri atau badan peperiksaan"): `source_papers.exam_board`, matched case-insensitively. */
  // A blank value (spaces only, `negeri=%20`) is no filter, like a blank search (T47-L1): it is dropped before the value rules run.
  negeri: z
    .preprocess(
      (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
      z.string({ error: QUESTION_MESSAGES.filterInvalid }).max(64, QUESTION_MESSAGES.filterInvalid).optional(),
    )
    .optional(),
  /** V2 "Kertas" (Kertas 1-3). */
  kertas: z.enum(['1', '2', '3'], QUESTION_MESSAGES.filterInvalid).optional(),
  /** V2 "Jenis" ("jenis peperiksaan"). */
  jenis: z.enum(QUESTION_JENIS, QUESTION_MESSAGES.filterInvalid).optional(),
} as const

export const QuestionListQuerySchema = PageQuerySchema.extend(questionFilterShape).meta({ id: 'QuestionListQuery' })

/** REQ-C-019: the values of the Studio selects that come from data. `negeri` = the distinct `exam_board` of the source papers, sorted. */
export const QuestionFilterOptionsSchema = z.object({ negeri: z.array(z.string()) }).meta({ id: 'QuestionFilterOptions' })

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

/** DM-56 `Rujukan buku teks` (45 T-11): Bab text (at most 20 characters), Tingkatan T1 to T5, Muka surat 1 to 999 and an optional last page. */
export const QUESTION_TEXTBOOK_PAGE_MESSAGE = 'Muka surat mesti nombor antara 1 dan 999.'
export const QuestionTextbookRefSchema = z
  .object({
    bab: z.string().trim().min(1).max(20),
    tingkatan: z.enum(['T1', 'T2', 'T3', 'T4', 'T5']),
    mukaSurat: z.coerce.number({ error: QUESTION_TEXTBOOK_PAGE_MESSAGE }).int(QUESTION_TEXTBOOK_PAGE_MESSAGE).min(1, QUESTION_TEXTBOOK_PAGE_MESSAGE).max(999, QUESTION_TEXTBOOK_PAGE_MESSAGE),
    hingga: z.coerce.number({ error: QUESTION_TEXTBOOK_PAGE_MESSAGE }).int(QUESTION_TEXTBOOK_PAGE_MESSAGE).min(1, QUESTION_TEXTBOOK_PAGE_MESSAGE).max(999, QUESTION_TEXTBOOK_PAGE_MESSAGE).optional(),
  })
  .meta({ id: 'QuestionTextbookRef', description: 'Rujukan buku teks: {bab, tingkatan, mukaSurat, hingga?} (DM-56).' })
export type QuestionTextbookRef = z.infer<typeof QuestionTextbookRefSchema>

/** The compact form of a textbook reference shown in the scheme panel: `B3T4 M56`, or `B3T4 M56-58` when it spans pages. */
export function textbookRefCompact(ref: QuestionTextbookRef): string {
  return `B${ref.bab}${ref.tingkatan} M${ref.mukaSurat}${ref.hingga === undefined ? '' : `-${ref.hingga}`}`
}

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
    /** DM-56 Rujukan buku teks (null = none). */
    textbookRef: QuestionTextbookRefSchema.nullable().optional(),
    /** DM-58: why an admin sent the question back from Semakan to Draf; with the status `draft` it is the chip "Ditolak". Null otherwise. */
    rejectionReason: z.string().nullable().optional(),
  })
  .meta({ id: 'Question' })

const DskpRef = z.object({ id: IdSchema, code: z.string(), description: z.string() })
/** R1-T45b (PIPE AC-04.4): one place where the question sits on a curated paper. */
export const QUESTION_PLACEMENT_STATUSES = ['draft', 'ready', 'published', 'withdrawn'] as const
export const QuestionPlacementSchema = z
  .object({
    paperId: IdSchema,
    title: z.string(),
    status: z.enum(QUESTION_PLACEMENT_STATUSES),
    section: z.string().meta({ description: 'Label of the section (Bahagian) that places the question.' }),
    versionNo: z.number().int().min(1).meta({ description: 'The question version printed on the paper (pinned); a published paper keeps it when the question is archived or edited.' }),
  })
  .meta({ id: 'QuestionPlacement' })
export type QuestionPlacement = z.infer<typeof QuestionPlacementSchema>


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
    /**
     * R1-T45b (PIPE AC-04.4), Admin Pusat detail only: the curated papers (Pilihan) that place this question, any status (draft, ready,
     * published, withdrawn) and any pinned version, published first. Read before editing or archiving: a published paper keeps its frozen snapshot.
     */
    placements: z.array(QuestionPlacementSchema).optional(),
    /** Generated (Jana) papers that place the question; they are counted, not listed. */
    generatedPaperCount: z.number().int().min(0).optional(),
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
  /** DM-56 Rujukan buku teks; null clears it, omitted keeps it. */
  textbookRef: QuestionTextbookRefSchema.nullable().optional(),
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

/**
 * S1-T01 (API-Q-04): the group form of the bulk action: every member of one stimulus group goes together (draft or review only).
 * `POST /questions/bulk-action` takes either this or `QuestionBulkRequest`; the "ids and groupId together" refusal
 * (`QUESTION_MESSAGES.bothIdsAndGroup`) is enforced by the backend parser, not here.
 */
export const QuestionBulkGroupRequestSchema = z
  .strictObject({
    action: z.enum(['draft', 'review'], { error: QUESTION_MESSAGES.bulkBadAction }),
    groupId: IdSchema,
  })
  .meta({ id: 'QuestionBulkGroupRequest' })

/** `POST /questions/:id/edit-as-draft`: the new draft is version `versionNo` of the same question; the live version keeps serving. */
export const QuestionEditAsDraftResultSchema = z.object({ id: IdSchema, versionNo: z.number().int().min(2) }).meta({ id: 'QuestionEditAsDraftResult' })

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
/** A row a bulk action left as it was because it is already in the target status (R1E2E-10): not a refusal, not an error. */
export const QuestionBulkSkippedSchema = z
  .object({
    id: IdSchema,
    reason: z.string().meta({ description: 'The BM text for this id: "Soalan ini sudah diterbitkan." [PROPOSED].' }),
  })
  .meta({ id: 'QuestionBulkSkipped' })
export type QuestionBulkSkipped = z.infer<typeof QuestionBulkSkippedSchema>
export const QuestionBulkResultSchema = z
  .object({
    affected: z.number().int().min(0),
    failed: z
      .array(QuestionBulkFailureSchema)
      .default([])
      .meta({ description: 'One entry per unique requested id that was refused, in request order; `[]` when none was. Real refusals only (not found, a transition not allowed, a gate); rows already in the target status are in `skipped`.' }),
    skipped: z
      .array(QuestionBulkSkippedSchema)
      .optional()
      .meta({ description: 'Rows already in the target status (bulk Terbitkan only); not applied, not counted in affected. Present only when there is at least one such row.' }),
  })
  .meta({ id: 'QuestionBulkResult' })

/**
 * `POST /questions/bulk-action/filter` (AC-03.3; V2 "Luluskan Hasil Tapisan" and "Arkib Semua"): the action applies to the rows of the
 * CURRENT FILTER, not to an id list. Strict: an unknown key, in the body or in `filter`, is 422. `filter` is the same filter as the
 * list, without paging. `expectedCount` is the total the client showed for that filter; if the count is not the same when the request
 * runs, nothing is applied and the answer is 409 (a stale filter cannot approve rows the admin never saw). `dryRun: true` only counts
 * (`expectedCount` is then optional). `approved` needs at least one filter (V2); `archived` with an empty filter is "Arkib Semua".
 */
export const QuestionFilterSchema = z.strictObject(questionFilterShape).meta({ id: 'QuestionFilter' })
export type QuestionFilter = z.infer<typeof QuestionFilterSchema>
export const QUESTION_FILTER_ACTIONS = ['approved', 'archived'] as const
export const QuestionFilterBulkRequestSchema = z
  .strictObject({
    action: z.enum(QUESTION_FILTER_ACTIONS, { error: QUESTION_MESSAGES.bulkBadAction }),
    filter: QuestionFilterSchema,
    expectedCount: z.number({ error: QUESTION_MESSAGES.filterCountNeeded }).int(QUESTION_MESSAGES.filterCountNeeded).min(0, QUESTION_MESSAGES.filterCountNeeded).optional(),
    dryRun: z.boolean().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.expectedCount === undefined && v.dryRun !== true) ctx.addIssue({ code: 'custom', path: ['expectedCount'], message: QUESTION_MESSAGES.filterCountNeeded })
    // A blank string is not a filter (the server drops a blank search): `{ search: '   ' }` would otherwise approve the whole bank (T47-L1).
    if (v.action === 'approved' && Object.values(v.filter).every((x) => x === undefined || (typeof x === 'string' && x.trim() === ''))) ctx.addIssue({ code: 'custom', path: ['filter'], message: QUESTION_MESSAGES.filterNeeded })
  })
  .meta({ id: 'QuestionFilterBulkRequest' })

export const QuestionFilterBulkResultSchema = z
  .object({
    matched: z.number().int().min(0).meta({ description: 'Rows of the filter (the total the list shows); compared with `expectedCount`.' }),
    eligible: z.number().int().min(0).meta({ description: 'Matched rows whose status allows the action (approved: Semakan; archived: Draf, Semakan, Diterbitkan).' }),
    skipped: z.number().int().min(0).meta({ description: 'matched - eligible (rows already in, or not allowed to move to, the target status), plus the rows another request approved after the count was taken and before this run reached them (bulk Terbitkan only; counted in `processed` but not in `affected` or `failed`). Left untouched, not failures.' }),
    cap: z.number().int().min(1).meta({ description: 'Rows one run applies at most.' }),
    processed: z.number().int().min(0).meta({ description: 'Rows tried in this run: min(eligible, cap); 0 on a dry run. Includes the rows that were then skipped because they were already Diterbitkan.' }),
    affected: z.number().int().min(0),
    failed: z.array(QuestionBulkFailureSchema).meta({ description: 'Rows tried and refused (the full approve gate: VALIDATION_ERROR with the gate `fields`), same shape as bulk-action.' }),
    remaining: z.number().int().min(0).meta({ description: 'eligible - processed: rows a further run would still try.' }),
    capped: z.boolean().meta({ description: 'true when `remaining` > 0 because of the cap.' }),
    dryRun: z.boolean(),
  })
  .meta({ id: 'QuestionFilterBulkResult' })

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

/**
 * S6-T06 (API-GUR-18, R1 decision D113, L-6): a teacher's single-MCQ submission is an intake item of an `intake_batches` row with
 * `source = 'guru'`, not a question row. These are the BM texts of the form 44-F1 (docs/prd/r1/20-guru-admin-sekolah.md) and of the shared
 * conditional DSKP rule (D112), so the screen and the server show the same strings. Messages of the CSV import are in question-workflow.
 */
export const GURU_QUESTION_MESSAGES = {
  level: 'Sila pilih tingkatan.',
  subject: 'Sila pilih subjek.',
  chapter: 'Sila pilih bab.',
  chapterInvalid: 'Bab tidak sah.',
  chapterMismatch: 'Bab tidak sepadan dengan subjek dan tingkatan.',
  sp: 'Sila pilih Standard Pembelajaran (SP).',
  spInvalid: 'SP tidak sah.',
  spMax: 'Satu soalan boleh mempunyai 1 hingga 3 SP sahaja.',
  tp: 'Sila pilih TP.',
  tpRange: 'Tahap Penguasaan (TP) mesti antara 1 dan 6.',
  cognitive: 'Sila pilih aras pemikiran.',
  difficulty: 'Sila pilih kesukaran.',
  type: 'Jenis soalan tidak sah.',
  text: 'Sila isi soalan.',
  textLong: 'Soalan tidak boleh melebihi 2000 aksara.',
  options: 'Sila isi semua pilihan jawapan.',
  option: (letter: string): string => `Sila isi pilihan ${letter}.`,
  optionLong: (letter: string): string => `Pilihan ${letter} tidak boleh melebihi 500 aksara.`,
  correct: 'Sila tanda satu jawapan yang betul.',
  explanationLong: 'Penerangan tidak boleh melebihi 2000 aksara.',
  /** Success text of the create (the screen shows it as the toast). */
  submitted: 'Soalan dihantar untuk semakan.',
  /** 409 of an edit or delete of an item that is no longer open to the teacher. */
  locked: 'Soalan ini sudah diterima atau diluluskan dan tidak boleh diubah.',
} as const

/** The teacher-facing state of a submission item (OPT-KIRIMAN-STATUS): review, approved, draft (returned). */
export const GURU_SUBMISSION_STATUSES = ['pending', 'approved', 'rejected'] as const
export const GuruSubmissionStatusSchema = z.enum(GURU_SUBMISSION_STATUSES).meta({ id: 'GuruSubmissionStatus' })
export type GuruSubmissionStatus = z.infer<typeof GuruSubmissionStatusSchema>
export const GURU_SUBMISSION_STATUS_LABELS: Readonly<Record<GuruSubmissionStatus, string>> = {
  pending: 'Menunggu Semakan',
  approved: 'Diluluskan',
  rejected: 'Ditolak',
}

/** The inputs of the shared conditional DSKP rule (D112) of a teacher submission. */
export interface GuruDskpInput {
  chapterId?: string | null | undefined
  spIds?: readonly string[] | null | undefined
  tp?: number | null | undefined
  cognitiveLevel?: string | null | undefined
}

/** What the Subjek + Tingkatan has: active chapters (Bab required) and DSKP nodes (SP, TP and Aras required). */
export interface GuruDskpFacts {
  hasChapters: boolean
  hasDskpNodes: boolean
}

/**
 * The conditional DSKP rule of 44-F1 / FR-GUR-44-9 as one pure function (API-GUR-18 now, API-GUR-24 later): Bab is required only where the
 * Subjek + Tingkatan has active chapters; SP (at least one), TP (1 to 6) and Aras only where it has DSKP nodes. Returns the `fields` map of the
 * 422 (empty when the input passes). A value that is sent but out of range is refused whether or not it is required.
 */
export function guruDskpFields(input: GuruDskpInput, facts: GuruDskpFacts): Record<string, string> {
  const fields: Record<string, string> = {}
  const M = GURU_QUESTION_MESSAGES
  if (facts.hasChapters && (input.chapterId === undefined || input.chapterId === null || input.chapterId === '')) fields.chapterId = M.chapter
  const sp = input.spIds ?? []
  if (facts.hasDskpNodes && sp.length === 0) fields.spIds = M.sp
  if (input.tp === undefined || input.tp === null) {
    if (facts.hasDskpNodes) fields.tp = M.tp
  } else if (!Number.isInteger(input.tp) || input.tp < 1 || input.tp > 6) fields.tp = M.tpRange
  if (facts.hasDskpNodes && (input.cognitiveLevel === undefined || input.cognitiveLevel === null || input.cognitiveLevel === '')) fields.cognitiveLevel = M.cognitive
  return fields
}

/** MCQ key: index 0..3, a digit string, or a letter A to D. */
const keyIndex = (v: unknown): number | undefined => {
  if (typeof v === 'number') return Number.isInteger(v) && v >= 0 && v <= 3 ? v : undefined
  if (typeof v !== 'string') return undefined
  const t = v.trim().toUpperCase()
  if (/^\d+$/.test(t)) return Number(t) <= 3 ? Number(t) : undefined
  return /^[A-D]$/.test(t) ? t.charCodeAt(0) - 65 : undefined
}

/** The index 0..3 of a submitted MCQ key (a number, a digit string or a letter A to D), or undefined. */
export const guruKeyIndex = keyIndex

const GURU_OPTION_MAX = 500
const GuruId = (message: string) => z.string({ error: message }).trim().min(1, message).max(64, message)
const guruLetter = (i: number): string => String.fromCharCode(65 + i)
const guruOptionText = (v: unknown): string => {
  if (typeof v === 'string') return v.trim()
  if (typeof v === 'object' && v !== null) {
    const o = v as { text?: unknown; optionText?: unknown }
    return (typeof o.optionText === 'string' ? o.optionText : typeof o.text === 'string' ? o.text : '').trim()
  }
  return ''
}

/** The four option texts in A to D order; items that all carry a unique numeric `id` 0..3 (the edit form) are placed by it. */
export function guruOptionTexts(options: readonly unknown[]): string[] {
  const ids = options.map((e) => (typeof e === 'object' && e !== null ? (e as { id?: unknown }).id : undefined))
  const placed = options.length === 4 && ids.every((i) => typeof i === 'number' && Number.isInteger(i) && i >= 0 && i <= 3) && new Set(ids).size === 4
  const ordered = placed ? [...options].sort((a, b) => Number((a as { id: number }).id) - Number((b as { id: number }).id)) : options
  return ordered.map(guruOptionText)
}

/**
 * Body of POST /guru/questions and of PUT /guru/questions/:id (the same form edits, 44-F1). MCQ only: `questionType` is `mcq` (any other value
 * is 422); exactly four options A to D (strings, `{ text }` or `{ optionText }` items) and one correct answer (`correctAnswer` or its alias
 * `correctOptionId`: index 0..3 or a letter A to D). `difficultyLevel` is the typed 1 to 5 Kesukaran (required; the words easy/medium/hard are
 * no longer accepted) and is separate from `tp`. `spIds` holds 1 to 3 SP ids. The conditional DSKP rule (Bab, SP, TP, Aras required only where
 * the Subjek + Tingkatan has chapters or DSKP nodes) is a service rule, `guruDskpFields`.
 * 422 `fields` keys: subjectId, educationLevelId, chapterId, spIds, tp, cognitiveLevel, difficultyLevel, questionType, questionText, options,
 * correctAnswer, explanation.
 */
const guruBody = () =>
  z
  .object({
    subjectId: GuruId(GURU_QUESTION_MESSAGES.subject),
    educationLevelId: GuruId(GURU_QUESTION_MESSAGES.level),
    chapterId: z.string({ error: GURU_QUESTION_MESSAGES.chapterInvalid }).max(64, GURU_QUESTION_MESSAGES.chapterInvalid).nullable().optional(),
    spIds: z
      .array(z.string({ error: GURU_QUESTION_MESSAGES.spInvalid }).min(1, GURU_QUESTION_MESSAGES.spInvalid).max(64, GURU_QUESTION_MESSAGES.spInvalid), { error: GURU_QUESTION_MESSAGES.spInvalid })
      .max(3, GURU_QUESTION_MESSAGES.spMax)
      .nullable()
      .optional(),
    tp: z.number({ error: GURU_QUESTION_MESSAGES.tpRange }).int(GURU_QUESTION_MESSAGES.tpRange).min(1, GURU_QUESTION_MESSAGES.tpRange).max(6, GURU_QUESTION_MESSAGES.tpRange).nullable().optional(),
    cognitiveLevel: z.enum(QUESTION_COGNITIVE_LEVELS, { error: GURU_QUESTION_MESSAGES.cognitive }).nullable().optional(),
    difficultyLevel: z.coerce
      .number({ error: GURU_QUESTION_MESSAGES.difficulty })
      .int(GURU_QUESTION_MESSAGES.difficulty)
      .min(1, GURU_QUESTION_MESSAGES.difficulty)
      .max(5, GURU_QUESTION_MESSAGES.difficulty),
    questionType: z.literal('mcq', { error: GURU_QUESTION_MESSAGES.type }).default('mcq'),
    questionText: z.string({ error: GURU_QUESTION_MESSAGES.text }).trim().min(1, GURU_QUESTION_MESSAGES.text).max(2000, GURU_QUESTION_MESSAGES.textLong),
    options: z.array(z.unknown(), { error: GURU_QUESTION_MESSAGES.options }).meta({ type: 'array', minItems: 4, maxItems: 4, items: { type: 'string' } }),
    correctAnswer: z.union([z.number(), z.string()]).optional(),
    correctOptionId: z.union([z.number(), z.string()]).optional(),
    explanation: z.string({ error: GURU_QUESTION_MESSAGES.explanationLong }).max(2000, GURU_QUESTION_MESSAGES.explanationLong).nullable().optional(),
  })
  .superRefine((v, ctx) => {
    const bad = (path: string, message: string) => ctx.addIssue({ code: 'custom', path: [path], message })
    if (v.options.length !== 4) bad('options', GURU_QUESTION_MESSAGES.options)
    else {
      const texts = guruOptionTexts(v.options)
      const empty = texts.findIndex((t) => t === '')
      const long = texts.findIndex((t) => charLen(t) > GURU_OPTION_MAX)
      if (empty >= 0) bad('options', GURU_QUESTION_MESSAGES.option(guruLetter(empty)))
      else if (long >= 0) bad('options', GURU_QUESTION_MESSAGES.optionLong(guruLetter(long)))
    }
    if (keyIndex(v.correctAnswer ?? v.correctOptionId) === undefined) bad('correctAnswer', GURU_QUESTION_MESSAGES.correct)
  })
export const QuestionGuruCreateRequestSchema = guruBody().meta({ id: 'QuestionGuruCreateRequest' })
export type QuestionGuruCreateRequest = z.output<typeof QuestionGuruCreateRequestSchema>

/** PUT /guru/questions/:id: the same form and rules as the create (the edit form sends every field); only a pending or returned own item. */
export const QuestionGuruUpdateRequestSchema = guruBody().meta({ id: 'QuestionGuruUpdateRequest' })

/** Owner-only views of a teacher's submissions: `id` is the intake item id (API-GUR-18). */
export const QuestionGuruSummarySchema = z
  .object({
    id: IdSchema,
    questionType: z.literal('mcq'),
    questionText: z.string(),
    subjectId: IdSchema.nullable(),
    subjectName: z.string(),
    educationLevelId: IdSchema.nullable(),
    levelName: z.string(),
    difficultyLevel: Difficulty,
    difficultyLabel: z.string(),
    dskpTagged: z.boolean(),
    status: GuruSubmissionStatusSchema,
    /** BM label of the status: Menunggu Semakan, Diluluskan, Ditolak. */
    statusLabel: z.string(),
    /** The admin's reason ("Sebab: {reason}") while `status` is `rejected`, else null. */
    rejectionReason: z.string().nullable(),
    /** True while the teacher may edit or delete the item (not yet accepted by the admin); the screen shows Edit and Padam from it. */
    editable: z.boolean(),
    options: z.array(z.string()),
    correctAnswer: z.number().int().min(0).max(3),
    explanation: z.string().nullable(),
    createdAt: TimestampSchema,
  })
  .meta({ id: 'QuestionGuruSummary' })

export const QuestionGuruDetailSchema = QuestionGuruSummarySchema.extend({
  chapterId: IdSchema.nullable(),
  spIds: z.array(IdSchema),
  tp: z.number().int().min(1).max(6).nullable(),
  cognitiveLevel: QuestionCognitiveLevelSchema.nullable(),
}).meta({ id: 'QuestionGuruDetail' })

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
