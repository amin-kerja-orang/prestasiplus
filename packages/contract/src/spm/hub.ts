import { z } from '../zod'
import { IdSchema } from '../common/ids'
import { SPM_DIFFICULTY_KEYS, SpmSetStatusSchema, SpmSubjectGroupSchema, SpmTargetTypeSchema } from './shared'
import { count } from './util'

/**
 * Read models of the SPM hub (M06-01 to M06-07): overview, Tahun Lepas databank, Latih Tubi,
 * Tracking A and Subjektif. Almost every figure is computed from other owners' stores (curriculum,
 * questions, practice); only the SPM subject configuration and the Tracking A sets are owned here.
 */

const icon = z.string().nullable().meta({ description: 'Subject icon (emoji or icon name) from the curriculum, or null.' })
const color = z.string().min(1).meta({ description: 'Subject colour (hex) from the curriculum; "#64748B" when unknown.' })
const subjectCode = z.string().min(1).meta({ description: 'Curriculum subject code (BM, BI, MATH, ...). Case-insensitive in the path.' })

// ---------------------------------------------------------------------------------------------
// M06-01 overview
// ---------------------------------------------------------------------------------------------

/**
 * `GET /spm/overview` data. `totalQuestions` and the two pool chips are display constants in the
 * mock (DV-M06-01); the real backend computes them (open question 1). `yearsAvailable` is 0 (the
 * bank has no year). `me` covers the caller's practice history over the modes `past_year`,
 * `latih_tubi` and `ramalan` (same figures as the stats of `GET /practice/sessions`; the field is
 * `avgAccuracy` here, `avgAccuracyPct` there).
 */
export const SpmOverviewSchema = z
  .strictObject({
    stats: z.strictObject({
      totalQuestions: count,
      subjectCount: count.meta({ description: 'Distinct active subjects at the two SPM levels (Tingkatan 4 and 5).' }),
      yearsAvailable: count,
      trackingAQuestions: count.meta({ description: 'Sum of the ready counts of all Tracking A sets.' }),
    }),
    modules: z.strictObject({
      databank: count.meta({ description: 'Databank chip.' }),
      latihTubi: count.meta({ description: 'Latih Tubi chip.' }),
      trackingA: count,
      subjektifSets: count.meta({ description: 'Visible structured sets across the Subjektif subjects.' }),
    }),
    me: z.strictObject({
      sessions: count,
      avgAccuracy: z.number().min(0).max(100),
      coins: count,
      answered: count,
    }),
  })
  .meta({ id: 'SpmOverview' })
export type SpmOverview = z.infer<typeof SpmOverviewSchema>

// ---------------------------------------------------------------------------------------------
// M06-02 databank
// ---------------------------------------------------------------------------------------------

/** One row of `GET /spm/databank` (18 subjects in BR-M06-06 order). */
export const SpmDatabankSubjectSchema = z
  .strictObject({
    code: subjectCode,
    name: z.string(),
    nameEn: z.string(),
    icon,
    color,
    databankCount: count.meta({ description: 'Size of the SPM pool of the subject.' }),
  })
  .meta({ id: 'SpmDatabankSubject' })
export type SpmDatabankSubject = z.infer<typeof SpmDatabankSubjectSchema>

// ---------------------------------------------------------------------------------------------
// M06-03 / M06-04 Latih Tubi
// ---------------------------------------------------------------------------------------------

const targetType = SpmTargetTypeSchema.nullable()
const targetSize = z.number().int().min(1).nullable()

/** A Latih Tubi subject card (S3). `locked` = `targetSize` set and `total < targetSize`. */
export const SpmLatihTubiCardSchema = z
  .strictObject({
    code: subjectCode,
    name: z.string(),
    nameEn: z.string(),
    icon,
    color,
    total: count.meta({ description: 'SPM pool size of the subject.' }),
    targetType,
    targetSize,
    locked: z.boolean(),
  })
  .meta({ id: 'SpmLatihTubiCard' })
export type SpmLatihTubiCard = z.infer<typeof SpmLatihTubiCardSchema>

/** `GET /spm/latih-tubi` data: each group ordered by `displayOrder`. */
export const SpmLatihTubiListSchema = z
  .strictObject({ teras: z.array(SpmLatihTubiCardSchema), elektif: z.array(SpmLatihTubiCardSchema) })
  .meta({ id: 'SpmLatihTubiList' })
export type SpmLatihTubiList = z.infer<typeof SpmLatihTubiListSchema>

/** Counts per difficulty; all five keys are always present (`"1"` may be 0). */
export const SpmDifficultyCountsSchema = z
  .strictObject(Object.fromEntries(SPM_DIFFICULTY_KEYS.map((k) => [k, count])) as Record<(typeof SPM_DIFFICULTY_KEYS)[number], typeof count>)
  .meta({ id: 'SpmDifficultyCounts', description: 'Question counts by difficulty 1 to 5.' })
