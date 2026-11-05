import { z } from '../zod'
import { IdSchema } from '../common/ids'

/**
 * v2 question model (docs/requirements/v2-exam-schema.md D1 to D4, D6, D9, D12; BE-09 card AC 1 to 3
 * and 12). A question is an ordered tree of parts (depth at most 3: (a), (i), (A)); only LEAF parts
 * carry marks, an answer mode and an answer key. The key kind must match the mode (discriminated
 * unions). Keys live only in the admin/editor schemas: the student-facing projection below omits them.
 */

/** D12 / D54(a) as amended by ADR-0027: the only lifecycle codes on the wire; `approved` is the only servable one. BM labels (UI only): Draf, Semakan, Diterbitkan, Diarkib. */
export const QUESTION_STATUSES = ['draft', 'review', 'approved', 'archived'] as const
export const QUESTION_STATUS_MESSAGE = 'Status tidak sah.'
export const QuestionStatusSchema = z.enum(QUESTION_STATUSES, QUESTION_STATUS_MESSAGE).meta({ id: 'QuestionStatus' })
export type QuestionStatus = z.infer<typeof QuestionStatusSchema>

/** Rich text `{ ms, en? }` (D2); LaTeX/MathML allowed inside the strings. */
export const QuestionRichTextSchema = z
  .object({ ms: z.string().min(1), en: z.string().optional() })
  .meta({ id: 'QuestionRichText' })

export const QUESTION_LEAF_MODES = [
  'mcq',
  'match_letter',
  'short_text',
  'numeric',
  'working',
  'essay',
  'drawing',
  'table_fill',
  /** R1-T07 (V2 `essay_choice`, 31 approved parts): the pupil picks one of 2 to 6 topics, then writes an essay marked like `essay`. */
  'essay_choice',
  /** BE-42 (M07 PKSK): 0 or 2 to 6 options, any number of correct labels. Valid only on a question tagged `pksk_domain`. */
  'pksk_choice',
] as const
export const QuestionLeafModeSchema = z.enum(QUESTION_LEAF_MODES).meta({ id: 'QuestionLeafMode' })

const OptionLabel = z.string().regex(/^[A-H]$/, 'Label pilihan mesti A hingga H.')
const Marks = z.number().int().min(0)
/** 45:452 L-04. */
const MARKS_MIN_MESSAGE = 'Nilai mata mesti sekurang-kurangnya 1.'
const MARKS_MAX_MESSAGE = 'Markah bahagian tidak boleh melebihi 100.'
/** 45:463. */
const MCQ_OPTIONS_MESSAGE = 'Soalan aneka pilihan mesti ada 2 hingga 8 pilihan.'
const MCQ_MULTI_COUNT_MESSAGE = 'Pilih sekurang-kurangnya satu jawapan betul dan sekurang-kurangnya satu jawapan salah.'
/** 45:475. */
const ESSAY_CHOICE_COUNT_MESSAGE = 'Esei pilihan mesti mempunyai 2 hingga 6 topik.'
/** 45:481 / DM-55: 1..100, or 0 on an example leaf; enforced by `refineLeaf(true)` on the write path only (no schema bound: oasdiff). */
const LeafMarks = z.number().int().min(0)

export const QuestionOptionSchema = z
  .object({
    label: OptionLabel,
    body: QuestionRichTextSchema,
    /** Reference from the file store (BE-04); never a client-supplied URL. */
    imageId: IdSchema.nullable().optional(),
  })
  .meta({ id: 'QuestionOption' })

/** D4.2: one marking point. `code` is the closed list K N P B M F C; marks are explicit. */
export const QUESTION_POINT_CODES = ['K', 'N', 'P', 'B', 'M', 'F', 'C'] as const
export const QuestionMarkPointSchema = z
  .object({
    id: z.string().min(1),
    code: z.enum(QUESTION_POINT_CODES),
    label: z.string().min(1),
    marks: Marks,
    text: QuestionRichTextSchema.optional(),
    accept: z.array(z.string()).optional(),
    allOf: z.array(z.string()).optional(),
    seen: z.boolean().optional(),
    impliedOk: z.boolean().optional(),
    requires: z.array(z.string()).optional(),
    ecf: z
      .object({
        fromPart: z.string().min(1),
        rule: z.discriminatedUnion('op', [
          z.object({ op: z.literal('same') }),
          z.object({ op: z.enum(['sub_from', 'add', 'mul']), k: z.number() }),
        ]),
      })
      .optional(),
    unit: z.object({ value: z.string(), alt: z.array(z.string()).optional(), mandatory: z.boolean() }).optional(),
    tolerance: z.object({ kind: z.enum(['abs', 'rel']), value: z.number().nonnegative() }).optional(),
    sigFigs: z.number().int().min(1).nullable().optional(),
    decimals: z.number().int().min(0).nullable().optional(),
    note: z.string().optional(),
  })
  .meta({ id: 'QuestionMarkPoint' })

