import { z } from '../../zod'
import { IdSchema } from '../../common/ids'
import { TimestampSchema } from '../../common/time'
import { AUTH_ERROR_MESSAGES } from '../../auth/errors'
import {
  BIJAK_PAPERS_MESSAGES,
  BijakBlueprintSourceSchema,
  BijakGenerateShortageSchema,
  BijakPaperReferencePanelSchema,
} from '../papers/schema'

/**
 * Bijak SPM (M28) paper builder and blueprint admin: the write side of BE-15 (BE-39, contract
 * only). Admin Pusat only (D40a, D52).
 *
 * There is NO frontend mock for these routes: `src/modules/m28-bijak-spm/admin/papers` and
 * `server/admin.ts` do not exist on `feature/v2-backend`, and the card says so ("No paper builder
 * or blueprint admin screens exist in `src/` yet"). The wire shapes are therefore derived from
 * `domain/{types,blueprint,paper-model}.ts` (`PaperDef`, `SectionDef`, `Blueprint`,
 * `BlueprintSection`, `Shortage`, `effectiveMarks`, `shortageLine`), `v2-exam-schema.md` D5/D6/D7
 * and `v2-question-bank.md` 4.5, 4.6, 4.8. Every deviation or assumption is recorded in the
 * description of the schema or route it affects; every BM message that is not copied from the mock
 * is NEW copy and is listed in `BIJAK_BUILDER_MESSAGES`.
 *
 * Questions are owned by M04 (BE-09/BE-10). This folder imports nothing from `questions/` or
 * `question-workflow/`; `BijakBuilderQuestionStatus` repeats the D54(a) codes and
 * `BIJAK_BUILDER_ANSWER_MODES` the leaf modes of exam schema D2 (`LeafKind` plus `mcq`).
 */

/** BM messages. `paperNotFound` is the mock copy (BE-15); every other entry is NEW copy of this card. */
export const BIJAK_BUILDER_MESSAGES = {
  paperNotFound: BIJAK_PAPERS_MESSAGES.paperNotFound,
  blueprintNotFound: 'Kontrak tidak ditemui',
  publishRefused:
    'Kertas tidak boleh diterbitkan: semua soalan mesti berstatus Diterbitkan dan kertas mesti menepati kontrak.',
  groupSplit:
    'Soalan dalam satu kumpulan stimulus mesti kekal bersama dalam satu bahagian dan berturutan.',
  duplicateQuestion: 'Soalan yang sama tidak boleh diletakkan dua kali dalam satu kertas.',
  paperLocked: 'Kertas yang telah diterbitkan tidak boleh diubah. Tarik balik kertas dahulu.',
  deleteNotDraft: 'Hanya kertas yang masih draf boleh dipadam.',
  notPublished: 'Kertas ini belum diterbitkan.',
  alreadyPublished: 'Kertas ini telah diterbitkan.',
  sectionHasPlacements: 'Bahagian yang masih mempunyai soalan tidak boleh dibuang.',
  blueprintRetired: 'Kontrak ini telah dipersara dan tidak boleh dipilih.',
  blueprintExists: 'Kontrak untuk subjek dan kertas ini sudah wujud. Cipta versi baharu.',
  blueprintAlreadyRetired: 'Kontrak ini sudah dipersara.',
} as const

/** CSRF failure of every mutation (copy of `AUTH_ERROR_MESSAGES.CSRF_INVALID`). */
export const BIJAK_BUILDER_CSRF_MESSAGE = AUTH_ERROR_MESSAGES.CSRF_INVALID

/* -------------------------------------------------------------------------- shared vocabulary */

/** Kertas number (paper definitions use 1 or 2; the dictionary is open, exam schema D5). */
const Kertas = z.number().int().min(1).meta({ description: 'Kertas number.', example: 2 })

/** Question lifecycle codes (D54a), repeated locally; identical to BE-09/BE-10. */
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
    'Question lifecycle code (D54a): draft = Draf, review = Semakan, approved = Lulus, published = Diterbitkan, archived = Diarkib. Only published questions may be on a published paper.',
})
export type BijakBuilderQuestionStatus = z.infer<typeof BijakBuilderQuestionStatusSchema>

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
  description: 'Leaf answer mode of a question part (exam schema D2).',
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

