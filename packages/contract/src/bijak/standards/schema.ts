import { z } from '../../zod'
import { IdSchema } from '../../common/ids'
import { TimestampSchema } from '../../common/time'
import { QuestionLeafModeSchema } from '../../questions/parts'

/**
 * Bijak SPM exam standard (slug `bijak-spm`, BJS-01): the shapes that turn a blueprint ("Kontrak")
 * into a checkable standard. Source of truth: `docs/architecture/v2-bijak-spm-standards.md`
 * sections 3.3, 6.2 and 6.3, ADR-0022 and ADR-0023. This file is the BASE layer: it imports nothing
 * from `bijak/papers` or `bijak/builder`, so both can import it. The evidence, verification,
 * pool-preview and error shapes that need the builder and papers vocabulary live in `./admin.ts`.
 *
 * Conventions: camelCase, strict objects (unknown keys are rejected, BE-NFR-05), field names final
 * once BJS-01 merges. BM copy is taken from the requirements (`docs/requirements/v2-bijak-spm.md`);
 * new copy is tagged [PROPOSED].
 */

/** BM copy of the standard. Labels are never shown raw (AC-25.4, AC-25.8). */
export const BIJAK_STANDARDS_MESSAGES = {
  /** [PROPOSED] 422 BLUEPRINT_INVALID message; the list of problems travels in `details.problems`. */
  blueprintInvalid: 'Kontrak tidak boleh disimpan. Betulkan masalah yang disenaraikan.',
  /** [PROPOSED] 422 VERIFICATION_FAILED message; every failure travels in `details`. */
  verificationFailed: 'Kontrak belum boleh disahkan. Semak senarai kegagalan.',
  /** [PROPOSED] 409 on verify when the head is already Disahkan. */
  alreadyVerified: 'Kontrak ini sudah Disahkan.',
  /** [PROPOSED] 409 on evidence write when the head is Disahkan (AC-39.4: edit through a new version). */
  evidenceLocked: 'Kontrak Disahkan tidak boleh diubah di tempat. Cipta versi baharu dahulu.',
  /** [PROPOSED] 404 on evidence delete. */
  evidenceNotFound: 'Bukti tidak ditemui',
  /** AC-29.1: empty pool is not an error. */
  poolEmpty: 'Tiada soalan Terbit untuk tag ini',
  /** [PROPOSED] (architecture 6.3a) badge text of the O-2 signal. */
  needsReview: 'Blueprint perlu disemak',
  /** [PROPOSED] (AC-39.5) label of study-seeded evidence until a human verification replaces it. */
  studyEvidenceLabel: 'Kajian kertas percubaan 2025',
} as const

/** [PROPOSED] UI labels of the profile kinds, quota bases and the T1-T3 bucket (architecture 6.2, AC-35.1). */
export const BIJAK_STANDARDS_LABELS = {
  profileKind: {
    ladder: 'Tangga mengikut nombor soalan',
    bahagian: 'Mengikut Bahagian',
    tema: 'Blok tema',
  },
  quotaBasis: { questions: 'Bilangan soalan', marks: 'Markah' },
  t1t3Bucket: 'T1-T3, luar DSKP',
} as const

/* -------------------------------------------------------------------------- vocabulary */

const Tp = z.number().int().min(1).max(6).meta({ description: 'Tahap Penguasaan, 1 to 6.' })

/** Slot numbers are 1-based inside a section. */
const Slot = z.number().int().min(1).max(500)

/** A unit reference of a quota line or a theme block (`curriculum_nodes.id` of kind unit, or the T1-T3 bucket). */
export const BijakUnitRefSchema = z
  .discriminatedUnion('kind', [
    z.strictObject({
      kind: z.literal('unit'),
      nodeId: IdSchema.meta({ description: 'curriculum_nodes.id of a node of kind unit.' }),
    }),
    z.strictObject({ kind: z.literal('t1_t3') }),
  ])
  .meta({
    id: 'BijakUnitRef',
    description:
      '{ kind: unit, nodeId } = a DSKP unit (pins the DSKP edition); { kind: t1_t3 } = the bucket "T1-T3, luar DSKP" (questions with form_origin t1_t3 and no unit).',
  })