const PointsKeyV1Base = z.object({
  kind: z.literal('points'),
  /** Absent = scheme v1 (D2). `scheme_v: 2` selects the 45 section 7 shape. */
  scheme_v: z.number().optional(),
  marks: Marks,
  points: z.array(QuestionMarkPointSchema).min(1),
  /** "[mana-mana n x k m]": at most `anyN` of `pointIds` count. */
  groups: z
    .array(z.object({ id: z.string(), anyN: z.number().int().min(1), eachMarks: Marks.optional(), pointIds: z.array(z.string()).min(1) }))
    .optional(),
  /** "Alternatif A/B": mark the best path, never add paths. */
  paths: z.array(z.object({ id: z.string(), pointIds: z.array(z.string()).min(1) })).optional(),
  final: z
    .object({
      display: z.string(),
      accept: z.array(z.string()).min(1),
      tolerance: z.number().nonnegative().optional(),
      unit: z.string().optional(),
      mustContain: z.string().optional(),
    })
    .optional(),
  deductions: z
    .array(z.object({ code: z.enum(['spelling', 'unit', 'sf', 'dp', 'copy']), amount: Marks, cap: Marks.optional() }))
    .optional(),
  modelText: z.string().optional(),
})

const RubricKeyV1Base = z.object({
  kind: z.literal('rubric'),
  scheme_v: z.number().optional(),
  marks: Marks,
  criteria: z.array(z.object({ id: z.string(), name: z.string() })).min(1),
  bands: z
    .array(z.object({ name: z.string(), range: z.tuple([Marks, Marks]), descriptors: z.record(z.string(), z.string()).optional() }))
    .min(1),
  floorBand: z.object({ name: z.string(), range: z.tuple([Marks, Marks]) }).optional(),
  notes: z.array(z.string()).optional(),
})
/** Write-path variants: a v1 key must not carry `scheme_v` (SCHEME_VERSION_MISMATCH, no PRD text). The read path (Base) never tightens. */
const noSchemeV = { path: ['scheme_v'], message: 'SCHEME_VERSION_MISMATCH' }
const PointsKeyV1 = PointsKeyV1Base.refine((k) => k.scheme_v === undefined, noSchemeV)
const RubricKeyV1 = RubricKeyV1Base.refine((k) => k.scheme_v === undefined, noSchemeV)



/* -------------------------------------------------------------------------------------------------
 * Scheme v2 (S1-T09a, DM-54; D1 and D2 of issue 558). Selected by `scheme_v: 2` on the key. Field names are those of
 * 45-question-authoring-flow.md section 7.0 (lines 984-1005, normative); a v2 object is strict so a v1 spelling
 * (`final`, `impliedOk`) is rejected instead of silently dropped. No stored row is rewritten.
 * ------------------------------------------------------------------------------------------------- */

/** 45:1001: the closed deduction / zero-rule code list. `zeroIf.code` reuses it (D1). */
export const QUESTION_DEDUCTION_CODES = ['spelling', 'punctuation', 'grammar', 'unit', 'sf', 'dp', 'copy', 'other'] as const
export const QuestionDeductionCodeSchema = z.enum(QUESTION_DEDUCTION_CODES).meta({ id: 'QuestionDeductionCode' })
export const QUESTION_DEDUCTION_SCOPES = ['question', 'part'] as const

/** 45:1001: `{code, amount, cap?, scope, label?}`; `label` is required when `code` is `other`. */
const DeductionV2 = z
  .strictObject({
    code: QuestionDeductionCodeSchema,
    amount: z.number().int().min(1),
    cap: z.number().int().min(1).optional(),
    scope: z.enum(QUESTION_DEDUCTION_SCOPES),
    label: z.string().trim().min(1).max(200).optional(),
  })
  .refine((d) => d.code !== 'other' || !!d.label, { path: ['label'], message: 'DEDUCTION_LABEL_REQUIRED' })
/** 45:1001: `{code, label}`. */
const ZeroIfV2 = z.strictObject({ code: QuestionDeductionCodeSchema, label: z.string().trim().min(1).max(200) })
export const QuestionSchemeRulesSchema = z
  .strictObject({ deductions: z.array(DeductionV2).optional(), zeroIf: z.array(ZeroIfV2).optional() })
  .meta({ id: 'QuestionSchemeRules' })