/** Paper lifecycle: `ready` is set automatically by the conformance check (card open question 1). */
export const BIJAK_BUILDER_PAPER_STATUSES = ['draft', 'ready', 'published', 'withdrawn'] as const
export const BijakBuilderPaperStatusSchema = z.enum(BIJAK_BUILDER_PAPER_STATUSES).meta({
  id: 'BijakBuilderPaperStatus',
  description:
    'draft = being assembled; ready = every placed question is published and the paper conforms (set by the conformance check, never by the client); published = visible in Kertas Pilihan; withdrawn = hidden from Kertas Pilihan (attempts already started are unaffected).',
})
export type BijakBuilderPaperStatus = z.infer<typeof BijakBuilderPaperStatusSchema>

/** Title and instruction limits are input validation only (no mock limit exists). */
const Title = z.string().trim().min(1).max(200)
const Instructions = z
  .array(z.string().max(500))
  .max(30)
  .meta({ description: 'Cover instruction lines, verbatim (may hold $latex$ spans).' })
const Reference = z.array(BijakPaperReferencePanelSchema).max(10)

/* ------------------------------------------------------------------------------------ paper */

/** Reference to a blueprint version (the "Kontrak" a paper is checked against). */
export const BijakBuilderBlueprintRefSchema = z
  .strictObject({
    id: IdSchema.meta({ description: 'Blueprint (family) id.' }),
    version: z.number().int().min(1),
  })
  .meta({ id: 'BijakBuilderBlueprintRef' })
export type BijakBuilderBlueprintRef = z.infer<typeof BijakBuilderBlueprintRefSchema>

/**
 * Read-only view of a placed question. The question is owned by M04; the builder only shows what
 * it needs to assemble and check (marks, modes, group, lifecycle status).
 */
export const BijakBuilderQuestionRefSchema = z
  .strictObject({
    id: IdSchema,
    version: z
      .number()
      .int()
      .min(1)
      .meta({ description: 'Current version of the question (v2-question-bank 4.6).' }),
    status: BijakBuilderQuestionStatusSchema,
    marks: z
      .number()
      .int()
      .min(0)
      .meta({ description: 'Total marks of the question (sum of its leaf marks).' }),
    modes: z
      .array(BijakBuilderAnswerModeSchema)
      .meta({ description: 'Distinct leaf modes of the question (checked against allowedModes).' }),
    groupId: IdSchema.nullable().meta({
      description: 'Stimulus group of the question (D6), null when it has none.',
    }),
    stemPreview: z
      .string()
      .max(200)
      .nullable()
      .meta({ description: 'Start of the stem for the builder list; may hold $latex$ spans.' }),
  })
  .meta({ id: 'BijakBuilderQuestionRef' })
export type BijakBuilderQuestionRef = z.infer<typeof BijakBuilderQuestionRefSchema>

/** One placement (D5): question + section + number label + marks override + pinned version. */
export const BijakBuilderPlacementSchema = z
  .strictObject({
    id: IdSchema,
    sectionId: IdSchema,
    position: z.number().int().min(1).meta({ description: '1-based order inside the section.' }),
    numberLabel: z
      .string()
      .nullable()
      .meta({ description: 'Printed number, e.g. "12" or "5(a)"; null when not set.' }),
    questionId: IdSchema,
    pinnedVersion: z
      .number()
      .int()
      .min(1)
      .nullable()
      .meta({
        description:
          'Question version pinned to the paper. Null in a draft until publish pins it (a later edit of the question, version n+1, never changes a published paper).',
      }),
    marksOverride: z
      .number()
      .int()
      .min(0)
      .nullable()
      .meta({ description: 'Marks the paper gives this question instead of its own total.' }),
    marks: z
      .number()
      .int()
      .min(0)
      .meta({ description: 'Marks that count on this paper: marksOverride, else question marks.' }),
    question: BijakBuilderQuestionRefSchema,
  })
  .meta({ id: 'BijakBuilderPlacement' })
export type BijakBuilderPlacement = z.infer<typeof BijakBuilderPlacementSchema>

