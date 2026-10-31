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
  BijakBlueprintClientSourceSchema,
  BijakBlueprintWarningSchema,
  BijakReviewPaperSchema,
  BijakVerificationSummarySchema,
  bijakBlueprintStandardInputShape,
  bijakSectionStandardInputShape,
  bijakSectionStandardViewShape,
} from '../standards/schema'
import {
  BijakAttemptOptionSchema,
  BijakAttemptPartViewSchema,
  BijakAttemptStimulusSchema,
} from '../attempts/schema'

/**
 * Bijak SPM (M28) paper builder and blueprint admin: the write side of BE-15 (BE-39, contract
 * only). Admin Pusat only (D40a, D52).
 *
 * SOURCE. The behavioural spec is the prototype on `feature/student-prototype` at `9af43134`,
 * read-only: `src/modules/m28-bijak-spm/server/admin.ts`, `domain/admin-types.ts`,
 * `domain/paper-builder.ts`, `domain/blueprint.ts` and `domain/types.ts` (`CurriculumTag` lines 67-76,
 * `StimulusDef` lines 15-27, `PartDef`, `SectionDef`, `SchemeDef`). The earlier read-only snapshot
 * `docs/reference/bijak-paper-builder-mock/` held the first four of these files; the full prototype
 * now settles the shapes that the snapshot lacked, so they are no longer [PROPOSED]. Field names,
 * statuses, result shapes, BM strings and the `checkPaper` lines below are copied from it. A string or
 * a field is marked [PROPOSED] only where the prototype does not cover it (blueprint admin writes,
 * route paths, the HTTP codes of the mock's `bad_request`, the D54 mapping of `ditolak`). Every
 * deliberate difference from the prototype is a row in `docs/architecture/v2-backend-deviations.md`.
 *
 * Prototype operations behind the routes: `createPaper`, `savePaper` (PaperPatch), `publishPaper`
 * ({ ok, errors }), `unpublishPaper`, `deletePaper` (idempotent), `getPaperEditor`,
 * `previewQuestions`, `listAdminPapers`, `listBlueprints`. The prototype keeps `SectionCheck` and
 * `PaperCheck` server-side; the wire shows only their result (`budget`, `ok` on the list row and the
 * publish `errors`). `SectionCheck.notes` (the non-blocking line "Soalan pilihan sepatutnya sama
 * markah supaya pilihan adil" for a choose-N section whose questions differ in marks) never reaches
 * the wire.
 *
 * Questions are owned by M04 (BE-09/BE-10). Stimulus, option and part shapes reuse the BE-16 views,
 * which carry every field of the prototype `StimulusDef` (id, kind, label, caption, alt, svg, text,
 * table), `McqOption` (id, text) and `PartDef` (id, label, prompt, marks, answer { kind, unit,
 * wordRange }, children); the curriculum tag and the bounds of the review shapes are those of BE-36
 * (`AiCurriculumTag`) and BE-38 (`IntakeCurriculumTag`).
 */

/**
 * BM messages, all copied from the prototype (`server/admin.ts`, `savePaper`, `createPaper` and
 * `deletePaper`). The last three were invented for blueprint admin, which has no prototype
 * counterpart, and are [PROPOSED].
 */
export const BIJAK_BUILDER_MESSAGES = {
  paperNotFound: BIJAK_PAPERS_MESSAGES.paperNotFound,
  paperLocked: 'Kertas Terbit tidak boleh disunting. Tarik balik dahulu.',
  deleteTerbit: 'Tarik balik kertas Terbit sebelum memadam',
  titleRequired: 'Tajuk kertas diperlukan',
  invalidQuestion: 'Soalan tidak sah untuk kertas ini',
  invalidSection: 'Bahagian tidak sah',
  noBlueprint: 'Tiada blueprint untuk subjek dan kertas ini',
  /** [PROPOSED] (blueprint admin has no prototype counterpart) */
  blueprintNotFound: 'Kontrak tidak ditemui',
  /** [PROPOSED] (blueprint admin has no prototype counterpart) */
  blueprintExists: 'Kontrak untuk subjek dan kertas ini sudah wujud. Cipta versi baharu.',
  /** [PROPOSED] (blueprint admin has no prototype counterpart) */
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
  /** D90: members of a stimulus group run in the group's published order. */
  groupOutOfOrder: (group: string) => `Kumpulan rangsangan ${group} tidak mengikut susunan asal`,
  /** Structural tier of exam-core `verifyComposition` (INELIGIBLE): the reason is one of `BIJAK_BUILDER_INELIGIBLE_TEXT`. */
  ineligible: (questionId: string, reason: string) => `Soalan ${questionId} tidak layak: ${reason}`,
} as const