/** 45:995: a v2 marking point. `id` unique per leaf; `label` at most 200; `marks` integer >= 0. */
const PointV2 = z.strictObject({
  id: z.string().min(1),
  code: z.enum(QUESTION_POINT_CODES),
  label: z.string().min(1).max(200),
  marks: Marks,
  text: QuestionRichTextSchema.optional(),
  accept: z.array(z.string()).optional(),
  allOf: z.array(z.string()).optional(),
  seen: z.boolean().optional(),
  implied: z.boolean().optional(),
  requires: z.array(z.string()).optional(),
  notAccepted: z.array(z.string()).optional(),
  unit: z.strictObject({ value: z.string(), mandatory: z.boolean(), alt: z.array(z.string()).optional() }).optional(),
  tol: z.number().nonnegative().optional(),
  tolKind: z.enum(['abs', 'rel']).optional(),
  sf: z.number().int().min(1).optional(),
  dp: z.number().int().min(0).optional(),
  ecf: z
    .strictObject({
      fromPart: z.string().min(1),
      rule: z.discriminatedUnion('op', [
        z.strictObject({ op: z.literal('same') }),
        z.strictObject({ op: z.literal('scale'), factor: z.number() }),
      ]),
    })
    .optional(),
  note: z.string().optional(),
})
/** 45: `type: "pair"` = the second point counts only with the first; `anyN` = any N of the points; `cap` = max marks of the group. */
const GroupV2 = z.strictObject({
  id: z.string().min(1),
  pointIds: z.array(z.string()).min(1),
  type: z.literal('pair').optional(),
  anyN: z.number().int().min(1).optional(),
  eachMarks: Marks.optional(),
  cap: Marks.optional(),
})
const pointsV2Shape = {
  points: z.array(PointV2).min(1),
  groups: z.array(GroupV2).optional(),
  /** Awarded when every point outside the bonus is hit. */
  bonus: z.strictObject({ ifAllCorrect: z.literal(true), marks: z.number().int().min(1), label: z.string().min(1) }).optional(),
  /** `+ Kaedah alternatif` (ATAU): the best single alternative counts, never their sum. */
  alternatives: z.array(z.strictObject({ id: z.string().min(1), name: z.string().min(1), pointIds: z.array(z.string()).min(1) })).optional(),
  /** "P2,1,0": `marks` lists the mark for n correct, n-1, ..., 0. */
  countMarks: z.strictObject({ items: z.number().int().min(1), marks: z.array(Marks).min(1) }).optional(),
  finalAnswer: z
    .strictObject({
      display: z.string(),
      accepted: z.array(z.string()).min(1),
      tol: z.number().nonnegative().optional(),
      tolKind: z.enum(['abs', 'rel']).optional(),
      unit: z.string().optional(),
    })
    .optional(),
  modelText: QuestionRichTextSchema.optional(),
  modelImageId: IdSchema.optional(),
  /** Staff only; the reveal routes strip it. */
  guidance: QuestionRichTextSchema.optional(),
  deductions: z.array(DeductionV2).optional(),
  zeroIf: z.array(ZeroIfV2).optional(),
}
const PointsKeyV2 = z.strictObject({ kind: z.literal('points'), scheme_v: z.literal(2), marks: Marks, ...pointsV2Shape })

const BandRangeV2 = z.tuple([Marks, Marks]).refine(([lo, hi]) => lo <= hi, { message: 'BAND_RANGE_INVALID' })
const RubricKeyV2 = z
  .strictObject({
    kind: z.literal('rubric'),
    scheme_v: z.literal(2),
    marks: Marks,
    /** `"overall"` (default) or `"perCriterion"`. */
    scoring: z.enum(['overall', 'perCriterion']).default('overall'),
    criteria: z.array(z.strictObject({ id: z.string().min(1), name: z.string().min(1), max: Marks.optional() })).min(1),
    bands: z
      .array(
        z.strictObject({
          name: z.string().min(1),
          range: BandRangeV2,
          descriptors: z.record(z.string(), z.string()).optional(),
          sub: z.array(z.strictObject({ name: z.string().min(1), range: BandRangeV2 })).optional(),
        }),
      )
      .min(1),
    floorBand: z.strictObject({ name: z.string().min(1), range: BandRangeV2 }).optional(),
    /** A `points` key without `marks`. */
    contentPoints: z.strictObject(pointsV2Shape).optional(),
    modelText: QuestionRichTextSchema.optional(),
    guidance: QuestionRichTextSchema.optional(),
    deductions: z.array(DeductionV2).optional(),
    zeroIf: z.array(ZeroIfV2).optional(),
  })
  .refine((k) => k.scoring !== 'perCriterion' || k.criteria.every((c) => c.max !== undefined), {
    path: ['criteria'],
    message: 'CRITERION_MAX_REQUIRED',
  })