/** One section of a paper (`SectionDef`) with its ordered placements. */
export const BijakBuilderSectionSchema = z
  .strictObject({
    id: IdSchema,
    position: z.number().int().min(1),
    label: z.string().min(1).meta({ example: 'Bahagian A' }),
    title: z.string().nullable(),
    instruction: z.string().nullable().meta({
      description:
        'Authored instruction; null means the derived line ("Jawab semua soalan." / "Jawab {n} daripada {count} soalan.").',
    }),
    rule: BijakBuilderSectionRuleSchema,
    compulsory: z.boolean().meta({ description: '"Soalan ini mesti dijawab".' }),
    markBudget: z
      .number()
      .int()
      .min(0)
      .meta({ description: 'Marks the section is worth after choose-N (printed budget).' }),
    questionCount: z.number().int().min(0).meta({ description: 'Questions placed in the section.' }),
    marks: z
      .number()
      .int()
      .min(0)
      .meta({
        description:
          'Effective marks derived from the placements (choose-N counts the N largest); never stored by hand.',
      }),
    placements: z.array(BijakBuilderPlacementSchema),
  })
  .meta({ id: 'BijakBuilderSection' })
export type BijakBuilderSection = z.infer<typeof BijakBuilderSectionSchema>

const paperSummaryShape = {
  id: IdSchema,
  title: z.string().min(1),
  subject: z.string().min(1).meta({ description: 'Subject code.', example: 'MAT' }),
  subjectName: z.string().min(1),
  kertas: Kertas,
  year: z.number().int(),
  code: z.string().min(1).meta({ description: 'Printed paper code.', example: '1449/2' }),
  durationMin: z.number().int().min(1),
  status: BijakBuilderPaperStatusSchema,
  version: z
    .number()
    .int()
    .min(1)
    .meta({ description: 'Paper version (`papers.version`, BE-15).' }),
  blueprint: BijakBuilderBlueprintRefSchema.nullable().meta({
    description: 'Selected blueprint version; null until one is chosen.',
  }),
  questionCount: z.number().int().min(0),
  marks: z.number().int().min(0).meta({ description: 'Total effective marks (derived).' }),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  publishedAt: TimestampSchema.nullable().meta({
    description: 'Time of the latest publish; null when never published.',
  }),
}

/** One row of the admin paper list. */
export const BijakBuilderPaperSummarySchema = z
  .strictObject(paperSummaryShape)
  .meta({ id: 'BijakBuilderPaperSummary' })
export type BijakBuilderPaperSummary = z.infer<typeof BijakBuilderPaperSummarySchema>

/** A paper with its sections and placements (admin view: question ids are included). */
export const BijakBuilderPaperSchema = z
  .strictObject({
    ...paperSummaryShape,
    instructions: Instructions,
    reference: z.array(BijakPaperReferencePanelSchema),
    sections: z.array(BijakBuilderSectionSchema),
  })
  .meta({ id: 'BijakBuilderPaper' })
export type BijakBuilderPaper = z.infer<typeof BijakBuilderPaperSchema>

/**
 * `POST /admin/papers` and `PUT /admin/papers/{id}` body: the paper header. Sections and
 * placements have their own routes. PUT replaces the header (same body as POST).
 */
export const BijakBuilderPaperInputSchema = z
  .strictObject({
    title: Title.meta({ example: 'Percubaan SPM Matematik Kertas 2 Set B' }),
    subject: z.string().trim().min(1).max(32).meta({ example: 'MAT' }),
    kertas: Kertas,
    year: z.number().int().min(1900).max(2100),
    code: z.string().trim().min(1).max(32).meta({ example: '1449/2' }),
    durationMin: z.number().int().min(1).max(600),
    instructions: Instructions.optional().meta({ description: 'Default: empty.' }),
    reference: Reference.optional().meta({ description: 'Default: empty.' }),
    blueprint: BijakBuilderBlueprintRefSchema.nullable()
      .optional()
      .meta({
        description:
          'Blueprint version to check the paper against; null clears it. A retired blueprint is refused (422).',
      }),
  })
  .meta({ id: 'BijakBuilderPaperInput' })
export type BijakBuilderPaperInput = z.infer<typeof BijakBuilderPaperInputSchema>

