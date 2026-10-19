import { z } from '../../zod'
import { IdSchema } from '../../common/ids'
import { TimestampSchema } from '../../common/time'

/**
 * M11 teacher analytics and monitoring read models (BE-20). The frontend mock
 * (`src/modules/m11-teacher-analytics`) is the wire spec. Ids are opaque strings (`Id`, the mock
 * sends numbers); timestamps are `Timestamp` (+08:00); percentages are numbers rounded to one
 * decimal; `dd/mm` labels are strings. All figures are computed from tables (only
 * `monitoring_flags` is stored). Wellbeing, psychometric and faith data are not modelled.
 *
 * Access (role access matrix rows 10 and 42, catalogue M11-01..07):
 * - Monitoring (`/monitoring/*`): admin (all schools), teacher and school_admin (both forced to the
 *   own school from the session; LEAD decision, final). Every other role gets 403. The mock lets a
 *   teacher see all schools; that is a recorded deviation.
 * - Teacher report and item analysis (`/teacher/*`): admin (empty population) and teacher (own
 *   classes). school_admin and every other role get 403.
 * - A teacher or school_admin asking about another school, or a pupil or teacher of another school, gets 404
 *   (existence is not revealed, SEC-M11-02). No session gives 401.
 */

const count = z.number().int()
const pct = z.number()
const code = z.string().nullable()

export const ANALYTICS_ERROR_MESSAGES = {
  unauthorized: 'Unauthenticated.',
  forbidden: 'This action is unauthorized.',
  notFound: 'Not Found.',
} as const

/** The only 422 of M11: the export format. Produced by zod's `error` param, verbatim from the mock. */
export const ANALYTICS_MESSAGES = {
  exportFormat: 'Format eksport mesti pdf atau csv.',
} as const

// --- Enums -----------------------------------------------------------------------------------

export const ANALYTICS_TAHAP = ['Cemerlang', 'Sederhana', 'Rendah', 'Kritikal', 'Tiada Langsung'] as const
export const AnalyticsTahapSchema = z.enum(ANALYTICS_TAHAP).meta({
  id: 'AnalyticsTahap',
  description: 'Engagement band of a percentage p: Cemerlang p > 60; Sederhana 20 <= p <= 60; Rendah 5 <= p < 20; Kritikal 0 < p < 5; Tiada Langsung p = 0.',
})
export const AnalyticsLevelSchema = z.enum(['T4', 'T5']).meta({ id: 'AnalyticsLevel' })
export const AnalyticsStudentStatusSchema = z.enum(['aktif', 'login', 'never']).meta({ id: 'AnalyticsStudentStatus' })
export const AnalyticsFlagLevelSchema = z.enum(['review', 'excluded']).meta({ id: 'AnalyticsFlagLevel' })
const optionLabel = z.enum(['A', 'B', 'C', 'D'])

// --- Queries (the mock tolerates any value: nothing here answers 422 except `format`) -----------

export const AnalyticsMonitoringFilterQuerySchema = z
  .object({
    period: z.string().optional().meta({ description: "'' (all time), 7d, 30d or 3m. Any other value is treated as all time." }),
    state: z.string().optional().meta({ description: "Exact state name; '' or unknown value narrows nothing / gives the empty table." }),
    tahap: z.string().optional().meta({ description: 'One of the five Tahap keys; filters the student table only, not KPIs, weekly or signals. An unknown value gives an empty table.' }),
  })
  .meta({ id: 'AnalyticsMonitoringFilterQuery' })

export const ANALYTICS_EXPORT_FORMATS = ['pdf', 'csv'] as const
export const AnalyticsExportQuerySchema = AnalyticsMonitoringFilterQuerySchema.extend({
  format: z.enum(ANALYTICS_EXPORT_FORMATS, { error: ANALYTICS_MESSAGES.exportFormat }).meta({ description: 'Required; a missing or other value gives 422 fields.format.' }),
}).meta({ id: 'AnalyticsExportQuery' })

export const AnalyticsTeacherReportQuerySchema = z
  .object({
    range: z.string().optional().meta({ description: 'Days: 7, 30 or 90. Anything else (including a non-number) is treated as 30.' }),
    classroomId: z.string().optional().meta({ description: 'An own class id. A class that is not an own class (or an unknown id) is ignored: all classes.' }),
  })
  .meta({ id: 'AnalyticsTeacherReportQuery' })

export const AnalyticsItemAnalysisQuerySchema = z
  .object({
    subjectId: z.string().optional().meta({ description: 'Subject id; an unknown id gives no rows.' }),
    classroomId: z.string().optional().meta({ description: 'Own class id; a selected own class without a subject uses the class subject. A not-own or unknown class gives no rows.' }),
  })
  .meta({ id: 'AnalyticsItemAnalysisQuery' })

// --- Teacher report (S1) ------------------------------------------------------------------------

export const AnalyticsStudentLiteSchema = z
  .object({ id: IdSchema, name: z.string(), email: z.string(), avatarUrl: z.string().nullable(), neverLoggedIn: z.boolean() })
  .meta({ id: 'AnalyticsStudentLite' })