/**
 * BM texts of the placement operations (R1-B09a). A question can only be placed while it is servable
 * (Terbit/approved); a stimulus group is ONE unit (D90): it is placed, removed and moved whole.
 */
export const BIJAK_BUILDER_PLACEMENT_LINES = {
  notServable: (id: string, reason: string) => `Soalan ${id} tidak boleh diletakkan dalam kertas: ${reason}.`,
  groupNotServable: (group: string, id: string, reason: string) =>
    `Kumpulan rangsangan ${group} tidak boleh diletakkan: soalan ${id} ${reason}.`,
  alreadyPlaced: (id: string) => `Soalan ${id} sudah ada dalam kertas ini`,
  notPlaced: (id: string) => `Soalan ${id} tiada dalam kertas ini`,
  orderMismatch: 'Susunan mesti menyenaraikan setiap soalan atau kumpulan dalam bahagian tepat sekali',
  statusDraft: 'masih draf',
  statusReview: 'masih dalam semakan',
  statusArchived: 'telah diarkibkan',
  notFound: 'tidak ditemui',
  otherSubject: 'bukan subjek kertas ini',
  /** Suffix of a copied paper title ("Salin set", V2 `clonePaperToDraft`). */
  copySuffix: ' (Salinan)',
} as const

/** Texts of the structural `INELIGIBLE` reasons of exam-core, for the publish blockers. */
export const BIJAK_BUILDER_INELIGIBLE_TEXT = {
  no_unit: 'tiada unit DSKP',
  no_tp: 'tiada TP',
  no_marks: 'tiada markah',
  no_key: 'tiada kunci jawapan',
  tag_review: 'tag perlu disemak',
  mode_not_allowed: 'jenis jawapan tidak dibenarkan dalam bahagian ini',
  pool_mismatch: 'bukan dalam kolam bahagian ini',
  unit_not_in_quota: 'unit tiada dalam kuota',
} as const

/** CSRF failure of every mutation (copy of `AUTH_ERROR_MESSAGES.CSRF_INVALID`). */
export const BIJAK_BUILDER_CSRF_MESSAGE = AUTH_ERROR_MESSAGES.CSRF_INVALID

/* -------------------------------------------------------------------------- shared vocabulary */

/** Kertas number (the prototype types it 1 | 2; the dictionary is open in v2, exam schema D5). */
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
 * prototype `QuestionStatus` (`admin-types.ts` line 19) is semakan | terbit | draf | ditolak; the
 * mapping is a deviation row.
 */
export const BIJAK_BUILDER_QUESTION_STATUSES = [
  'draft',
  'review',
  'approved',
  'archived',
] as const
export const BijakBuilderQuestionStatusSchema = z.enum(BIJAK_BUILDER_QUESTION_STATUSES).meta({
  id: 'BijakBuilderQuestionStatus',
  description:
    'Question lifecycle code (D54a, ADR-0027): draft, review, approved, archived. Prototype mapping: semakan = review, terbit = approved, draf = draft (the prototype also reports draf for a question that is not in the bank); ditolak (rejected) has no D54 code and maps to draft, a contract choice [PROPOSED]. The builder offers only approved questions as candidates (`getPaperEditor`: terbit, same subject and kertas); a paper can reference questions of any status, and publish refuses any that is not approved ("{N} soalan belum Terbit").',
})
export type BijakBuilderQuestionStatus = z.infer<typeof BijakBuilderQuestionStatusSchema>