/** Section of `PUT /admin/papers/{id}/sections`. */
export const BijakBuilderSectionInputSchema = z
  .strictObject({
    id: IdSchema.optional().meta({
      description: 'Existing section id to keep; omit to create a new section.',
    }),
    label: z.string().trim().min(1).max(100).meta({ example: 'Bahagian A' }),
    title: z.string().max(200).nullable().optional(),
    instruction: z.string().max(500).nullable().optional(),
    rule: BijakBuilderSectionRuleSchema,
    compulsory: z.boolean().optional().meta({ description: 'Default: false.' }),
    markBudget: z.number().int().min(0).max(1000),
  })
  .meta({ id: 'BijakBuilderSectionInput' })
export type BijakBuilderSectionInput = z.infer<typeof BijakBuilderSectionInputSchema>

/**
 * `PUT /admin/papers/{id}/sections`: the full ordered section list (replace). Array order is the
 * section order. A section that is left out is removed; a removed section must hold no placement
 * (422 `sectionHasPlacements`, working assumption, see the report).
 */
export const BijakBuilderSectionsRequestSchema = z
  .strictObject({ sections: z.array(BijakBuilderSectionInputSchema).max(20) })
  .meta({ id: 'BijakBuilderSectionsRequest' })
export type BijakBuilderSectionsRequest = z.infer<typeof BijakBuilderSectionsRequestSchema>

/** Placement of `PUT /admin/papers/{id}/placements`. */
export const BijakBuilderPlacementInputSchema = z
  .strictObject({
    sectionId: IdSchema.meta({ description: 'Id of a section of this paper.' }),
    questionId: IdSchema,
    pinnedVersion: z
      .number()
      .int()
      .min(1)
      .nullable()
      .optional()
      .meta({ description: 'Explicit pin; omit or null to let publish pin the current version.' }),
    numberLabel: z.string().trim().max(32).nullable().optional(),
    marksOverride: z.number().int().min(0).max(1000).nullable().optional(),
  })
  .meta({ id: 'BijakBuilderPlacementInput' })
export type BijakBuilderPlacementInput = z.infer<typeof BijakBuilderPlacementInputSchema>

/**
 * `PUT /admin/papers/{id}/placements`: every placement of the paper, in order (replace). The order
 * of the array is the order inside each section. A stimulus group must stay in one section and
 * stay consecutive (D6): otherwise 422 `groupSplit`. A question appears once.
 */
export const BijakBuilderPlacementsRequestSchema = z
  .strictObject({
    placements: z
      .array(BijakBuilderPlacementInputSchema)
      .max(500)
      .superRefine((rows, ctx) => {
        const seen = new Set<string>()
        rows.forEach((row, index) => {
          if (seen.has(row.questionId)) {
            ctx.addIssue({
              code: 'custom',
              path: [index, 'questionId'],
              message: BIJAK_BUILDER_MESSAGES.duplicateQuestion,
            })
          }
          seen.add(row.questionId)
        })
      }),
  })
  .meta({ id: 'BijakBuilderPlacementsRequest' })
export type BijakBuilderPlacementsRequest = z.infer<typeof BijakBuilderPlacementsRequestSchema>

/** `DELETE /admin/papers/{id}` result (house style: 200, not 204). */
export const BijakBuilderDeleteResultSchema = z
  .strictObject({ deleted: z.literal(1) })
  .meta({ id: 'BijakBuilderDeleteResult' })

/** Query of `GET /admin/papers`. */
export const BijakBuilderPaperListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).optional(),
    pageSize: z.coerce.number().int().min(1).max(100).optional(),
    status: BijakBuilderPaperStatusSchema.optional(),
    subject: z.string().max(32).optional().meta({ description: 'Subject code.' }),
    kertas: z.coerce.number().int().min(1).optional(),
    q: z.string().trim().max(100).optional().meta({ description: 'Title contains.' }),
  })
  .meta({ id: 'BijakBuilderPaperListQuery' })
export type BijakBuilderPaperListQuery = z.infer<typeof BijakBuilderPaperListQuerySchema>

/* -------------------------------------------------------------------------------- conformance */

/**
 * Rule that a gap belongs to. marks_budget, count, mode and choose_n are the four blueprint rules
 * of the card; `section` = a paper section the blueprint does not know, or a blueprint section
 * the paper lacks; `group_integrity` = D6; `question_status` = a placed question is not published
 * (v2-question-bank 4.8); `blueprint` = no blueprint chosen, or the chosen one is retired.
 */
