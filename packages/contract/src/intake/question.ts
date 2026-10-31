import { z } from '../zod'
import { IdSchema } from '../common/ids'
import { QuestionCognitiveLevelSchema } from '../questions/parts'

/**
 * BE-38 (contract only): the question content shapes of the SPM intake (D52, OD-20).
 *
 * Source: prototype commit `9af43134` on `feature/student-prototype`, read-only:
 *  - `src/modules/m28-bijak-spm/admin/intake/types.ts`  (IntakeQuestion, IntakePart, IntakeStimulus,
 *    IntakeIssue, PAPER_TYPES)
 *  - `src/modules/m28-bijak-spm/domain/types.ts`        (LeafKind, McqOption, CurriculumTag, SchemeDef,
 *    PointDef, PointMatch, EcfRule, FinalDef, PointGroup, RubricBand, PointCode, StimulusDef)
 *  - `src/modules/m28-bijak-spm/admin/intake/domain/validation.ts` (the quality-gate BM messages)
 *
 * Field names, optionality and enum values are copied one for one. What differs is listed in
 * `docs/architecture/v2-backend-deviations.md` (rows dated 2026-10-20, "BE-38 ..."). Anything the
 * prototype does not define is marked `[PROPOSED]` in the description of the schema or field.
 *
 * These shapes are the EDIT payload of an extracted question, not the stored `Question` of BE-09:
 * `accept` converts them (the prototype `intakeToDef`).
 *
 * Parity with the merged BE-36 `ai/schema.ts` (McqOption, SchemeDef, CurriculumTag, WordRange, Region,
 * Stimulus, Part) was verified field for field and by boundary values (`__tests__/ai-parity.test.ts`).
 * They are still declared here, not imported from `../ai`, because importing would rename the emitted
 * components (`AiMcqOption` instead of `IntakeMcqOption`, ...) and the intake shapes carry intentional
 * extras (`lead`, `figureId`, nullable `region`, `confirmed` writable). BE-39
 * (`BijakBuilderCurriculumTag`) is still unmerged. LEAD consolidation is pending (deviation row).
 *
 * Every object is strict (an unknown key is a 422, D58d). The caps (string and array lengths, `tp` 1..6,
 * `unit` 64, word range 0..5000) are the ones of BE-36 (`fa378ec3`, aligned to the same prototype), so an
 * extraction result always fits an item. A draft with a gap (empty stem, 0 marks, no key) is still
 * savable: the gate runs on accept, not on parse.
 */

/* ------------------------------------------------------------------------------------------ */
/* Caps and copy                                                                               */
/* ------------------------------------------------------------------------------------------ */

export const INTAKE_MAX_STEM_CHARS = 100_000
export const INTAKE_MAX_PROMPT_CHARS = 10_000
export const INTAKE_MAX_OPTION_CHARS = 5_000
export const INTAKE_MAX_OPTIONS = 10
export const INTAKE_MAX_PARTS = 50
export const INTAKE_MAX_POINTS = 50
/** [PROPOSED] Cap of `scheme.mapping.map` keys (a lettered bank has at most a few dozen). */
export const INTAKE_MAX_MAPPING_KEYS = 50
/** [PROPOSED] Total JSON body cap of a large write (item edit, stimulus create and edit): larger is 413. */
export const INTAKE_MAX_BODY_BYTES = 1_048_576

/** Prototype `PAPER_TYPES` (declaration of the batch; owned by BE-37, listed here for the BM copy). */
export const INTAKE_PAPER_TYPES = [
  'Percubaan SPM',
  'Soalan Umum',
  'Peperiksaan Sebenar',
  'Buku Latihan',
  'Lain-lain',
] as const

/** Prototype `COPYRIGHT_OPTIONS` (value and BM label). */
export const INTAKE_COPYRIGHT_OPTIONS = [
  { value: 'sendiri', label: 'Milik sendiri / sekolah' },
  { value: 'rasmi', label: 'Kertas rasmi KPM / LPM' },
  { value: 'pihak-ketiga', label: 'Pihak ketiga / komersial' },
] as const

