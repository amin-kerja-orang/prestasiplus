import { z } from '../../zod'
import { IdSchema } from '../../common/ids'
import { BijakUnitRefViewSchema } from '../standards/schema'

/**
 * Bijak SPM (M28) papers, blueprints ("Kontrak") and "Jana Kertas" generation: the read side of
 * BE-15. The mock `BijakServer` (`src/modules/m28-bijak-spm/server/store.ts`, types in
 * `domain/types.ts`) has no HTTP routes; the five routes of this contract are derived from its
 * methods `listPapers`, `getCover`, `listContracts`, `subjects` and `generatePaper`.
 *
 * Differences from the mock, all forced by the wire conventions:
 * - ids (paper, attempt) are opaque `Id` strings (UD-1); the mock already uses strings;
 * - `subject` and the paper `code` ("1449/1") stay plain strings (open dictionary, exam schema D9);
 * - the mock's three-way `GenerateOutcome` becomes `201 { data: { paperId } }` or a 422 error body
 *   (`NO_BLUEPRINT`, `SHORTAGE`), see `paths.ts`.
 *
 * Reveal rule (US-15, BE-15 AC 6): these responses never carry an answer key, mark scheme, accepted
 * equivalent or explanation, and never the question ids of a paper. Every response object is
 * therefore a strict object: an extra key (for example a `scheme` or `questionIds`) fails parsing.
 * The internal blueprint `pool` tag is not part of the wire either.
 */

/** BM messages kept verbatim from the mock (`BijakError`, `BijakHubPage.vue`). */
export const BIJAK_PAPERS_MESSAGES = {
  paperNotFound: 'Kertas tidak ditemui',
  noBlueprint: 'Belum ada kontrak untuk subjek dan kertas ini',
  shortage: 'Kertas tidak dapat dijana kerana soalan tidak mencukupi.',
  /** [PROPOSED] 503 GENERATE_LIMIT (solver node budget or time cap reached). */
  generateLimit: 'Kertas tidak dapat disusun sekarang. Cuba lagi.',
} as const

/** Subject dictionary entry (open dictionary, exam schema D9): MAT, SN, SEJ, ... */
export const BijakSubjectSchema = z
  .strictObject({
    code: z
      .string()
      .min(1)
      .max(32)
      .meta({ description: 'Subject code, e.g. MAT, SN, SEJ.', example: 'MAT' }),
    name: z.string().min(1).meta({ description: 'Display name (BM).', example: 'Matematik' }),
  })
  .meta({ id: 'BijakSubject' })
export type BijakSubject = z.infer<typeof BijakSubjectSchema>

/** Kertas number as served by the mock summary (`kertas: number`; paper definitions use 1 or 2). */
const Kertas = z
  .number()
  .int()
  .min(1)
  .meta({ description: 'Kertas number, 1 or 2 in the seeded data.', example: 2 })

/** `pilihan` = curated paper (Kertas Pilihan); `jana` = paper generated for the caller (Jana Kertas). */
export const BIJAK_PAPER_KINDS = ['pilihan', 'jana'] as const
export const BijakPaperKindSchema = z.enum(BIJAK_PAPER_KINDS).meta({
  description: 'pilihan = curated paper, jana = paper generated for the caller.',
})
export type BijakPaperKind = z.infer<typeof BijakPaperKindSchema>

/** Caller progress on a paper: `belum` not started, `sedang` an attempt is in progress, `selesai` has a result. */
export const BIJAK_PAPER_PROGRESS = ['belum', 'sedang', 'selesai'] as const
export const BijakPaperProgressSchema = z.enum(BIJAK_PAPER_PROGRESS).meta({
  description:
    'Latest status for the caller: sedang when the latest attempt is in progress (attemptId is then set), else selesai when any attempt has a result (lastScore is then set), else belum.',
})
export type BijakPaperProgress = z.infer<typeof BijakPaperProgressSchema>

const summaryShape = {
  id: IdSchema,
  title: z.string().min(1).meta({ example: 'Percubaan SPM Matematik Kertas 2 Set A' }),
  subject: z.string().min(1).meta({ description: 'Subject code.', example: 'MAT' }),
  subjectName: z.string().min(1).meta({ example: 'Matematik' }),
  kertas: Kertas,
  year: z.number().int(),
  code: z.string().min(1).meta({ description: 'Printed paper code.', example: '1449/2' }),
  durationMin: z.number().int().min(1).meta({ description: 'Printed duration in minutes (Q-S1).' }),
  questionCount: z
    .number()
    .int()
    .min(0)
    .meta({ description: 'Questions on the paper, over all sections.' }),
  marks: z
    .number()
    .int()
    .min(0)
    .meta({
      description:
        'Total marks derived from the placements (choose-N counts the N largest questions), never stored by hand (Q-S6).',
    }),
  kind: BijakPaperKindSchema,
  status: BijakPaperProgressSchema,
  lastScore: z
    .strictObject({ score: z.number().min(0), max: z.number().min(0) })
    .optional()
    .meta({
      description: 'Score of the latest submitted attempt of the caller; absent when none.',
    }),
  attemptId: IdSchema.optional().meta({
    description: 'The in-progress attempt of the caller; present only when status is sedang.',
  }),
}