export const BIJAK_BUILDER_CONFORMANCE_RULES = [
  'marks_budget',
  'count',
  'mode',
  'choose_n',
  'section',
  'group_integrity',
  'question_status',
  'blueprint',
] as const
export const BijakBuilderConformanceRuleSchema = z.enum(BIJAK_BUILDER_CONFORMANCE_RULES).meta({
  id: 'BijakBuilderConformanceRule',
  description: 'Rule behind one conformance gap.',
})
export type BijakBuilderConformanceRule = z.infer<typeof BijakBuilderConformanceRuleSchema>

/** One gap of the conformance report: section, rule, expected and actual values, BM message. */
export const BijakBuilderIssueSchema = z
  .strictObject({
    rule: BijakBuilderConformanceRuleSchema,
    sectionId: IdSchema.nullable().meta({ description: 'Paper section, null for a paper-wide gap.' }),
    sectionLabel: z.string().nullable(),
    questionId: IdSchema.nullable(),
    expected: z.union([z.number(), z.string()]).nullable(),
    actual: z.union([z.number(), z.string()]).nullable(),
    message: z.string().min(1).meta({
      description: 'BM text for direct display, e.g. "Bahagian A: perlu 3 soalan, hanya 2 tersedia".',
    }),
  })
  .meta({ id: 'BijakBuilderIssue' })
export type BijakBuilderIssue = z.infer<typeof BijakBuilderIssueSchema>

/** Per-section line of the conformance report. */
export const BijakBuilderSectionCheckSchema = z
  .strictObject({
    sectionId: IdSchema,
    label: z.string().min(1),
    blueprintSection: z
      .string()
      .nullable()
      .meta({ description: 'Label of the matching blueprint section; null when none matches.' }),
    questionCount: z.number().int().min(0),
    expectedCount: z.number().int().min(0).nullable(),
    marks: z.number().int().min(0).meta({ description: 'Effective marks (choose-N applied).' }),
    expectedMarks: z.number().int().min(0).nullable(),
    ok: z.boolean(),
  })
  .meta({ id: 'BijakBuilderSectionCheck' })
export type BijakBuilderSectionCheck = z.infer<typeof BijakBuilderSectionCheckSchema>

/**
 * `GET /admin/papers/{id}/conformance`: the paper against its blueprint version, computed with the
 * shared exam-core engine. Always 200 (a paper without blueprint reports a `blueprint` gap).
 */
export const BijakBuilderConformanceSchema = z
  .strictObject({
    paperId: IdSchema,
    status: BijakBuilderPaperStatusSchema,
    blueprint: BijakBuilderBlueprintRefSchema.nullable(),
    conforms: z.boolean().meta({
      description:
        'True when there is no gap of the blueprint rules (marks_budget, count, mode, choose_n, section, group_integrity, blueprint).',
    }),
    publishable: z.boolean().meta({
      description: 'True when there is no gap at all (conforms and every placed question is published).',
    }),
    totals: z.strictObject({
      questionCount: z.number().int().min(0),
      expectedQuestionCount: z.number().int().min(0).nullable(),
      marks: z.number().int().min(0),
      expectedMarks: z.number().int().min(0).nullable(),
    }),
    sections: z.array(BijakBuilderSectionCheckSchema),
    issues: z.array(BijakBuilderIssueSchema),
    shortages: z.array(BijakGenerateShortageSchema).meta({
      description:
        'Blueprint sections the paper cannot fill: need = blueprint take, have = questions placed.',
    }),
  })
  .meta({ id: 'BijakBuilderConformance' })
export type BijakBuilderConformance = z.infer<typeof BijakBuilderConformanceSchema>

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

/** 422 on publish: the gate of v2-question-bank 4.8 failed; nothing changes. */
export const BijakBuilderPublishRefusedErrorSchema = z
  .object({
    error: z.object({
      code: z.literal('VALIDATION_ERROR'),
      message: z.literal(BIJAK_BUILDER_MESSAGES.publishRefused),
      details: z.strictObject({
        issues: z.array(BijakBuilderIssueSchema).min(1),
        shortages: z.array(BijakGenerateShortageSchema),
      }),
      requestId: z.string().optional(),
    }),
  })
  .meta({ id: 'BijakBuilderPublishRefusedError' })
