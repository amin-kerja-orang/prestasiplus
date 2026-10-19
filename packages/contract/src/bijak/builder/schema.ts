import { z } from '../../zod'
import { IdSchema } from '../../common/ids'
import { TimestampSchema } from '../../common/time'
import { AUTH_ERROR_MESSAGES } from '../../auth/errors'
import {
  BIJAK_PAPERS_MESSAGES,
  BijakBlueprintSourceSchema,
  BijakPaperReferencePanelSchema,
} from '../papers/schema'
import { BijakAttemptGroupSchema, BijakAttemptQuestionSchema } from '../attempts/schema'

/**
 * Bijak SPM (M28) paper builder and blueprint admin: the write side of BE-15 (BE-39, contract
 * only). Admin Pusat only (D40a, D52).
 *
 * MOCK STATUS. The paper builder mock exists in the prototype
 * (`src/modules/m28-bijak-spm/{server/admin.ts, domain/admin-types.ts, domain/paper-builder.ts,
 * admin/papers}`, student-prototype commit 1507044) but is NOT pushed to GitHub yet; it is pushed
 * after the owner approves the prototype. Until then the wire shapes follow the quotes of the LEAD
 * round-2 review (`docs/plan/reviews/BE-39.md`): `AdminPaperStatus` draf | terbit; `AdminPaper`
 * sections that carry `questionIds`, with the section structure fixed by the blueprint;
 * `PaperPatch` { title?, year?, durationMin?, sections?: [{ id, questionIds }] }; `createPaper`
 * { subject, kertas, title? } returning the new id; `SectionCheck` { label, count, need, marks,
 * budget, errors, notes, ok }; `publishPaper` returning { ok: false, errors } as a normal result;
 * `previewQuestions`; `getPaperEditor` with `questions` and `groups` (`BuilderQuestion`,
 * `BuilderGroup`); a slim `BlueprintView`; an idempotent `deletePaper`. Field lists the review does
 * not quote are marked [PROPOSED] in the description of the schema or route that carries them; the
 * LEAD aligns them once the prototype code is pushed.
 *
 * COPY (D58b). Every BM string of this card is [PROPOSED] until the prototype paper-builder code is
 * pushed. The strings quoted by the review are kept verbatim (see `BIJAK_BUILDER_MESSAGES`); any
 * other string was invented here and is also [PROPOSED].
 *
 * Questions are owned by M04 (BE-09/BE-10). The student-view preview reuses the BE-16 question and
 * group views (no answer key, no scheme). Deviations from the mock are in
 * `docs/architecture/v2-backend-deviations.md`.
 */

/**
 * BM messages. `paperNotFound` is the mock copy (BE-15). The six entries marked "quoted" are quoted
 * by the LEAD review from the mock and kept verbatim; they are [PROPOSED] per D58b until the
 * prototype code is pushed. The last three entries were invented for routes that have no mock
 * (blueprint admin) and are [PROPOSED] too.
 */
export const BIJAK_BUILDER_MESSAGES = {
  paperNotFound: BIJAK_PAPERS_MESSAGES.paperNotFound,
  /** quoted [PROPOSED] */
  paperLocked: 'Kertas Terbit tidak boleh disunting. Tarik balik dahulu.',
  /** quoted [PROPOSED] */
  deleteTerbit: 'Tarik balik kertas Terbit sebelum memadam',
  /** quoted [PROPOSED] */
  titleRequired: 'Tajuk kertas diperlukan',
  /** quoted [PROPOSED] */
  invalidQuestion: 'Soalan tidak sah untuk kertas ini',
  /** quoted [PROPOSED] */
  invalidSection: 'Bahagian tidak sah',
  /** quoted [PROPOSED] */
  noBlueprint: 'Tiada blueprint untuk subjek dan kertas ini',
  /** [PROPOSED] (blueprint admin has no mock) */
  blueprintNotFound: 'Kontrak tidak ditemui',
  /** [PROPOSED] (blueprint admin has no mock) */
  blueprintExists: 'Kontrak untuk subjek dan kertas ini sudah wujud. Cipta versi baharu.',
  /** [PROPOSED] (blueprint admin has no mock) */
  blueprintAlreadyRetired: 'Kontrak ini sudah dipersara.',
} as const

