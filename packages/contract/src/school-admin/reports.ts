import { z } from '../zod'
import { IdSchema } from '../common/ids'
import { ListMetaSchema } from '../common/envelope'
import { TimestampSchema } from '../common/time'
import { count, SchoolAdminSchoolRefSchema } from './common'

/**
 * School reports of the Admin Sekolah (M27 S0 to S5 and S8): dashboard, usage, activity report,
 * monthly report, DSKP heatmap and the class list. Every route is read-only and always confined to
 * the caller school (no `schoolId` in any query or body).
 *
 * Wire spec: `src/modules/m27-school-admin/api/{dashboard,school-admin}.ts` and the mock handlers.
 * Differences from the mock (ids are opaque strings, UD-1) are listed in the BE-21 contract report.
 */

// ---------------------------------------------------------------------------------------------
// S0 dashboard
// ---------------------------------------------------------------------------------------------

export const SCHOOL_ADMIN_SUBSCRIPTION_STATUSES = ['none', 'active', 'grace', 'expired'] as const
export const SchoolAdminSubscriptionStatusSchema = z
  .enum(SCHOOL_ADMIN_SUBSCRIPTION_STATUSES)
  .meta({
    id: 'SchoolAdminSubscriptionStatus',
    description:
      'Current subscription of the school: none ("Belum Ada"), active ("Aktif"), grace ("Tempoh Ihsan"), expired ("Tamat"). A cancelled row is not current.',
  })
export type SchoolAdminSubscriptionStatus = z.infer<typeof SchoolAdminSubscriptionStatusSchema>

export const SchoolAdminDashboardSchema = z
  .object({
    school: z.object({
      id: IdSchema,
      name: z.string(),
      state: z.string(),
      ppd: z.string().nullable().meta({ description: 'District (PPD); null when blank.' }),
      code: z.string().nullable(),
    }),
    roleLabel: z.string().meta({ description: '"Admin Sekolah".' }),
    perutusan: z
      .array(
        z.object({
          id: IdSchema,
          title: z.string(),
          createdAt: TimestampSchema,
          author: z.object({ initials: z.string(), roleLabel: z.string() }),
        }),
      )
      .max(3)
      .meta({ description: 'The first 3 Perutusan posts visible to the caller (content owner BE-24).' }),
    cards: z.object({
      pupils: count.meta({ description: 'Pupils of the school, active or not.' }),
      teachers: count.meta({ description: 'Teachers of the school, active or not.' }),
      activeClasses: count.meta({ description: 'Active classes of both kinds.' }),
      subscription: z.object({ status: SchoolAdminSubscriptionStatusSchema, label: z.string() }),
    }),
    performance: z.object({
      gps: z.object({
        value: z.number().nullable(),
        grade: z.string().nullable(),
        band: z.string().nullable(),
        entries: count,
      }),
      risk: z
        .object({ safe: count, watch: count, high: count, total: count })
        .nullable()
        .meta({
          description:
            'Amaran Awal tally of the school (all levels; safe = on_track). null hides the panel.',
        }),
      practice: z.object({
        accuracy: z.number().nullable().meta({ description: 'null (never 0%) when there are no sessions.' }),
        sessions: count,
        questions: count,
      }),
      levels: z.array(
        z.object({ code: z.enum(['t4', 't5']), name: z.string(), accuracy: z.number() }),
      ),
      distribution: z.array(z.object({ grade: z.string(), count, pct: z.number() })),
      total: count.meta({ description: 'Sum of the distribution counts.' }),
    }),
  })
  .meta({ id: 'SchoolAdminDashboard' })
export type SchoolAdminDashboard = z.infer<typeof SchoolAdminDashboardSchema>

// ---------------------------------------------------------------------------------------------
// S1 usage
// ---------------------------------------------------------------------------------------------

export const SCHOOL_ADMIN_USAGE_PERIODS = ['today', '7days', '30days'] as const
export const SchoolAdminUsagePeriodSchema = z
  .enum(SCHOOL_ADMIN_USAGE_PERIODS)
  .meta({ id: 'SchoolAdminUsagePeriod' })
export type SchoolAdminUsagePeriod = z.infer<typeof SchoolAdminUsagePeriodSchema>

/** An unknown or absent `period` is not an error: it gives `30days`. */
export const SchoolAdminUsageQuerySchema = z
  .object({
    period: z
      .string()
      .optional()
      .meta({ description: 'today | 7days | 30days. Any other value (or none) means 30days.' }),
  })
  .meta({ id: 'SchoolAdminUsageQuery' })
export type SchoolAdminUsageQuery = z.infer<typeof SchoolAdminUsageQuerySchema>

