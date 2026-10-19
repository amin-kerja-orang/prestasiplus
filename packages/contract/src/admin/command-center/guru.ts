import { z } from '../../zod'
import { IdSchema } from '../../common/ids'
import { CurriculumGradeCodeSchema } from '../../curriculum/schema'
import { DateOnlySchema, TimestampSchema } from '../../common/time'

/**
 * M10 teacher Command Center (BE-22, guru half): the six read routes under `/guru/command-center`
 * (relative to the `/api` server). Roles: teacher and admin (`teacherOnly`); school_admin gets 403.
 * Every figure is scoped to the viewer's own students (BR-M10-04).
 *
 * Bodies are BARE objects (no `{ data }` envelope, as live). Errors use the shared
 * `{ error: { code, message, fields? } }` form (`ErrorBodySchema`). Ids are decimal strings (v2);
 * the mock uses numbers (catalogue OQ-API-B3-15, resolved by UD-1). Times are `+08:00` instants
 * unless a field says `HH:mm`. Remedial routes are BE-18 and not described here.
 */

const count = z.number().int().min(0)
const num = z.number()
const FIELD = (description: string) => ({ description })
const HHMM = /^\d{2}:\d{2}$/

/** BR-M08-01: the ten SPM grades in point order (A+ 0 ... G 9). */
export const COMMAND_CENTER_GURU_GRADES = ['A+', 'A', 'A-', 'B+', 'B', 'C+', 'C', 'D', 'E', 'G'] as const

export const COMMAND_CENTER_GURU_MESSAGES = {
  drillType: 'Jenis drill tidak sah.',
  drillFilter: 'Penapis tidak sah.',
  badgeInvalid: 'Lencana tidak sah.',
  badgeNotFound: 'Lencana tidak dijumpai.',
} as const

// ---------------------------------------------------------------------------------------------
// GET /guru/command-center/live-data
// ---------------------------------------------------------------------------------------------

export const CommandCenterGuruClassRowSchema = z
  .object({
    id: IdSchema.meta(FIELD('Class id.')),
    name: z.string(),
    educationLevel: CurriculumGradeCodeSchema.meta({
      description:
        'Class level as the BE-08 curriculum grade code (DARJAH_1..6, TINGKATAN_1..5). Shape differs from the mock, which emits slugs "tahun-1".."tahun-6", "tingkatan-1".."tingkatan-5" (tahun-n maps to DARJAH_n, tingkatan-n to TINGKATAN_n).',
    }),
    studentCount: count,
    active: count.meta(FIELD('Members with at least one answer in the last 7 days.')),
    accuracy: count.meta(FIELD('Whole percent over all answers of the members; 0 when none.')),
  })
  .meta({ id: 'CommandCenterGuruClassRow' })

export const CommandCenterGuruStudentRankSchema = z
  .object({
    studentId: IdSchema,
    name: z.string(),
    answered: count,
    accuracy: count,
  })
  .meta({ id: 'CommandCenterGuruStudentRank' })

export const CommandCenterGuruFeedItemSchema = z
  .object({
    studentId: IdSchema,
    time: z.string().regex(HHMM).meta(FIELD('HH:mm, Asia/Kuala_Lumpur.')),
    student: z.string(),
    subject: z.string().meta(FIELD('Subject name; "-" when the answer has no subject.')),
    isCorrect: z.boolean(),
  })
  .meta({ id: 'CommandCenterGuruFeedItem' })

export const CommandCenterGuruRecentBadgeSchema = z
  .object({
    studentId: IdSchema,
    student: z.string(),
    badge: z.string(),
    icon: z.string(),
    awardedAt: TimestampSchema,
  })
  .meta({ id: 'CommandCenterGuruRecentBadge' })

export const CommandCenterGuruEngagementSchema = z
  .object({
    champion: count,
    consistent: count,
    developing: count,
    minimum: count,
    disengaged: count,
  })
  .meta({ id: 'CommandCenterGuruEngagement' })

export const CommandCenterGuruMoodSchema = z
  .object({ happy: count, okay: count, sad: count, stressed: count })
  .meta({ id: 'CommandCenterGuruMood' })