export type SpmDifficultyCounts = z.infer<typeof SpmDifficultyCountsSchema>

/** One entry of `countOptions`. With a target the only option is the target (`isTarget: true`). */
export const SpmCountOptionSchema = z
  .strictObject({ value: z.number().int().min(1), label: z.string().min(1), isTarget: z.boolean() })
  .meta({ id: 'SpmCountOption' })
export type SpmCountOption = z.infer<typeof SpmCountOptionSchema>

/**
 * `GET /spm/latih-tubi/{code}` data. `levelCounts` and `difficultyByLevel` are keyed by the
 * education level id (decimal string) of Tingkatan 4 and Tingkatan 5; the mock keys `"10"` and
 * `"11"` are mock ids (open question 7).
 *
 * With a target: one option `{ value: target, label: "<target> (Target <SPM|Custom|Latihan>)",
 * isTarget: true }` and `defaultCount = target`. Without: the options 5, 10, 20, 30, 40, 50, 60
 * (`isTarget: false`) and `defaultCount = 10`.
 */
export const SpmLatihTubiConfigSchema = z
  .strictObject({
    code: subjectCode,
    name: z.string(),
    icon,
    color,
    total: count,
    targetType,
    targetSize,
    levelCounts: z
      .record(z.string().min(1), count)
      .meta({ description: 'Pool size per level id (Tingkatan 4 and 5).' }),
    difficultyStats: SpmDifficultyCountsSchema,
    difficultyByLevel: z.record(z.string().min(1), SpmDifficultyCountsSchema),
    countOptions: z.array(SpmCountOptionSchema).min(1),
    defaultCount: z.number().int().min(1),
  })
  .meta({ id: 'SpmLatihTubiConfig' })
export type SpmLatihTubiConfig = z.infer<typeof SpmLatihTubiConfigSchema>

// ---------------------------------------------------------------------------------------------
// M06-05 / M06-06 Tracking A
// ---------------------------------------------------------------------------------------------

/**
 * An open subject card of the Tracking A hub (non-bahasa subjects with at least one startable
 * set, teras before elektif). `readyQuestions` sums the ready counts of the startable sets only.
 */
export const SpmOpenSubjectCardSchema = z
  .strictObject({
    subjectId: IdSchema,
    code: subjectCode,
    name: z.string(),
    nameEn: z.string(),
    icon,
    color,
    readyQuestions: count,
    bankBesarSets: count,
    bersihSets: count,
    targetType,
    targetSize,
    bankSource: count.nullable().meta({ description: 'Sum of bankSource of the bank_besar sets, or null.' }),
    startableSets: count,
  })
  .meta({ id: 'SpmOpenSubjectCard' })
export type SpmOpenSubjectCard = z.infer<typeof SpmOpenSubjectCardSchema>

/** A subject of the bahasa lane (BM before BI). */
export const SpmBahasaSubjectSchema = z
  .strictObject({
    subjectId: IdSchema,
    code: subjectCode,
    name: z.string(),
    nameEn: z.string(),
    sets: count.meta({ description: 'Visible structured sets of the subject.' }),
    icon: icon.optional().meta({ description: 'Sent by the mock although its TypeScript type omits it.' }),
    color: color.optional().meta({ description: 'Sent by the mock although its TypeScript type omits it.' }),
  })
  .meta({ id: 'SpmBahasaSubject' })
export type SpmBahasaSubject = z.infer<typeof SpmBahasaSubjectSchema>

/** A locked set of a readiness tile. */
export const SpmLockedSetSchema = z
  .strictObject({ setNo: z.number().int().min(1), readyCount: count, target: count })
  .meta({ id: 'SpmLockedSet' })
export type SpmLockedSet = z.infer<typeof SpmLockedSetSchema>

/** A readiness tile (one subject with a target, in the BR-M06-11 order). */
export const SpmReadinessTileSchema = z
  .strictObject({
    code: subjectCode,
    name: z.string(),
    targetSize: count,
    bersih: count,
    bankBesar: count,
    locked: count,
    total: count,
    readiness: z.number().int().min(0).max(100).meta({ description: 'round((bersih + bankBesar) / total x 100); 0 without sets.' }),
    lockedSets: z.array(SpmLockedSetSchema).max(6).meta({ description: 'The first 6 locked sets.' }),
    hasBankBesar: z.boolean(),
  })
  .meta({ id: 'SpmReadinessTile' })
export type SpmReadinessTile = z.infer<typeof SpmReadinessTileSchema>