export type BijakUnitRef = z.infer<typeof BijakUnitRefSchema>

/** Response form of a unit reference: adds the display fields. */
export const BijakUnitRefViewSchema = z
  .discriminatedUnion('kind', [
    z.strictObject({
      kind: z.literal('unit'),
      nodeId: IdSchema,
      code: z.string().min(1).optional().meta({ example: '3.0' }),
      level: z.enum(['T4', 'T5']).optional(),
      title: z.string().optional(),
    }),
    z.strictObject({ kind: z.literal('t1_t3') }),
  ])
  .meta({
    id: 'BijakUnitRefView',
    description: 'Unit reference as read back: code, level (T4 or T5) and title are added for display.',
  })
export type BijakUnitRefView = z.infer<typeof BijakUnitRefViewSchema>

export const BIJAK_PROFILE_KINDS = ['ladder', 'bahagian', 'tema'] as const
export const BijakProfileKindSchema = z.enum(BIJAK_PROFILE_KINDS).meta({
  id: 'BijakProfileKind',
  description:
    'ladder = "Tangga mengikut nombor soalan"; bahagian = "Mengikut Bahagian"; tema = "Blok tema" (hidden in the editor until built, design D-9).',
})
export type BijakProfileKind = z.infer<typeof BijakProfileKindSchema>

export const BIJAK_QUOTA_BASES = ['questions', 'marks'] as const
export const BijakQuotaBasisSchema = z.enum(BIJAK_QUOTA_BASES).meta({
  id: 'BijakQuotaBasis',
  description:
    'questions = "Bilangan soalan" (default for objective sections); marks = "Markah" (default for structured sections), AC-36.1.',
})
export type BijakQuotaBasis = z.infer<typeof BijakQuotaBasisSchema>

/** Stated T4:T5 share in the quota basis (AC-36.3). */
export const BijakLevelShareSchema = z
  .strictObject({ t4: z.number().int().min(0), t5: z.number().int().min(0) })
  .meta({
    id: 'BijakLevelShare',
    description:
      'Stated T4:T5 share in the basis unit (the T1-T3 bucket is excluded from the denominator). Must equal the share implied by the unit values.',
  })
export type BijakLevelShare = z.infer<typeof BijakLevelShareSchema>

/* ----------------------------------------------------------------------- slot group, profile */

const slotGroupFields = {
  from: Slot.meta({ description: '1-based first slot of the group inside the section.' }),
  to: Slot.meta({ description: '1-based last slot (inclusive). Groups tile 1..questionCount.' }),
  tpMin: Tp,
  tpMax: Tp,
  tpCounts: z
    .array(z.strictObject({ tp: Tp, count: z.number().int().min(1).max(500) }))
    .max(6)
    .optional()
    .meta({
      description:
        'Optional EXACT number of questions per TP in this group; when set, the counts add up to the group size (TPs without a count inside the band count as 0), AC-35.2.',
    }),
  marksMin: z.number().int().min(1).max(1000).optional().meta({
    description:
      'O-8, AC-34.9: minimum marks of a question in this group. marksMin = marksMax is exact per-slot marks (AC-34.3).',
  }),
  marksMax: z.number().int().min(1).max(1000).optional().meta({
    description: 'O-8, AC-34.9: maximum marks of a question in this group.',
  }),
}

/** Cross-field rules of a slot group that a single-field schema cannot express (the all-at-once list is `validateBlueprint`). */
const slotGroupRefine = (g: {
  from: number
  to: number
  tpMin: number
  tpMax: number
  marksMin?: number
  marksMax?: number
}): boolean =>
  g.to >= g.from &&
  g.tpMax >= g.tpMin &&
  (g.marksMin === undefined || g.marksMax === undefined || g.marksMax >= g.marksMin)

/** [PROPOSED] copy. Kept out of the string so the tag never reaches a runtime message. */
export const SLOT_GROUP_REFINE_MESSAGE =
  'Kumpulan slot tidak sah: slot akhir tidak boleh sebelum slot awal, dan nilai maksimum tidak boleh kurang daripada nilai minimum.'