const LocalId = z.string().min(1).max(64)
const Marks = z.number().int().min(0).max(1000)
const PartMarks = z.number().int().min(0).max(100)
const MatchText = z.string().max(2000)
const EcfK = z.number().min(-1_000_000).max(1_000_000)

/** Word range of an essay leaf; same bounds and rule as BE-36 `AiWordRange`. */
export const IntakeWordRangeSchema = z
  .strictObject({ min: z.number().int().min(0).max(5000), max: z.number().int().min(0).max(5000) })
  .refine((r) => r.min <= r.max, { message: 'min must not exceed max.' })
  .meta({ id: 'IntakeWordRange', description: 'Word range of an essay leaf (prototype wordRange).' })

/* ------------------------------------------------------------------------------------------ */
/* Leaf modes, options, tag                                                                    */
/* ------------------------------------------------------------------------------------------ */

/** Prototype `LeafKind` (exam schema D2). */
export const INTAKE_LEAF_KINDS = [
  'working',
  'numeric',
  'short_text',
  'match_letter',
  'essay',
  'drawing',
  'table_fill',
] as const
export const IntakeLeafKindSchema = z.enum(INTAKE_LEAF_KINDS).meta({
  id: 'IntakeLeafKind',
  description: 'Answer mode of a leaf (prototype LeafKind). table_fill is a typed stub, drawing is a photo plus a teacher checklist.',
})
export type IntakeLeafKind = z.infer<typeof IntakeLeafKindSchema>

/** Prototype `IntakeQType`. */
export const INTAKE_QUESTION_TYPES = ['mcq', 'structured', 'short', 'essay'] as const
export const IntakeQuestionTypeSchema = z.enum(INTAKE_QUESTION_TYPES).meta({
  id: 'IntakeQuestionType',
  description: 'mcq = Objektif, structured = Berstruktur, short = Pendek, essay = Esei (prototype IntakeQType).',
})
export type IntakeQuestionType = z.infer<typeof IntakeQuestionTypeSchema>

/** Prototype `McqOption`. */
export const IntakeMcqOptionSchema = z
  .strictObject({
    id: z.string().min(1).max(16).meta({ description: 'Option key, e.g. "A".' }),
    text: z.string().max(INTAKE_MAX_OPTION_CHARS).meta({ description: 'May contain `$latex$` spans.' }),
  })
  .meta({ id: 'IntakeMcqOption', description: 'Prototype McqOption.' })
export type IntakeMcqOption = z.infer<typeof IntakeMcqOptionSchema>

/** Prototype `CurriculumTag` (exam schema D9). `unit` is null only for T1-T3 content outside the DSKP (Q-S2). */
export const IntakeCurriculumTagSchema = z
  .strictObject({
    subject: z.string().min(1).max(32).meta({ example: 'MAT' }),
    level: z.enum(['T4', 'T5', 'T4+T5']),
    unit: z.string().min(1).max(64).nullable().meta({ description: 'DSKP unit code from the controlled list, or null.' }),
    unitLabel: z.string().max(200),
    sp: z.array(z.string().min(1).max(64)).max(20).meta({ description: 'Standard Pembelajaran codes.' }),
    tp: z.number().int().min(1).max(6).meta({
      description: 'Tahap Penguasaan 1..6, as the prototype gate ("Tahap Penguasaan (TP) mesti antara 1 dan 6.") and BE-36 AiCurriculumTag. The prototype empty tag (lib/dskp.ts emptyTag) uses 3, so 0 is never needed.',
    }),
    formOrigin: z.enum(['T1-T3', 'T4', 'T5']),
  })
  .meta({ id: 'IntakeCurriculumTag', description: 'Prototype CurriculumTag, field for field.' })
export type IntakeCurriculumTag = z.infer<typeof IntakeCurriculumTagSchema>

/* ------------------------------------------------------------------------------------------ */
/* Mark schemes (prototype SchemeDef)                                                          */
/* ------------------------------------------------------------------------------------------ */

