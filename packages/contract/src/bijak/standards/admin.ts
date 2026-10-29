import { z } from '../../zod'
import { IdSchema } from '../../common/ids'
import { TimestampSchema } from '../../common/time'
import { BijakBuilderSectionRuleSchema } from '../builder/schema'
import { BijakBlueprintSourceSchema, BijakGenerateShortageSchema } from '../papers/schema'
import {
  BIJAK_STANDARDS_MESSAGES,
  BijakBlueprintProblemSchema,
  BijakBlueprintWarningSchema,
  BijakQuotaBasisSchema,
  BijakUnitRefViewSchema,
  BijakVerificationSummarySchema,
} from './schema'

/**
 * Bijak SPM standard, admin side (BJS-01): evidence, verification, version history, pool preview
 * ("Pratonton kolam"), draft generation and the two 422 bodies. Architecture 3.4, 6.3, 6.5, 6.6.
 * Every route is Admin Pusat only (AC-32.1, AC-39.3). Strict objects throughout.
 */

/* ------------------------------------------------------------------------------- evidence */

export const BIJAK_EVIDENCE_KINDS = ['trial_paper', 'skema', 'lpm_format'] as const
export const BijakEvidenceKindSchema = z.enum(BIJAK_EVIDENCE_KINDS).meta({
  id: 'BijakEvidenceKind',
  description:
    'trial_paper = a trial paper; skema = its skema jawapan; lpm_format = an official LPM format / JSU document (counts as two supporting bodies, AC-39.2).',
})
export type BijakEvidenceKind = z.infer<typeof BijakEvidenceKindSchema>

/** Values read from an evidence item. Every field is optional: a skema states marks but not rules or duration (SPP 10.3). */
export const BijakEvidenceValuesSchema = z
  .strictObject({
    durationMin: z.number().int().min(1).max(600).optional(),
    totalMarks: z.number().int().min(0).max(1000).optional().meta({ description: 'Effective (counted) total.' }),
    sections: z
      .array(
        z.strictObject({
          position: z.number().int().min(1).meta({ description: '1-based; matched to the blueprint by position, the label is informational.' }),
          label: z.string().max(100).optional(),
          markBudget: z.number().int().min(0).max(1000).optional(),
          offeredMarks: z.number().int().min(0).max(1000).optional(),
          rule: BijakBuilderSectionRuleSchema.optional(),
          questionCount: z.number().int().min(0).max(500).optional(),
        }),
      )
      .max(20)
      .optional(),
  })
  .meta({ id: 'BijakEvidenceValues' })
export type BijakEvidenceValues = z.infer<typeof BijakEvidenceValuesSchema>

/** `POST .../evidence` body. Never the file, never question text (AC-40.3). */
export const BijakEvidenceInputSchema = z
  .strictObject({
    kind: BijakEvidenceKindSchema,
    body: z.string().trim().min(1).max(64).meta({
      description: "Exam board value of the exam schema (D8), e.g. sbp, selangor_mpsm; 'lpm' for the official body.",
      example: 'sbp',
    }),
    year: z.number().int().min(1990).max(2100),
    paperCode: z.string().trim().min(1).max(32).meta({ example: '1449/2' }),
    setLabel: z.string().trim().max(64).nullish(),
    sourceRef: z.string().trim().max(500).nullish().meta({
      description: 'Free-text pointer to where the paper is kept (folder / file label).',
    }),
    values: BijakEvidenceValuesSchema,
    note: z.string().max(2000).nullish(),
  })
  .meta({ id: 'BijakEvidenceInput' })
export type BijakEvidenceInput = z.infer<typeof BijakEvidenceInputSchema>

export const BijakEvidenceItemSchema = z
  .strictObject({
    id: IdSchema,
    kind: BijakEvidenceKindSchema,
    body: z.string().min(1),
    year: z.number().int(),
    paperCode: z.string().min(1),
    setLabel: z.string().nullable(),
    sourceRef: z.string().nullable(),
    values: BijakEvidenceValuesSchema,
    origin: z.enum(['study', 'admin']).meta({ description: 'study = seeded from the study; admin = entered by Admin Pusat.' }),
    note: z.string().nullable(),
    createdAt: TimestampSchema,
  })
  .meta({ id: 'BijakEvidenceItem' })
export type BijakEvidenceItem = z.infer<typeof BijakEvidenceItemSchema>

/* ----------------------------------------------------------------------------- verification */

export const BIJAK_EVIDENCE_LINE_FIELDS = ['durationMin', 'totalMarks', 'markBudget', 'rule', 'questionCount'] as const
export const BIJAK_EVIDENCE_LINE_STATUSES = ['ok', 'differs', 'not_covered', 'tidak_disahkan'] as const

