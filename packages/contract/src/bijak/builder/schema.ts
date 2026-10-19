import { z } from '../../zod'
import { IdSchema } from '../../common/ids'
import { TimestampSchema } from '../../common/time'
import { AUTH_ERROR_MESSAGES } from '../../auth/errors'
import {
  BIJAK_PAPERS_MESSAGES,
  BijakBlueprintSourceSchema,
  BijakPaperReferencePanelSchema,
} from '../papers/schema'
import {
  BijakAttemptOptionSchema,
  BijakAttemptQuestionSchema,
  BijakAttemptStimulusSchema,
} from '../attempts/schema'

/**
 * Bijak SPM (M28) paper builder and blueprint admin: the write side of BE-15 (BE-39, contract
 * only). Admin Pusat only (D40a, D52).
 *
 * MOCK STATUS. The paper builder mock lives in the prototype
 * (`src/modules/m28-bijak-spm/{server/admin.ts, domain/admin-types.ts, domain/paper-builder.ts,
 * admin/papers}`, student-prototype commit 1507044). It is not on GitHub yet, so this contract was
 * written from the field names, statuses and BM strings that the LEAD review (rounds 2 and 3,
 * `docs/plan/reviews/BE-39.md`) quotes from it. Those quotes were checked by the LEAD against
 * `server/admin.ts`: the BM strings of `BIJAK_BUILDER_MESSAGES` are confirmed verbatim. Shapes taken
 * from the mock: `AdminPaperStatus` draf | terbit; `AdminPaper` (extends `PaperDef`, so it carries
 * `instructions`, `reference`, `createdAt`, `publishedAt?` and a per-section `questionCount`);
 * `AdminPaperSummary` (with `subjectName`, `code`, `budget`, `ok`); `PaperPatch`; `createPaper`;
 * `publishPaper` `{ ok, errors }`; `PaperEditorData` `{ paper, blueprint, questions, groups }`
 * (`BuilderQuestion`, `BuilderGroup`); `previewQuestions(ids)`; `BlueprintView`; idempotent
 * `deletePaper`. What the review does not quote (the value set of `kind`, the field list of the
 * preview `ReviewQuestion`, the HTTP mapping of the mock's `bad_request`, every route or string
 * that has no mock) is marked [PROPOSED] where it appears; the LEAD aligns it when the mock is
 * pushed. Every deliberate difference from the mock is a row in
 * `docs/architecture/v2-backend-deviations.md`.
 *
 * Questions are owned by M04 (BE-09/BE-10). The stimulus, option and question-view shapes of the
 * preview reuse the BE-16 student views (no answer key, no scheme).
 */

/**
 * BM messages. Every entry except the last three is quoted from the mock `server/admin.ts` and
 * confirmed by the LEAD round-3 review. The last three were invented for blueprint admin, which has
 * no mock, and are [PROPOSED].
 */
export const BIJAK_BUILDER_MESSAGES = {
  paperNotFound: BIJAK_PAPERS_MESSAGES.paperNotFound,
  paperLocked: 'Kertas Terbit tidak boleh disunting. Tarik balik dahulu.',
  deleteTerbit: 'Tarik balik kertas Terbit sebelum memadam',
  titleRequired: 'Tajuk kertas diperlukan',
  invalidQuestion: 'Soalan tidak sah untuk kertas ini',
  invalidSection: 'Bahagian tidak sah',
  noBlueprint: 'Tiada blueprint untuk subjek dan kertas ini',
  /** [PROPOSED] (blueprint admin has no mock) */
  blueprintNotFound: 'Kontrak tidak ditemui',
  /** [PROPOSED] (blueprint admin has no mock) */
  blueprintExists: 'Kontrak untuk subjek dan kertas ini sudah wujud. Cipta versi baharu.',
  /** [PROPOSED] (blueprint admin has no mock) */
  blueprintAlreadyRetired: 'Kontrak ini sudah dipersara.',
} as const