export const CommandCenterGuruLiveDataSchema = z
  .object({
    teacherName: z.string(),
    totalStudents: z.string().meta(FIELD('Formatted count: digits with "," between thousands.')),
    totalStudentsRaw: count,
    activeStudents: z.string().meta(FIELD('Students with an answer today (formatted).')),
    activeStudentsRaw: count,
    totalAnswered: z.string(),
    totalAnsweredRaw: count,
    answeredToday: z.string(),
    answeredTodayRaw: count,
    answeredWeek: z.string().meta(FIELD('Answers in the 7 calendar days ending today (formatted).')),
    answeredWeekRaw: count,
    weekChange: z
      .number()
      .int()
      .meta(FIELD('round((week - previous 7 days) / previous * 100); 0 when the previous week has no answer.')),
    accuracy: count.meta(FIELD('round(correct / answered * 100) over all answers; 0 when none.')),
    gpsOverall: num
      .nullable()
      .meta(FIELD('GPS over graded headcount entries (2 dp); null when none. For the seed snapshot user (id 1) the value is the documented display constant 4.69 (D11 exception).')),
    classes: z.array(CommandCenterGuruClassRowSchema),
    topStudents: z
      .array(CommandCenterGuruStudentRankSchema)
      .meta(FIELD('Top 5 by accuracy among students with >= 10 answers.')),
    leaderboardWeek: z
      .array(CommandCenterGuruStudentRankSchema)
      .meta(FIELD('Top 10 by answers in the last 7 days (ties: accuracy desc, id); students with none are not listed.')),
    recentBadges: z
      .array(CommandCenterGuruRecentBadgeSchema)
      .meta(FIELD("Latest 5 awards to the viewer's students, newest first.")),
    engagement: CommandCenterGuruEngagementSchema,
    recentFeed: z.array(CommandCenterGuruFeedItemSchema).meta(FIELD('Last 10 answers, newest first.')),
    kirkT1: num.min(0).meta(FIELD("Mean reaction score 0-10 (NPS) of the students' feedback, 1 dp; 0 when none.")),
    kirkT1Count: count,
    kirkT2Accuracy: count.meta(FIELD('Accuracy of the last 30 days.')),
    kirkT2Delta: z.number().int().meta(FIELD('Difference to the 30 days before.')),
    kirkT2Prev: count,
    kirkT3Active: count.meta(FIELD('Students with an answer in the last 30 days.')),
    kirkT3Delta: z.number().int(),
    kirkT3Prev: count,
    kirkT4Gps: num.min(0).meta(FIELD('gpsOverall, or 0.')),
    mood: CommandCenterGuruMoodSchema,
    generatedAt: TimestampSchema,
  })
  .meta({ id: 'CommandCenterGuruLiveData' })
export type CommandCenterGuruLiveData = z.infer<typeof CommandCenterGuruLiveDataSchema>

// ---------------------------------------------------------------------------------------------
// GET /guru/command-center/drill
// ---------------------------------------------------------------------------------------------

export const COMMAND_CENTER_GURU_DRILL_TYPES = [
  'students',
  'today',
  'subjects',
  'gps',
  'kirk',
  'mood',
  'engagement',
] as const
export const CommandCenterGuruDrillTypeSchema = z
  .enum(COMMAND_CENTER_GURU_DRILL_TYPES)
  .meta({ id: 'CommandCenterGuruDrillType' })

export const CommandCenterGuruDrillQuerySchema = z
  .object({
    type: CommandCenterGuruDrillTypeSchema.meta(
      FIELD('Required. Anything else: 422 fields.type "Jenis drill tidak sah.".'),
    ),
    filter: z
      .string()
      .optional()
      .meta(
        FIELD(
          'Trimmed; absent = empty. students: "" | active. today: "" | aktiviti. subjects and gps: "". kirk: t1|t2|t3|t4 (required). mood: "" | happy|okay|sad|stressed. engagement: "" | champion|consistent|developing|minimum|disengaged. Anything else: 422 fields.filter "Penapis tidak sah.".',
        ),
      ),
  })
  .meta({ id: 'CommandCenterGuruDrillQuery' })