export const BijakEvidenceLineSchema = z
  .strictObject({
    field: z.enum(BIJAK_EVIDENCE_LINE_FIELDS),
    sectionPosition: z.number().int().min(1).optional(),
    expected: z.unknown().meta({ description: 'The blueprint value compared.' }),
    statements: z.array(
      z.strictObject({
        evidenceId: IdSchema,
        body: z.string().min(1),
        kind: BijakEvidenceKindSchema,
        value: z.unknown(),
      }),
    ),
    supportingBodies: z.number().int().min(0),
    status: z.enum(BIJAK_EVIDENCE_LINE_STATUSES).meta({
      description:
        'differs = a contradicting statement; not_covered = no statement; tidak_disahkan = fewer than 2 supporting bodies [PROPOSED label]; ok otherwise (AC-39.7).',
    }),
  })
  .meta({ id: 'BijakEvidenceLine' })
export type BijakEvidenceLine = z.infer<typeof BijakEvidenceLineSchema>

export const BIJAK_COMPLETENESS_CODES = [
  'NO_PROFILE',
  'NO_QUOTA',
  'NO_KBAT',
  'NO_SHARE',
  'NO_DURATION',
  'NO_EVIDENCE_BODIES',
] as const

export const BijakVerificationCheckSchema = z
  .strictObject({
    passes: z.boolean(),
    blueprintProblems: z.array(BijakBlueprintProblemSchema),
    completeness: z.array(
      z.strictObject({
        code: z.enum(BIJAK_COMPLETENESS_CODES),
        sectionPosition: z.number().int().min(1).optional(),
      }),
    ),
    lines: z.array(BijakEvidenceLineSchema),
  })
  .meta({
    id: 'BijakVerificationCheck',
    description:
      'The live gate of AC-39.1 and AC-39.7 against the head. passes is true only when there is no problem, no completeness gap and every evidence line is ok. Every failure is listed at once.',
  })
export type BijakVerificationCheck = z.infer<typeof BijakVerificationCheckSchema>

export const BijakVerificationRecordSchema = BijakVerificationSummarySchema.extend({
  evidence: z.array(BijakEvidenceItemSchema),
  lines: z.array(BijakEvidenceLineSchema),
}).meta({
  id: 'BijakVerificationRecord',
  description: 'The recorded verification: summary plus the frozen evidence snapshot and compared lines (insert-only).',
})
export type BijakVerificationRecord = z.infer<typeof BijakVerificationRecordSchema>

/** `GET .../verification` result. */
export const BijakVerificationStateSchema = z
  .strictObject({
    record: BijakVerificationRecordSchema.nullable(),
    check: BijakVerificationCheckSchema,
  })
  .meta({ id: 'BijakVerificationState' })
export type BijakVerificationState = z.infer<typeof BijakVerificationStateSchema>

/** `POST .../verify` body. */
export const BijakVerifyInputSchema = z
  .strictObject({ note: z.string().trim().max(2000).optional() })
  .meta({ id: 'BijakVerifyInput' })
export type BijakVerifyInput = z.infer<typeof BijakVerifyInputSchema>

/* ----------------------------------------------------------------------- version history */

export const BijakBlueprintVersionItemSchema = z
  .strictObject({
    version: z.number().int().min(1),
    status: z.enum(['draft', 'active', 'retired']),
    source: BijakBlueprintSourceSchema,
    servesStudents: z.boolean(),
    createdAt: TimestampSchema,
    structureHash: z.string().min(1),
    verification: BijakVerificationSummarySchema.optional(),
  })
  .meta({ id: 'BijakBlueprintVersionItem' })
export type BijakBlueprintVersionItem = z.infer<typeof BijakBlueprintVersionItemSchema>

/* ---------------------------------------------------------------------------- pool preview */

export const BIJAK_EXCLUDED_REASONS = ['no_unit', 'no_tp', 'no_cognitive_level', 'no_marks', 'no_key'] as const
const BankQuery = z.record(z.string(), z.string()).meta({
  description: 'Filters for the "Lihat soalan" link into the Bank Soalan (subject, status=published, missing=...).',
})
const Short = z.strictObject({ needed: z.number().int().min(0), available: z.number().int().min(0), short: z.number().int().min(0) })

