import { z } from '../zod'
import { IdSchema } from '../common/ids'
import { TimestampSchema } from '../common/time'
import { questionWorkflowMutationOf } from './common'

/**
 * Question quality dashboard and re-audit (mock `handlers/quality.ts`, SRS BR-M04-21/22, FR-M04-59
 * to 63). Routes: `GET /question-quality`, `POST /question-quality/audit`. Admin only.
 *
 * The score of one question is the mock's `score(q)` (SRS 6.12; catalogue M04-20): `100` minus 15
 * when the explanation is empty, 10 when `dskpSpId` is null, 10 when `sourceType` is null, 15 when
 * `complianceStatus` is quarantined or rejected, 10 when the text is shorter than 20 characters,
 * clamped to 0..100. In v2 the audit scores every question and stores `quality_audits` rows
 * (the mock scores only runtime-created rows); the formula itself is the implementer's to copy.
 *
 * Difference from the mock: ids are strings (UD-1).
 */

export const QUESTION_QUALITY_FLASH = 'Audit kualiti selesai.'

/** Score bands (BR-M04-21). The stored bucket `le50` of the mock covers lemah and kritikal. */
export const QUESTION_QUALITY_BANDS = [
  { band: 'cemerlang', min: 76, max: 100, label: 'Cemerlang' },
  { band: 'baik', min: 51, max: 75, label: 'Baik' },
  { band: 'lemah', min: 26, max: 50, label: 'Lemah' },
  { band: 'kritikal', min: 0, max: 25, label: 'Kritikal' },
] as const
export const QuestionQualityBandSchema = z
  .enum(['cemerlang', 'baik', 'lemah', 'kritikal'])
  .meta({ id: 'QuestionQualityBand', description: 'Cemerlang 76 to 100, Baik 51 to 75, Lemah 26 to 50, Kritikal 0 to 25.' })
export type QuestionQualityBand = z.infer<typeof QuestionQualityBandSchema>

/** The band of a score (0 to 100). A score outside the range is clamped first. */
export function questionQualityBandOf(score: number): QuestionQualityBand {
  const s = Math.min(100, Math.max(0, Math.round(score)))
  if (s >= 76) return 'cemerlang'
  if (s >= 51) return 'baik'
  if (s >= 26) return 'lemah'
  return 'kritikal'
}

/** Rows scoring this or less appear in "Soalan Untuk Semakan Aktif" (non-legacy rows only). */
export const QUESTION_QUALITY_ACTION_MAX_SCORE = 50

export const QuestionQualityRefSchema = z
  .strictObject({ id: IdSchema, name: z.string() })
  .meta({ id: 'QuestionQualityRef', description: '{ id, name } of a subject or education level.' })

export const QuestionQualityActionRowSchema = z
  .strictObject({
    id: IdSchema,
    questionText: z.string(),
    subject: QuestionQualityRefSchema.nullable(),
    level: QuestionQualityRefSchema.nullable(),
    sourceSet: z.string().nullable(),
    qualityScore: z.number().int().min(0).max(100),
  })
  .meta({ id: 'QuestionQualityActionRow' })

const percent = z.number().min(0).max(100)

/** `data` of `GET /question-quality`; every figure is counted from the question store. Percentages and averages have one decimal. */
export const QuestionQualitySummarySchema = z
  .strictObject({
    total: z.number().int().min(0),
    average: z.number().min(0).max(100).meta({ description: 'Mean over the scored questions; 0 when none is scored.' }),
    scoredCount: z.number().int().min(0),
    excellentCount: z.number().int().min(0),
    activeActionCount: z.number().int().min(0),
    buckets: z.strictObject({
      baik: z.number().int().min(0),
      lemahKritikal: z.number().int().min(0),
      legacyGeneric: z.number().int().min(0),
    }),
    distribution: z.strictObject({ cemerlang: percent, baik: percent, lemah: percent, kritikal: percent }),
    bySubject: z.array(
      z.strictObject({
        subjectId: IdSchema,
        name: z.string(),
        count: z.number().int().min(1),
        average: z.number().min(0).max(100),
        excellentPct: z.number().int().min(0).max(100),
      }),
    ),
    byLevel: z.array(
      z.strictObject({
        levelId: IdSchema,
        name: z.string(),
        count: z.number().int().min(0),
        average: z.number().min(0).max(100),
      }),
    ),
    actionList: z.array(QuestionQualityActionRowSchema),
    lastAuditAt: TimestampSchema.nullable(),
  })
  .meta({ id: 'QuestionQualitySummary' })
export type QuestionQualitySummary = z.infer<typeof QuestionQualitySummarySchema>

export const QuestionQualityAuditResultSchema = z
  .strictObject({ lastAuditAt: TimestampSchema })
  .meta({ id: 'QuestionQualityAuditResult' })

/** 200 body `{ data: { lastAuditAt }, status: "Audit kualiti selesai." }`. No request body. */
export const QuestionQualityAuditedSchema = questionWorkflowMutationOf(QuestionQualityAuditResultSchema).meta({
  id: 'QuestionQualityAudited',
})