const PointsKey = z.union([PointsKeyV1, PointsKeyV2])
const RubricOrPointsKey = z.union([RubricKeyV1, RubricKeyV2, PointsKeyV1, PointsKeyV2])

/** 45:1005: `correct` (label), `accepted?` (extra accepted labels (45:463; may include `correct`); D7 the option id is its label), `note?` (Nota kunci). */
const OptionKey = z.object({
  kind: z.literal('option'),
  correct: OptionLabel,
  accepted: z.array(OptionLabel).min(1).max(8).optional(),
  /** No length limit in the PRD; 500 is this contract's choice. */
  note: z.string().max(500).optional(),
})
/** D7 / DM-69: `mcq_multi` key. Ids are option labels; 1..n-1 correct (checked on the leaf). */
const McqMultiKey = z.object({
  kind: z.literal('options'),
  correctOptionIds: z.array(OptionLabel).min(1, MCQ_MULTI_COUNT_MESSAGE),
  note: z.string().max(500).optional(),
})
/** BE-42: several or no correct label (PKSK, BR-M07-04). Not used by any other mode. */
const OptionsKey = z.object({ kind: z.literal('options'), correct: z.array(OptionLabel).max(6) })
const MappingKey = z.object({ kind: z.literal('mapping'), map: z.record(z.string(), OptionLabel), bankUnique: z.boolean().optional() })
const CellsKey = z.object({ kind: z.literal('mapping'), cells: z.record(z.string(), z.array(z.string()).min(1)) })
const AcceptedTextKey = z.object({
  kind: z.literal('accepted'),
  values: z.array(z.string().min(1)).min(1),
  caseSensitive: z.boolean().optional(),
  anyOrder: z.boolean().optional(),
})
const AcceptedNumericKey = z.object({
  kind: z.literal('accepted'),
  values: z
    .array(
      z.object({
        v: z.number(),
        tol: z.number().nonnegative().optional(),
        tolKind: z.enum(['abs', 'rel']).optional(),
        unit: z.string().optional(),
        unitAlt: z.array(z.string()).optional(),
        sigFigs: z.number().int().min(1).nullable().optional(),
        decimals: z.number().int().min(0).nullable().optional(),
      }),
    )
    .min(1),
})

/**
 * BJS-06 (v2-bijak-spm-standards 3.1, 6): optional per-leaf overrides. Absent or null means "inherit the question
 * version's value" (effective = coalesce(part, version)); the question TP and the marks per unit are computed from
 * the effective leaf values, never stored. KBAT is the DSKP field (14.1 R-1, A9); the 1..6 cognitive level is not on the wire.
 */
export const QUESTION_KBAT_LEVELS = ['mengaplikasi', 'menganalisis', 'menilai', 'mencipta'] as const
export const QuestionKbatLevelSchema = z.enum(QUESTION_KBAT_LEVELS).meta({ id: 'QuestionKbatLevel' })
/**
 * R1-B05 (ADR-0031, D76, D83 D-4): the cognitive level of a leaf (Taksonomi Bloom). The four upper levels are KBAT. Mandatory per leaf at
 * the new approval of an SPM-bound question (Tingkatan 4/5 of an SPM subject); drafts and legacy questions may leave it unset.
 */
export const QUESTION_COGNITIVE_LEVELS = ['mengingat', 'memahami', 'mengaplikasi', 'menganalisis', 'menilai', 'mencipta'] as const
export const QuestionCognitiveLevelSchema = z.enum(QUESTION_COGNITIVE_LEVELS).meta({ id: 'QuestionCognitiveLevel' })
export type QuestionCognitiveLevel = z.infer<typeof QuestionCognitiveLevelSchema>
const leafCurriculum = {
  /** Cognitive level of the leaf; absent or null = not set. Sending only this also settles `kbat` (the four upper levels are KBAT). */
  cognitiveLevel: QuestionCognitiveLevelSchema.nullable().optional(),
  /** The four KBAT levels, or 'bukan' (explicitly not KBAT: overrides a KBAT question). Absent or null = inherit. */
  kbat: z.enum([...QUESTION_KBAT_LEVELS, 'bukan']).nullable().optional(),
  unitNodeId: IdSchema.nullable().optional(),
  formOrigin: z.enum(['t1_t3', 't4', 't5']).nullable().optional(),
  difficultyTp: z.number().int().min(1).max(6).nullable().optional(),
}
const leafCurriculumKeys = { kbat: true, unitNodeId: true, formOrigin: true, difficultyTp: true, cognitiveLevel: true } as const


