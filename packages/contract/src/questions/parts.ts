import { z } from '../zod'
import { IdSchema } from '../common/ids'

/**
 * v2 question model (docs/requirements/v2-exam-schema.md D1 to D4, D6, D9, D12; BE-09 card AC 1 to 3
 * and 12). A question is an ordered tree of parts (depth at most 3: (a), (i), (A)); only LEAF parts
 * carry marks, an answer mode and an answer key. The key kind must match the mode (discriminated
 * unions). Keys live only in the admin/editor schemas: the student-facing projection below omits them.
 */

/** D12 / D54(a): the only lifecycle codes on the wire. BM labels (UI only): Draf, Semakan, Lulus, Diterbitkan, Diarkib. */
export const QUESTION_STATUSES = ['draft', 'review', 'approved', 'published', 'archived'] as const
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
  /** BE-42 (M07 PKSK): 0 or 2 to 6 options, any number of correct labels. Valid only on a question tagged `pksk_domain`. */
  'pksk_choice',
] as const
export const QuestionLeafModeSchema = z.enum(QUESTION_LEAF_MODES).meta({ id: 'QuestionLeafMode' })

const OptionLabel = z.string().regex(/^[A-H]$/, 'Label pilihan mesti A hingga H.')
const Marks = z.number().int().min(0)

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

const PointsKey = z.object({
  kind: z.literal('points'),
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

const RubricKey = z.object({
  kind: z.literal('rubric'),
  marks: Marks,
  criteria: z.array(z.object({ id: z.string(), name: z.string() })).min(1),
  bands: z
    .array(z.object({ name: z.string(), range: z.tuple([Marks, Marks]), descriptors: z.record(z.string(), z.string()).optional() }))
    .min(1),
  floorBand: z.object({ name: z.string(), range: z.tuple([Marks, Marks]) }).optional(),
  notes: z.array(z.string()).optional(),
})

const OptionKey = z.object({ kind: z.literal('option'), correct: OptionLabel })
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

/** One answer key per mode (D3). A key of the wrong kind for the mode is rejected at the field `key`. */
const leafBase = {
  label: z.string().max(10),
  prompt: QuestionRichTextSchema,
  marks: Marks,
  stimulusId: IdSchema.optional(),
  reveal: z.enum(['after_submit', 'never']).optional(),
}
const keyed = <M extends string, K extends z.ZodType>(mode: M, key: K) =>
  z.object({ ...leafBase, mode: z.literal(mode), key })

const McqLeaf = keyed('mcq', OptionKey).extend({ options: z.array(QuestionOptionSchema).min(3).max(8) })
/**
 * BE-42 PKSK choice leaf (additive; `McqLeaf` is unchanged). Bahagian A and B carry 2 to 6 options, Bahagian C (essay,
 * marked by the simulated marker) carries none. Several or no label may be correct (BR-M07-04). Valid only on a question
 * tagged `pksk_domain`: the question service rejects it with 422 otherwise.
 */
const PkskChoiceLeaf = keyed('pksk_choice', OptionsKey).extend({ options: z.array(QuestionOptionSchema).max(6) })
const LeafBranches = [
  McqLeaf,
  PkskChoiceLeaf,
  keyed('match_letter', MappingKey),
  keyed('short_text', AcceptedTextKey).extend({ blankCount: z.number().int().min(1).optional() }),
  keyed('numeric', AcceptedNumericKey),
  keyed('working', PointsKey),
  keyed('essay', z.discriminatedUnion('kind', [RubricKey, PointsKey])).extend({
    wordRange: z.object({ min: z.number().int(), max: z.number().int() }).optional(),
  }),
  keyed('drawing', PointsKey),
  keyed('table_fill', CellsKey),
] as const

export const QuestionLeafPartSchema = z
  .discriminatedUnion('mode', LeafBranches)
  .check((ctx) => {
    const p = ctx.value
    if (p.mode === 'mcq' && !p.options.some((o) => o.label === p.key.correct)) {
      ctx.issues.push({ code: 'custom', input: p, path: ['key', 'correct'], message: 'Jawapan betul mesti salah satu pilihan.' })
    }
    if (p.mode === 'pksk_choice') {
      const labels = new Set(p.options.map((o) => o.label))
      if (labels.size !== p.options.length || p.options.length === 1) {
        ctx.issues.push({ code: 'custom', input: p, path: ['options'], message: 'Sila masukkan 2 hingga 6 pilihan jawapan.' })
      }
      const correct = p.key.correct
      if (new Set(correct).size !== correct.length || correct.some((c) => !labels.has(c))) {
        ctx.issues.push({ code: 'custom', input: p, path: ['key', 'correct'], message: 'Jawapan betul mesti salah satu pilihan.' })
      }
    }
  })
  .meta({ id: 'QuestionLeafPart' })

/** A branch part has children and NO marks and NO mode/key (the strict object rejects them). */
const branch = <C extends z.ZodType>(children: C) =>
  z.strictObject({ label: z.string().max(10), prompt: QuestionRichTextSchema, children: z.array(children).min(1) })

const Level3 = QuestionLeafPartSchema
const Level2 = z.union([QuestionLeafPartSchema, branch(Level3)])
export const QuestionPartSchema = z.union([QuestionLeafPartSchema, branch(Level2)]).meta({ id: 'QuestionPart' })
export type QuestionPart = z.infer<typeof QuestionPartSchema>

/** D9: curriculum tag. Ids are curriculum node ids owned by BE-08. SP: 1 to 3 nodes; TP 1 to 6. */
export const QuestionCurriculumTagSchema = z
  .object({
    unitId: IdSchema.nullable(),
    spIds: z.array(IdSchema).max(3),
    tp: z.number().int().min(1).max(6).nullable(),
  })
  .meta({ id: 'QuestionCurriculumTag' })

/** D6: a stimulus (diagram, passage, table) and a group that keeps ordered questions together. */
export const QuestionStimulusSchema = z
  .object({
    id: IdSchema,
    kind: z.enum(['diagram', 'passage', 'table']),
    label: z.string(),
    body: QuestionRichTextSchema.nullable(),
    imageId: IdSchema.nullable(),
    alt: z.string().nullable(),
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
  (LeafBranches as readonly z.ZodObject[]).map((s) => s.omit({ key: true })) as unknown as [z.ZodObject, ...z.ZodObject[]],
)
const PublicBranch = <C extends z.ZodType>(children: C) =>
  z.strictObject({ label: z.string().max(10), prompt: QuestionRichTextSchema, children: z.array(children).min(1) })
export const QuestionPublicPartSchema = z
  .union([PublicLeaf, PublicBranch(z.union([PublicLeaf, PublicBranch(PublicLeaf)]))])
  .meta({ id: 'QuestionPublicPart' })