export type BijakBuilderPublishRefusedError = z.infer<typeof BijakBuilderPublishRefusedErrorSchema>

/** 422 on a placement update that splits a stimulus group across sections or separates it in order (AC 3). */
export const BijakBuilderGroupSplitErrorSchema = z
  .object({
    error: z.object({
      code: z.literal('VALIDATION_ERROR'),
      message: z.literal(BIJAK_BUILDER_MESSAGES.groupSplit),
      fields: z.record(z.string(), z.string()).optional(),
      details: z.strictObject({
        groups: z
          .array(z.strictObject({ groupId: IdSchema, questionIds: z.array(IdSchema).min(2) }))
          .min(1),
      }),
      requestId: z.string().optional(),
    }),
  })
  .meta({ id: 'BijakBuilderGroupSplitError' })
export type BijakBuilderGroupSplitError = z.infer<typeof BijakBuilderGroupSplitErrorSchema>

/* ===================================================================== blueprint admin ===== */

/** Section of a blueprint version (`BlueprintSection` plus `allowedModes`, exam schema D7). */
const blueprintSectionShape = {
  label: z.string().trim().min(1).max(100).meta({ example: 'Bahagian A' }),
  rule: BijakBuilderSectionRuleSchema,
  pool: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .meta({ description: 'Pool tag the section draws from (internal; not shown to students).' }),
  take: z
    .number()
    .int()
    .min(1)
    .max(500)
    .meta({ description: 'Questions the section holds (a stimulus group counts with all its questions).' }),
  markBudget: z
    .number()
    .int()
    .min(0)
    .max(1000)
    .meta({ description: 'Marks after choose-N (mandatory in v2, exam schema D7).' }),
}