export const SchoolAdminUsageSchema = z
  .object({
    school: SchoolAdminSchoolRefSchema,
    period: SchoolAdminUsagePeriodSchema,
    label: z.enum(['Hari Ini', '7 Hari', '30 Hari']),
    tiles: z.object({
      pupils: count,
      teachers: count,
      activePupils: count.meta({ description: 'Pupils with at least one answer in the window.' }),
      participationPct: count.meta({ description: 'round(activePupils / pupils x 100); 0 without pupils.' }),
      sessions: count.meta({ description: 'Completed sessions in the window.' }),
      answers: count,
      accuracy: z.number().nullable().meta({ description: 'Mean per-session accuracy, 1 decimal; null = no session with questions.' }),
    }),
    modes: z
      .array(
        z.object({
          label: z.string().meta({ description: 'Bab, Ulang Kaji, Tracking A, PKSK or Latihan.' }),
          sessions: count,
          accuracy: z.number().nullable(),
        }),
      )
      .meta({ description: 'Sessions descending, ties by label; only rows with sessions.' }),
  })
  .meta({ id: 'SchoolAdminUsage' })
export type SchoolAdminUsage = z.infer<typeof SchoolAdminUsageSchema>

// ---------------------------------------------------------------------------------------------
// S3 activity report
// ---------------------------------------------------------------------------------------------

export const SCHOOL_ADMIN_ACTIVITY_RANGES = [7, 30, 90] as const

/** An unknown or absent `range` is not an error: it gives 30. */
export const SchoolAdminActivityQuerySchema = z
  .object({
    range: z.string().optional().meta({ description: '7 | 30 | 90 (days, today included). Any other value (or none) means 30.' }),
  })
  .meta({ id: 'SchoolAdminActivityQuery' })
export type SchoolAdminActivityQuery = z.infer<typeof SchoolAdminActivityQuerySchema>

export const SchoolAdminActivityPupilRowSchema = z
  .object({
    userId: IdSchema,
    name: z.string(),
    className: z.string().nullable(),
    sessions: count,
    accuracy: z.number().min(0).max(100).meta({ description: 'correct / answered x 100, 1 decimal, never above 100.' }),
    seconds: count,
    coins: count,
    lastLoginAt: TimestampSchema.nullable(),
  })
  .meta({ id: 'SchoolAdminActivityPupilRow' })
export type SchoolAdminActivityPupilRow = z.infer<typeof SchoolAdminActivityPupilRowSchema>

export const SchoolAdminActivityTeacherRowSchema = z
  .object({
    userId: IdSchema,
    name: z.string(),
    email: z.string(),
    loggedIn: z.boolean(),
    mcq: count,
    structured: count,
    coins: count,
    hasHeadcount: z.boolean(),
    lastLoginAt: TimestampSchema.nullable(),
  })
  .meta({ id: 'SchoolAdminActivityTeacherRow' })
export type SchoolAdminActivityTeacherRow = z.infer<typeof SchoolAdminActivityTeacherRowSchema>

/**
 * The M17 statistics report in the school scope: no `schools` list, no `overview.score` /
 * `structuredScore` and no `schoolName` on rows (platform-only figures are never present).
 */
export const SchoolAdminActivityReportSchema = z
  .object({
    range: z.union([z.literal(7), z.literal(30), z.literal(90)]),
    schoolId: IdSchema,
    generatedAt: TimestampSchema,
    overview: z.object({
      pupils: count,
      pupilsLogged: count,
      teachers: count,
      teachersLogged: count,
      practised: count,
      activity: count,
    }),
    trend: z.array(z.object({ label: z.string(), value: count })),
    breakdown: z.object({ quiz: count, structured: count, battle: count, game: count }),
    topPupils: z.array(z.object({ userId: IdSchema, name: z.string(), activities: count })),
    teachersNeverLogged: z.array(z.object({ userId: IdSchema, name: z.string(), email: z.string() })),
    teachers: z.array(SchoolAdminActivityTeacherRowSchema),
    pupils: z
      .object({
        semua: z.array(SchoolAdminActivityPupilRowSchema).max(200),
        aktif: z.array(SchoolAdminActivityPupilRowSchema).max(200),
        loginSahaja: z.array(SchoolAdminActivityPupilRowSchema).max(200),
        belumLogin: z.array(SchoolAdminActivityPupilRowSchema).max(200),
      })
      .meta({ description: 'The pills Semua, Aktif, Login Sahaja, Belum Login; up to 200 rows each.' }),
    tiles: z.object({
      teachers: z.object({ total: count, logged: count, questions: count, coins: count }),
      pupils: z.object({ total: count, practised: count, sessions: count, accuracy: z.number() }),
    }),
  })
  .meta({ id: 'SchoolAdminActivityReport' })
export type SchoolAdminActivityReport = z.infer<typeof SchoolAdminActivityReportSchema>