/** `QuestionKind` of the prototype (`admin-types.ts` line 20): objektif (MCQ), berstruktur, esei (rubric-marked). */
export const BIJAK_BUILDER_QUESTION_KINDS = ['objektif', 'berstruktur', 'esei'] as const
export const BijakBuilderQuestionKindSchema = z.enum(BIJAK_BUILDER_QUESTION_KINDS).meta({
  id: 'BijakBuilderQuestionKind',
  description:
    'QuestionKind of the prototype (admin-types.ts line 20). Derived as `kindOf` does (admin.ts lines 197-201): objektif = the question has MCQ options; esei = a structured question with at least one leaf whose scheme is a rubric; berstruktur = any other.',
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
    title: z
      .string()
      .optional()
      .meta({ description: 'Section title (`SectionDef.title`, types.ts line 182).' }),
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
        'Short text for the picker; may hold $latex$ spans. Composed as `previewOf` does (admin.ts lines 217-220): the stem, then " {label} {prompt}" of the first part when that part is a leaf (has no children); the stem alone otherwise.',
    }),
    marks: z.number().int().min(0).max(1000).meta({
      description:
        'Total marks of the question (`marksOf`, admin.ts lines 202-205): the MCQ scheme marks (1 when there is no scheme), else the sum of the leaf marks.',
    }),
    kind: BijakBuilderQuestionKindSchema,
    topic: z
      .string()
      .max(200)
      .meta({ description: 'Display name of the curriculum unit (unitLabel).' }),
    status: BijakBuilderQuestionStatusSchema,
    kertas: Kertas,
    subject: z.string().min(1).meta({ example: 'MAT' }),
  })
  .meta({ id: 'BijakBuilderQuestion' })
export type BijakBuilderQuestion = z.infer<typeof BijakBuilderQuestionSchema>

/**
 * Stimulus group of the picker (`BuilderGroup` = { id, stimulus: StimulusDef, questionIds }); its
 * questions must stay together in one section (D6). `stimulus` reuses the BE-16 stimulus shape, which
 * carries every field of the prototype `StimulusDef` (types.ts lines 15-27).
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
    pool: z.string().min(1).nullable().meta({
      description:
        'Optional narrowing tag of the section (null = no tag filter; the six launch blueprints use null). The builder uses it to suggest questions.',
    }),
    ...bijakSectionStandardViewShape,
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
    // Bijak SPM standard (BJS-01, architecture 6.3 / 6.3a)
    version: z.number().int().min(1).meta({ description: 'Version number of the row shown.' }),
    servesStudents: z.boolean().meta({
      description:
        'True on the single version real students generate from (the last Disahkan one). While a Spec head is being verified, an older Disahkan version keeps serving (Q-B22).',
    }),
    verification: BijakVerificationSummarySchema.nullable().meta({
      description: 'Verifier, date and evidence in one glance; null when the version is not Disahkan.',
    }),
    evidenceCount: z.number().int().min(0),
    notes: z.string().nullable(),
    subPartRamp: z.boolean(),
    kbatMarks: z.number().int().min(0).nullable().meta({ description: 'Paper-level KBAT marks.' }),
    levelShare: z
      .strictObject({ t4: z.number().int().min(0), t5: z.number().int().min(0) })
      .nullable()
      .meta({ description: 'Stated paper-level T4:T5 share.' }),
    warnings: z.array(BijakBlueprintWarningSchema).meta({
      description: 'Non-blocking warnings (KBAT_TP_BAND). Empty when there are none.',
    }),
    needsReview: z.boolean().meta({
      description:
        'O-2, architecture 6.3a: computed, never stored. True when a published Kertas Pilihan of the subject and kertas (newest 20) has a standard-tier mismatch against this blueprint. Informational: blocks neither verification nor generation. Badge text "Blueprint perlu disemak" [PROPOSED].',
    }),
    reviewPapers: z.array(BijakReviewPaperSchema).meta({
      description: 'The papers behind needsReview; empty when needsReview is false.',
    }),
    reference: ReferencePanels.meta({
      description:
        'Reference-sheet panels of this version (architecture 15.4); [] when none. The editor sends them back unchanged on a new version.',
    }),
    servingVersion: z.number().int().min(1).optional().meta({
      description:
        'Architecture 15.6: version number of the row with servesStudents; absent when none serves. Equals `version` when the head serves; a Spec head over a Disahkan version shows the older number.',
    }),
    dependentPaperCount: z.number().int().min(0).meta({
      description:
        'Architecture 15.6: published pilihan papers whose blueprint is any version of this subject and kertas; used by the retire / delete-blocked message (AC-25.5). Computed on read.',
    }),
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
    instructions: z
      .array(z.string().trim().min(1).max(500))
      .max(40)
      .optional()
      .meta({ description: 'Cover instruction lines (Arahan kulit kertas); replaces the whole list.' }),
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
    notes: z.array(z.string()).optional().meta({
      description: 'Non-blocking notes of the standard tier (quota, profile, KBAT): a curated paper is never blocked by them (D78 O-2).',
    }),
    blueprintNeedsReview: z.boolean().optional().meta({
      description: 'true when `notes` is not empty: the UI shows "Blueprint perlu semakan".',
    }),
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
 * Curriculum tag of a question: the prototype `CurriculumTag` (`domain/types.ts` lines 67-76, exam
 * schema D9), field for field, with the bounds of BE-36 `AiCurriculumTag` and BE-38
 * `IntakeCurriculumTag`: `subject` 1..32 characters, `unit` 1..64 characters or null, `unitLabel` at
 * most 200, `sp` at most 20 codes of 1..64 characters, `tp` an integer 1..6. T1-T3 Matematik content
 * has `formOrigin` 'T1-T3' and `unit` null (types.ts line 66, Q-S2). An empty `sp` is valid (legacy
 * seed questions carry none; the prototype waives the SP check for them).
 */