/**
 * Lines of `publishPaper` `errors`, as built by the mock `checkPaper` (quoted by the LEAD review;
 * N, X, Y, M, B, G are placeholders). The per-section lines are prefixed with `{label}: ` (the
 * section label, e.g. "Bahagian A: "). Clients show every line verbatim, so this list is
 * documentation, not a closed set.
 */
export const BIJAK_BUILDER_CHECK_LINES = {
  tooFew: 'Kurang N soalan (perlu X, ada Y)',
  marksMismatch: 'Markah M tidak sama dengan bajet B',
  notPublished: '{N} soalan belum Terbit',
  groupNotConsecutive: 'Kumpulan rangsangan G tidak berturutan',
  incomplete: 'tidak lengkap',
  duplicateQuestion: 'Soalan berulang dalam kertas: ...',
  groupSplit: 'Kumpulan rangsangan X dipecahkan antara dua bahagian',
} as const

/** CSRF failure of every mutation (copy of `AUTH_ERROR_MESSAGES.CSRF_INVALID`). */
export const BIJAK_BUILDER_CSRF_MESSAGE = AUTH_ERROR_MESSAGES.CSRF_INVALID

/* -------------------------------------------------------------------------- shared vocabulary */

/** Kertas number (the mock types it 1 | 2; the dictionary is open in v2, exam schema D5). */
const Kertas = z.number().int().min(1).meta({ description: 'Kertas number.', example: 2 })

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

/** Paper lifecycle of the mock (`AdminPaperStatus`, admin-types.ts:167). */
export const BIJAK_BUILDER_PAPER_STATUSES = ['draf', 'terbit'] as const
export const BijakBuilderPaperStatusSchema = z.enum(BIJAK_BUILDER_PAPER_STATUSES).meta({
  id: 'BijakBuilderPaperStatus',
  description:
    'draf = being assembled (editable, can be deleted); terbit = published, visible in Kertas Pilihan and locked. Unpublish (tarik balik) sets the status back to draf; there is no ready or withdrawn state. Mapping to BE-15 `papers.status` (draft, ready, published, withdrawn) is internal: draf = draft or withdrawn, terbit = published; ready is not exposed.',
})
export type BijakBuilderPaperStatus = z.infer<typeof BijakBuilderPaperStatusSchema>

/** Question lifecycle codes of D54(a), as on every question wire shape; `BuilderQuestion.status`. */
export const BIJAK_BUILDER_QUESTION_STATUSES = [
  'draft',
  'review',
  'approved',
  'published',
  'archived',
] as const
export const BijakBuilderQuestionStatusSchema = z.enum(BIJAK_BUILDER_QUESTION_STATUSES).meta({
  id: 'BijakBuilderQuestionStatus',
  description:
    'Question lifecycle code (D54a): draft, review, approved, published, archived. The mock status values are realigned to these codes at the http switch.',
})
export type BijakBuilderQuestionStatus = z.infer<typeof BijakBuilderQuestionStatusSchema>

/* ------------------------------------------------------------------------------------ paper */

/**
 * One section of a paper (`SectionDef`). The structure (label, rule, budget, count) is fixed by the
 * blueprint of the paper's subject and kertas; only `questionIds` change. Optional keys are omitted
 * when absent, as in the mock.
 */
export const BijakBuilderPaperSectionSchema = z
  .strictObject({
    id: IdSchema,
    label: z.string().min(1).meta({ example: 'Bahagian A' }),
    title: z.string().optional(),
    markBudget: z
      .number()
      .int()
      .min(0)
      .meta({ description: 'Marks after choose-N (printed budget).' }),
    questionCount: z
      .number()
      .int()
      .min(0)
      .meta({
        description: 'Questions the section holds on the paper (not the number to answer).',
      }),
    compulsory: z.boolean().optional().meta({ description: '"Soalan ini mesti dijawab".' }),
    instruction: z
      .string()
      .optional()
      .meta({ description: 'Authored instruction; absent means derived from the rule.' }),
    rule: BijakBuilderSectionRuleSchema,
    questionIds: z.array(IdSchema).meta({ description: 'Placed question ids, in order.' }),
  })
  .meta({ id: 'BijakBuilderPaperSection' })