// ---------------------------------------------------------------------------------------------
// S2 DSKP heatmap
// ---------------------------------------------------------------------------------------------

export const SCHOOL_ADMIN_DSKP_STATUSES = ['mahir', 'sederhana', 'lemah', 'belum'] as const
export const SchoolAdminDskpStatusSchema = z
  .enum(SCHOOL_ADMIN_DSKP_STATUSES)
  .meta({
    id: 'SchoolAdminDskpStatus',
    description: 'mahir >= 75, sederhana >= 50, lemah < 50 (on the shown integer percent), belum = not attempted.',
  })
export type SchoolAdminDskpStatus = z.infer<typeof SchoolAdminDskpStatusSchema>

/** Unknown values are not errors: `tingkatan` falls back to T4, `subjectId` to the first subject. */
export const SchoolAdminHeatmapQuerySchema = z
  .object({
    subjectId: z.string().optional().meta({ description: 'Subject id (digits). Unknown or absent = the first subject by name.' }),
    tingkatan: z.string().optional().meta({ description: 'T4 or T5 (case-insensitive). Anything else means T4.' }),
  })
  .meta({ id: 'SchoolAdminHeatmapQuery' })
export type SchoolAdminHeatmapQuery = z.infer<typeof SchoolAdminHeatmapQuerySchema>

export const SchoolAdminHeatmapSpSchema = z
  .object({
    id: IdSchema,
    code: z.string(),
    title: z.string(),
    answered: count,
    correct: count,
    pct: count.nullable().meta({ description: 'floor(100 x correct / answered + 0.5); null when unanswered ("Belum cuba").' }),
    status: SchoolAdminDskpStatusSchema,
  })
  .meta({ id: 'SchoolAdminHeatmapSp' })
export type SchoolAdminHeatmapSp = z.infer<typeof SchoolAdminHeatmapSpSchema>

export const SchoolAdminHeatmapBidangSchema = z
  .object({
    id: IdSchema,
    code: z.string().nullable(),
    name: z.string(),
    sp: z.array(SchoolAdminHeatmapSpSchema),
  })
  .meta({ id: 'SchoolAdminHeatmapBidang' })
export type SchoolAdminHeatmapBidang = z.infer<typeof SchoolAdminHeatmapBidangSchema>

export const SchoolAdminDskpHeatmapSchema = z
  .object({
    school: SchoolAdminSchoolRefSchema,
    subjects: z
      .array(z.object({ id: IdSchema, name: z.string() }))
      .meta({ description: 'Subjects with at least one SP at the level, by name A to Z.' }),
    subject: z.object({ id: IdSchema, name: z.string() }).nullable(),
    level: z.object({ code: z.enum(['t4', 't5']), name: z.enum(['Tingkatan 4', 'Tingkatan 5']) }),
    caption: z.string().nullable().meta({ description: '"KSSM {Subjek} Tingkatan {n}"; null without a subject.' }),
    bidang: z.array(SchoolAdminHeatmapBidangSchema),
  })
  .meta({ id: 'SchoolAdminDskpHeatmap' })
export type SchoolAdminDskpHeatmap = z.infer<typeof SchoolAdminDskpHeatmapSchema>

// ---------------------------------------------------------------------------------------------
// S5 monthly report
// ---------------------------------------------------------------------------------------------

const MONTH_KEY = /^\d{4}-(0[1-9]|1[0-2])$/
const MonthKeySchema = z.string().regex(MONTH_KEY)

/** A future or invalid `bulan` is not an error: it gives the current month. */
export const SchoolAdminMonthlyQuerySchema = z
  .object({
    bulan: z.string().optional().meta({ description: 'YYYY-MM. A future or invalid value (or none) means the current month.' }),
  })
  .meta({ id: 'SchoolAdminMonthlyQuery' })
export type SchoolAdminMonthlyQuery = z.infer<typeof SchoolAdminMonthlyQuerySchema>

export const SchoolAdminMonthlySubjectRowSchema = z
  .object({
    name: z.string(),
    accuracy: z.number().min(0).max(100),
    answers: count,
    pupils: count,
  })
  .meta({ id: 'SchoolAdminMonthlySubjectRow' })
export type SchoolAdminMonthlySubjectRow = z.infer<typeof SchoolAdminMonthlySubjectRowSchema>

export const SchoolAdminMonthlyMonthRowSchema = z
  .object({
    month: MonthKeySchema,
    label: z.string().meta({ description: 'BM month name and year, e.g. "September 2026".' }),
    answers: count,
    correct: count,
    activePupils: count,
    perPupil: z.number().min(0).meta({ description: '1 decimal.' }),
    accuracy: z.number().min(0).max(100).meta({ description: '1 decimal.' }),
  })
  .meta({ id: 'SchoolAdminMonthlyMonthRow' })