export const BijakBuilderCurriculumTagSchema = z
  .strictObject({
    subject: z
      .string()
      .min(1)
      .max(32)
      .meta({ description: 'SubjectCode (open dictionary).', example: 'MAT' }),
    level: z.enum(['T4', 'T5', 'T4+T5']),
    unit: z.string().min(1).max(64).nullable().meta({
      description:
        'DSKP unit code, or null when the content lies outside the DSKP (always null for T1-T3 content).',
    }),
    unitLabel: z.string().max(200).meta({ description: 'Display name of the unit.' }),
    sp: z
      .array(z.string().min(1).max(64))
      .max(20)
      .meta({ description: 'Standard Pembelajaran codes.' }),
    tp: z.number().int().min(1).max(6).meta({ description: 'Tahap Penguasaan 1..6.' }),
    formOrigin: z.enum(['T1-T3', 'T4', 'T5']),
  })
  .meta({ id: 'BijakBuilderCurriculumTag', description: 'Prototype CurriculumTag.' })

/** Longest scheme line the review accepts (the BE-38 `model` cap). */
const SCHEME_LINE_MAX_CHARS = 5000

/**
 * BM text of the scheme lines, built exactly as `describeScheme` and `reviewQuestion` build them
 * (admin.ts lines 233-282). `optionIndex` is the position of the correct option in `mcq.options`;
 * the letter is A..H, or "?" when the position is outside A..H (as the prototype).
 */
export const BIJAK_BUILDER_SCHEME_LINES = {
  correctOption: (optionIndex: number) => `Jawapan betul: ${'ABCDEFGH'[optionIndex] ?? '?'}`,
  accepted: (value: string, unit?: string) => `Diterima: ${value}${unit ? ` ${unit}` : ''}`,
  mapping: (key: string, value: string) => `${key} = ${value}`,
  rubricBand: (name: string, from: number, to: number, descriptor: string) =>
    `${name} (${from}-${to}): ${descriptor}`,
  finalAnswer: (display: string) => `Jawapan akhir: $${display}$`,
  /** Tag of a mark point: its code and its 1-based sequence among the points of the same code. */
  pointTag: (code: string, sequence: number) => `${code}${sequence}`,
} as const