export type BijakBuilderPaperSection = z.infer<typeof BijakBuilderPaperSectionSchema>

/** Reference-sheet panel of `PaperDef.reference` (same shape as the BE-15 cover panel). */
const ReferencePanels = z.array(BijakPaperReferencePanelSchema)

/**
 * A paper (`AdminPaper`, which extends `PaperDef`): header, cover instructions, reference sheet and
 * sections. `createdAt`, `updatedAt` and `publishedAt` are numbers in the mock and timestamps here
 * (deviations log). The mock keeps the conformance result (`checkOf`) server-side, so it is not
 * part of this shape; `publishPaper` returns its lines as `errors`.
 */
export const BijakBuilderPaperSchema = z
  .strictObject({
    id: IdSchema,
    title: z.string().min(1),
    subject: z.string().min(1).meta({ description: 'Subject code.', example: 'MAT' }),
    kertas: Kertas,
    year: z.number().int(),
    code: z.string().min(1).meta({ description: 'Printed paper code.', example: '1449/2' }),
    durationMin: z.number().int().min(1),
    instructions: z.array(z.string()).meta({ description: 'Cover instruction lines, verbatim.' }),
    reference: ReferencePanels.optional().meta({
      description: 'Reference-sheet panels; absent when the paper has none.',
    }),
    sections: z.array(BijakBuilderPaperSectionSchema),
    status: BijakBuilderPaperStatusSchema,
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema,
    publishedAt: TimestampSchema.optional().meta({
      description: 'Time of the latest publish; absent while the paper has never been published.',
    }),
  })
  .meta({ id: 'BijakBuilderPaper' })
export type BijakBuilderPaper = z.infer<typeof BijakBuilderPaperSchema>

/** One row of the admin paper list (`AdminPaperSummary`: with `subjectName` and `code`, `budget` and `ok`). */
export const BijakBuilderPaperSummarySchema = z
  .strictObject({
    id: IdSchema,
    title: z.string().min(1),
    subject: z.string().min(1).meta({ description: 'Subject code.', example: 'MAT' }),
    subjectName: z.string().min(1).meta({ example: 'Matematik' }),
    kertas: Kertas,
    year: z.number().int(),
    code: z.string().min(1).meta({ example: '1449/2' }),
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
      description: 'True when the paper passes the publish check (no `errors` would be returned).',
    }),
    updatedAt: TimestampSchema,
  })
  .meta({ id: 'BijakBuilderPaperSummary' })
export type BijakBuilderPaperSummary = z.infer<typeof BijakBuilderPaperSummarySchema>

/**
 * Picker candidate (`BuilderQuestion`): a question of the paper's subject that can be placed. Fields
 * exactly as quoted by the LEAD review: id, groupId?, stimulusLabel?, preview, marks, kind
 * (QuestionKind), topic, status, kertas, subject. The value set of `kind` is not quoted [PROPOSED].
 */
export const BijakBuilderQuestionSchema = z
  .strictObject({
    id: IdSchema,
    groupId: IdSchema.optional().meta({ description: 'Stimulus group (D6), when it has one.' }),
    stimulusLabel: z
      .string()
      .optional()
      .meta({ description: 'Label of the group stimulus, e.g. "Rajah 2".' }),
    preview: z
      .string()
      .meta({ description: 'Start of the stem for the picker; may hold $latex$ spans.' }),
    marks: z.number().int().min(0).meta({ description: 'Total marks of the question.' }),
    kind: z.string().min(1).meta({
      description:
        'QuestionKind of the mock (for example mcq or a structured kind). The value set is not quoted by the review [PROPOSED].',
    }),
    topic: z.string().meta({ description: 'Display name of the curriculum unit.' }),
    status: BijakBuilderQuestionStatusSchema,
    kertas: Kertas,
    subject: z.string().min(1).meta({ example: 'MAT' }),
  })
  .meta({ id: 'BijakBuilderQuestion' })