/** 45:473-481 / DM-55: `question_parts.mode_config`. `answerSpace` is stored English (45:1115 "medium"); UI labels Pendek / Sederhana / Panjang (D1). */
export const QUESTION_ANSWER_SPACES = ['short', 'medium', 'long'] as const
export const QUESTION_DRAWING_KINDS = ['graf', 'rajah', 'lakaran'] as const
const WordRange = z.object({ min: z.number().int().min(0).max(5000), max: z.number().int().min(0).max(5000) }).refine((r) => r.min <= r.max, {
  message: 'Julat perkataan tidak sah.',
})
export const ModeConfigSchema = z
  .strictObject({
    maxWords: z.number().int().min(1).optional(),
    wordRange: WordRange.optional(),
    hardLimit: z.boolean().optional(),
    answerSpace: z.enum(QUESTION_ANSWER_SPACES).optional(),
    /** `Templat jawapan (pra-isi)` (FR-QA-28). */
    preFill: z.string().optional(),
    /** `Bergantung pada jawapan bahagian`: label of the leaf whose answer this one carries (DM-55; not on the part). */
    dependsOnPart: z.string().min(1).max(10).optional(),
    /** `Contoh (tidak dimarkah)`: present only on an example leaf, which then has 0 marks and a required answer. */
    example: z.strictObject({ answer: z.string() }).optional(),
    /** `mcq_multi` leaf (N-12). */
    multi: z.boolean().optional(),
    /** `essay_choice` 2..6 `Gesaan alternatif` (45:481). */
    alternatives: z
      .array(z.strictObject({ id: z.string().min(1).max(40).optional(), prompt: QuestionRichTextSchema, stimulusId: IdSchema.optional() }))
      .min(2, ESSAY_CHOICE_COUNT_MESSAGE)
      .max(6, ESSAY_CHOICE_COUNT_MESSAGE)
      .optional(),
    drawingKind: z.enum(QUESTION_DRAWING_KINDS).optional(),
    /** Exactly one of an image or a graph grid (DM-55). */
    answerTemplate: z
      .union([
        z.strictObject({ imageId: IdSchema }),
        z.strictObject({
          grid: z.strictObject({
            xMin: z.number(),
            xMax: z.number(),
            yMin: z.number(),
            yMax: z.number(),
            step: z.number().positive(),
            scale: z.string().max(100),
          }),
        }),
      ])
      .optional(),
    /** `table_fill` grid: 1..20 rows, 1..10 columns. */
    grid: z
      .strictObject({
        rows: z.number().int().min(1).max(20),
        cols: z.number().int().min(1).max(10),
        cells: z.array(z.array(z.strictObject({ type: z.enum(['tajuk', 'diberi', 'kosong']), text: QuestionRichTextSchema.optional() }))),
      })
      .optional(),
  })
  .meta({ id: 'QuestionModeConfig' })

/** One answer key per mode (D3). A key of the wrong kind for the mode is rejected at the field `key`. */
const leafBase = {
  label: z.string().max(10),
  prompt: QuestionRichTextSchema,
  marks: LeafMarks,
  modeConfig: ModeConfigSchema.optional(),
  stimulusId: IdSchema.optional(),
  reveal: z.enum(['after_submit', 'never']).optional(),
  ...leafCurriculum,
}
const keyed = <M extends string, K extends z.ZodType>(mode: M, key: K) =>
  z.object({ ...leafBase, mode: z.literal(mode), key })

/** R1-T07: one topic of an `essay_choice` leaf (V2 `config.topics`). `id` is the stable key of the topic inside the leaf. */
export const QuestionEssayTopicSchema = z
  .object({ id: z.string().min(1).max(40), label: z.string().trim().min(1) })
  .meta({ id: 'QuestionEssayTopic' })

/**
 * The leaf branches, built twice from the same shape. `LeafBranches` (the schema the services and routes use today) keeps the
 * v1 key TYPES, so the consumers of `QuestionPart` still compile; `LeafBranchesV3` additionally accepts the `mcq_multi` key
 * (`options` + `correctOptionIds`, D7) and the scheme v2 keys (D2). The consumers (grading, publish gate, mappers) switch to the
 * V3 schema in S1-T09a parts 3 to 5; until then v2 content is validated by `QuestionLeafPartV3Schema` only.
 */