/**
 * Example lines of `publishPaper` `errors` (built by the mock `checkPaper`), quoted by the review.
 * [PROPOSED] per D58b; the argument formats ("..." and X) are the review's placeholders. Further
 * lines come from `checkPaper` and are not known to this contract; clients show them verbatim.
 */
export const BIJAK_BUILDER_CHECK_LINES = {
  duplicateQuestion: (detail: string) => `Soalan berulang dalam kertas: ${detail}`,
  groupSplit: (stimulusLabel: string) =>
    `Kumpulan rangsangan ${stimulusLabel} dipecahkan antara dua bahagian`,
} as const

/** CSRF failure of every mutation (copy of `AUTH_ERROR_MESSAGES.CSRF_INVALID`). */
export const BIJAK_BUILDER_CSRF_MESSAGE = AUTH_ERROR_MESSAGES.CSRF_INVALID

/* -------------------------------------------------------------------------- shared vocabulary */

/** Kertas number (paper definitions use 1 or 2; the dictionary is open, exam schema D5). */
const Kertas = z.number().int().min(1).meta({ description: 'Kertas number.', example: 2 })

/** Leaf answer modes (exam schema D2): the vocabulary of a blueprint section `allowedModes`. */
export const BIJAK_BUILDER_ANSWER_MODES = [
  'mcq',
  'match_letter',
  'short_text',
  'numeric',
  'working',
  'essay',
  'drawing',
  'table_fill',
] as const
export const BijakBuilderAnswerModeSchema = z.enum(BIJAK_BUILDER_ANSWER_MODES).meta({
  id: 'BijakBuilderAnswerMode',
  description:
    'Leaf answer mode of a question part (exam schema D2). Used only by blueprint admin writes (no mock) [PROPOSED].',
})
export type BijakBuilderAnswerMode = z.infer<typeof BijakBuilderAnswerModeSchema>

/** Section rule of `SectionDef` / `BlueprintSection`: answer all, or choose n. */
export const BijakBuilderSectionRuleSchema = z
  .discriminatedUnion('type', [
    z.strictObject({ type: z.literal('all') }),
    z.strictObject({ type: z.literal('choose'), n: z.number().int().min(1) }),
  ])
  .meta({
    id: 'BijakBuilderSectionRule',
    description:
      '{ type: all } = answer every question; { type: choose, n } = answer n of the questions (choose-N counts only the N largest questions in the section marks).',
  })
export type BijakBuilderSectionRule = z.infer<typeof BijakBuilderSectionRuleSchema>

/** Paper lifecycle of the mock (`AdminPaperStatus`, admin-types.ts:167 as quoted by the review). */
export const BIJAK_BUILDER_PAPER_STATUSES = ['draf', 'terbit'] as const
export const BijakBuilderPaperStatusSchema = z.enum(BIJAK_BUILDER_PAPER_STATUSES).meta({
  id: 'BijakBuilderPaperStatus',
  description:
    'draf = being assembled (editable, can be deleted); terbit = published, visible in Kertas Pilihan and locked. Unpublish (tarik balik) sets the status back to draf; there is no ready or withdrawn state (deviation of the earlier contract, aligned to the mock). Mapping to BE-15 `papers.status` (draft, ready, published, withdrawn) is an implementation detail: draf = draft or withdrawn, terbit = published; the API does not expose ready.',
})
export type BijakBuilderPaperStatus = z.infer<typeof BijakBuilderPaperStatusSchema>

/* ------------------------------------------------------------------------------------ paper */

/**
 * Conformance line of one blueprint section (`SectionCheck` of `checkPaper`, quoted by the review):
 * `count` questions placed against `need`, `marks` effective marks against `budget`. `errors` hold
 * the BM lines that block publishing (for example "Bahagian A: perlu 3 soalan, hanya 2 tersedia"),
 * `notes` hold non-blocking BM lines. The BM text of `errors` and `notes` is [PROPOSED] (D58b).
 */