/**
 * One line of a mark scheme as the review shows it (`SchemeLine`, admin-types.ts lines 112-116).
 * `tag` and `marks` are set on a mark point of a `points` scheme only; `tag` is the point code
 * (K N P B M F C, types.ts `PointCode`) followed by its sequence ("K1", "M2").
 */
export const BijakBuilderSchemeLineSchema = z
  .strictObject({
    tag: z
      .string()
      .regex(/^[KNPBMFC][1-9][0-9]*$/)
      .optional()
      .meta({ example: 'K1' }),
    text: z.string().max(SCHEME_LINE_MAX_CHARS),
    marks: z.number().int().min(0).max(100).optional(),
  })
  .meta({ id: 'BijakBuilderSchemeLine' })

/**
 * `ReviewQuestion` of the prototype (admin-types.ts lines 118-126), as `previewQuestions` returns it
 * through `reviewQuestion` (admin.ts lines 266-298): the question content (`id`, `stem`, `marks`,
 * `curriculum`, `mcq`, `parts`) and its mark scheme per leaf id (the question id for an MCQ; null
 * when a leaf has no scheme). `mcq` is set only for an MCQ, `parts` only for a structured question,
 * and `mcq.correct` only when the MCQ scheme is an option key. This is the ADMIN review shape and
 * carries the answer key and scheme lines (for example "Jawapan betul: A"): the route is Admin Pusat
 * only and nothing of it reaches students. `parts` is the BE-16 part view, which has exactly the
 * fields of the prototype `PartDef` (types.ts lines 42-51).
 */
export const BijakBuilderReviewQuestionSchema = z
  .strictObject({
    id: IdSchema,
    stem: z.string().max(100_000),
    marks: z.number().int().min(0).max(1000),
    curriculum: BijakBuilderCurriculumTagSchema,
    mcq: z
      .strictObject({
        options: z.array(BijakAttemptOptionSchema).max(10),
        correct: IdSchema.optional().meta({ description: 'Id of the correct option.' }),
      })
      .optional(),
    parts: z.array(BijakAttemptPartViewSchema).max(50).optional().meta({
      description: 'Question parts (prototype PartDef, nested through `children`).',
    }),
    scheme: z
      .record(
        z.string(),
        z
          .strictObject({
            marks: z.number().int().min(0).max(1000),
            lines: z.array(BijakBuilderSchemeLineSchema).max(100),
          })
          .nullable(),
      )
      .meta({
        description:
          'Mark scheme per leaf id (the question id for an MCQ); null where a leaf has no scheme. Lines are built as `describeScheme` does: option = the reason; accepted = "Diterima: {value} {unit}"; mapping = "{key} = {value}"; rubric = one line per band, then the notes; points = one tagged line per mark point and a closing "Jawapan akhir: $display$" when the scheme has a final answer. An MCQ scheme starts with "Jawapan betul: {letter}".',
      }),
  })
  .meta({ id: 'BijakBuilderReviewQuestion' })
export type BijakBuilderReviewQuestion = z.infer<typeof BijakBuilderReviewQuestionSchema>

/**
 * `previewQuestions` result: `{ questions, stimuli, optionBanks }`, the last two keyed by group id
 * (`Record<groupId, StimulusDef>` and `Record<groupId, McqOption[]>`). Ids that do not exist are left
 * out; a group appears once per group that has a stimulus or an option bank (admin.ts lines
 * 1071-1093).
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
 * field names are those of `BlueprintView.sections[]`; the prototype domain `BlueprintSection`
 * (types.ts lines 210-220) calls `questionCount` `take` and makes `markBudget` optional (default
 * `take`); the write requires `markBudget` so a choose-N section never takes the wrong default
 * (deviations log). `compulsory` and `instruction` may be left out (defaults: false, and the derived
 * line of `BlueprintView`).
 */
