import { z } from '../zod'
import { IdSchema } from '../common/ids'
import { DateOnlySchema } from '../common/time'
import { count } from './common'

/**
 * M18 Amaran Awal, the four routes folded into BE-21 (user decision UD-4): school risk page,
 * executive summary, effectiveness report and the school CSV.
 *
 * Wire spec: `src/modules/m18-ppd-jpn/mock/{handlers/amaran.ts,repository/amaran.ts,repository/types.ts}`.
 * B1 roles: admin, school_admin and teacher only (ppd_officer / jpn_officer have no B1 endpoints).
 * Error texts are the English Laravel defaults ("Unauthenticated.", "This action is unauthorized.",
 * "Not Found."), unlike the BM texts of the M27 routes.
 */

export const AMARAN_MESSAGES = {
  /** 422 texts of `GET /amaran/summary` (the top-level message equals the single field text). */
  schoolIdRequired: 'The school id is required.',
  districtStateRequired: 'The district and state are required.',
  stateRequired: 'The state is required.',
  scopeInvalid: 'The scope must be school, district or state.',
} as const

// ---------------------------------------------------------------------------------------------
// Enums and labels
// ---------------------------------------------------------------------------------------------

export const AMARAN_RISK_STATUSES = ['on_track', 'watch', 'high'] as const
export const AmaranRiskStatusSchema = z
  .enum(AMARAN_RISK_STATUSES)
  .meta({
    id: 'AmaranRiskStatus',
    description:
      'score < 40 on_track, < 60 watch, otherwise high. Labels: "On Track", "Perlu Perhatian", "Berisiko Tinggi".',
  })
export type AmaranRiskStatus = z.infer<typeof AmaranRiskStatusSchema>

export const AMARAN_STATUS_LABELS: Readonly<Record<AmaranRiskStatus, string>> = {
  on_track: 'On Track',
  watch: 'Perlu Perhatian',
  high: 'Berisiko Tinggi',
}

export const AMARAN_SCOPES = ['school', 'district', 'state'] as const
export const AmaranScopeSchema = z.enum(AMARAN_SCOPES).meta({ id: 'AmaranScope' })
export type AmaranScope = z.infer<typeof AmaranScopeSchema>

export const AMARAN_INTERVENTION_TYPES = [
  'kaunseling',
  'kelas_tambahan',
  'tugasan_khas',
  'hubungi_ibubapa',
  'mentor_rakan',
  'bimbingan',
  'lain',
] as const
export const AmaranInterventionTypeSchema = z
  .enum(AMARAN_INTERVENTION_TYPES)
  .meta({ id: 'AmaranInterventionType' })
export type AmaranInterventionType = z.infer<typeof AmaranInterventionTypeSchema>

export const AMARAN_TYPE_LABELS: Readonly<Record<AmaranInterventionType, string>> = {
  kaunseling: 'Sesi Kaunseling',
  kelas_tambahan: 'Kelas Tambahan',
  tugasan_khas: 'Tugasan Khas',
  hubungi_ibubapa: 'Hubungi Ibu Bapa',
  mentor_rakan: 'Mentor Rakan Sebaya',
  bimbingan: 'Bimbingan',
  lain: 'Lain-lain',
}

export const AMARAN_EFFECTIVENESS = ['belum_dinilai', 'berkesan', 'sederhana', 'tidak_berkesan'] as const
export const AmaranEffectivenessSchema = z
  .enum(AMARAN_EFFECTIVENESS)
  .meta({ id: 'AmaranEffectiveness' })
export type AmaranEffectiveness = z.infer<typeof AmaranEffectivenessSchema>

/** BM month abbreviations of the trend labels (the label is "{abbr} {year}", e.g. "Okt 2026"). */
export const AMARAN_MONTH_ABBREVIATIONS = [
  'Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis',
] as const

/** Header row of the school CSV. */
export const AMARAN_CSV_COLUMNS = [
  'Bil',
  'Pelajar',
  'Tingkatan / Kelas',
  'Skor Risiko',
  'Status',
  'Ketepatan',
  'Penglibatan',
  'Penguasaan',
] as const

/** `amaran-sekolah-{id}-{yyyymmdd}.csv`, the date in Malaysia time. */
export const amaranCsvFilename = (schoolId: string, yyyymmdd: string): string =>
  `amaran-sekolah-${schoolId}-${yyyymmdd}.csv`

// ---------------------------------------------------------------------------------------------
// Shared pieces
// ---------------------------------------------------------------------------------------------

const pctInt = z.number().int().min(0).max(100)

/** Pupils by risk status; percentages are round(part / total x 100), 0 when total is 0. */
export const AmaranTallySchema = z
  .object({
    green: count.meta({ description: 'on_track.' }),
    yellow: count.meta({ description: 'watch.' }),
    red: count.meta({ description: 'high.' }),
    total: count,
    pct: z.object({ green: pctInt, yellow: pctInt, red: pctInt }),
  })
  .meta({ id: 'AmaranTally' })