/** Slot group of a difficulty profile, input form (`units` are unit references; used by 'tema' only). */
export const BijakSlotGroupSchema = z
  .strictObject({
    ...slotGroupFields,
    units: z.array(BijakUnitRefSchema).max(60).optional().meta({
      description: "'tema' only: the unit set of the theme block.",
    }),
  })
  .refine(slotGroupRefine, SLOT_GROUP_REFINE_MESSAGE)
  .meta({
    id: 'BijakSlotGroup',
    description:
      'Cross-field rules: from <= to, tpMin <= tpMax, and marksMin <= marksMax when both are set. A violation is refused with SLOT_GROUP_REFINE_MESSAGE.',
  })
export type BijakSlotGroup = z.infer<typeof BijakSlotGroupSchema>

export const BijakSlotGroupViewSchema = z
  .strictObject({
    ...slotGroupFields,
    units: z.array(BijakUnitRefViewSchema).optional(),
  })
  .meta({ id: 'BijakSlotGroupView' })
export type BijakSlotGroupView = z.infer<typeof BijakSlotGroupViewSchema>

/** Difficulty profile of a section (US-35), input form. */
export const BijakDifficultyProfileSchema = z
  .strictObject({
    kind: BijakProfileKindSchema,
    groups: z.array(BijakSlotGroupSchema).min(1).max(40),
  })
  .meta({
    id: 'BijakDifficultyProfile',
    description:
      'Exactly one kind per section (AC-35.1). Groups tile slots 1..questionCount with no gap or overlap (SLOT_GAP, SLOT_OVERLAP are reported by the validator, which lists every problem at once).',
  })
export type BijakDifficultyProfile = z.infer<typeof BijakDifficultyProfileSchema>

export const BijakDifficultyProfileViewSchema = z
  .strictObject({
    kind: BijakProfileKindSchema,
    groups: z.array(BijakSlotGroupViewSchema).min(1).max(40),
  })
  .meta({ id: 'BijakDifficultyProfileView' })
export type BijakDifficultyProfileView = z.infer<typeof BijakDifficultyProfileViewSchema>

/* ------------------------------------------------------------------------------------ quota */

export const BIJAK_QUOTA_TAGS = ['observed', 'inferred', 'single_source'] as const
export const BijakQuotaTagSchema = z.enum(BIJAK_QUOTA_TAGS).meta({
  id: 'BijakQuotaTag',
  description:
    'Provenance of a seeded quota value, shown in the editor. Informational: no gate uses it (architecture 13.1a(b)).',
})
export type BijakQuotaTag = z.infer<typeof BijakQuotaTagSchema>

export const BijakQuotaLineSchema = z
  .strictObject({
    tag: BijakQuotaTagSchema.optional(),
    unit: BijakUnitRefSchema,
    value: z.number().int().min(0).max(1000).meta({
      description: 'EXACT value in the quota basis. 0 is allowed; a unit without a line is never picked for the section (AC-36.2).',
    }),
  })
  .meta({ id: 'BijakQuotaLine' })
export type BijakQuotaLine = z.infer<typeof BijakQuotaLineSchema>

/** Exact topic quota of a section (US-36), input form. */
export const BijakTopicQuotaSchema = z
  .strictObject({
    basis: BijakQuotaBasisSchema,
    lines: z.array(BijakQuotaLineSchema).min(1).max(60),
    levelShare: BijakLevelShareSchema.optional(),
  })
  .meta({
    id: 'BijakTopicQuota',
    description:
      'One exact value per unit, counted by the primary unit of a question (O-1). Lines add up to the offered question count (basis questions) or the offered marks (basis marks); a duplicate unit is a QUOTA_SUM problem.',
  })
export type BijakTopicQuota = z.infer<typeof BijakTopicQuotaSchema>

export const BijakQuotaLineViewSchema = z
  .strictObject({
    tag: BijakQuotaTagSchema.optional(),
    unit: BijakUnitRefViewSchema,
    value: z.number().int().min(0),
    reviewed: z.boolean().meta({
      description:
        'AC-39.9: false = "Belum disemak" (seeded, not yet confirmed by Admin Pusat). Read-only: the client cannot send it; the server sets true on an admin save, seeds set false. Sahkan is refused while any line is unreviewed (UNREVIEWED).',
    }),
  })
  .meta({ id: 'BijakQuotaLineView' })