export const BijakBuilderSectionCheckSchema = z
  .strictObject({
    label: z.string().min(1).meta({ example: 'Bahagian A' }),
    count: z.number().int().min(0).meta({ description: 'Questions placed in the section.' }),
    need: z.number().int().min(0).meta({ description: 'Questions the blueprint section holds.' }),
    marks: z
      .number()
      .int()
      .min(0)
      .meta({ description: 'Effective marks of the placements (choose-N applied).' }),
    budget: z.number().int().min(0).meta({ description: 'Printed mark budget of the section.' }),
    errors: z.array(z.string().min(1)),
    notes: z.array(z.string().min(1)),
    ok: z.boolean().meta({ description: 'True when `errors` is empty.' }),
  })
  .meta({ id: 'BijakBuilderSectionCheck' })
export type BijakBuilderSectionCheck = z.infer<typeof BijakBuilderSectionCheckSchema>

/**
 * One section of a paper (`SectionDef`). The structure (label, rule, budget) is fixed by the
 * blueprint of the paper's subject and kertas; only `questionIds` change. Optional keys are
 * omitted when absent, as in the mock.
 */
export const BijakBuilderPaperSectionSchema = z
  .strictObject({
    id: IdSchema,
    label: z.string().min(1).meta({ example: 'Bahagian A' }),
    title: z.string().optional(),
    instruction: z
      .string()
      .optional()
      .meta({ description: 'Authored instruction; absent means derived from the rule.' }),
    compulsory: z.boolean().optional().meta({ description: '"Soalan ini mesti dijawab".' }),
    rule: BijakBuilderSectionRuleSchema,
    markBudget: z.number().int().min(0),
    questionIds: z.array(IdSchema).meta({ description: 'Placed question ids, in order.' }),
  })
  .meta({ id: 'BijakBuilderPaperSection' })
export type BijakBuilderPaperSection = z.infer<typeof BijakBuilderPaperSectionSchema>

const paperSummaryShape = {
  id: IdSchema,
  title: z.string().min(1),
  subject: z.string().min(1).meta({ description: 'Subject code.', example: 'MAT' }),
  kertas: Kertas,
  year: z.number().int(),
  durationMin: z.number().int().min(1),
  status: BijakBuilderPaperStatusSchema,
  questionCount: z.number().int().min(0).meta({ description: 'Questions placed, all sections.' }),
  marks: z.number().int().min(0).meta({ description: 'Total effective marks (derived).' }),
  budget: z
    .number()
    .int()
    .min(0)
    .meta({ description: 'Total printed mark budget of the blueprint sections.' }),
  ok: z.boolean().meta({
    description:
      'True when every section check is ok, so the paper can be published (the mock summary field).',
  }),
  updatedAt: TimestampSchema.meta({
    description:
      'Last change. The mock keeps updatedAt as an epoch number; the contract serialises a timestamp (UD-1 / ADR-0018, see the deviations log).',
  }),
}

/** One row of the admin paper list (`AdminPaperSummary`; extra fields beyond budget/ok [PROPOSED]). */
export const BijakBuilderPaperSummarySchema = z
  .strictObject(paperSummaryShape)
  .meta({ id: 'BijakBuilderPaperSummary' })
export type BijakBuilderPaperSummary = z.infer<typeof BijakBuilderPaperSummarySchema>

/** A paper with its sections (`AdminPaper`) and the live conformance lines. */
export const BijakBuilderPaperSchema = z
  .strictObject({
    ...paperSummaryShape,
    code: z
      .string()
      .min(1)
      .meta({
        description: 'Printed paper code from the blueprint, read-only [PROPOSED].',
        example: '1449/2',
      }),
    sections: z.array(BijakBuilderPaperSectionSchema),
    checks: z.array(BijakBuilderSectionCheckSchema).meta({
      description:
        'One `SectionCheck` per blueprint section (the `checkPaper` result that also feeds `publishPaper`). Where the mock exposes it is [PROPOSED].',
    }),
  })
  .meta({ id: 'BijakBuilderPaper' })