export const AnalyticsClassOptionSchema = z.object({ id: IdSchema, name: z.string() }).meta({ id: 'AnalyticsClassOption' })

export const AnalyticsTeacherReportSchema = z
  .object({
    range: z.union([z.literal(7), z.literal(30), z.literal(90)]),
    classroomId: IdSchema.nullable(),
    options: z.object({ classes: z.array(AnalyticsClassOptionSchema) }),
    population: z.object({ total: count, loggedIn: count, practised: count }),
    activity: z.object({
      total: count,
      byType: z.object({ kuiz: count, struktur: count, latihTubi: count, trackingA: count, battle: count, permainan: count }),
    }),
    score: z.object({
      overall: pct.nullable(),
      byType: z.object({ kuiz: pct.nullable(), struktur: pct.nullable(), latihTubi: pct.nullable(), trackingA: pct.nullable(), battle: pct.nullable() }),
    }),
    trend: z.array(z.object({ date: z.string(), count })).meta({ description: 'One entry per day of the range ending today; date is dd/mm.' }),
    notLoggedIn: z.array(AnalyticsStudentLiteSchema).meta({ description: 'Every population pupil who never logged in, name A-Z.' }),
    notPractised: z.array(AnalyticsStudentLiteSchema).meta({ description: 'The first 10 pupils without a practice session, name A-Z.' }),
    notPractisedAll: z.array(AnalyticsStudentLiteSchema).meta({ description: 'All pupils without a practice session, name A-Z.' }),
    mostActive: z.array(AnalyticsStudentLiteSchema.extend({ activities: count })).meta({ description: 'Up to 10 pupils with at least one activity in the range.' }),
  })
  .meta({ id: 'AnalyticsTeacherReport' })

// --- Monitoring overview (S2) ---------------------------------------------------------------------

export const AnalyticsSchoolEngagementRowSchema = z
  .object({ schoolId: IdSchema, name: z.string(), code, state: z.string(), registered: count, engaged: count, pct, tahap: AnalyticsTahapSchema })
  .meta({ id: 'AnalyticsSchoolEngagementRow' })
export const AnalyticsTeacherEngagementRowSchema = z
  .object({ schoolId: IdSchema, name: z.string(), code, state: z.string(), registered: count, loggedIn: count, pct, tahap: AnalyticsTahapSchema })
  .meta({ id: 'AnalyticsTeacherEngagementRow' })
export const AnalyticsWeeklyRowSchema = z
  .object({
    schoolId: IdSchema,
    name: z.string(),
    code,
    cells: z.array(z.object({ k: count, count, cls: z.enum(['zero', 'first', 'up', 'down']), best: z.boolean() })),
    trend: z.enum(['up', 'down', 'same']),
    best: z.object({ k: count, count }).nullable(),
  })
  .meta({ id: 'AnalyticsWeeklyRow' })
export const AnalyticsSignalSchema = z
  .object({
    schoolId: IdSchema,
    name: z.string(),
    kind: z.enum(['best', 'rendah', 'kritikal', 'tiada', 'motivasi', 'hubungi', 'handsOn']),
    registered: count,
    engaged: count,
    pct,
    teachersLoggedIn: count,
  })
  .meta({ id: 'AnalyticsSignal' })

export const AnalyticsMonitoringOverviewSchema = z
  .object({
    filters: z.object({ period: z.string(), state: z.string(), tahap: z.string() }).meta({ description: 'Echo of the effective filters; an unknown period is echoed as an empty string.' }),
    kpi: z.object({ schools: count, students: count, engaged: count, engagementPct: pct, answers: count, avgPerStudent: z.number(), teachers: count, teachersLoggedIn: count, teacherPct: pct }),
    studentRows: z.array(AnalyticsSchoolEngagementRowSchema),
    teacherRows: z.array(AnalyticsTeacherEngagementRowSchema),
    weeks: z.array(z.object({ k: count, from: z.string(), to: z.string() })).meta({ description: 'Monday-based weeks up to now; from/to are dd/mm.' }),
    weekly: z.array(AnalyticsWeeklyRowSchema),
    signals: z.object({ best: z.array(AnalyticsSignalSchema), attention: z.array(AnalyticsSignalSchema), suggestions: z.array(AnalyticsSignalSchema) }),
  })
  .meta({ id: 'AnalyticsMonitoringOverview' })

// --- School, pupil and teacher detail (S3 to S5) -----------------------------------------------------