export const BijakTopicQuotaViewSchema = z
  .strictObject({
    basis: BijakQuotaBasisSchema,
    lines: z.array(BijakQuotaLineViewSchema),
    levelShare: BijakLevelShareSchema.optional(),
  })
  .meta({ id: 'BijakTopicQuotaView' })
export type BijakTopicQuotaView = z.infer<typeof BijakTopicQuotaViewSchema>

/* ----------------------------------------------------------------------- section additions */

/** [PROPOSED] copy. */
export const ALLOWED_MODES_UNIQUE_MESSAGE = 'Mod jawapan tidak boleh berulang.'

/** Answer modes a section accepts (AC-38.1(e)); empty = any mode. Same vocabulary as the question leaf modes. */
export const BijakAllowedModesSchema = z
  .array(QuestionLeafModeSchema)
  .max(12)
  .refine((modes) => new Set(modes).size === modes.length, ALLOWED_MODES_UNIQUE_MESSAGE)
  .meta({
    id: 'BijakAllowedModes',
    description: 'Answer modes (leaf modes of M04) allowed in the section; empty = any mode. Enforced as pool eligibility.',
  })

/** Fields added to a section on WRITE (merged into `BijakBlueprintAdminSectionInput`). */
export const bijakSectionStandardInputShape = {
  profile: BijakDifficultyProfileSchema.nullish().meta({
    description: 'Difficulty profile (US-35). Absent or null = none (allowed in Draf and Spec only).',
  }),
  quota: BijakTopicQuotaSchema.nullish().meta({
    description: 'Exact topic quota (US-36). Absent or null = none (any unit allowed).',
  }),
  kbatMarks: z.number().int().min(0).max(1000).nullish().meta({
    description:
      'Exact KBAT marks of the OFFERED questions of the section (US-37, cognitive level 3 to 6). Absent or null = unconstrained; 0 is a value.',
  }),
  allowedModes: BijakAllowedModesSchema.optional(),
}

/** Fields added to a section on READ (merged into `BijakBlueprintViewSection`). */
export const bijakSectionStandardViewShape = {
  position: z.number().int().min(1).meta({
    description: '1-based position of the section; the key that problems and evidence refer to.',
  }),
  profile: BijakDifficultyProfileViewSchema.nullable(),
  quota: BijakTopicQuotaViewSchema.nullable(),
  kbatMarks: z.number().int().min(0).nullable(),
  kbatReviewed: z.boolean().meta({
    description:
      'AC-39.9: false = the section KBAT value is "Belum disemak". Read-only (server-set: true on an admin save, false from seeds).',
  }),
  allowedModes: BijakAllowedModesSchema,
}

/* ----------------------------------------------------------------------- paper-level fields */

/** Fields added to the version input / create body (architecture 6.3). */
export const bijakBlueprintStandardInputShape = {
  totalMarks: z.number().int().min(1).max(1000).optional().meta({
    description: 'Optional. Stored total = sum of section markBudget; when sent it must match (TOTAL_MISMATCH).',
  }),
  notes: z.string().max(4000).nullish().meta({
    description: 'Cosmetic note (not part of the structural hash). Carries the observed/inferred tags of seeded values.',
  }),
  subPartRamp: z.boolean().optional().meta({
    description: '"sub-bahagian menaik" (AC-25.1, AC-38.4): informs the bank review checklist only. Default false.',
  }),
  kbatMarks: z.number().int().min(0).max(1000).nullish().meta({
    description: 'Optional paper-level KBAT marks (AC-37.2); must equal the sum of the section values when both are set (KBAT_TOTAL).',
  }),
  levelShare: BijakLevelShareSchema.nullish().meta({
    description: 'Optional stated paper-level T4:T5 share in the quota basis (AC-36.3).',
  }),
}

/** Client-writable provenance: the client can never write Disahkan (only the verify endpoint sets it). */
export const BIJAK_CLIENT_BLUEPRINT_SOURCES = ['Draf', 'Spec'] as const
export const BijakBlueprintClientSourceSchema = z.enum(BIJAK_CLIENT_BLUEPRINT_SOURCES).meta({
  id: 'BijakBlueprintClientSource',
  description:
    'Draf or Spec. Disahkan is refused by the request enum: only POST .../verify sets it (architecture 3.5). When omitted the server decides: Draf if asked for; Disahkan only when the previous head is Disahkan and the structural hash is unchanged (cosmetic edit); else Spec.',
})
export type BijakBlueprintClientSource = z.infer<typeof BijakBlueprintClientSourceSchema>