export type BijakBuilderPaper = z.infer<typeof BijakBuilderPaperSchema>

/**
 * Picker candidate (`BuilderQuestion`): a published question of the paper's subject that can be
 * placed. [PROPOSED] field list (the review names the type, not its fields): the minimum a picker
 * needs.
 */
export const BijakBuilderQuestionSchema = z
  .strictObject({
    id: IdSchema,
    stem: z.string().meta({ description: 'Question stem; may hold $latex$ spans.' }),
    topic: z.string().meta({ description: 'Display name of the curriculum unit.' }),
    marks: z.number().int().min(0).meta({ description: 'Total marks of the question.' }),
    groupId: IdSchema.optional().meta({ description: 'Stimulus group (D6), when it has one.' }),
  })
  .meta({ id: 'BijakBuilderQuestion' })
export type BijakBuilderQuestion = z.infer<typeof BijakBuilderQuestionSchema>

/**
 * Stimulus group of the picker (`BuilderGroup`): its questions must stay together in one section
 * (D6). [PROPOSED] field list.
 */
export const BijakBuilderGroupSchema = z
  .strictObject({
    id: IdSchema,
    label: z.string().min(1).meta({ description: 'Stimulus label, e.g. "Rajah 2".' }),
    questionIds: z.array(IdSchema).min(2).meta({ description: 'Question ids in published order.' }),
  })
  .meta({ id: 'BijakBuilderGroup' })
export type BijakBuilderGroup = z.infer<typeof BijakBuilderGroupSchema>

/** `GET /admin/papers/{id}` (`getPaperEditor`): the paper plus the picker candidates and groups. */
export const BijakBuilderEditorSchema = z
  .strictObject({
    paper: BijakBuilderPaperSchema,
    questions: z.array(BijakBuilderQuestionSchema),
    groups: z.array(BijakBuilderGroupSchema),
  })
  .meta({ id: 'BijakBuilderEditor' })
export type BijakBuilderEditor = z.infer<typeof BijakBuilderEditorSchema>

/** `POST /admin/papers` body (`createPaper`): the blueprint is found by subject and kertas. */
export const BijakBuilderPaperCreateSchema = z
  .strictObject({
    subject: z.string().trim().min(1).max(32).meta({ example: 'MAT' }),
    kertas: Kertas,
    title: z
      .string()
      .trim()
      .min(1, BIJAK_BUILDER_MESSAGES.titleRequired)
      .max(200)
      .optional()
      .meta({ description: 'Default title is chosen by the server when omitted [PROPOSED].' }),
  })
  .meta({ id: 'BijakBuilderPaperCreate' })
export type BijakBuilderPaperCreate = z.infer<typeof BijakBuilderPaperCreateSchema>

/** `POST /admin/papers` result: the new id. */
export const BijakBuilderPaperCreateResultSchema = z
  .strictObject({ id: IdSchema })
  .meta({ id: 'BijakBuilderPaperCreateResult' })
export type BijakBuilderPaperCreateResult = z.infer<typeof BijakBuilderPaperCreateResultSchema>

/** One section of `PaperPatch`: the section id and its full ordered question list. */
export const BijakBuilderSectionPatchSchema = z
  .strictObject({
    id: IdSchema.meta({ description: 'Id of a section of this paper (fixed by the blueprint).' }),
    questionIds: z.array(IdSchema).max(500),
  })
  .meta({ id: 'BijakBuilderSectionPatch' })
export type BijakBuilderSectionPatch = z.infer<typeof BijakBuilderSectionPatchSchema>

/**
 * `PUT /admin/papers/{id}` body (`PaperPatch`): every key optional; only the keys sent change.
 * `sections` replaces the question list of each section listed (a section that is not listed is
 * unchanged); the sections themselves cannot be added, removed or reordered.
 */