/** Mark-point letters follow the subject (Q-S3): K N P maths, M sciences, F C Sejarah and BI, B independent. */
export const INTAKE_POINT_CODES = ['K', 'N', 'P', 'B', 'M', 'F', 'C'] as const
export const IntakePointCodeSchema = z.enum(INTAKE_POINT_CODES).meta({ id: 'IntakePointCode', description: 'Prototype PointCode.' })
export type IntakePointCode = z.infer<typeof IntakePointCodeSchema>

/** Prototype `PointMatch`. */
export const IntakePointMatchSchema = z
  .discriminatedUnion('type', [
    z.strictObject({ type: z.literal('step'), accept: z.array(MatchText).max(50) }),
    z.strictObject({ type: z.literal('all_of'), items: z.array(MatchText).max(50) }),
    z.strictObject({ type: z.literal('final') }),
    z.strictObject({ type: z.literal('unit') }),
    z.strictObject({ type: z.literal('keywords'), anyOf: z.array(MatchText).max(50) }),
    z.strictObject({ type: z.literal('manual') }),
  ])
  .meta({
    id: 'IntakePointMatch',
    description: 'How a mark point is matched (prototype PointMatch). `manual` is checked by a teacher and never auto-awarded.',
  })
export type IntakePointMatch = z.infer<typeof IntakePointMatchSchema>

/** Prototype `EcfRule`: own figure carried forward, as data (exam schema D4.2). */
export const IntakeEcfRuleSchema = z
  .discriminatedUnion('op', [
    z.strictObject({ op: z.literal('same') }),
    z.strictObject({ op: z.literal('sub_from'), k: EcfK }),
    z.strictObject({ op: z.literal('add'), k: EcfK }),
    z.strictObject({ op: z.literal('mul'), k: EcfK }),
  ])
  .meta({ id: 'IntakeEcfRule', description: 'Prototype EcfRule.' })

/** Prototype `PointDef`. */
export const IntakePointSchema = z
  .strictObject({
    id: LocalId,
    code: IntakePointCodeSchema,
    marks: PartMarks.meta({ description: 'Explicit marks: the digit of a tag (K1, K2) is a sequence number, never the marks.' }),
    label: MatchText,
    match: IntakePointMatchSchema,
    requires: z.array(LocalId).max(INTAKE_MAX_POINTS).optional().meta({ description: 'Only awarded when every one of these other points was hit.' }),
    ecf: z
      .strictObject({ fromPart: LocalId, rule: IntakeEcfRuleSchema, note: z.string().max(200) })
      .optional()
      .meta({ description: 'Own figure carried forward from an earlier part.' }),
  })
  .meta({ id: 'IntakePoint', description: 'Prototype PointDef.' })
export type IntakePoint = z.infer<typeof IntakePointSchema>

/** Prototype `PointGroup`: "[mana-mana n x k m]", at most `anyN` of these points count. */
export const IntakePointGroupSchema = z
  .strictObject({ id: LocalId, anyN: z.number().int().min(1).max(INTAKE_MAX_POINTS), pointIds: z.array(LocalId).max(INTAKE_MAX_POINTS) })
  .meta({ id: 'IntakePointGroup', description: 'Prototype PointGroup.' })

/** Prototype `FinalDef`. */
export const IntakeFinalSchema = z
  .strictObject({
    accept: z.array(MatchText).max(50).meta({ description: 'Accepted equivalent forms (plain or LaTeX); any one matches.' }),
    tolerance: z.number().min(0).optional().meta({ description: 'Absolute tolerance for numeric answers.' }),
    unit: z.string().max(32).optional(),
    mustContain: z.string().max(200).optional(),
    formHint: z.string().max(500).optional(),
    display: MatchText.meta({ description: 'LaTeX shown in the revealed scheme.' }),
  })
  .meta({ id: 'IntakeFinal', description: 'Prototype FinalDef.' })

/** Prototype `RubricBand`. */
export const IntakeRubricBandSchema = z
  .strictObject({
    name: z.string().max(100),
    range: z.tuple([z.number().min(0).max(1000), z.number().min(0).max(1000)]),
    descriptor: z.string().max(2000),
  })
  .meta({ id: 'IntakeRubricBand', description: 'Prototype RubricBand.' })