export type SchoolAdminMonthlyMonthRow = z.infer<typeof SchoolAdminMonthlyMonthRowSchema>

/**
 * A month with no data returns the empty shape: `months: []`, `total: null`, `cards.accuracy: null`,
 * `subjects: { strongest: null, weakest: null, rows: [] }`.
 */
export const SchoolAdminMonthlyReportSchema = z
  .object({
    school: SchoolAdminSchoolRefSchema,
    month: MonthKeySchema,
    label: z.string(),
    prev: MonthKeySchema,
    next: MonthKeySchema.nullable().meta({ description: 'null while the shown month is the current month.' }),
    cards: z.object({
      participationPct: count,
      active: count,
      registered: count,
      answers: count,
      perPupil: count.meta({ description: 'Integer: round(answers / active), 0 without an active pupil.' }),
      accuracy: z.number().nullable().meta({ description: '1 decimal; null = "—".' }),
      sessions: count,
    }),
    months: z
      .array(SchoolAdminMonthlyMonthRowSchema)
      .meta({
        description:
          'The 12 months ending with the shown month, ascending; a month is listed only if it has at least one completed session, and only when the shown month has answers.',
      }),
    total: z
      .object({ answers: count, correct: count, accuracy: z.number().nullable() })
      .nullable()
      .meta({ description: 'Only when more than one month row is listed.' }),
    subjects: z.object({
      strongest: SchoolAdminMonthlySubjectRowSchema.nullable(),
      weakest: SchoolAdminMonthlySubjectRowSchema.nullable(),
      rows: z
        .array(SchoolAdminMonthlySubjectRowSchema)
        .meta({ description: 'Shown month only, by accuracy descending, ties by answers descending then subject id.' }),
    }),
    generatedAt: TimestampSchema.meta({ description: 'The request minute.' }),
  })
  .meta({ id: 'SchoolAdminMonthlyReport' })
export type SchoolAdminMonthlyReport = z.infer<typeof SchoolAdminMonthlyReportSchema>

// ---------------------------------------------------------------------------------------------
// S8 classes
// ---------------------------------------------------------------------------------------------

/** An unknown `level` means all levels; `page` beyond the last page gives the last page. */
export const SchoolAdminClassListQuerySchema = z
  .object({
    level: z.string().optional().meta({ description: 'A level slug present in the school, e.g. tingkatan-4. Unknown = all.' }),
    search: z.string().optional().meta({ description: 'Class name contains, case-insensitive.' }),
    page: z.string().optional().meta({ description: '25 rows per page; invalid = 1; beyond the last page = the last page.' }),
  })
  .meta({ id: 'SchoolAdminClassListQuery' })
export type SchoolAdminClassListQuery = z.infer<typeof SchoolAdminClassListQuerySchema>

export const SchoolAdminClassRowSchema = z
  .object({
    key: z.string().regex(/^classroom:.+$/).meta({ description: 'classroom:{id}.' }),
    kind: z.literal('classroom'),
    id: IdSchema,
    name: z.string(),
    subject: z.object({ id: IdSchema, name: z.string() }).nullable(),
    levelLabel: z.string().meta({ description: '"Tingkatan n" or "Darjah n".' }),
    teacherName: z.string().nullable(),
    members: count.meta({ description: 'Active enrolments; may include pupils of another school.' }),
    joinCode: z.string().nullable(),
    isActive: z.boolean(),
    link: z.string().min(1).meta({ description: 'Page link "/prestasi/kelas/{id}", built by the server from the id.' }),
  })
  .meta({ id: 'SchoolAdminClassRow' })
export type SchoolAdminClassRow = z.infer<typeof SchoolAdminClassRowSchema>

export const SchoolAdminClassListMetaSchema = ListMetaSchema.extend({
  displayed: count.meta({ description: 'Rows matching the filters ("{n} kelas dipaparkan").' }),
}).meta({ id: 'SchoolAdminClassListMeta' })
export type SchoolAdminClassListMeta = z.infer<typeof SchoolAdminClassListMetaSchema>

/** Body: the list envelope plus the top-level extras `tiles` and `levels` (not wrapped in `data`). */
export const SchoolAdminClassListResponseSchema = z
  .object({
    data: z.array(SchoolAdminClassRowSchema),
    meta: SchoolAdminClassListMetaSchema,
    tiles: z.object({ activeClasses: count }),
    levels: z
      .array(z.object({ code: z.string(), label: z.string() }))
      .meta({ description: 'Levels present in the school classes, in level order (Darjah before Tingkatan).' }),
  })
  .meta({ id: 'SchoolAdminClassListResponse' })
export type SchoolAdminClassListResponse = z.infer<typeof SchoolAdminClassListResponseSchema>