export const AnalyticsSchoolDetailSchema = z
  .object({
    school: z.object({ id: IdSchema, name: z.string(), code, state: z.string() }),
    subscription: z.object({ status: z.enum(['active', 'cancelled', 'expired']), endsAt: TimestampSchema }).nullable(),
    warning: z.object({ review: count, excluded: count }).nullable(),
    tahap: AnalyticsTahapSchema,
    pct,
    cards: z.object({ students: count, engaged: count, answers: count, teachers: count, teachersLoggedIn: count }),
    flags: z.object({ review: count, excluded: count }),
    students: z.array(
      z.object({
        id: IdSchema,
        name: z.string(),
        email: z.string(),
        level: AnalyticsLevelSchema,
        answers: count,
        status: AnalyticsStudentStatusSchema,
        engaged: z.boolean().meta({ description: 'At least one answer and not flagged excluded.' }),
        flag: AnalyticsFlagLevelSchema.nullable(),
        lastLoginAt: TimestampSchema.nullable(),
        lastActivityAt: TimestampSchema.nullable(),
      }),
    ),
    teachers: z.array(z.object({ id: IdSchema, name: z.string(), email: z.string(), loggedIn: z.boolean(), lastLoginAt: TimestampSchema.nullable(), createdAt: TimestampSchema })),
  })
  .meta({ id: 'AnalyticsSchoolDetail' })

export const AnalyticsStudentAnswerRowSchema = z
  .object({
    questionId: IdSchema,
    html: z.string().meta({ description: 'Question HTML; the client must sanitise it.' }),
    textPlain: z.string(),
    subjectName: z.string(),
    chapterLabel: z.string().nullable(),
    source: z.string().nullable(),
    difficulty: z.number(),
    answeredAt: TimestampSchema,
    selectedLabel: optionLabel.nullable(),
    correctLabel: optionLabel.nullable(),
    isCorrect: z.boolean(),
    options: z.array(z.object({ label: optionLabel, text: z.string() })).meta({ description: 'Empty when the question has no options.' }),
    explanation: z.string().nullable(),
  })
  .meta({ id: 'AnalyticsStudentAnswerRow' })

export const AnalyticsStudentDetailSchema = z
  .object({
    school: z.object({ id: IdSchema, name: z.string() }),
    student: z.object({ id: IdSchema, name: z.string(), email: z.string(), level: AnalyticsLevelSchema, lastActivityAt: TimestampSchema.nullable() }),
    cards: z.object({ answered: count, correct: count, wrong: count, accuracy: pct }),
    subjects: z.array(z.object({ subjectId: IdSchema, name: z.string(), correct: count, total: count, pct })),
    topics: z.array(
      z.object({
        subjectId: IdSchema,
        subjectName: z.string(),
        rows: z.array(z.object({ bab: z.number().int().nullable(), name: z.string(), correct: count, total: count, pct, badge: z.enum(['Kuat', 'Sederhana', 'Lemah']) })),
      }),
    ),
    answers: z.object({ available: count, total: count, rows: z.array(AnalyticsStudentAnswerRowSchema) }),
    wrong: z.object({ count, unique: count, rows: z.array(AnalyticsStudentAnswerRowSchema) }),
    gaps: z.object({
      count,
      items: z.array(z.object({ group: z.string(), subjectName: z.string(), pct, correct: count, total: count, severity: z.enum(['Kritikal', 'Lemah', 'Perlu Perhatian']), availableQuestions: count })),
      strong: z.array(z.object({ group: z.string(), subjectName: z.string(), pct, answered: count })),
      untried: z.array(z.string()),
    }),
    observations: z.array(z.object({ kind: z.enum(['strong', 'weak']), subjectName: z.string(), pct, wrong: count, total: count })),
  })
  .meta({ id: 'AnalyticsStudentDetail' })

export const AnalyticsTeacherDetailSchema = z
  .object({
    school: z.object({ id: IdSchema, name: z.string() }),
    teacher: z.object({ id: IdSchema, name: z.string(), email: z.string(), lastLoginAt: TimestampSchema.nullable() }),
    cards: z.object({ students: count, engaged: count, pct, needAttention: count }),
    students: z.array(z.object({ id: IdSchema, name: z.string(), level: AnalyticsLevelSchema, answers: count, accuracy: pct.nullable(), status: AnalyticsStudentStatusSchema })),
    suggestions: z.object({ neverLoggedIn: count, lowAccuracy: count, answered: count }),
  })
  .meta({ id: 'AnalyticsTeacherDetail' })

// --- Export and item analysis (S6) ---------------------------------------------------------------------

export const AnalyticsMonitoringExportSchema = z
  .object({
    filename: z.string().meta({ description: 'monitoring-penglibatan.{format}. The mock returns rows only; the client builds the file.' }),
    rows: z.array(AnalyticsSchoolEngagementRowSchema),
  })
  .meta({ id: 'AnalyticsMonitoringExport' })

export const AnalyticsItemAnalysisSchema = z
  .object({
    options: z.object({ subjects: z.array(z.object({ id: IdSchema, name: z.string() })), classes: z.array(AnalyticsClassOptionSchema) }),
    rows: z.array(
      z.object({
        questionId: IdSchema,
        textPlain: z.string(),
        subjectName: z.string(),
        attempts: count,
        pct,
        band: z.enum(['mudah', 'sederhana', 'sukar']),
        discrimination: z.number().nullable().meta({ description: 'Upper-group p minus lower-group p (3 decimals); null when it cannot be computed.' }),
      }),
    ),
  })
  .meta({ id: 'AnalyticsItemAnalysis' })