/** Prototype `SchemeDef`: answer-key kinds option, mapping, accepted, points, rubric (exam schema D3). */
export const IntakeSchemeSchema = z
  .discriminatedUnion('kind', [
    z.strictObject({
      kind: z.literal('option'),
      marks: Marks,
      correct: z.string().max(16).meta({ description: 'Key of the correct option (McqOption.id); empty while not chosen ("Kunci jawapan belum dipilih.").' }),
      reason: z.string().max(2000),
    }),
    z.strictObject({
      kind: z.literal('mapping'),
      marks: Marks,
      map: z
        .record(z.string().max(64), z.string().max(500))
        .refine((m) => Object.keys(m).length <= INTAKE_MAX_MAPPING_KEYS, { message: `At most ${INTAKE_MAX_MAPPING_KEYS} mapping entries.` }),
    }),
    z.strictObject({
      kind: z.literal('accepted'),
      marks: Marks,
      values: z
        .array(
          z.strictObject({
            v: z.string().max(500),
            tol: z.number().min(0).optional(),
            unit: z.string().max(32).optional(),
          }),
        )
        .max(50),
      caseSensitive: z.boolean().optional(),
    }),
    z.strictObject({
      kind: z.literal('points'),
      marks: Marks,
      points: z.array(IntakePointSchema).max(INTAKE_MAX_POINTS),
      groups: z.array(IntakePointGroupSchema).max(20).optional(),
      final: IntakeFinalSchema.optional(),
      model: z.string().max(5000).optional(),
    }),
    z.strictObject({
      kind: z.literal('rubric'),
      marks: Marks,
      criteria: z.array(z.strictObject({ id: LocalId, name: z.string().max(200) })).max(20),
      bands: z.array(IntakeRubricBandSchema).max(20),
      notes: z.array(z.string().max(2000)).max(20).optional(),
    }),
  ])
  .meta({
    id: 'IntakeScheme',
    description:
      'Answer key and mark scheme (prototype SchemeDef). Visible to the reviewer only (Guru owner or Admin Pusat); a student never receives an intake item.',
  })
export type IntakeScheme = z.infer<typeof IntakeSchemeSchema>

/* ------------------------------------------------------------------------------------------ */
/* Parts and the question                                                                      */
/* ------------------------------------------------------------------------------------------ */

/** Prototype `IntakePart` (a leaf; ancestors of a nested part are kept in `lead`). */
export const IntakePartSchema = z
  .strictObject({
    id: LocalId,
    label: z.string().min(1).max(16).meta({ description: 'Printed label, e.g. "(a)" or "(a)(i)".' }),
    prompt: z.string().max(INTAKE_MAX_PROMPT_CHARS),
    marks: PartMarks,
    mode: IntakeLeafKindSchema,
    scheme: IntakeSchemeSchema.optional(),
    unit: z.string().max(32).optional().meta({ description: 'Unit shown after a numeric answer.' }),
    wordRange: IntakeWordRangeSchema.optional(),
    cognitiveLevel: QuestionCognitiveLevelSchema.optional().meta({ description: 'R1-B05: cognitive level of this part, set by the reviewer; carried to the bank leaf on accept. Mandatory for an SPM-bound approval.' }),
    lead: z
      .array(z.strictObject({ id: LocalId, label: z.string().max(16), prompt: z.string().max(INTAKE_MAX_PROMPT_CHARS) }))
      .max(3)
      .optional()
      .meta({ description: 'Ancestors of a nested part; the editor shows one flat list and the nesting is rebuilt on save.' }),
  })
  .meta({ id: 'IntakePart', description: 'Prototype IntakePart, field for field.' })
export type IntakePart = z.infer<typeof IntakePartSchema>

/**
 * Prototype `IntakeQuestion`, field for field. On the wire `id` is the INTAKE ITEM id (the prototype's
 * local `q1`..), `stimulusId` is the id of an `IntakeStimulus` of the same batch, and `lowFields` /
 * `confirmed` / `needsManual` keep their meaning: the extractor lists the fields it was unsure of and a
 * person confirms each (gate 4.8).
 */
