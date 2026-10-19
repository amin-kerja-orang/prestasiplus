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
  BijakAttemptPartViewSchema,
  BijakAttemptStimulusSchema,
} from '../attempts/schema'

/**
 * Bijak SPM (M28) paper builder and blueprint admin: the write side of BE-15 (BE-39, contract
 * only). Admin Pusat only (D40a, D52).
 *
 * SOURCE. The behavioural spec is the prototype paper-builder mock, kept as a read-only snapshot in
 * `docs/reference/bijak-paper-builder-mock/` (`server_admin.ts.txt` = `server/admin.ts`,
 * `domain_admin-types.ts.txt`, `domain_paper-builder.ts.txt`, `domain_blueprint.ts.txt`; taken from
 * `feature/student-prototype` at f9eeded5). Field names, statuses, result shapes, BM strings and the
 * `checkPaper` lines below are copied from it. A string or a field is marked [PROPOSED] only where
 * the snapshot does not cover it (blueprint admin writes, route paths, HTTP codes of the mock's
 * `bad_request`). Every deliberate difference from the mock is a row in
 * `docs/architecture/v2-backend-deviations.md`.
 *
 * Mock operations behind the routes: `createPaper`, `savePaper` (PaperPatch), `publishPaper`
 * ({ ok, errors }), `unpublishPaper`, `deletePaper` (idempotent), `getPaperEditor`,
 * `previewQuestions`, `listAdminPapers`, `listBlueprints`. The mock keeps `SectionCheck` and
 * `PaperCheck` server-side; the wire shows only their result (`budget`, `ok` on the list row and the
 * publish `errors`).
 *
 * Questions are owned by M04 (BE-09/BE-10). Stimulus, option and part shapes reuse the BE-16 views,
 * which have the same fields as the mock `StimulusDef`, `McqOption` and `PartDef`.
 */

/**
 * BM messages, all copied from the snapshot (`server_admin.ts.txt`). The last three were invented
 * for blueprint admin, which has no mock, and are [PROPOSED].
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
 * The BM lines of `publishPaper` `errors`, built exactly as `checkPaper` and `publishPaper` build
 * them (`domain_paper-builder.ts.txt`, `server_admin.ts.txt`). Paper-wide lines (duplicates, a group
 * split between sections) come first and are not prefixed; each section line is prefixed with
 * `{label}: ` through `sectionLine`. `group` is a group id. Clients show every line verbatim.
 */
export const BIJAK_BUILDER_CHECK_LINES = {
  duplicateQuestion: (ids: readonly string[]) => `Soalan berulang dalam kertas: ${ids.join(', ')}`,
  groupSplit: (group: string) => `Kumpulan rangsangan ${group} dipecahkan antara dua bahagian`,
  tooFew: (need: number, have: number) =>
    `Kurang ${need - have} soalan (perlu ${need}, ada ${have})`,
  tooMany: (need: number, have: number) =>
    `Lebih ${have - need} soalan (perlu ${need}, ada ${have})`,
  marksMismatch: (marks: number, budget: number) =>
    `Markah ${marks} tidak sama dengan bajet ${budget}`,
  groupNotConsecutive: (group: string) => `Kumpulan rangsangan ${group} tidak berturutan`,
  groupIncomplete: (group: string, missing: number) =>
    `Kumpulan rangsangan ${group} tidak lengkap (${missing} soalan tiada)`,
  notPublished: (count: number) => `${count} soalan belum Terbit`,
  sectionLine: (label: string, line: string) => `${label}: ${line}`,
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

/**
 * Question lifecycle codes of D54(a), as on every question wire shape; `BuilderQuestion.status`. The
 * mock `QuestionStatus` is semakan | terbit | draf | ditolak; the mapping is a deviation row.
 */
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
    'Question lifecycle code (D54a): draft, review, approved, published, archived. Mock mapping: semakan = review, terbit = published, draf = draft; ditolak (rejected) has no D54 code and maps to draft [PROPOSED]. The builder offers only published questions as candidates; a paper can reference questions of any status, and publish refuses any that is not published ("{N} soalan belum Terbit").',
})
export type BijakBuilderQuestionStatus = z.infer<typeof BijakBuilderQuestionStatusSchema>