/** `PaperSummary` of the mock: one row of the Kertas Pilihan list, with the caller's progress. */
export const BijakPaperSummarySchema = z
  .strictObject(summaryShape)
  .meta({ id: 'BijakPaperSummary' })
export type BijakPaperSummary = z.infer<typeof BijakPaperSummarySchema>

/** One section of the cover. No question ids, no scheme. */
export const BijakPaperCoverSectionSchema = z
  .strictObject({
    label: z.string().min(1).meta({ example: 'Bahagian C' }),
    marks: z.number().int().min(0).meta({ description: 'Effective marks after choose-N.' }),
    instruction: z.string().min(1).meta({
      description:
        'Authored instruction, else "Jawab semua soalan." (rule all) or "Jawab {n} daripada {count} soalan." (rule choose).',
      example: 'Jawab 1 daripada 2 soalan.',
    }),
    questionCount: z.number().int().min(0),
    compulsory: z.boolean().meta({ description: '"Soalan ini mesti dijawab".' }),
    chooseN: z
      .number()
      .int()
      .min(1)
      .optional()
      .meta({ description: 'Present only for a choose-N section.' }),
  })
  .meta({ id: 'BijakPaperCoverSection' })
export type BijakPaperCoverSection = z.infer<typeof BijakPaperCoverSectionSchema>

/** A reference-sheet panel (formula sheet), returned verbatim; items may hold `$latex$` spans. */
export const BijakPaperReferencePanelSchema = z
  .strictObject({
    title: z.string().min(1).meta({ example: 'Rumus (ringkas)' }),
    items: z.array(z.string()),
  })
  .meta({ id: 'BijakPaperReferencePanel' })
export type BijakPaperReferencePanel = z.infer<typeof BijakPaperReferencePanelSchema>

/** `PaperCover` of the mock: the summary plus instructions, reference sheet and sections. */
export const BijakPaperCoverSchema = z
  .strictObject({
    ...summaryShape,
    instructions: z.array(z.string()).meta({ description: 'Cover instruction lines, verbatim.' }),
    reference: z
      .array(BijakPaperReferencePanelSchema)
      .meta({ description: 'Reference-sheet panels; empty when the paper has none.' }),
    sections: z.array(BijakPaperCoverSectionSchema).min(1),
  })
  .meta({ id: 'BijakPaperCover' })
export type BijakPaperCover = z.infer<typeof BijakPaperCoverSchema>

/** Provenance of a blueprint: `Disahkan` (confirmed), `Spec`, `Draf` (a draft cannot generate). */
export const BIJAK_BLUEPRINT_SOURCES = ['Disahkan', 'Spec', 'Draf'] as const
export const BijakBlueprintSourceSchema = z.enum(BIJAK_BLUEPRINT_SOURCES).meta({
  description:
    'Provenance tag of the blueprint. A blueprint with source Draf cannot generate a paper (NO_BLUEPRINT).',
})
export type BijakBlueprintSource = z.infer<typeof BijakBlueprintSourceSchema>

export const BijakBlueprintSectionSchema = z
  .strictObject({
    label: z.string().min(1).meta({ example: 'Bahagian A' }),
    take: z
      .number()
      .int()
      .min(0)
      .meta({
        description:
          'Number of questions the section holds (a stimulus group counts with all its questions).',
      }),
  })
  .meta({ id: 'BijakBlueprintSection' })
export type BijakBlueprintSection = z.infer<typeof BijakBlueprintSectionSchema>

/** `listContracts()` row: a Kontrak Blueprint as shown to the student (the internal `pool` tag is not exposed). */
export const BijakBlueprintContractSchema = z
  .strictObject({
    subject: z.string().min(1).meta({ example: 'MAT' }),
    subjectName: z.string().min(1).meta({ example: 'Matematik' }),
    kertas: Kertas,
    source: BijakBlueprintSourceSchema,
    code: z.string().min(1).meta({ example: '1449/2' }),
    durationMin: z.number().int().min(1),
    sections: z.array(BijakBlueprintSectionSchema).min(1),
    canGenerate: z.boolean().meta({
      description:
        'BJS-01: whether the caller can generate from this row now. Student and Admin Sekolah in Mod Pelajar: true only when a serving (Disahkan) version exists; the row shown is the serving version, or the head when none serves. Admin Pusat in Mod Pelajar: true when the head is Spec or Disahkan. When false the UI shows the AC-03.6 reason.',
    }),
    unavailableReason: z.enum(['NO_BLUEPRINT']).optional().meta({
      description: 'Present only when canGenerate is false.',
    }),
  })
  .meta({ id: 'BijakBlueprintContract' })
export type BijakBlueprintContract = z.infer<typeof BijakBlueprintContractSchema>

/** `POST /bijak/papers/generate` request. */
export const BijakGenerateRequestSchema = z
  .object({
    subject: z
      .string()
      .min(1)
      .max(32)
      .meta({ description: 'Subject code of a blueprint.', example: 'MAT' }),
    kertas: z.number().int().min(1).meta({ example: 2 }),
  })
  .meta({ id: 'BijakGenerateRequest' })