/** Section of a blueprint as written by the admin. */
export const BijakBlueprintAdminSectionInputSchema = z
  .strictObject({
    ...blueprintSectionShape,
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

/** Section of a blueprint as returned (all defaults applied). */
export const BijakBlueprintAdminSectionSchema = z
  .strictObject({
    ...blueprintSectionShape,
    compulsory: z.boolean(),
    instruction: z.string().nullable(),
    allowedModes: z.array(BijakBuilderAnswerModeSchema),
  })
  .meta({ id: 'BijakBlueprintAdminSection' })
export type BijakBlueprintAdminSection = z.infer<typeof BijakBlueprintAdminSectionSchema>

/** `active` can be chosen by new papers and generates; `retired` cannot. */
export const BIJAK_BLUEPRINT_ADMIN_STATUSES = ['active', 'retired'] as const
export const BijakBlueprintAdminStatusSchema = z.enum(BIJAK_BLUEPRINT_ADMIN_STATUSES).meta({
  id: 'BijakBlueprintAdminStatus',
  description:
    'active = selectable by new papers; retired = no longer selectable (papers already published keep their version). Working assumption, see the report.',
})
export type BijakBlueprintAdminStatus = z.infer<typeof BijakBlueprintAdminStatusSchema>

/** Content of one blueprint version, as written by the admin (`POST .../versions`). */
const blueprintVersionInputShape = {
  source: BijakBlueprintSourceSchema,
  code: z.string().trim().min(1).max(32).meta({ example: '1449/2' }),
  durationMin: z.number().int().min(1).max(600),
  instructions: Instructions.optional().meta({ description: 'Default: empty.' }),
  reference: Reference.optional().meta({ description: 'Default: empty.' }),
  provenance: z
    .string()
    .trim()
    .max(200)
    .nullable()
    .optional()
    .meta({ description: 'Evidence note of the version, e.g. "PAPER (Johor)" (exam schema D7).' }),
  confidence: z
    .string()
    .trim()
    .max(100)
    .nullable()
    .optional()
    .meta({ description: 'Confidence note, e.g. "High (structure) / Low (duration)".' }),
  sections: z.array(BijakBlueprintAdminSectionInputSchema).min(1).max(20),
}

/** `POST /admin/blueprints/{id}/versions` body: the full content of the new version. */
export const BijakBlueprintAdminVersionInputSchema = z
  .strictObject(blueprintVersionInputShape)
  .meta({ id: 'BijakBlueprintAdminVersionInput' })
export type BijakBlueprintAdminVersionInput = z.infer<typeof BijakBlueprintAdminVersionInputSchema>

/** `POST /admin/blueprints` body: subject and kertas identify the blueprint; this is its version 1. */
export const BijakBlueprintAdminCreateSchema = z
  .strictObject({
    subject: z.string().trim().min(1).max(32).meta({ example: 'MAT' }),
    kertas: Kertas,
    ...blueprintVersionInputShape,
  })
  .meta({ id: 'BijakBlueprintAdminCreate' })
export type BijakBlueprintAdminCreate = z.infer<typeof BijakBlueprintAdminCreateSchema>

/** One immutable blueprint version (`blueprints` row with `blueprint_sections`). */
export const BijakBlueprintAdminVersionSchema = z
  .strictObject({
    version: z.number().int().min(1),
    status: BijakBlueprintAdminStatusSchema,
    source: BijakBlueprintSourceSchema,
    code: z.string().min(1),
    durationMin: z.number().int().min(1),
    instructions: z.array(z.string()),
    reference: z.array(BijakPaperReferencePanelSchema),
    provenance: z.string().nullable(),
    confidence: z.string().nullable(),
    sections: z.array(BijakBlueprintAdminSectionSchema).min(1),
    questionCount: z.number().int().min(0).meta({ description: 'Sum of the section `take` values.' }),
    totalMarks: z
      .number()
      .int()
      .min(0)
      .meta({ description: 'Sum of the section marks (choose-N already in `markBudget`); derived.' }),
    locked: z.boolean().meta({
      description:
        'True once a published paper uses this version: it can never change (edit = new version).',
    }),
    createdAt: TimestampSchema,
  })
  .meta({ id: 'BijakBlueprintAdminVersion' })
export type BijakBlueprintAdminVersion = z.infer<typeof BijakBlueprintAdminVersionSchema>

const blueprintSummaryShape = {
  id: IdSchema.meta({ description: 'Blueprint (family) id; stable over versions.' }),
  subject: z.string().min(1).meta({ example: 'MAT' }),
  subjectName: z.string().min(1),
  kertas: Kertas,
  status: BijakBlueprintAdminStatusSchema,
  latestVersion: z.number().int().min(1),
  versionCount: z.number().int().min(1),
  source: BijakBlueprintSourceSchema.meta({ description: 'Provenance tag of the latest version.' }),
  code: z.string().min(1).meta({ description: 'Paper code of the latest version.' }),
  durationMin: z.number().int().min(1),
  questionCount: z.number().int().min(0),
  totalMarks: z.number().int().min(0),
  updatedAt: TimestampSchema,
}

/** One row of the admin blueprint list (the latest version of each blueprint). */
export const BijakBlueprintAdminSummarySchema = z
  .strictObject(blueprintSummaryShape)
  .meta({ id: 'BijakBlueprintAdminSummary' })
export type BijakBlueprintAdminSummary = z.infer<typeof BijakBlueprintAdminSummarySchema>

/** A blueprint with every version. */
export const BijakBlueprintAdminSchema = z
  .strictObject({
    ...blueprintSummaryShape,
    versions: z.array(BijakBlueprintAdminVersionSchema).min(1).meta({
      description: 'Every version, newest first.',
    }),
  })
  .meta({ id: 'BijakBlueprintAdmin' })
export type BijakBlueprintAdmin = z.infer<typeof BijakBlueprintAdminSchema>

/** Query of `GET /admin/blueprints`. */
export const BijakBlueprintAdminListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).optional(),
    pageSize: z.coerce.number().int().min(1).max(100).optional(),
    subject: z.string().max(32).optional().meta({ description: 'Subject code.' }),
    kertas: z.coerce.number().int().min(1).optional(),
    status: BijakBlueprintAdminStatusSchema.optional(),
  })
  .meta({ id: 'BijakBlueprintAdminListQuery' })
export type BijakBlueprintAdminListQuery = z.infer<typeof BijakBlueprintAdminListQuerySchema>