const buildBranches = <Mcq extends z.ZodType, Pts extends z.ZodType, Ess extends z.ZodType>(mcqKey: Mcq, pointsKey: Pts, essayKey: Ess) =>
  [
    /** FR-QA-27: 2 to 8 options (default 4 in the form). */
    keyed('mcq', mcqKey).extend({ options: z.array(QuestionOptionSchema).min(2, MCQ_OPTIONS_MESSAGE).max(8, MCQ_OPTIONS_MESSAGE) }),
    /**
     * BE-42 PKSK choice leaf. Bahagian A and B carry 2 to 6 options, Bahagian C (essay) carries none. Several or no label may be
     * correct (BR-M07-04). Valid only on a question tagged `pksk_domain`: the question service rejects it with 422 otherwise.
     */
    keyed('pksk_choice', OptionsKey).extend({ options: z.array(QuestionOptionSchema).max(6) }),
    keyed('match_letter', MappingKey),
    keyed('short_text', AcceptedTextKey).extend({ blankCount: z.number().int().min(1).optional() }),
    keyed('numeric', AcceptedNumericKey),
    keyed('working', pointsKey),
    keyed('essay', essayKey).extend({
      wordRange: z.object({ min: z.number().int(), max: z.number().int() }).optional(),
    }),
    keyed('drawing', pointsKey),
    keyed('table_fill', CellsKey),
    keyed('essay_choice', essayKey).extend({
      topics: z.array(QuestionEssayTopicSchema).min(2, 'Sila masukkan 2 hingga 6 tajuk.').max(6, 'Sila masukkan 2 hingga 6 tajuk.'),
      wordRange: z.object({ min: z.number().int(), max: z.number().int() }).optional(),
    }),
  ] as const
/** Read path: old v1 rules plus the additive fields only. */
const LeafBranches = buildBranches(OptionKey, PointsKeyV1Base, z.discriminatedUnion('kind', [RubricKeyV1Base, PointsKeyV1Base]))
/** Write path (create/update requests): v1 key types, new rules on. */
const LeafBranchesWrite = buildBranches(OptionKey, PointsKeyV1, z.discriminatedUnion('kind', [RubricKeyV1, PointsKeyV1]))
const LeafBranchesV3 = buildBranches(z.union([OptionKey, McqMultiKey]), PointsKey, RubricOrPointsKey)

/** AC-ADM-QE3.17: an example leaf without an answer. */
export const EXAMPLE_ANSWER_MESSAGE = 'Jawapan contoh diperlukan.'

interface LeafLike {
  mode: string
  marks: number
  options?: { label: string }[]
  topics?: { id: string }[]
  modeConfig?: { multi?: boolean; example?: { answer: string } }
  key: { kind: string; correct?: string | string[]; accepted?: string[]; correctOptionIds?: string[] }
}
/** No PRD text: code only (DOC DEFECT). */
const MISMATCH = 'SCHEME_MODE_MISMATCH'
const WRONG_CHOICE = 'Jawapan betul mesti salah satu pilihan.'
/** 45:463 / 45:662 row 11. */
const PICK_CORRECT = 'Sila pilih jawapan betul.'

/**
 * Cross-field rules of a leaf. `strict = false` is the READ path (stored v1 rows): only the old rules plus the additive `accepted`.
 * `strict = true` is the WRITE path and the V3 schemas: adds marks 1..100 (or 0 with example), duplicate labels, `scheme_v` on a v1 key,
 * the example rules, the multi flag and the PRD correct-answer copy.
 */