export type BijakBuilderQuestion = z.infer<typeof BijakBuilderQuestionSchema>

/**
 * Stimulus group of the picker (`BuilderGroup` = { id, stimulus: StimulusDef, questionIds }); its
 * questions must stay together in one section (D6). `stimulus` reuses the BE-16 stimulus shape.
 */
export const BijakBuilderGroupSchema = z
  .strictObject({
    id: IdSchema,
    stimulus: BijakAttemptStimulusSchema,
    questionIds: z.array(IdSchema).meta({ description: 'Question ids in published order.' }),
  })
  .meta({ id: 'BijakBuilderGroup' })
export type BijakBuilderGroup = z.infer<typeof BijakBuilderGroupSchema>

/** One section of a blueprint as the builder reads it (`BlueprintView.sections[]`, fields as quoted). */
export const BijakBlueprintViewSectionSchema = z
  .strictObject({
    label: z.string().min(1).meta({ example: 'Bahagian A' }),
    markBudget: z.number().int().min(0),
    questionCount: z.number().int().min(0).meta({ description: 'Questions the section holds.' }),
    compulsory: z.boolean(),
    instruction: z.string().meta({ description: 'Authored instruction; empty string when none.' }),
    rule: BijakBuilderSectionRuleSchema,
    pool: z.string().min(1).meta({
      description:
        'Pool tag the section draws from; the builder uses it to suggest questions (internal, never sent to students).',
    }),
  })
  .meta({ id: 'BijakBlueprintViewSection' })

/**
 * Blueprint ("Kontrak") as the builder reads it: `BlueprintView` exactly as quoted by the review
 * (subject, subjectName, kertas, source, code, durationMin, instructions, totalMarks, sections).
 * It has no id, version or status: a blueprint is addressed by subject and kertas.
 */
export const BijakBlueprintViewSchema = z
  .strictObject({
    subject: z.string().min(1).meta({ example: 'MAT' }),
    subjectName: z.string().min(1),
    kertas: Kertas.meta({ description: 'Kertas number (the mock types it 1 | 2).' }),
    source: BijakBlueprintSourceSchema.meta({
      description: 'Provenance tag (Disahkan, Spec, Draf).',
    }),
    code: z.string().min(1).meta({ example: '1449/2' }),
    durationMin: z.number().int().min(1),
    instructions: z.array(z.string()),
    totalMarks: z
      .number()
      .int()
      .min(0)
      .meta({ description: 'Sum of the section mark budgets (derived).' }),
    sections: z.array(BijakBlueprintViewSectionSchema).min(1),
  })
  .meta({ id: 'BijakBlueprintView' })
export type BijakBlueprintView = z.infer<typeof BijakBlueprintViewSchema>