export const BijakBuilderPaperPatchSchema = z
  .strictObject({
    title: z
      .string()
      .trim()
      .min(1, BIJAK_BUILDER_MESSAGES.titleRequired)
      .max(200)
      .optional()
      .meta({ example: 'Percubaan SPM Matematik Kertas 2 Set B' }),
    year: z.number().int().min(1900).max(2100).optional(),
    durationMin: z.number().int().min(1).max(600).optional(),
    sections: z.array(BijakBuilderSectionPatchSchema).max(20).optional(),
  })
  .meta({ id: 'BijakBuilderPaperPatch' })
export type BijakBuilderPaperPatch = z.infer<typeof BijakBuilderPaperPatchSchema>

/**
 * Result of `DELETE` and of nothing else: `{ ok: true }`. The mock `deletePaper` is idempotent, so an
 * unknown id also answers success.
 */
export const BijakBuilderOkSchema = z
  .strictObject({ ok: z.literal(true) })
  .meta({ id: 'BijakBuilderOk' })
export type BijakBuilderOk = z.infer<typeof BijakBuilderOkSchema>

/**
 * `publishPaper` result: a normal 200 result, not an error. `ok: false` carries the BM lines built
 * from `checkPaper`, e.g. "Soalan berulang dalam kertas: ..." and "Kumpulan rangsangan X
 * dipecahkan antara dua bahagian". Nothing changes on `ok: false`.
 */
export const BijakBuilderPublishResultSchema = z
  .discriminatedUnion('ok', [
    z.strictObject({ ok: z.literal(true) }),
    z.strictObject({ ok: z.literal(false), errors: z.array(z.string().min(1)).min(1) }),
  ])
  .meta({ id: 'BijakBuilderPublishResult' })
export type BijakBuilderPublishResult = z.infer<typeof BijakBuilderPublishResultSchema>

/**
 * `GET /admin/papers/{id}/preview` (`previewQuestions`): the saved questions of the paper as a
 * student sees them. Reuses the BE-16 student views, so every question carries its option bank and
 * every group its stimulus, and nothing carries an answer key or scheme. Shape [PROPOSED] (the
 * review names `previewQuestions`, not its result type).
 */
export const BijakBuilderPreviewSchema = z
  .strictObject({
    questions: z.array(BijakAttemptQuestionSchema),
    groups: z.array(BijakAttemptGroupSchema),
  })
  .meta({ id: 'BijakBuilderPreview' })
export type BijakBuilderPreview = z.infer<typeof BijakBuilderPreviewSchema>

/** Query of `GET /admin/papers`. */
export const BijakBuilderPaperListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).optional(),
    pageSize: z.coerce.number().int().min(1).max(100).optional(),
    status: BijakBuilderPaperStatusSchema.optional(),
  })
  .meta({ id: 'BijakBuilderPaperListQuery' })
export type BijakBuilderPaperListQuery = z.infer<typeof BijakBuilderPaperListQuerySchema>

/* ----------------------------------------------------------------------------- error bodies */

/** 403 on a mutation without a valid `X-CSRF-Token`. */
export const BijakBuilderCsrfErrorSchema = z
  .object({
    error: z.object({
      code: z.literal('CSRF_INVALID'),
      message: z.literal(BIJAK_BUILDER_CSRF_MESSAGE),
      requestId: z.string().optional(),
    }),
  })
  .meta({ id: 'BijakBuilderCsrfError' })

/* ===================================================================== blueprint admin ===== */

/**
 * Blueprint ("Kontrak") as read by the builder: the slim `BlueprintView` [PROPOSED field list]. The
 * internal `pool` tag and the cover texts are not part of the view. Read model of the five blueprint
 * routes; the blueprint WRITE routes have no mock and are kept only because the card requires them.
 */