export type AmaranTally = z.infer<typeof AmaranTallySchema>

/** One weakness row per stored subject row of the school with pupils > 0, in stored order. */
export const AmaranSubjectRiskSchema = z
  .object({
    subjectId: IdSchema,
    subjectName: z.string(),
    weak: count,
    total: count,
    pct: pctInt,
  })
  .meta({ id: 'AmaranSubjectRisk' })
export type AmaranSubjectRisk = z.infer<typeof AmaranSubjectRiskSchema>

// ---------------------------------------------------------------------------------------------
// GET /amaran/schools/{id}
// ---------------------------------------------------------------------------------------------

/** `tingkatan` accepts T4, T5, 4 or 5 case-insensitively; anything else means no filter. */
export const AmaranSchoolRiskQuerySchema = z
  .object({
    tingkatan: z.string().optional().meta({ description: 'T4 | T5 | 4 | 5 (case-insensitive). Anything else = no filter. The filter is class based.' }),
  })
  .meta({ id: 'AmaranSchoolRiskQuery' })
export type AmaranSchoolRiskQuery = z.infer<typeof AmaranSchoolRiskQuerySchema>

/**
 * One pupil of the risk list. Cell texts are the exact BM strings: accuracyText "Purata ketepatan:
 * {n}%" / "Tiada data latihan" (never active) / "Tiada data"; engagementText "Terakhir aktif:
 * {yyyy-mm-dd}" / "Tiada aktiviti"; masteryText "Purata tahap: L{n}" / "Tiada data penguasaan"
 * (never active) / "Tiada data". Personal contact data (IC, e-mail, phone) is never present.
 *
 * PDPA: this is the most sensitive derived data about minors (name, class and a risk score). It is
 * served only to roles with access to the school (an out-of-scope school is 404), never cached
 * (the CSV is `Cache-Control: no-store`) and every export is audited. Show it only to staff who
 * need it for intervention.
 */
export const AmaranPupilRiskSchema = z
  .object({
    rank: z.number().int().min(1),
    userId: IdSchema,
    studentId: IdSchema.meta({ description: 'Alias of userId.' }),
    name: z.string(),
    levelLabel: z.string().nullable().meta({ description: '"Tingkatan n" / "Darjah n" from the grade, or null.' }),
    tingkatan: z.number().int().min(1).max(5).nullable(),
    className: z.string().nullable().meta({ description: 'First class name, or null when in no class.' }),
    classLabel: z.string().meta({ description: '"Tingkatan n {class}", "Darjah n {class}" or "-".' }),
    score: z.number().min(0).max(100).meta({ description: '0.4A + 0.3E + 0.3M, 1 decimal.' }),
    status: AmaranRiskStatusSchema,
    accuracy: z.number().nullable().meta({ description: 'Mean practice-session accuracy %, 1 decimal.' }),
    engagement: DateOnlySchema.nullable().meta({ description: 'Last active date.' }),
    mastery: z.number().nullable().meta({ description: 'Mean mastery level, 1 decimal.' }),
    accuracyText: z.string(),
    engagementText: z.string(),
    masteryText: z.string(),
  })
  .meta({ id: 'AmaranPupilRisk' })
export type AmaranPupilRisk = z.infer<typeof AmaranPupilRiskSchema>

export const AmaranSchoolRiskSchema = z
  .object({
    school: z.object({
      id: IdSchema,
      name: z.string(),
      code: z.string(),
      district: z.string().nullable(),
      state: z.string(),
    }),
    levelFilter: z.enum(['T4', 'T5']).nullable(),
    levelSuffix: z.string().meta({ description: '"" or " — Tingkatan {n}".' }),
    tally: AmaranTallySchema,
    weakness: z.array(AmaranSubjectRiskSchema),
    pupils: z
      .array(AmaranPupilRiskSchema)
      .meta({ description: 'Score descending, 1-based rank. Inactive pupils are included.' }),
  })
  .meta({ id: 'AmaranSchoolRisk' })
export type AmaranSchoolRisk = z.infer<typeof AmaranSchoolRiskSchema>

// ---------------------------------------------------------------------------------------------
// GET /amaran/summary
// ---------------------------------------------------------------------------------------------

/**
 * No field is rejected by the parser; the 422 rules are on the route: `scope` absent = the viewer
 * default scope; `school` needs an integer `schoolId`; `district` needs district and state (the
 * viewer own values are the defaults); `state` needs a state; any other `scope` is a 422.
 */
export const AmaranSummaryQuerySchema = z
  .object({
    scope: z.string().optional().meta({ description: 'school | district | state. Absent = the viewer default scope.' }),
    schoolId: z.string().optional().meta({ description: 'Required for scope=school; decimal digits.' }),
    district: z.string().optional(),
    state: z.string().optional(),
  })
  .meta({ id: 'AmaranSummaryQuery' })