const refineLeaf = (strict: boolean) => (ctx: { value: unknown; issues: z.core.$ZodRawIssue[] }) => {
  const p = ctx.value as LeafLike & { key: { scheme_v?: number } }
  const bad = (path: (string | number)[], message: string) => ctx.issues.push({ code: 'custom', input: p, path, message })
  if (p.mode === 'mcq') {
    const labels = (p.options ?? []).map((o) => o.label)
    const has = (l: string) => labels.includes(l)
    if (strict && new Set(labels).size !== labels.length) bad(['options'], 'OPTION_LABEL_DUPLICATE')
    if (p.key.kind === 'option') {
      const correct = p.key.correct as string
      if (strict && p.modeConfig?.multi === true) bad(['key'], MISMATCH)
      if (!has(correct)) bad(['key', 'correct'], strict ? PICK_CORRECT : WRONG_CHOICE)
      if ((p.key.accepted ?? []).some((x) => !has(x))) bad(['key', 'accepted'], PICK_CORRECT)
    } else {
      // mcq_multi (D7): ids are option labels, 1..n-1 correct.
      const ids = p.key.correctOptionIds ?? []
      if (new Set(ids).size !== ids.length) bad(['key', 'correctOptionIds'], 'OPTION_LABEL_DUPLICATE')
      else if (ids.some((i) => !has(i))) bad(['key', 'correctOptionIds'], PICK_CORRECT)
      else if (ids.length > labels.length - 1) bad(['key', 'correctOptionIds'], MCQ_MULTI_COUNT_MESSAGE)
      if (p.modeConfig?.multi !== true) bad(['modeConfig', 'multi'], MISMATCH)
    }
  }
  if (strict) {
    // 45:481 / AC-ADM-QE3.17/18: marks 0 exactly when `modeConfig.example` is present, 1..100 otherwise.
    const ex = p.modeConfig?.example
    if (ex) {
      if (ex.answer.trim() === '') bad(['modeConfig', 'example', 'answer'], EXAMPLE_ANSWER_MESSAGE)
      if (p.marks !== 0) bad(['marks'], 'EXAMPLE_MARKS_NOT_ZERO')
    } else if (p.marks < 1) bad(['marks'], MARKS_MIN_MESSAGE)
    else if (p.marks > 100) bad(['marks'], MARKS_MAX_MESSAGE)
  }
  if (p.mode === 'essay_choice' && new Set((p.topics ?? []).map((t) => t.id)).size !== (p.topics ?? []).length) {
    bad(['topics'], 'Setiap tajuk mesti mempunyai id yang berbeza.')
  }
  if (p.mode === 'pksk_choice') {
    const opts = p.options ?? []
    const labels = new Set(opts.map((o) => o.label))
    if (labels.size !== opts.length || opts.length === 1) bad(['options'], 'Sila masukkan 2 hingga 6 pilihan jawapan.')
    const correct = (p.key.correct ?? []) as string[]
    if (new Set(correct).size !== correct.length || correct.some((c) => !labels.has(c))) bad(['key', 'correct'], WRONG_CHOICE)
  }
}

/** READ path (stored rows, responses, OpenAPI `QuestionLeafPart`): never tighter than v1 except the additive fields. */
export const QuestionLeafPartSchema = z
  .discriminatedUnion('mode', LeafBranches)
  .check(refineLeaf(false) as never)
  .meta({ id: 'QuestionLeafPart' })
/** WRITE path leaf (create/update requests): the new rules apply. */
export const QuestionWriteLeafPartSchema = z
  .discriminatedUnion('mode', LeafBranchesWrite)
  .check(refineLeaf(true) as never)
  .meta({ id: 'QuestionWriteLeafPart' })
/** Leaf that also accepts `mcq_multi` and scheme v2 keys (D2, D7). */
export const QuestionLeafPartV3Schema = z
  .discriminatedUnion('mode', LeafBranchesV3)
  .check(refineLeaf(true) as never)
  .meta({ id: 'QuestionLeafPartV3' })

/** D8 / OPT-MOD-JAWAPAN: the two fixed options of a `true_false` leaf (leaf mode `mcq`, key kind `option`); BM only, no EN. */
export const TRUE_FALSE_OPTIONS = [
  { label: 'A', body: { ms: 'Betul' } },
  { label: 'B', body: { ms: 'Salah' } },
] as const
export const isTrueFalseOptions = (options: readonly { label: string; body: { ms: string; en?: string | undefined } }[]): boolean =>
  options.length === 2 && options.every((o, i) => o.label === TRUE_FALSE_OPTIONS[i]!.label && o.body.ms === TRUE_FALSE_OPTIONS[i]!.body.ms)
/** A `true_false` leaf: an `mcq` leaf with exactly the two fixed options and a single-answer key. */
export const QuestionTrueFalseLeafSchema = QuestionLeafPartV3Schema.check((ctx) => {
  const p = ctx.value
  if (p.mode !== 'mcq' || p.key.kind !== 'option' || !isTrueFalseOptions(p.options)) {
    ctx.issues.push({ code: 'custom', input: p, path: ['options'], message: 'TRUE_FALSE_OPTIONS_INVALID' })
  }
})

/** A branch part has children and NO marks and NO mode/key (the strict object rejects them). */
const branch = <C extends z.ZodType>(children: C) =>
  z.strictObject({ label: z.string().max(10), prompt: QuestionRichTextSchema, children: z.array(children).min(1) })