/* ------------------------------------------------------------------ verification summary */

/** One-glance verification of a Disahkan blueprint (AC-39.5). */
export const BijakVerificationSummarySchema = z
  .strictObject({
    verifiedAt: TimestampSchema,
    verifierName: z.string().min(1),
    verifierRole: z.literal('admin'),
    evidenceLabel: z.string().min(1).meta({
      description: 'Short label of the evidence, e.g. "Kajian kertas percubaan 2025" for study-seeded evidence.',
    }),
    bodies: z.array(z.string().min(1)).meta({ description: 'Exam bodies of the evidence, e.g. sbp, selangor_mpsm.' }),
    note: z.string().optional(),
  })
  .meta({ id: 'BijakVerificationSummary' })
export type BijakVerificationSummary = z.infer<typeof BijakVerificationSummarySchema>

/* ------------------------------------------------------------------------ problems */

/** Stable validation codes (architecture 4.3). Used by the contract, the validator and the UI. */
export const BIJAK_BLUEPRINT_PROBLEM_CODES = [
  'TOTAL_MISMATCH',
  'CHOOSE_N_RANGE',
  'SLOT_OVERLAP',
  'SLOT_GAP',
  'PROFILE_SHAPE',
  'TP_COUNTS',
  'MARKS_BAND',
  'QUOTA_SUM',
  'QUOTA_UNIT',
  'LEVEL_SHARE',
  'KBAT_RANGE',
  'KBAT_TOTAL',
  'MODES',
] as const
export const BijakBlueprintProblemCodeSchema = z.enum(BIJAK_BLUEPRINT_PROBLEM_CODES).meta({
  id: 'BijakBlueprintProblemCode',
})
export type BijakBlueprintProblemCode = z.infer<typeof BijakBlueprintProblemCodeSchema>

/** Warning codes: shown beside problems, never refuse a save (O-5). */
export const BIJAK_BLUEPRINT_WARNING_CODES = ['KBAT_TP_BAND'] as const

const problemFields = {
  sectionPosition: z.number().int().min(1).optional(),
  groupIndex: z.number().int().min(0).optional().meta({ description: '0-based index of the slot group inside the profile.' }),
  unit: BijakUnitRefViewSchema.optional(),
  expected: z.number().optional(),
  actual: z.number().optional(),
}

export const BijakBlueprintProblemSchema = z
  .strictObject({ code: BijakBlueprintProblemCodeSchema, ...problemFields })
  .meta({ id: 'BijakBlueprintProblem' })
export type BijakBlueprintProblem = z.infer<typeof BijakBlueprintProblemSchema>

export const BijakBlueprintWarningSchema = z
  .strictObject({
    code: z.enum(BIJAK_BLUEPRINT_WARNING_CODES),
    warning: z.literal(true),
    ...problemFields,
  })
  .meta({
    id: 'BijakBlueprintWarning',
    description:
      'KBAT_TP_BAND: KBAT marks above 0 while every TP band of the section has maximum 1-2 (AC-37.5, O-5). A warning, not a refusal.',
  })
export type BijakBlueprintWarning = z.infer<typeof BijakBlueprintWarningSchema>

/* ------------------------------------------------------------------ needs review (O-2) */

export const BIJAK_REVIEW_GAPS = ['marks', 'tp', 'quota', 'kbat', 'level_share'] as const
export const BijakReviewGapSchema = z.enum(BIJAK_REVIEW_GAPS).meta({ id: 'BijakReviewGap' })

/** A published Kertas Pilihan that does not match the standard tier of the head blueprint (architecture 6.3a). */
export const BijakReviewPaperSchema = z
  .strictObject({
    paperId: IdSchema,
    title: z.string().min(1),
    gaps: z.array(BijakReviewGapSchema).min(1),
  })
  .meta({ id: 'BijakReviewPaper' })
export type BijakReviewPaper = z.infer<typeof BijakReviewPaperSchema>