export const BijakBlueprintViewSchema = z
  .strictObject({
    id: IdSchema.meta({ description: 'Blueprint (family) id; stable over versions.' }),
    subject: z.string().min(1).meta({ example: 'MAT' }),
    subjectName: z.string().min(1),
    kertas: Kertas,
    version: z.number().int().min(1).meta({ description: 'Latest version (no mock).' }),
    status: z.enum(['active', 'retired']).meta({
      description:
        'active = selectable by new papers; retired = no longer selectable (no mock, [PROPOSED]).',
    }),
    source: BijakBlueprintSourceSchema.meta({
      description: 'Provenance tag (Disahkan, Spec, Draf).',
    }),
    code: z.string().min(1).meta({ example: '1449/2' }),
    durationMin: z.number().int().min(1),
    sections: z
      .array(
        z.strictObject({
          label: z.string().min(1).meta({ example: 'Bahagian A' }),
          rule: BijakBuilderSectionRuleSchema,
          take: z.number().int().min(0).meta({ description: 'Questions the section holds.' }),
          markBudget: z.number().int().min(0),
          compulsory: z.boolean().optional(),
          instruction: z.string().optional(),
        }),
      )
      .min(1),
  })
  .meta({ id: 'BijakBlueprintView' })
export type BijakBlueprintView = z.infer<typeof BijakBlueprintViewSchema>

/** Section of a blueprint as written by the admin (NO MOCK: kept because the card requires blueprint writes). */
export const BijakBlueprintAdminSectionInputSchema = z
  .strictObject({
    label: z.string().trim().min(1).max(100).meta({ example: 'Bahagian A' }),
    rule: BijakBuilderSectionRuleSchema,
    pool: z
      .string()
      .trim()
      .min(1)
      .max(64)
      .meta({ description: 'Pool tag the section draws from (internal; not shown to students).' }),
    take: z.number().int().min(1).max(500),
    markBudget: z.number().int().min(0).max(1000),
    compulsory: z.boolean().optional().meta({ description: 'Default: false.' }),
    instruction: z.string().max(500).nullable().optional(),
    allowedModes: z
      .array(BijakBuilderAnswerModeSchema)
      .max(8)
      .optional()
      .meta({ description: 'Leaf modes the section allows; omitted or empty = any mode.' }),
  })
  .meta({ id: 'BijakBlueprintAdminSectionInput' })
export type BijakBlueprintAdminSectionInput = z.infer<typeof BijakBlueprintAdminSectionInputSchema>

const blueprintVersionInputShape = {
  source: BijakBlueprintSourceSchema,
  code: z.string().trim().min(1).max(32).meta({ example: '1449/2' }),
  durationMin: z.number().int().min(1).max(600),
  instructions: z
    .array(z.string().max(500))
    .max(30)
    .optional()
    .meta({ description: 'Cover instruction lines. Default: empty.' }),
  reference: z.array(BijakPaperReferencePanelSchema).max(10).optional().meta({
    description: 'Reference-sheet panels. Default: empty.',
  }),
  sections: z.array(BijakBlueprintAdminSectionInputSchema).min(1).max(20),
}

/** `POST /admin/blueprints/{id}/versions` body (NO MOCK): the full content of the new version. */
export const BijakBlueprintAdminVersionInputSchema = z
  .strictObject(blueprintVersionInputShape)
  .meta({ id: 'BijakBlueprintAdminVersionInput' })
export type BijakBlueprintAdminVersionInput = z.infer<typeof BijakBlueprintAdminVersionInputSchema>

/** `POST /admin/blueprints` body (NO MOCK): subject and kertas identify the blueprint; this is version 1. */
export const BijakBlueprintAdminCreateSchema = z
  .strictObject({
    subject: z.string().trim().min(1).max(32).meta({ example: 'MAT' }),
    kertas: Kertas,
    ...blueprintVersionInputShape,
  })
  .meta({ id: 'BijakBlueprintAdminCreate' })
export type BijakBlueprintAdminCreate = z.infer<typeof BijakBlueprintAdminCreateSchema>

/** Query of `GET /admin/blueprints`. */
export const BijakBlueprintListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).optional(),
    pageSize: z.coerce.number().int().min(1).max(100).optional(),
    subject: z.string().max(32).optional().meta({ description: 'Subject code.' }),
    kertas: z.coerce.number().int().min(1).optional(),
  })
  .meta({ id: 'BijakBlueprintListQuery' })
export type BijakBlueprintListQuery = z.infer<typeof BijakBlueprintListQuerySchema>