/** `QuestionKind` of the mock (admin-types.ts): objektif (MCQ), berstruktur, esei (rubric-marked). */
export const BIJAK_BUILDER_QUESTION_KINDS = ['objektif', 'berstruktur', 'esei'] as const
export const BijakBuilderQuestionKindSchema = z.enum(BIJAK_BUILDER_QUESTION_KINDS).meta({
  id: 'BijakBuilderQuestionKind',
  description:
    'QuestionKind of the mock: objektif = MCQ, esei = a structured question with a rubric leaf, berstruktur = any other structured question.',
})
export type BijakBuilderQuestionKind = z.infer<typeof BijakBuilderQuestionKindSchema>

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
    questionCount: z.number().int().min(0).meta({
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

/** One row of the admin paper list (`AdminPaperSummary`, fields exactly as the mock). */
export const BijakBuilderPaperSummarySchema = z
  .strictObject({
    id: IdSchema,
    title: z.string().min(1),
    subject: z.string().min(1).meta({ description: 'Subject code.', example: 'MAT' }),
    subjectName: z.string().min(1).meta({ example: 'Matematik' }),
    kertas: Kertas,
    code: z.string().min(1).meta({ example: '1449/2' }),
    status: BijakBuilderPaperStatusSchema,
    questionCount: z.number().int().min(0).meta({ description: 'Questions placed, all sections.' }),
    marks: z
      .number()
      .int()
      .min(0)
      .meta({ description: 'Total effective marks (choose-N applied), derived by checkPaper.' }),
    budget: z
      .number()
      .int()
      .min(0)
      .meta({ description: 'Total printed mark budget of the blueprint sections.' }),
    ok: z.boolean().meta({
      description:
        'checkPaper `ok`: no paper-wide error and every section ok (publish would succeed).',
    }),
    updatedAt: TimestampSchema,
  })
  .meta({ id: 'BijakBuilderPaperSummary' })
export type BijakBuilderPaperSummary = z.infer<typeof BijakBuilderPaperSummarySchema>

/**
 * A question as the builder shows it (`BuilderQuestion`): the picker candidates (published questions
 * of the paper's subject and kertas) and every question the paper already references.
 */
export const BijakBuilderQuestionSchema = z
  .strictObject({
    id: IdSchema,
    groupId: IdSchema.optional().meta({ description: 'Stimulus group (D6), when it has one.' }),
    stimulusLabel: z
      .string()
      .optional()
      .meta({ description: 'Label of the group stimulus, e.g. "Rajah 2".' }),
    preview: z.string().meta({
      description:
        'Stem followed by the first part label and prompt when the first part is a leaf; may hold $latex$ spans.',
    }),
    marks: z.number().int().min(0).meta({ description: 'Total marks of the question.' }),
    kind: BijakBuilderQuestionKindSchema,
    topic: z.string().meta({ description: 'Display name of the curriculum unit (unitLabel).' }),
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
    markBudget: z
      .number()
      .int()
      .min(0)
      .meta({ description: 'Marks after choose-N; the mock defaults it to the question count.' }),
    questionCount: z.number().int().min(0).meta({ description: 'Questions the section holds.' }),
    compulsory: z.boolean(),
    instruction: z.string().meta({
      description:
        'Authored instruction, else the derived line ("Jawab semua soalan." or "Jawab N daripada M soalan."); never empty in the mock view.',
    }),
    rule: BijakBuilderSectionRuleSchema,
    pool: z.string().min(1).meta({
      description:
        'Pool the section draws from in Jana Kertas; the builder uses it to suggest questions.',
    }),
  })
  .meta({ id: 'BijakBlueprintViewSection' })

/**
 * Blueprint ("Kontrak") as the builder reads it (`BlueprintView`, fields exactly as the mock). It has
 * no id, version or status: a blueprint is addressed by subject and kertas, as the mock does.
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

/**
 * `GET /admin/papers/{id}` and the result of `PUT` (`PaperEditorData`): the paper, its blueprint, every
 * question the paper references plus the picker candidates, and their stimulus groups.
 */
export const BijakBuilderEditorSchema = z
  .strictObject({
    paper: BijakBuilderPaperSchema,
    blueprint: BijakBlueprintViewSchema.nullable().meta({
      description:
        'The blueprint of the paper subject and kertas (any source, Draf included); null when there is none.',
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
    title: z.string().max(200).optional().meta({
      description:
        'Trimmed; omitted or blank = the default "Percubaan SPM {subjectName} Kertas {kertas} (draf)" (the mock ignores a blank title on create).',
    }),
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
 * Result of `DELETE`, of unpublish (withdraw) and of retiring a blueprint: `{ ok: true }`. The mock
 * `deletePaper` and `unpublishPaper` return void; `deletePaper` is idempotent, so an unknown id also
 * answers success (deviations log).
 */
export const BijakBuilderOkSchema = z
  .strictObject({ ok: z.literal(true) })
  .meta({ id: 'BijakBuilderOk' })
export type BijakBuilderOk = z.infer<typeof BijakBuilderOkSchema>

/**
 * `publishPaper` result `{ ok: boolean, errors: string[] }` (`PublishPaperResult`), a normal 200
 * result and not an error: `ok: true` comes with `errors: []` and the paper becomes terbit;
 * `ok: false` carries the BM lines of `checkPaper` (see `BIJAK_BUILDER_CHECK_LINES`: paper-wide lines
 * first, then each section line prefixed with `{label}: `). Nothing changes on `ok: false`.
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

/** Curriculum tag of a question (`CurriculumTag`, exam schema D9). */
export const BijakBuilderCurriculumTagSchema = z
  .strictObject({
    subject: z.string().min(1).meta({ example: 'MAT' }),
    level: z.enum(['T4', 'T5', 'T4+T5']),
    unit: z.string().nullable().meta({ description: 'DSKP unit code, null outside the DSKP.' }),
    unitLabel: z.string().meta({ description: 'Display name of the unit.' }),
    sp: z.array(z.string()),
    tp: z.number().int(),
    formOrigin: z.enum(['T1-T3', 'T4', 'T5']),
  })
  .meta({ id: 'BijakBuilderCurriculumTag' })

/** One line of a mark scheme as the review shows it (`SchemeLine`). */
export const BijakBuilderSchemeLineSchema = z
  .strictObject({
    tag: z.string().optional().meta({ example: 'K1' }),
    text: z.string(),
    marks: z.number().int().min(0).optional(),
  })
  .meta({ id: 'BijakBuilderSchemeLine' })

/**
 * `ReviewQuestion` of the mock, as `previewQuestions` returns it: the question content (stem,
 * curriculum tag, MCQ options with `correct`, parts) and its mark scheme per leaf id (the question id
 * for an MCQ; null when a leaf has no scheme). This is the ADMIN review shape and carries the answer
 * key and scheme lines (for example "Jawapan betul: A"): the route is Admin Pusat only and nothing of
 * it reaches students.
 */
export const BijakBuilderReviewQuestionSchema = z
  .strictObject({
    id: IdSchema,
    stem: z.string(),
    marks: z.number().int().min(0),
    curriculum: BijakBuilderCurriculumTagSchema,
    mcq: z
      .strictObject({
        options: z.array(BijakAttemptOptionSchema),
        correct: z.string().optional().meta({ description: 'Id of the correct option.' }),
      })
      .optional(),
    parts: z.array(BijakAttemptPartViewSchema).optional(),
    scheme: z.record(
      z.string(),
      z
        .strictObject({
          marks: z.number().int().min(0),
          lines: z.array(BijakBuilderSchemeLineSchema),
        })
        .nullable(),
    ),
  })
  .meta({ id: 'BijakBuilderReviewQuestion' })
export type BijakBuilderReviewQuestion = z.infer<typeof BijakBuilderReviewQuestionSchema>

/**
 * `previewQuestions` result: `{ questions, stimuli, optionBanks }`, the last two keyed by group id
 * (`Record<groupId, StimulusDef>` and `Record<groupId, McqOption[]>`). Ids that do not exist are left
 * out; a group appears once per group that has a stimulus or an option bank.
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