export const CommandCenterGuruDrillStudentRowSchema = z
  .object({
    studentId: IdSchema,
    name: z.string(),
    className: z.string().meta(FIELD('The viewer\'s classes the student is in, joined by ", ".')),
    answered: count,
    accuracy: count,
    lastActiveAt: TimestampSchema.nullable(),
    status: z.enum(['Aktif', 'Login']).meta(FIELD('"Aktif" when the student answered today, else "Login".')),
  })
  .meta({ id: 'CommandCenterGuruDrillStudentRow' })

export const CommandCenterGuruDrillTodayRowSchema = z
  .object({
    studentId: IdSchema,
    time: z.string().regex(HHMM).meta(FIELD('HH:mm of the last answer of the pair today.')),
    student: z.string(),
    subject: z.string(),
    answered: count,
    correct: count,
    accuracy: count,
  })
  .meta({ id: 'CommandCenterGuruDrillTodayRow' })

export const CommandCenterGuruDrillSubjectRowSchema = z
  .object({
    subject: z.string(),
    answered: count,
    correct: count,
    accuracy: count,
    students: count,
  })
  .meta({ id: 'CommandCenterGuruDrillSubjectRow' })

export const CommandCenterGuruDrillGpsRowSchema = z
  .object({
    subject: z.string(),
    gps: num.min(0),
    grade: z
      .string()
      .meta(FIELD("The drill's own scale: <=1.5 A+, <=2.0 A, <=2.5 A-, <=3.0 B+, <=3.5 B, <=4.0 C+, <=4.5 C, <=5.0 D, else E.")),
    students: count,
    source: z.literal('Anggaran OTR'),
  })
  .meta({ id: 'CommandCenterGuruDrillGpsRow' })

export const CommandCenterGuruDrillKirkRowSchema = z
  .object({
    studentId: IdSchema,
    name: z.string(),
    average: num.min(0).max(10).meta(FIELD('Reaction score 0-10.')),
    satisfaction: num.min(1).max(5),
    relevance: z.null().meta(FIELD('Not stored: always null.')),
    usefulness: z.null().meta(FIELD('Not stored: always null.')),
    date: z.string().regex(/^\d{4}-\d{2}$/).meta(FIELD('YYYY-MM month of the response.')),
  })
  .meta({ id: 'CommandCenterGuruDrillKirkRow' })

export const CommandCenterGuruMoodNameSchema = z
  .enum(['happy', 'okay', 'sad', 'stressed'])
  .meta({ id: 'CommandCenterGuruMoodName' })

export const CommandCenterGuruDrillMoodRowSchema = z
  .object({
    studentId: IdSchema,
    name: z.string(),
    mood: CommandCenterGuruMoodNameSchema,
    date: DateOnlySchema,
    reason: z.string().nullable(),
  })
  .meta({ id: 'CommandCenterGuruDrillMoodRow' })

export const CommandCenterGuruEngagementBandSchema = z
  .enum(['champion', 'consistent', 'developing', 'minimum', 'disengaged'])
  .meta({ id: 'CommandCenterGuruEngagementBand' })

export const CommandCenterGuruDrillEngagementRowSchema = z
  .object({
    studentId: IdSchema,
    name: z.string(),
    band: CommandCenterGuruEngagementBandSchema,
    days: count.meta(FIELD('Distinct answer days in the last 7 days.')),
    answeredWeek: count,
    accuracy: count,
    lastActiveAt: TimestampSchema.nullable(),
  })
  .meta({ id: 'CommandCenterGuruDrillEngagementRow' })

export const CommandCenterGuruDrillVsSchema = z
  .object({
    accuracyNow: count,
    accuracyPrev: count,
    accuracyChange: z.number().int(),
    answersNow: count,
    answersPrev: count,
    activeNow: count,
    activePrev: count,
    newStudents: count.meta(FIELD('Students whose first answer is inside the last 30 days.')),
  })
  .meta({ id: 'CommandCenterGuruDrillVs' })