export const BijakBlueprintAdminSectionInputSchema = z
  .strictObject({
    label: z.string().trim().min(1).max(100).meta({ example: 'Bahagian A' }),
    markBudget: z.number().int().min(0).max(1000).meta({
      description:
        'Marks after choose-N (required on the write; optional in the prototype, where it defaults to the question count).',
    }),
    questionCount: z.number().int().min(1).max(500).meta({
      description: 'Questions the section holds (prototype `BlueprintSection.take`).',
    }),
    compulsory: z.boolean().optional().meta({ description: 'Default: false.' }),
    instruction: z.string().max(500).optional().meta({
      description:
        'Authored instruction. Default: absent, and the view derives "Jawab semua soalan." or "Jawab N daripada M soalan.".',
    }),
    rule: BijakBuilderSectionRuleSchema,
    pool: z.string().trim().min(1).max(64).optional().meta({
      description: 'Optional narrowing tag; absent = no tag filter (was required before the standard).',
    }),
    ...bijakSectionStandardInputShape,
  })
  .meta({ id: 'BijakBlueprintAdminSectionInput' })
export type BijakBlueprintAdminSectionInput = z.infer<typeof BijakBlueprintAdminSectionInputSchema>

const blueprintVersionInputShape = {
  source: BijakBlueprintClientSourceSchema.optional(),
  ...bijakBlueprintStandardInputShape,
  code: z.string().trim().min(1).max(32).meta({ example: '1449/2' }),
  durationMin: z.number().int().min(1).max(600),
  instructions: z.array(z.string().max(500)).max(30).optional().meta({
    description: 'Cover instruction lines. Default: empty.',
  }),
  reference: ReferencePanels.max(10).optional().meta({
    description:
      'Reference-sheet panels for papers made from this blueprint. On POST .../versions: omitted = the server carries over the head panels; [] = clear (architecture 15.4). `BlueprintView.reference` reads them back.',
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

/* ------------------------------------------------------------- R1-B09a: placements, review, pool */

/**
 * D90: a stimulus shared by several questions is ONE group. These operations place, remove and move
 * the whole group as one unit; a single member is never placed alone. Removing any member removes
 * the whole group (decision B09a, documented in the route descriptions).
 */

/** `POST /admin/papers/{id}/placements` body. */
export const BijakBuilderPlacementAddSchema = z
  .strictObject({
    sectionId: IdSchema.meta({ description: 'Id of a section of this paper.' }),
    questionId: IdSchema.meta({ description: 'A servable question; when it belongs to a stimulus group the whole group is placed.' }),
  })
  .meta({ id: 'BijakBuilderPlacementAdd' })
export type BijakBuilderPlacementAdd = z.infer<typeof BijakBuilderPlacementAddSchema>

/** `PUT /admin/papers/{id}/sections/{sid}/order` body: one id per unit (any member id for a group). */
export const BijakBuilderSectionOrderSchema = z
  .strictObject({
    order: z.array(IdSchema).min(1).max(500).meta({
      description: 'The units of the section in the wanted order: one question id per single question, any member id per stimulus group. Every unit exactly once.',
    }),
  })
  .meta({ id: 'BijakBuilderSectionOrder' })
export type BijakBuilderSectionOrder = z.infer<typeof BijakBuilderSectionOrderSchema>

/** Result of add / remove / order: the editor data plus the question ids that were added or removed. */
export const BijakBuilderPlacementResultSchema = z
  .strictObject({
    editor: BijakBuilderEditorSchema,
    added: z.array(IdSchema).optional(),
    removed: z.array(IdSchema).optional(),
  })
  .meta({ id: 'BijakBuilderPlacementResult' })
export type BijakBuilderPlacementResult = z.infer<typeof BijakBuilderPlacementResultSchema>

/** One placed question in the review (per-row servability). */
export const BijakBuilderReviewRowSchema = z
  .strictObject({
    questionId: IdSchema,
    groupId: IdSchema.optional(),
    section: z.string().min(1),
    ok: z.boolean(),
    reason: z.string().optional().meta({ description: 'BM reason when ok is false ("Tidak disajikan").' }),
  })
  .meta({ id: 'BijakBuilderReviewRow' })

/** `GET /admin/papers/{id}/review`. */
export const BijakBuilderReviewSchema = z
  .strictObject({
    paperId: IdSchema,
    status: BijakBuilderPaperStatusSchema,
    ok: z.boolean().meta({ description: 'No blocker: Terbit would succeed.' }),
    blockers: z.array(z.string()).meta({ description: 'Same lines as the publish refusal (BM).' }),
    notes: z.array(z.string()).meta({ description: 'Standard-tier notes; never block a curated paper (D78 O-2).' }),
    blueprintNeedsReview: z.boolean().meta({ description: '"Blueprint perlu semakan".' }),
    visibleToStudents: z.boolean(),
    totalMarks: z.number().int().min(0),
    totalBudget: z.number().int().min(0),
    rows: z.array(BijakBuilderReviewRowSchema),
  })
  .meta({ id: 'BijakBuilderReview' })
export type BijakBuilderReview = z.infer<typeof BijakBuilderReviewSchema>

/** `GET /admin/papers/{id}/student-view`: what a pupil sees (no keys, no schemes). */
export const BijakBuilderStudentQuestionSchema = z
  .strictObject({ id: IdSchema, number: z.number().int().min(1), preview: z.string(), marks: z.number().int().min(0) })
  .meta({ id: 'BijakBuilderStudentQuestion' })
export const BijakBuilderStudentUnitSchema = z
  .strictObject({
    groupId: IdSchema.optional(),
    stimulus: BijakAttemptStimulusSchema.optional().meta({ description: 'Shown ONCE for the group (D90).' }),
    questions: z.array(BijakBuilderStudentQuestionSchema).min(1),
  })
  .meta({ id: 'BijakBuilderStudentUnit' })
export const BijakBuilderStudentViewSchema = z
  .strictObject({
    title: z.string(),
    subject: z.string(),
    subjectName: z.string(),
    kertas: Kertas,
    year: z.number().int(),
    code: z.string(),
    durationMin: z.number().int(),
    instructions: z.array(z.string()),
    reference: z.array(BijakPaperReferencePanelSchema),
    questionCount: z.number().int().min(0),
    marks: z.number().int().min(0),
    sections: z.array(
      z.strictObject({
        label: z.string(),
        instruction: z.string(),
        compulsory: z.boolean(),
        marks: z.number().int().min(0),
        units: z.array(BijakBuilderStudentUnitSchema),
      }),
    ),
  })
  .meta({ id: 'BijakBuilderStudentView' })
export type BijakBuilderStudentView = z.infer<typeof BijakBuilderStudentViewSchema>

/** Query of `GET /admin/papers/{id}/sections/{sid}/pool`. */
export const BijakBuilderSectionPoolQuerySchema = z
  .object({
    q: z.string().trim().max(100).optional(),
    level: z.enum(['t4', 't5', 't1_t3']).optional(),
    unit: z.string().max(40).optional().meta({ description: 'DSKP unit node id.' }),
    page: z.coerce.number().int().min(1).optional(),
    pageSize: z.coerce.number().int().min(1).max(100).optional(),
  })
  .meta({ id: 'BijakBuilderSectionPoolQuery' })

/** One candidate unit of the section pool: a single question or a whole stimulus group. */
export const BijakBuilderPoolUnitSchema = z
  .strictObject({
    groupId: IdSchema.optional(),
    stimulus: BijakAttemptStimulusSchema.optional(),
    questionIds: z.array(IdSchema).min(1),
    questions: z.array(BijakBuilderQuestionSchema),
    marks: z.number().int().min(0).meta({ description: 'Sum of the members.' }),
    eligible: z.boolean(),
    reasons: z.array(z.string()),
    placed: z.boolean(),
  })
  .meta({ id: 'BijakBuilderPoolUnit' })
export type BijakBuilderPoolUnit = z.infer<typeof BijakBuilderPoolUnitSchema>

/** Query of `GET /admin/papers/pool-preview` ("Pratonton kolam"). */
export const BijakBuilderPoolPreviewQuerySchema = z
  .object({
    subject: z.string().trim().min(1).max(32),
    kertas: z.coerce.number().int().min(1),
  })
  .meta({ id: 'BijakBuilderPoolPreviewQuery' })