/** The admin readiness board. */
export const SpmReadinessSchema = z
  .strictObject({
    summary: z.strictObject({ bersih: count, bankBesar: count, locked: count }),
    tiles: z.array(SpmReadinessTileSchema),
  })
  .meta({ id: 'SpmReadiness' })
export type SpmReadiness = z.infer<typeof SpmReadinessSchema>

/** `GET /spm/tracking-a` data. `readiness` is non-null only for the active role `admin` (BR-M06-30). */
export const SpmTrackingAHubSchema = z
  .strictObject({
    objectiveLane: z.strictObject({
      subjects: count,
      sets: count,
      questions: count.meta({ description: 'Sum over the startable sets of (bankSource ?? readyCount).' }),
    }),
    bahasaLane: z.strictObject({ subjects: z.literal(2), sets: count }),
    readiness: SpmReadinessSchema.nullable(),
    bahasa: z.array(SpmBahasaSubjectSchema),
    openSubjects: z.array(SpmOpenSubjectCardSchema),
  })
  .meta({ id: 'SpmTrackingAHub' })
export type SpmTrackingAHub = z.infer<typeof SpmTrackingAHubSchema>

/** One set of a Tracking A subject. */
export const SpmTrackingASetSchema = z
  .strictObject({
    setNo: z.number().int().min(1),
    status: SpmSetStatusSchema,
    readyCount: count,
    bankSource: count.nullable(),
    dskpTagged: count,
    dskpTotal: count,
  })
  .meta({ id: 'SpmTrackingASet' })
export type SpmTrackingASet = z.infer<typeof SpmTrackingASetSchema>

/**
 * `GET /spm/tracking-a/{code}` data for a subject other than BM and BI: the sets of the Tracking
 * year (2026 in the mock), startable sets first, then locked, each by set number.
 * `summary.readyQuestions` sums ALL sets (unlike `SpmOpenSubjectCard.readyQuestions`).
 */
export const SpmTrackingASubjectSchema = z
  .strictObject({
    code: subjectCode,
    name: z.string(),
    icon,
    color,
    targetType,
    targetSize,
    summary: z.strictObject({ bersih: count, bankBesar: count, readyQuestions: count, belumCukup: count }),
    sets: z.array(SpmTrackingASetSchema),
  })
  .meta({ id: 'SpmTrackingASubject' })
export type SpmTrackingASubject = z.infer<typeof SpmTrackingASubjectSchema>

/** BM and BI answer a redirect to the bahasa structured track instead of a set list. */
export const SpmTrackingARedirectSchema = z
  .strictObject({
    redirect: z.string().regex(/^\/latihan-berstruktur\?subject_id=.+&scope=spm&track=bahasa$/).meta({
      description: '"/latihan-berstruktur?subject_id=<id of BM or BI>&scope=spm&track=bahasa".',
    }),
  })
  .meta({ id: 'SpmTrackingARedirect' })
export type SpmTrackingARedirect = z.infer<typeof SpmTrackingARedirectSchema>

/** `GET /spm/tracking-a/{code}` data: a subject, or the redirect for BM and BI. */
export const SpmTrackingASubjectResultSchema = z
  .union([SpmTrackingASubjectSchema, SpmTrackingARedirectSchema])
  .meta({ id: 'SpmTrackingASubjectResult' })
export type SpmTrackingASubjectResult = z.infer<typeof SpmTrackingASubjectResultSchema>

// ---------------------------------------------------------------------------------------------
// M06-07 Subjektif
// ---------------------------------------------------------------------------------------------

/** A Subjektif subject (15 of them; teras first, then by name in the `ms` locale). */
export const SpmSubjektifSubjectSchema = z
  .strictObject({
    subjectId: IdSchema,
    name: z.string(),
    nameEn: z.string(),
    group: SpmSubjectGroupSchema,
    icon,
    color,
    sets: count.meta({ description: 'Student-visible structured questions of the subject.' }),
  })
  .meta({ id: 'SpmSubjektifSubject' })
export type SpmSubjektifSubject = z.infer<typeof SpmSubjektifSubjectSchema>

/**
 * `GET /spm/subjektif` data. The stats count only the caller's structured attempts with scope
 * `spm`; `bestScore` is the best attempt percentage rounded (`null` with no attempt, shown as
 * "Belum Ada").
 */
export const SpmSubjektifOverviewSchema = z
  .strictObject({
    stats: z.strictObject({
      setsAnswered: count,
      subjectsTried: count,
      bestScore: z.number().int().min(0).max(100).nullable(),
      bestSetsSaved: count.meta({ description: 'Distinct questions attempted.' }),
    }),
    subjects: z.array(SpmSubjektifSubjectSchema),
  })
  .meta({ id: 'SpmSubjektifOverview' })
export type SpmSubjektifOverview = z.infer<typeof SpmSubjektifOverviewSchema>