export const CommandCenterGuruDrillRowSchema = z
  .union([
    CommandCenterGuruDrillStudentRowSchema,
    CommandCenterGuruDrillTodayRowSchema,
    CommandCenterGuruDrillSubjectRowSchema,
    CommandCenterGuruDrillGpsRowSchema,
    CommandCenterGuruDrillKirkRowSchema,
    CommandCenterGuruDrillMoodRowSchema,
    CommandCenterGuruDrillEngagementRowSchema,
  ])
  .meta({
    id: 'CommandCenterGuruDrillRow',
    description: 'Row shape depends on the requested `type` (one of the seven row components).',
  })

export const CommandCenterGuruDrillSchema = z
  .object({
    title: z
      .string()
      .meta(
        FIELD(
          'Pelajar Berdaftar | Soalan Dijawab | Aktiviti Hari Ini | Ketepatan Purata | GPS Sekolah | Kirkpatrick T1..T4 | Mood Pelajar | Engagement Pelajar.',
        ),
      ),
    students: z
      .array(CommandCenterGuruDrillRowSchema)
      .meta(FIELD('Rows (named `students` on the wire for every type); empty for kirk t2-t4.')),
    extra: CommandCenterGuruDrillVsSchema.optional().meta(FIELD('Only kirk t2-t4.')),
    vsLabel: z.string().optional().meta(FIELD('"Bulan Ini vs Bulan Lepas"; only kirk t2-t4.')),
  })
  .meta({ id: 'CommandCenterGuruDrill' })
export type CommandCenterGuruDrill = z.infer<typeof CommandCenterGuruDrillSchema>

// ---------------------------------------------------------------------------------------------
// GET /guru/command-center/predictive
// ---------------------------------------------------------------------------------------------

export const CommandCenterGuruRiskSchema = z
  .enum(['kritikal', 'tinggi', 'sederhana', 'rendah'])
  .meta({ id: 'CommandCenterGuruRisk' })
export const CommandCenterGuruTrendLabelSchema = z
  .enum(['Naik', 'Turun', 'Stabil'])
  .meta({ id: 'CommandCenterGuruTrendLabel' })
export const CommandCenterGuruGradeSchema = z
  .enum(COMMAND_CENTER_GURU_GRADES)
  .meta({ id: 'CommandCenterGuruGrade' })

export const CommandCenterGuruPredictionSchema = z
  .object({
    studentId: IdSchema,
    studentName: z.string(),
    overallAccuracy: count,
    trend: z
      .number()
      .int()
      .meta(FIELD('Accuracy of the last 14 days minus the 14 before; 0 when either window has no answer.')),
    trendLabel: CommandCenterGuruTrendLabelSchema.meta(FIELD('> 5 Naik, < -5 Turun, else Stabil.')),
    consistency: count.meta(FIELD('Distinct answer days in the last 30 / 30 * 100, whole percent.')),
    predictedGrade: CommandCenterGuruGradeSchema,
    predictedGps: z.number().int().min(0).max(9).meta(FIELD('Grade points: A+ 0 ... G 9.')),
    risk: CommandCenterGuruRiskSchema.meta(FIELD('E/G kritikal, D tinggi, C/C+ sederhana, else rendah.')),
  })
  .meta({ id: 'CommandCenterGuruPrediction' })

export const CommandCenterGuruPredictiveSchema = z
  .object({
    predictions: z
      .array(CommandCenterGuruPredictionSchema)
      .meta(FIELD('Students with >= 10 answers only; accuracy ascending, then id.')),
    gradeDistribution: z
      .record(z.string(), count)
      .meta(FIELD('All ten grades (A+ ... G) as keys, counts 0 allowed.')),
    avgPredictedGps: num.min(0).meta(FIELD('2 dp; 0 when nobody is predicted.')),
    atRiskCount: count.meta(FIELD('kritikal + tinggi.')),
    totalPredicted: count,
  })
  .meta({ id: 'CommandCenterGuruPredictive' })
export type CommandCenterGuruPredictive = z.infer<typeof CommandCenterGuruPredictiveSchema>

// ---------------------------------------------------------------------------------------------
// GET /guru/command-center/evaluate
// ---------------------------------------------------------------------------------------------