const Level3 = QuestionLeafPartSchema
const Level2 = z.union([QuestionLeafPartSchema, branch(Level3)])
export const QuestionPartSchema = z.union([QuestionLeafPartSchema, branch(Level2)]).meta({ id: 'QuestionPart' })
export type QuestionPart = z.infer<typeof QuestionPartSchema>

/** WRITE path part tree (create/update requests): same shape as `QuestionPart`, new rules on. */
const WLevel3 = QuestionWriteLeafPartSchema
const WLevel2 = z.union([QuestionWriteLeafPartSchema, branch(WLevel3)])
export const QuestionWritePartSchema = z.union([QuestionWriteLeafPartSchema, branch(WLevel2)]).meta({ id: 'QuestionWritePart' })

/** Part tree that reads v1 and scheme v2 / `mcq_multi` leaves (D2). Not yet used by the services (S1-T09a parts 3 to 5). */
const LevelV3_3 = QuestionLeafPartV3Schema
const LevelV3_2 = z.union([QuestionLeafPartV3Schema, branch(LevelV3_3)])
export const QuestionPartV3Schema = z.union([QuestionLeafPartV3Schema, branch(LevelV3_2)])
export type QuestionPartV3 = z.infer<typeof QuestionPartV3Schema>

/** D9: curriculum tag. Ids are curriculum node ids owned by BE-08. SP: 1 to 3 nodes; TP 1 to 6. */
export const QuestionCurriculumTagSchema = z
  .object({
    unitId: IdSchema.nullable(),
    spIds: z.array(IdSchema).max(3),
    tp: z.number().int().min(1).max(6).nullable(),
  })
  .meta({ id: 'QuestionCurriculumTag' })

/** R1-T07: the seven V2 production stimulus kinds (audio exists in the store but is never served as a stimulus). */
export const QUESTION_STIMULUS_KINDS = ['passage', 'image', 'diagram', 'table', 'map', 'infographic', 'graph'] as const
export const QuestionStimulusKindSchema = z.enum(QUESTION_STIMULUS_KINDS).meta({ id: 'QuestionStimulusKind' })
export type QuestionStimulusKind = z.infer<typeof QuestionStimulusKindSchema>

/** Table grid of a `table` stimulus (`stimuli.table_data`): header cells and body rows. */
export const QuestionStimulusTableSchema = z
  .object({ head: z.array(z.string()), rows: z.array(z.array(z.string())) })
  .meta({ id: 'QuestionStimulusTable' })

/**
 * D6: a stimulus and a group that keeps ordered questions together. D90: a shared stimulus is ONE group shown once with all
 * its member questions; it carries no marks and is never a question. `caption`, `sourceCitation` and `tableData` are additive.
 */
export const QuestionStimulusSchema = z
  .object({
    id: IdSchema,
    kind: QuestionStimulusKindSchema,
    label: z.string(),
    body: QuestionRichTextSchema.nullable(),
    imageId: IdSchema.nullable(),
    alt: z.string().nullable(),
    caption: z.string().nullable().optional(),
    sourceCitation: z.string().nullable().optional(),
    tableData: QuestionStimulusTableSchema.nullable().optional(),
  })
  .meta({ id: 'QuestionStimulus' })

export const QuestionStimulusGroupSchema = z
  .object({
    id: IdSchema,
    /** At most 3 (OD-28). */
    stimuli: z.array(QuestionStimulusSchema).min(1).max(3),
    optionBank: z.array(z.object({ label: OptionLabel, body: QuestionRichTextSchema })).optional(),
    /** Question ids in the published order. */
    questionIds: z.array(IdSchema),
  })
  .meta({ id: 'QuestionStimulusGroup' })

/**
 * Student-facing projection of a part tree (for M05/M28 reuse): the `key` is omitted, and the
 * default zod object behaviour strips it if a caller passes a full leaf in.
 */
const PublicLeaf = z.discriminatedUnion(
  'mode',
  (LeafBranches as readonly z.ZodObject[]).map((s) => s.omit({ key: true, ...leafCurriculumKeys })) as unknown as [z.ZodObject, ...z.ZodObject[]],
)
const PublicBranch = <C extends z.ZodType>(children: C) =>
  z.strictObject({ label: z.string().max(10), prompt: QuestionRichTextSchema, children: z.array(children).min(1) })
export const QuestionPublicPartSchema = z
  .union([PublicLeaf, PublicBranch(z.union([PublicLeaf, PublicBranch(PublicLeaf)]))])
  .meta({ id: 'QuestionPublicPart' })