export const IntakeQuestionSchema = z
  .strictObject({
    id: IdSchema,
    label: z.string().max(32).meta({ description: 'Number label as printed on the paper, e.g. "12".' }),
    type: IntakeQuestionTypeSchema,
    stem: z.string().max(INTAKE_MAX_STEM_CHARS),
    options: z.array(IntakeMcqOptionSchema).max(INTAKE_MAX_OPTIONS),
    marks: Marks.meta({ description: 'Question marks; for a structured question it is the sum of the part marks.' }),
    mode: IntakeLeafKindSchema.meta({ description: 'Leaf mode of a question without parts.' }),
    unit: z.string().max(32).optional().meta({ description: 'Unit of a question without parts.' }),
    wordRange: IntakeWordRangeSchema.optional(),
    cognitiveLevel: QuestionCognitiveLevelSchema.optional().meta({ description: 'R1-B05: cognitive level of a question without parts (an MCQ or a single-leaf question); a structured question carries it per part.' }),
    parts: z.array(IntakePartSchema).max(INTAKE_MAX_PARTS),
    scheme: IntakeSchemeSchema.optional().meta({ description: 'Answer key of a question without parts (MCQ key, short answer, essay points).' }),
    tag: IntakeCurriculumTagSchema,
    stimulusId: IdSchema.optional().meta({ description: 'Stimulus group (the figure is stored once on the batch).' }),
    page: z.number().int().min(1).max(10_000).meta({ description: 'Source page (1-based).' }),
    lowFields: z.array(z.string().min(1).max(64)).max(50).meta({
      description: 'Fields the extractor was unsure of (e.g. tag.unit, tag.sp, marks, stem, scheme). Set by the server only; a client cannot write it.',
    }),
    confirmed: z.array(z.string().min(1).max(64)).max(50).meta({ description: 'Low fields a person confirmed.' }),
    needsManual: z.boolean().optional().meta({ description: 'The extractor could not parse it: "Perlu semak manual".' }),
  })
  .meta({ id: 'IntakeQuestion', description: 'Prototype IntakeQuestion (the extracted, editable question content).' })
export type IntakeQuestion = z.infer<typeof IntakeQuestionSchema>

/* ------------------------------------------------------------------------------------------ */
/* Region, stimulus                                                                            */
/* ------------------------------------------------------------------------------------------ */

/**
 * Source region of a question or figure as fractions of the page (0..1), so it survives re-rendering.
 * [PROPOSED] card BE-38 ("item with fields + confidence + region"); the prototype only has `page`.
 * Same shape as the merged BE-36 `AiRegion` (parity test); the LEAD consolidates.
 */
export const IntakeRegionSchema = z
  .strictObject({
    page: z.number().int().min(1),
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    w: z.number().min(0).max(1),
    h: z.number().min(0).max(1),
  })
  .refine((r) => r.x + r.w <= 1 && r.y + r.h <= 1, { message: 'Region must lie inside the page (x + w <= 1 and y + h <= 1).' })
  .meta({ id: 'IntakeRegion', description: '[PROPOSED] Source region as page fractions.' })
export type IntakeRegion = z.infer<typeof IntakeRegionSchema>

export const INTAKE_STIMULUS_KINDS = ['diagram', 'passage', 'table'] as const
export const IntakeStimulusKindSchema = z.enum(INTAKE_STIMULUS_KINDS).meta({ id: 'IntakeStimulusKind', description: 'Prototype StimulusDef.kind.' })
export type IntakeStimulusKind = z.infer<typeof IntakeStimulusKindSchema>

const StimulusTable = z.strictObject({
  head: z.array(z.string().max(500)).max(50),
  rows: z.array(z.array(z.string().max(500)).max(50)).max(500),
})

/**
 * Prototype `IntakeStimulus` (= StimulusDef + `page`): a shared figure, passage or table stored once on
 * the batch, pinned while its group's questions are answered. `svg` exists in the response only
 * (seed and demo stimuli); a client can never send it (see the create and update requests): inline
 * markup from a client would be a stored-XSS vector [PROPOSED rule]. An extracted figure is a cropped
 * image referenced by `figureId` (BE-37 `intake_figures`) [PROPOSED].
 */