export type BijakGenerateRequest = z.infer<typeof BijakGenerateRequestSchema>

/** `201` result: the new private paper (`kind: jana`); open it with `GET /bijak/papers/{id}`. */
export const BijakGenerateResultSchema = z
  .strictObject({ paperId: IdSchema })
  .meta({ id: 'BijakGenerateResult' })
export type BijakGenerateResult = z.infer<typeof BijakGenerateResultSchema>

export const BIJAK_SHORTAGE_KINDS = [
  'count',
  'marks',
  'tp',
  'unit',
  'kbat',
  'level_share',
  'combination',
  'overlap',
] as const
export const BijakShortageKindSchema = z.enum(BIJAK_SHORTAGE_KINDS).meta({ id: 'BijakShortageKind' })
export type BijakShortageKind = z.infer<typeof BijakShortageKindSchema>

/**
 * Shortage of one blueprint section: `need` wanted, only `have` reachable. The original
 * `{ section, need, have }` stays valid; the typed fields are optional and carry data, not prose
 * (the BM line is built by `shortageLine` in exam-core from `kind`).
 */
export const BijakGenerateShortageSchema = z
  .strictObject({
    section: z.string().min(1).meta({ example: 'Bahagian A' }),
    need: z.number().int().min(1),
    have: z.number().int().min(0),
    kind: BijakShortageKindSchema.optional(),
    basis: z.enum(['questions', 'marks']).optional().meta({ description: 'Unit of need/have for kind unit.' }),
    unit: BijakUnitRefViewSchema.optional().meta({ description: 'The short unit (kind unit).' }),
    slot: z
      .strictObject({ from: z.number().int().min(1), to: z.number().int().min(1) })
      .optional()
      .meta({ description: 'Slot range of the short group (kind tp).' }),
    tp: z
      .strictObject({ min: z.number().int().min(1).max(6), max: z.number().int().min(1).max(6) })
      .optional()
      .meta({ description: 'TP band of the short group (kind tp).' }),
    blocking: z.enum(['kbat', 'tp', 'marks', 'quota']).optional().meta({
      description: 'Kind combination: the constraint family whose removal makes the section solvable.',
    }),
    otherSection: z.string().min(1).optional().meta({
      description: 'Kind overlap: the section whose picks used up the needed questions.',
    }),
  })
  .meta({ id: 'BijakGenerateShortage' })
export type BijakGenerateShortage = z.infer<typeof BijakGenerateShortageSchema>

/** Module error codes of `POST /bijak/papers/generate`: NO_BLUEPRINT and SHORTAGE are HTTP 422, GENERATE_LIMIT is HTTP 503. */
export const BIJAK_GENERATE_ERROR_CODES = ['NO_BLUEPRINT', 'SHORTAGE', 'GENERATE_LIMIT'] as const
export const BijakGenerateErrorCodeSchema = z
  .enum(BIJAK_GENERATE_ERROR_CODES)
  .meta({ id: 'BijakGenerateErrorCode' })
export type BijakGenerateErrorCode = z.infer<typeof BijakGenerateErrorCodeSchema>

/** 422 NO_BLUEPRINT: no blueprint for (subject, kertas), or its source is Draf. No paper row is created. */
export const BijakGenerateNoBlueprintErrorSchema = z
  .object({
    error: z.object({
      code: z.literal('NO_BLUEPRINT'),
      message: z.literal(BIJAK_PAPERS_MESSAGES.noBlueprint),
      requestId: z.string().optional(),
    }),
  })
  .meta({ id: 'BijakGenerateNoBlueprintError' })

/** 422 SHORTAGE: the pool cannot fill a section exactly; a shortage list is returned instead of a short paper. */
export const BijakGenerateShortageErrorSchema = z
  .object({
    error: z.object({
      code: z.literal('SHORTAGE'),
      message: z.literal(BIJAK_PAPERS_MESSAGES.shortage),
      details: z.strictObject({ shortages: z.array(BijakGenerateShortageSchema).min(1) }),
      requestId: z.string().optional(),
    }),
  })
  .meta({ id: 'BijakGenerateShortageError' })
export type BijakGenerateShortageError = z.infer<typeof BijakGenerateShortageErrorSchema>

/**
 * 503 GENERATE_LIMIT [PROPOSED]: the solver node budget or time cap was reached. No paper is created
 * and no shortage is invented. `details.limitSections` lists the sections being solved. No Retry-After is needed.
 */
export const BijakGenerateLimitErrorSchema = z
  .object({
    error: z.object({
      code: z.literal('GENERATE_LIMIT'),
      message: z.literal(BIJAK_PAPERS_MESSAGES.generateLimit),
      details: z.strictObject({
        limitSections: z
          .array(z.strictObject({ section: z.string().min(1).optional() }))
          .meta({
            description: 'Sections that were being solved when the budget ran out; section may be absent.',
          }),
      }),
      requestId: z.string().optional(),
    }),
  })
  .meta({ id: 'BijakGenerateLimitError' })
export type BijakGenerateLimitError = z.infer<typeof BijakGenerateLimitErrorSchema>