export const CommandCenterGuruEvaluationRiskSchema = z
  .enum(['critical', 'high', 'medium'])
  .meta({ id: 'CommandCenterGuruEvaluationRisk' })

export const CommandCenterGuruEvaluationAlertSchema = z
  .object({ message: z.string(), suggestion: z.string() })
  .meta({ id: 'CommandCenterGuruEvaluationAlert' })

export const CommandCenterGuruEvaluationSchema = z
  .object({
    summary: z.object({
      totalStudents: count,
      atRisk: count,
      critical: count,
      high: count,
      medium: count,
    }),
    alerts: z
      .array(
        z.object({
          studentId: IdSchema,
          name: z.string(),
          riskLevel: CommandCenterGuruEvaluationRiskSchema.meta(FIELD('3 alerts critical, 2 high, 1 medium.')),
          alerts: z.array(CommandCenterGuruEvaluationAlertSchema).min(1),
        }),
      )
      .meta(FIELD('Students with at least one alert, riskiest first, then id.')),
  })
  .meta({ id: 'CommandCenterGuruEvaluation' })
export type CommandCenterGuruEvaluation = z.infer<typeof CommandCenterGuruEvaluationSchema>

// ---------------------------------------------------------------------------------------------
// GET /guru/command-center/achievements, /badge-holders
// ---------------------------------------------------------------------------------------------

export const CommandCenterGuruBadgeStatSchema = z
  .object({
    id: IdSchema,
    name: z.string(),
    icon: z.string(),
    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .meta(
        FIELD(
          'By holders: >= 20 Common #94a3b8, >= 10 Uncommon #22c55e, >= 5 Rare #3b82f6, >= 1 Epic #a855f7, 0 Legendary #f59e0b.',
        ),
      ),
    holders: count,
  })
  .meta({ id: 'CommandCenterGuruBadgeStat' })

export const CommandCenterGuruNewAwardSchema = z
  .object({
    studentId: IdSchema,
    name: z.string(),
    badgeName: z.string(),
    icon: z.string(),
    awardedAt: TimestampSchema,
  })
  .meta({ id: 'CommandCenterGuruNewAward' })

export const CommandCenterGuruAchievementsSchema = z
  .object({
    totalStudents: count,
    totalNew: count.meta(FIELD('Awards dated today.')),
    badgeStats: z.array(CommandCenterGuruBadgeStatSchema).meta(FIELD('The whole badge catalogue.')),
    topCollectors: z
      .array(z.object({ name: z.string(), count: count.min(1) }))
      .max(5)
      .meta(FIELD('Top 5 by badge count; students with none are not listed.')),
    newAwards: z
      .array(CommandCenterGuruNewAwardSchema)
      .meta(FIELD('Awards dated today, newest first. Nothing is awarded on GET.')),
  })
  .meta({ id: 'CommandCenterGuruAchievements' })
export type CommandCenterGuruAchievements = z.infer<typeof CommandCenterGuruAchievementsSchema>

export const CommandCenterGuruBadgeHoldersQuerySchema = z
  .object({
    badgeId: z
      .string()
      .regex(/^[1-9]\d*$/)
      .meta(
        FIELD(
          'Badge id (integer >= 1 as digits). Missing or not a positive integer: 422 fields.badgeId "Lencana tidak sah."; unknown badge: 404 "Lencana tidak dijumpai.".',
        ),
      ),
  })
  .meta({ id: 'CommandCenterGuruBadgeHoldersQuery' })

export const CommandCenterGuruBadgeHoldersSchema = z
  .object({
    badge: z.object({
      name: z.string(),
      description: z.string().meta(FIELD('Always "" (the badge catalogue has no description).')),
    }),
    holders: z
      .array(
        z.object({
          studentId: IdSchema,
          name: z.string(),
          accuracy: count,
          awardedAt: TimestampSchema,
        }),
      )
      .meta(FIELD("Viewer's students holding the badge, by award time then id.")),
  })
  .meta({ id: 'CommandCenterGuruBadgeHolders' })
export type CommandCenterGuruBadgeHolders = z.infer<typeof CommandCenterGuruBadgeHoldersSchema>