/** `GET /admin/papers/{id}` (`getPaperEditor`, `PaperEditorData`): paper, its blueprint, picker candidates and groups. */
export const BijakBuilderEditorSchema = z
  .strictObject({
    paper: BijakBuilderPaperSchema,
    blueprint: BijakBlueprintViewSchema.nullable().meta({
      description: 'The blueprint of the paper subject and kertas; null when there is none.',
    }),
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
 * Result of `DELETE` (and of retiring a blueprint): `{ ok: true }`. The mock `deletePaper` is
 * idempotent, so an unknown id also answers success.
 */
export const BijakBuilderOkSchema = z
  .strictObject({ ok: z.literal(true) })
  .meta({ id: 'BijakBuilderOk' })
export type BijakBuilderOk = z.infer<typeof BijakBuilderOkSchema>

/**
 * `publishPaper` result `{ ok: boolean, errors: string[] }`, a normal 200 result and not an error
 * (server/admin.ts): `ok: true` comes with `errors: []`; `ok: false` carries the BM lines built by
 * `checkPaper` (see `BIJAK_BUILDER_CHECK_LINES`, prefixed with the section label). Nothing changes on
 * `ok: false`.
 */
export const BijakBuilderPublishResultSchema = z
  .strictObject({
    ok: z.boolean(),
    errors: z.array(z.string()).meta({ description: 'Empty when ok is true.' }),
  })
  .meta({ id: 'BijakBuilderPublishResult' })
export type BijakBuilderPublishResult = z.infer<typeof BijakBuilderPublishResultSchema>

/** `POST /admin/papers/preview` body (`previewQuestions(ids)`): the ids currently in the editor, saved or not. */
export const BijakBuilderPreviewRequestSchema = z
  .strictObject({
    ids: z
      .array(IdSchema)
      .max(500)
      .meta({ description: 'Question ids to preview (may be unsaved edits).' }),
  })
  .meta({ id: 'BijakBuilderPreviewRequest' })
export type BijakBuilderPreviewRequest = z.infer<typeof BijakBuilderPreviewRequestSchema>

/**
 * `ReviewQuestion` of the preview: a question as a student sees it, without number, section or option
 * bank (the bank is in `optionBanks`, the stimulus in `stimuli`). The review names the type, not its
 * fields, so the field list is derived from the BE-16 student question view [PROPOSED]. No answer key.
 */
export const BijakBuilderReviewQuestionSchema = BijakAttemptQuestionSchema.omit({
  number: true,
  sectionId: true,
  optionBank: true,
}).meta({ id: 'BijakBuilderReviewQuestion' })
export type BijakBuilderReviewQuestion = z.infer<typeof BijakBuilderReviewQuestionSchema>

/**
 * `previewQuestions` result: `{ questions, stimuli, optionBanks }`, the last two keyed by group id
 * (`Record<groupId, StimulusDef>` and `Record<groupId, McqOption[]>`).
 */
export const BijakBuilderPreviewSchema = z
  .strictObject({
    questions: z.array(BijakBuilderReviewQuestionSchema),
    stimuli: z.record(z.string(), BijakAttemptStimulusSchema),
    optionBanks: z.record(z.string(), z.array(BijakAttemptOptionSchema)),
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
 * Section of a blueprint as written by the admin (NO MOCK: the card requires blueprint writes). The
 * field names are those of `BlueprintView.sections[]`; `compulsory` and `instruction` may be left
 * out (defaults false and empty).
 */
export const BijakBlueprintAdminSectionInputSchema = z
  .strictObject({
    label: z.string().trim().min(1).max(100).meta({ example: 'Bahagian A' }),
    markBudget: z.number().int().min(0).max(1000),
    questionCount: z.number().int().min(1).max(500),
    compulsory: z.boolean().optional().meta({ description: 'Default: false.' }),
    instruction: z.string().max(500).optional().meta({ description: 'Default: empty.' }),
    rule: BijakBuilderSectionRuleSchema,
    pool: z.string().trim().min(1).max(64),
  })
  .meta({ id: 'BijakBlueprintAdminSectionInput' })
export type BijakBlueprintAdminSectionInput = z.infer<typeof BijakBlueprintAdminSectionInputSchema>

const blueprintVersionInputShape = {
  source: BijakBlueprintSourceSchema,
  code: z.string().trim().min(1).max(32).meta({ example: '1449/2' }),
  durationMin: z.number().int().min(1).max(600),
  instructions: z.array(z.string().max(500)).max(30).optional().meta({
    description: 'Cover instruction lines. Default: empty.',
  }),
  reference: ReferencePanels.max(10).optional().meta({
    description:
      'Reference-sheet panels for papers made from this blueprint. Write-only here: `BlueprintView` does not carry it.',
  }),
  sections: z.array(BijakBlueprintAdminSectionInputSchema).min(1).max(20),
}

/** `POST /admin/blueprints/{subject}/{kertas}/versions` body (NO MOCK): the full content of the new version. */
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