export const IntakeStimulusSchema = z
  .strictObject({
    id: IdSchema,
    kind: IntakeStimulusKindSchema,
    label: z.string().max(100).meta({ description: 'Short label used in headings and chips, e.g. "Rajah 2".' }),
    caption: z.string().max(300).optional(),
    alt: z.string().max(1000).meta({ description: 'Accessible description. Required by the gate ("Teks alternatif (alt) bagi rajah diperlukan.").' }),
    svg: z.string().max(100_000).optional().meta({ description: 'Response only, bundled trusted markup (demo seed). Never accepted on a write.' }),
    text: z.string().max(INTAKE_MAX_STEM_CHARS).optional(),
    table: StimulusTable.optional(),
    page: z.number().int().min(1).max(10_000).optional().meta({ description: 'Source page the figure was cropped from.' }),
    figureId: IdSchema.nullable().optional().meta({ description: '[PROPOSED] BE-37 figure crop (served by GET /intake/figures/{id}/image). Opaque.' }),
    region: IntakeRegionSchema.nullable().optional().meta({ description: '[PROPOSED] Crop region on `page`.' }),
  })
  .meta({ id: 'IntakeStimulus', description: 'Prototype IntakeStimulus, with the [PROPOSED] fields figureId and region.' })
export type IntakeStimulus = z.infer<typeof IntakeStimulusSchema>

/* ------------------------------------------------------------------------------------------ */
/* Quality gate (prototype validateBatch): issue shape and verbatim BM copy                    */
/* ------------------------------------------------------------------------------------------ */

/**
 * Prototype `IntakeIssue`. `questionId` is renamed `itemId` (the intake item id); `where` is
 * "Soalan <label>" plus the part label ("Soalan 3(b)"), a stimulus label, or "Kertas".
 */
export const IntakeIssueSchema = z
  .strictObject({
    itemId: IdSchema.optional().meta({ description: 'Absent for a batch-level or stimulus-level issue.' }),
    where: z.string().min(1).max(200),
    message: z.string().min(1).max(500),
  })
  .meta({ id: 'IntakeIssue', description: 'Prototype IntakeIssue (questionId renamed itemId). One failed quality-gate rule.' })
export type IntakeIssue = z.infer<typeof IntakeIssueSchema>

/** Field names used in "Medan keyakinan rendah belum disahkan: <name>." (prototype `fieldName`). */
export function intakeFieldName(field: string): string {
  switch (field) {
    case 'tag.unit':
      return 'unit DSKP'
    case 'tag.sp':
      return 'SP'
    case 'marks':
      return 'markah'
    case 'stem':
      return 'teks soalan'
    case 'scheme':
      return 'skema'
    default:
      return field
  }
}