export type AmaranSummaryQuery = z.infer<typeof AmaranSummaryQuerySchema>

export const AmaranKomboSchema = z
  .object({
    active: count.meta({ description: 'Pupils with a current streak > 0.' }),
    pupils: count,
    avg: z.number().min(0).meta({ description: 'Mean current streak of the active ones, 1 decimal.' }),
    max: count,
    today: count.meta({ description: 'Distinct pupils with an answer today.' }),
  })
  .meta({ id: 'AmaranKombo' })
export type AmaranKombo = z.infer<typeof AmaranKomboSchema>

export const AmaranSummarySchoolRowSchema = z
  .object({
    schoolId: IdSchema,
    school: z.string(),
    pupils: count,
    avgScore: z.number().min(0).max(100),
    green: count,
    yellow: count,
    red: count,
  })
  .meta({ id: 'AmaranSummarySchoolRow' })
export type AmaranSummarySchoolRow = z.infer<typeof AmaranSummarySchoolRowSchema>

/**
 * `schools` is present for scope district and state (average score descending, ties by school id,
 * schools with pupils only); `weakness` is present for scope school. `generatedAt` is an epoch in
 * milliseconds (a number, NOT an ISO timestamp), as in the mock.
 */
export const AmaranSummarySchema = z
  .object({
    scope: AmaranScopeSchema,
    title: z.string().meta({ description: 'School name, district name, or "Negeri {state}".' }),
    subtitle: z.string().meta({ description: '"{district}, {state}", "{state} — Ringkasan Eksekutif" or "Ringkasan Eksekutif Seluruh Negeri".' }),
    pupilsLine: z.string().nullable().meta({ description: '"{n} pelajar"; null for the state scope.' }),
    generatedAt: z.number().int().min(0).meta({ description: 'Epoch milliseconds.' }),
    tally: AmaranTallySchema,
    kombo: AmaranKomboSchema,
    schools: z.array(AmaranSummarySchoolRowSchema).optional(),
    weakness: z.array(AmaranSubjectRiskSchema).optional(),
  })
  .meta({ id: 'AmaranSummary' })
export type AmaranSummary = z.infer<typeof AmaranSummarySchema>

// ---------------------------------------------------------------------------------------------
// GET /amaran/effectiveness
// ---------------------------------------------------------------------------------------------

export const AmaranEffectivenessReportSchema = z
  .object({
    cards: z.object({
      total: count,
      berkesan: count,
      evaluated: count,
      rate: pctInt.meta({ description: 'round(berkesan / evaluated x 100); 0 when nothing is evaluated.' }),
      needsAction: count.meta({ description: 'sederhana + tidakBerkesan.' }),
      sederhana: count,
      tidakBerkesan: count,
      notEvaluated: count,
    }),
    doughnut: z
      .tuple([count, count, count, count])
      .meta({ description: '[Berkesan, Sederhana, Tidak Berkesan, Belum Dinilai].' }),
    trend: z
      .object({
        labels: z.array(z.string()).length(6).meta({ description: 'The current month and the 5 before (Malaysia time), "{Jan|Feb|Mac|Apr|Mei|Jun|Jul|Ogo|Sep|Okt|Nov|Dis} {year}".' }),
        data: z.array(count).length(6),
      }),
    byType: z.array(z.object({ type: AmaranInterventionTypeSchema, label: z.string(), count })),
    byTeacher: z.array(
      z.object({
        teacherId: IdSchema,
        name: z.string(),
        total: count,
        berkesan: count,
        notEvaluated: count,
        rate: pctInt.nullable().meta({ description: 'null when the teacher has nothing evaluated.' }),
      }),
    ),
    followUps: z.array(
      z.object({
        id: IdSchema,
        studentId: IdSchema,
        studentName: z.string(),
        type: AmaranInterventionTypeSchema,
        label: z.string(),
        interventionDate: DateOnlySchema,
        effectiveness: AmaranEffectivenessSchema,
      }),
    ),
    bySchool: z.array(
      z.object({
        schoolId: IdSchema,
        school: z.string(),
        total: count,
        berkesan: count,
        sederhana: count,
        tidakBerkesan: count,
        notEvaluated: count,
        rate: pctInt,
      }),
    ),
  })
  .meta({ id: 'AmaranEffectivenessReport' })
export type AmaranEffectivenessReport = z.infer<typeof AmaranEffectivenessReportSchema>

/** The report of the viewer own school (admin: the preview school; officers have none). */
export const AmaranEffectivenessResultSchema = z
  .object({
    school: z.object({ id: IdSchema, name: z.string() }),
    report: AmaranEffectivenessReportSchema,
  })
  .meta({ id: 'AmaranEffectivenessResult' })
export type AmaranEffectivenessResult = z.infer<typeof AmaranEffectivenessResultSchema>