export const BijakPoolPreviewSectionSchema = z
  .strictObject({
    position: z.number().int().min(1),
    label: z.string().min(1),
    slots: z.number().int().min(0),
    effectiveMarks: z.number().int().min(0),
    offeredMarks: z.number().int().min(0),
    eligible: z.number().int().min(0).meta({ description: 'Questions eligible for this section (AC-29.1).' }),
    modeExcluded: z.number().int().min(0).meta({ description: 'Eligible elsewhere but the answer mode is not allowed here.' }),
    counts: Short,
    marks: z.strictObject({ needed: z.number().int().min(0), reachable: z.boolean() }),
    quota: z.array(
      Short.extend({ unit: BijakUnitRefViewSchema, basis: BijakQuotaBasisSchema }),
    ),
    tp: z.array(
      Short.extend({
        slot: z.strictObject({ from: z.number().int().min(1), to: z.number().int().min(1) }),
        tpMin: z.number().int().min(1).max(6),
        tpMax: z.number().int().min(1).max(6),
        tp: z.number().int().min(1).max(6).optional().meta({ description: 'Set for an exact per-TP count line.' }),
      }),
    ),
    kbat: Short.nullable(),
    bankQuery: BankQuery,
  })
  .meta({ id: 'BijakPoolPreviewSection' })

export const BijakPoolPreviewSchema = z
  .strictObject({
    blueprint: z.strictObject({ version: z.number().int().min(1), source: BijakBlueprintSourceSchema }),
    verdict: z.enum(['boleh', 'tidak_boleh', 'tidak_pasti']).meta({
      description: '"Boleh dijana" / "Tidak boleh dijana" / tidak_pasti when the reference attempt hit the budget (AC-29.5).',
    }),
    firstFailure: BijakGenerateShortageSchema.nullable(),
    excluded: z.strictObject({
      total: z.number().int().min(0).meta({ description: 'Unique excluded questions; per-reason counts may overlap (design D-8).' }),
      byReason: z.array(
        z.strictObject({
          reason: z.enum(BIJAK_EXCLUDED_REASONS),
          count: z.number().int().min(0),
          bankQuery: BankQuery,
        }),
      ),
    }),
    warnings: z.array(BijakBlueprintWarningSchema).meta({ description: 'KBAT_TP_BAND is shown in the preview too (AC-37.5).' }),
    sections: z.array(BijakPoolPreviewSectionSchema),
  })
  .meta({
    id: 'BijakPoolPreview',
    description:
      'Pratonton kolam. Counts equal rows (NFR-12): computed over the same candidate list the generator uses. short > 0 is rendered as "Kurang {n}" text, not by colour alone (NFR-16).',
  })
export type BijakPoolPreview = z.infer<typeof BijakPoolPreviewSchema>

export const BijakPoolPreviewQuerySchema = z
  .object({ version: z.coerce.number().int().min(1).optional() })
  .meta({ id: 'BijakPoolPreviewQuery' })

/* ----------------------------------------------------------------------------- draft paper */

/** `POST /admin/papers/generate` body (AC-29.2). */
export const BijakDraftGenerateRequestSchema = z
  .strictObject({
    subject: z.string().trim().min(1).max(32).meta({ example: 'MAT' }),
    kertas: z.number().int().min(1).meta({ example: 2 }),
  })
  .meta({ id: 'BijakDraftGenerateRequest' })
export type BijakDraftGenerateRequest = z.infer<typeof BijakDraftGenerateRequestSchema>

export const BijakDraftGenerateResultSchema = z
  .strictObject({ paperId: IdSchema })
  .meta({ id: 'BijakDraftGenerateResult', description: 'A draft pilihan paper; never published automatically.' })
export type BijakDraftGenerateResult = z.infer<typeof BijakDraftGenerateResultSchema>

/* ------------------------------------------------------------------------------ error bodies */

/** 422 BLUEPRINT_INVALID: every problem at once (AC-25.7). */
export const BijakBlueprintInvalidErrorSchema = z
  .object({
    error: z.object({
      code: z.literal('BLUEPRINT_INVALID'),
      message: z.literal(BIJAK_STANDARDS_MESSAGES.blueprintInvalid),
      details: z.strictObject({
        problems: z.array(BijakBlueprintProblemSchema).min(1),
        warnings: z.array(BijakBlueprintWarningSchema).optional(),
      }),
      requestId: z.string().optional(),
    }),
  })
  .meta({ id: 'BijakBlueprintInvalidError' })
export type BijakBlueprintInvalidError = z.infer<typeof BijakBlueprintInvalidErrorSchema>

/** 422 VERIFICATION_FAILED: the same check object as GET .../verification; every failure listed (AC-39.1). */
export const BijakVerificationFailedErrorSchema = z
  .object({
    error: z.object({
      code: z.literal('VERIFICATION_FAILED'),
      message: z.literal(BIJAK_STANDARDS_MESSAGES.verificationFailed),
      details: z.strictObject({
        check: BijakVerificationCheckSchema,
      }),
      requestId: z.string().optional(),
    }),
  })
  .meta({ id: 'BijakVerificationFailedError' })
export type BijakVerificationFailedError = z.infer<typeof BijakVerificationFailedErrorSchema>