/** The gate messages, verbatim from the prototype `validateBatch` (BM copy must not change). */
export const INTAKE_GATE_MESSAGES = {
  noQuestions: 'Tiada soalan. Tambah sekurang-kurangnya satu soalan.',
  sourceRequired: 'Pengisytiharan sumber diperlukan.',
  copyrightRequired: 'Status hak cipta diperlukan.',
  stemEmpty: 'Teks soalan kosong.',
  needsManual: 'Soalan ini perlu disemak manual. Tandakan selesai disemak.',
  mcqOptionsMin: 'Soalan objektif perlu sekurang-kurangnya 2 pilihan.',
  mcqOptionEmpty: 'Ada pilihan jawapan yang kosong.',
  mcqKeyMissing: 'Kunci jawapan belum dipilih.',
  marksPositive: 'Markah mesti lebih daripada 0.',
  partPromptEmpty: 'Teks bahagian kosong.',
  schemeMissing: 'Skema pemarkahan tiada.',
  schemePointNoLabel: 'Ada mata skema tanpa penerangan.',
  questionMarksZero: 'Jumlah markah soalan ialah 0.',
  subjectLevelMissing: 'Subjek dan tingkatan perlu ditetapkan.',
  unitMissing: 'Unit DSKP belum dipilih.',
  spMissing: 'Standard Pembelajaran (SP) belum dipilih.',
  tpRange: 'Tahap Penguasaan (TP) mesti antara 1 dan 6.',
  stimulusMissing: 'Rajah / petikan yang dirujuk tidak wujud.',
  groupNotContiguous: 'Soalan dalam satu kumpulan mesti berturutan.',
  stimulusAltMissing: 'Teks alternatif (alt) bagi rajah diperlukan.',
  /** [PROPOSED] new copy (AC4: tags valid against the taxonomy). */
  unitNotInTaxonomy: 'Unit DSKP tiada dalam senarai kurikulum.',
  /** [PROPOSED] new copy (AC4: figure references resolve to a stored crop). */
  figureNotResolved: 'Rajah belum mempunyai imej tersimpan.',
  /** `Jumlah markah skema (n) tidak sama dengan markah bahagian (m).` */
  schemeTotalPart: (scheme: number, marks: number) =>
    `Jumlah markah skema (${scheme}) tidak sama dengan markah bahagian (${marks}).`,
  /** `Jumlah markah skema (n) tidak sama dengan markah soalan (m).` */
  schemeTotalQuestion: (scheme: number, marks: number) =>
    `Jumlah markah skema (${scheme}) tidak sama dengan markah soalan (${marks}).`,
  /** `Medan keyakinan rendah belum disahkan: <name>.` */
  lowFieldUnconfirmed: (field: string) => `Medan keyakinan rendah belum disahkan: ${intakeFieldName(field)}.`,
} as const

/**
 * [PROPOSED] Which gate rules block a SINGLE accept (card AC4; the prototype blocks its whole batch
 * submit on every rule, but accept is per item and only creates a Draf; BE-10 owns the Semakan gate).
 *
 * BLOCK accept (they are the entries of `item.issues`, `blocksAccept: true`):
 *  - every per-question rule of the prototype `validateBatch` (stem, options, key, marks, parts, scheme
 *    totals, tag, TP 1..6, `needsManual`, unconfirmed low fields);
 *  - `unitNotInTaxonomy` (AC4): `tag.unit` is not a unit of the curriculum list (BE-08) for the subject,
 *    unless `formOrigin` is `T1-T3` with a null unit;
 *  - for the item's stimulus: `stimulusMissing` (unknown `stimulusId`), `stimulusAltMissing`, and
 *    `figureNotResolved` (a `diagram` stimulus with neither a stored crop `figureId` nor an `svg`);
 *    the issue carries the item id of the item being accepted and the stimulus label in `where`.
 *
 * Do NOT block accept (listed in `GET /intake/batches/{id}/review` `issues` with `blocksAccept: false`,
 * enforced later by the BE-10 submit gate): `noQuestions`, `sourceRequired`, `copyrightRequired`
 * (the declaration is BE-37) and `groupNotContiguous` (the server keeps a group contiguous on every
 * attach, so it is a defensive check only). An open exact or near duplicate entry does not block accept
 * either (accept creates a Draf); it blocks the BE-10 submit gate, "Duplicate flag resolved or marked
 * Bukan pendua".
 *
 * Shared stimulus handed to QuestionsService: the first accepted item of a stimulus group creates one
 * bank stimulus and group from a SNAPSHOT of the intake stimulus (text, caption, alt, the stored crop);
 * each later accepted item of the same group is attached to that same bank group (one stimulus, many
 * questions, D6). Items of the group that are not yet accepted keep using the intake stimulus. While any
 * accepted item uses a stimulus it is read-only here (409 on edit and delete, `stimulusInUse`): from then
 * on it is edited through the bank (BE-09).
 */
export const INTAKE_ACCEPT_BLOCKING_RULES = [
  'question',
  'unitNotInTaxonomy',
  'stimulusMissing',
  'stimulusAltMissing',
  'figureNotResolved',
] as const

/** Rules listed but not blocking an accept. */
export const INTAKE_ACCEPT_NON_BLOCKING_RULES = ['noQuestions', 'sourceRequired', 'copyrightRequired', 'groupNotContiguous'] as const
