import { z } from '../../zod'
import { DateOnlySchema, TimestampSchema } from '../../common/time'
import { IdSchema } from '../../common/ids'

/**
 * M17 Command Center for Admin Pusat and Admin Sekolah (BE-22, admin/school half): the live board
 * (`/admin/command-center/live-data`), the daily-activity board and its school drill, the drill-down
 * pages S4 to S7 with their modals, and the header server-status pill. The teacher (Guru) half lives in
 * `guru.ts` (`CommandCenterGuru*`).
 *
 * Wire notes:
 * - Every success body is `{ data }`. Errors use the common `ErrorBody` (401 UNAUTHORIZED
 *   "Unauthenticated.", 403 FORBIDDEN "This action is unauthorized.", 404 NOT_FOUND "Not Found.",
 *   422 VALIDATION_ERROR), English Laravel defaults as the mock produces them.
 * - Entity ids are decimal strings (`IdSchema`); the mock still uses numbers. Session ids are strings in
 *   both. Instants are ISO 8601 with +08:00; calendar dates are `YYYY-MM-DD`.
 * - Accuracies are percentages: 1 decimal, except `CommandCenterSessionRow.accuracy` (2 decimals).
 */

const FIELD = (description: string) => ({ description })
const count = z.number().int().min(0)
const pct = z.number().min(0).max(100)

/** Path segment of an entity id: digits only; a non-digit segment does not match the route (404). */
const PathId = (what: string) =>
  IdSchema.meta(FIELD(`${what}. Digits only; a non-digit segment does not match the route (404 "Not Found.").`))

// ---------------------------------------------------------------------------------------------
// Shared building blocks
// ---------------------------------------------------------------------------------------------

export const CommandCenterMoodSchema = z
  .enum(['happy', 'okay', 'sad', 'stressed'])
  .meta({ id: 'CommandCenterMood' })
export type CommandCenterMood = z.infer<typeof CommandCenterMoodSchema>

export const CommandCenterMoodCountsSchema = z
  .object({ happy: count, okay: count, sad: count, stressed: count })
  .meta({ id: 'CommandCenterMoodCounts' })
export type CommandCenterMoodCounts = z.infer<typeof CommandCenterMoodCountsSchema>

/** The three tabs of the daily board. A request may send any text; the response echoes it raw. */
export const COMMAND_CENTER_PERIODS = ['today', 'week', 'month'] as const
export const CommandCenterPeriodSchema = z.enum(COMMAND_CENTER_PERIODS).meta({ id: 'CommandCenterPeriod' })
export type CommandCenterPeriod = z.infer<typeof CommandCenterPeriodSchema>

/** `{ id, name }` of a school, teacher or pupil. */
export const CommandCenterRefSchema = z
  .object({ id: IdSchema, name: z.string() })
  .meta({ id: 'CommandCenterRef' })
export type CommandCenterRef = z.infer<typeof CommandCenterRefSchema>

/** `level` is "T{n}" (Tingkatan) or "D{n}" (Darjah). */
export const CommandCenterClassRefSchema = z
  .object({ id: IdSchema, name: z.string(), level: z.string() })
  .meta({ id: 'CommandCenterClassRef' })
export type CommandCenterClassRef = z.infer<typeof CommandCenterClassRefSchema>

export const CommandCenterScopeSchema = z
  .enum(['platform', 'school'])
  .meta({ id: 'CommandCenterScope', description: 'Admin sees the platform view; a school admin the school view.' })
export type CommandCenterScope = z.infer<typeof CommandCenterScopeSchema>

// ---------------------------------------------------------------------------------------------
// M17-01 live board (GET /admin/command-center/live-data)
// ---------------------------------------------------------------------------------------------

export const CommandCenterTopSchoolSchema = z
  .object({
    schoolId: IdSchema,
    schoolName: z.string(),
    activeCount: count.meta(FIELD('Pupils with at least one answer.')),
    totalAnswers: count,
  })
  .meta({ id: 'CommandCenterTopSchool' })
export type CommandCenterTopSchool = z.infer<typeof CommandCenterTopSchoolSchema>

export const CommandCenterTopStudentSchema = z
  .object({
    studentId: IdSchema,
    name: z.string(),
    schoolName: z.string().nullable().meta(FIELD('Null for a pupil without a school.')),
    answersCount: count,
    accuracy: pct,
  })
  .meta({ id: 'CommandCenterTopStudent' })
export type CommandCenterTopStudent = z.infer<typeof CommandCenterTopStudentSchema>

export const CommandCenterFeedRowSchema = z
  .object({
    student: z.string(),
    subject: z.string().meta(FIELD('Short subject name.')),
    correct: z.boolean(),
    time: z.string().regex(/^\d{2}:\d{2}$/).meta(FIELD('HH:mm, Malaysia time.')),
    schoolId: IdSchema.nullable(),
    schoolName: z.string().nullable(),
  })
  .meta({ id: 'CommandCenterFeedRow' })
export type CommandCenterFeedRow = z.infer<typeof CommandCenterFeedRowSchema>

export const CommandCenterKirkpatrickSchema = z
  .object({
    t1: z.object({
      value: z.number().min(0).max(5).meta(FIELD('Satisfaction mean on a 1 to 5 scale; 0 when no responses.')),
      scale: z.literal(5),
      count,
    }),
    t2Accuracy: pct,
    t3Active: count.meta(FIELD('Pupils with an answer in the last 30 days.')),
    t4Gps: z.number().min(0).meta(FIELD('SPM subject GPS of the scope, 3 decimals; 0 when none.')),
  })
  .meta({ id: 'CommandCenterKirkpatrick' })
export type CommandCenterKirkpatrick = z.infer<typeof CommandCenterKirkpatrickSchema>

export const CommandCenterEngagementBucketsSchema = z
  .object({ champion: count, consistent: count, developing: count, minimum: count, disengaged: count })
  .meta({
    id: 'CommandCenterEngagementBuckets',
    description: 'Platform view: display constant DC-M17-05 (D11 exception). School view: zeros.',
  })
export type CommandCenterEngagementBuckets = z.infer<typeof CommandCenterEngagementBucketsSchema>

export const CommandCenterCorrectionSchema = z
  .object({
    total: count,
    avgImprovement: z.number(),
    improvedCount: count,
    topImprovers: z.array(z.unknown()).max(0).meta(FIELD('Always empty in the mock (no list data).')),
  })
  .meta({
    id: 'CommandCenterCorrection',
    description: 'Platform view: display constant DC-M17-03 (D11 exception). School view: zeros.',
  })
export type CommandCenterCorrection = z.infer<typeof CommandCenterCorrectionSchema>

export const CommandCenterDailyPointSchema = z
  .object({
    date: DateOnlySchema,
    label: z.string().meta(FIELD('BM weekday abbreviation: Ahd, Isn, Sel, Rab, Kha, Jum, Sab.')),
    count,
  })
  .meta({ id: 'CommandCenterDailyPoint' })
export type CommandCenterDailyPoint = z.infer<typeof CommandCenterDailyPointSchema>

export const CommandCenterLiveDataSchema = z
  .object({
    generatedAt: TimestampSchema,
    scope: CommandCenterScopeSchema,
    school: z
      .object({ id: IdSchema, name: z.string() })
      .nullable()
      .meta(FIELD('The viewer school on the school view, else null.')),
    totalSchools: count.meta(FIELD('Platform: subscribed schools outside fixture schools. School view: 1 or 0.')),
    totalStudents: count,
    activeStudents: count.meta(FIELD('Pupils with at least one answer ever.')),
    totalAnswered: count,
    answeredToday: count,
    answeredWeek: count,
    answeredLastWeek: count,
    weekChange: z.number().int().meta(FIELD('Whole percent, half away from zero; 0 when last week is 0.')),
    accuracy: pct,
    topSchools: z.array(CommandCenterTopSchoolSchema).max(5).meta(FIELD('Platform view only; empty on the school view.')),
    topStudents: z.array(CommandCenterTopStudentSchema).max(5),
    gpsOverall: z.number().min(0).meta(FIELD('Equals kirk.t4Gps.')),
    kirk: CommandCenterKirkpatrickSchema,
    engagement: CommandCenterEngagementBucketsSchema,
    dailyTrend: z.array(CommandCenterDailyPointSchema).max(7).meta(FIELD('School view: last 7 days; empty on the platform view.')),
    mood: CommandCenterMoodCountsSchema,
    recentFeed: z.array(CommandCenterFeedRowSchema).max(10),
    correction: CommandCenterCorrectionSchema,
  })
  .meta({ id: 'CommandCenterLiveData' })
export type CommandCenterLiveData = z.infer<typeof CommandCenterLiveDataSchema>

export const CommandCenterLiveDataResponseSchema = z
  .object({ data: CommandCenterLiveDataSchema })
  .meta({ id: 'CommandCenterLiveDataResponse' })

// ---------------------------------------------------------------------------------------------
// M17-02 / M17-03 daily activity
// ---------------------------------------------------------------------------------------------

/** `period` query of both daily routes. Any text is accepted; an unknown value answers with today's figures. */
export const CommandCenterDailyQuerySchema = z
  .object({
    period: z
      .string()
      .optional()
      .meta(FIELD('today, week or month. Absent or any other value gives today figures; the raw value is echoed in the response `period`.')),
  })
  .meta({ id: 'CommandCenterDailyQuery' })
export type CommandCenterDailyQuery = z.infer<typeof CommandCenterDailyQuerySchema>

export const COMMAND_CENTER_PACKAGE_CHIPS = ['ADMIN', 'PARENT', 'AKTIF', 'PKSK', 'SEKOLAH', 'BEBAS', 'FREE'] as const
export const CommandCenterPackageChipSchema = z
  .enum(COMMAND_CENTER_PACKAGE_CHIPS)
  .meta({ id: 'CommandCenterPackageChip' })

export const CommandCenterLoginRowSchema = z
  .object({
    userId: IdSchema,
    name: z.string(),
    role: z.string().meta(FIELD('Role code.')),
    lastLoginAt: TimestampSchema,
    schoolId: IdSchema.nullable(),
    schoolName: z.string().nullable().meta(FIELD('Null for a user without a school.')),
    package: CommandCenterPackageChipSchema,
    timeAgo: z.string().meta(FIELD('Human-readable age (diffForHumans), mock wire text. Open question for the frontend: BM rendering of relative time.')),
  })
  .meta({ id: 'CommandCenterLoginRow' })
export type CommandCenterLoginRow = z.infer<typeof CommandCenterLoginRowSchema>

export const CommandCenterBadgeRowSchema = z
  .object({
    userId: IdSchema,
    name: z.string(),
    badgeName: z.string(),
    icon: z.string(),
    awardedAt: TimestampSchema,
  })
  .meta({ id: 'CommandCenterBadgeRow' })
export type CommandCenterBadgeRow = z.infer<typeof CommandCenterBadgeRowSchema>

export const CommandCenterSchoolActivitySchema = z
  .object({
    schoolId: IdSchema,
    schoolName: z.string(),
    activeStudents: count,
    totalAnswers: count,
    accuracy: pct.nullable().meta(FIELD('Null when the school has no answer in the period.')),
    activeTeachers: count,
    loginCount: count,
    lastActive: TimestampSchema.nullable(),
    lastActiveHuman: z.string().meta(FIELD('Mock wire text. Open question for the frontend: BM rendering of relative time.')),
  })
  .meta({ id: 'CommandCenterSchoolActivity' })
export type CommandCenterSchoolActivity = z.infer<typeof CommandCenterSchoolActivitySchema>

export const CommandCenterDailyTopStudentSchema = z
  .object({
    userId: IdSchema,
    name: z.string(),
    schoolId: IdSchema.nullable(),
    schoolName: z.string().nullable(),
    answers: count,
    accuracy: pct,
  })
  .meta({ id: 'CommandCenterDailyTopStudent' })
export type CommandCenterDailyTopStudent = z.infer<typeof CommandCenterDailyTopStudentSchema>

export const CommandCenterSubjectBarSchema = z
  .object({ code: z.string(), shortName: z.string(), answers: count })
  .meta({ id: 'CommandCenterSubjectBar' })
export type CommandCenterSubjectBar = z.infer<typeof CommandCenterSubjectBarSchema>

export const CommandCenterDailyFeedRowSchema = CommandCenterFeedRowSchema.extend({ studentId: IdSchema }).meta({
  id: 'CommandCenterDailyFeedRow',
})
export type CommandCenterDailyFeedRow = z.infer<typeof CommandCenterDailyFeedRowSchema>

export const CommandCenterDailyActivitySchema = z
  .object({
    period: z.string().meta(FIELD('The raw `period` of the request (an unknown value is echoed, with today figures).')),
    label: z.string().meta(FIELD('"Hari Ini (D Mon YYYY)", "Minggu Ini" or "Bulan Ini".')),
    scope: CommandCenterScopeSchema,
    school: z.object({ id: IdSchema, name: z.string() }).nullable(),
    logins: z.object({
      total: count,
      byRole: z.record(z.string(), count).meta(FIELD('Role code to login count, only roles with at least one login.')),
      recent: z.array(CommandCenterLoginRowSchema).max(10),
    }),
    practice: z.object({
      totalAnswers: count,
      correctAnswers: count,
      accuracy: pct,
      activeStudents: count,
      sessionsStarted: count,
      sessionsCompleted: count,
      avgSessionSeconds: count.meta(FIELD('Mean time spent per completed session, seconds.')),
    }),
    engagement: z.object({
      moodCheckins: count,
      moodDist: CommandCenterMoodCountsSchema,
      missionsCompleted: count,
      badgesEarned: count,
      recentBadges: z.array(CommandCenterBadgeRowSchema),
      quizSetsCreated: count,
    }),
    summary: z.object({
      activeSchools: count,
      totalSchools: count,
      activeStudents: count,
      totalStudents: count,
      totalLogins: count,
    }),
    schools: z.array(CommandCenterSchoolActivitySchema).optional().meta(FIELD('Platform view only; omitted for a school admin.')),
    topStudents: z.array(CommandCenterDailyTopStudentSchema),
    subjectBreakdown: z.array(CommandCenterSubjectBarSchema),
    hourlyHeatmap: z
      .record(z.string(), count)
      .meta(FIELD('Hour (MYT, "0" to "23") to answers; 24 hours on "today", empty object otherwise.')),
    liveFeed: z.array(CommandCenterDailyFeedRowSchema),
  })
  .meta({ id: 'CommandCenterDailyActivity' })
export type CommandCenterDailyActivity = z.infer<typeof CommandCenterDailyActivitySchema>

export const CommandCenterDailyActivityResponseSchema = z
  .object({ data: CommandCenterDailyActivitySchema })
  .meta({ id: 'CommandCenterDailyActivityResponse' })

export const CommandCenterSchoolDrillSchema = z
  .object({
    school: z.object({ id: IdSchema, name: z.string() }),
    period: z.string().meta(FIELD('The raw `period` of the request.')),
    teachers: z.array(
      z.object({
        userId: IdSchema,
        name: z.string(),
        students: count,
        accuracy: pct,
        lastActiveHuman: z.string().meta(FIELD('Mock wire text. Open question for the frontend: BM rendering of relative time.')),
      }),
    ),
    students: z.array(
      z.object({ userId: IdSchema, name: z.string(), answers: count, accuracy: pct, lastActiveHuman: z.string() }),
    ),
    logins: z.array(z.object({ userId: IdSchema, name: z.string(), role: z.string(), timeAgo: z.string().meta(FIELD('Mock wire text. Open question for the frontend: BM rendering of relative time.')) })),
  })
  .meta({ id: 'CommandCenterSchoolDrill' })
export type CommandCenterSchoolDrill = z.infer<typeof CommandCenterSchoolDrillSchema>

export const CommandCenterSchoolDrillResponseSchema = z
  .object({ data: CommandCenterSchoolDrillSchema })
  .meta({ id: 'CommandCenterSchoolDrillResponse' })

// ---------------------------------------------------------------------------------------------
// M17-04..07 drill-down pages
// ---------------------------------------------------------------------------------------------

export const CommandCenterSchoolSchema = z
  .object({
    school: CommandCenterRefSchema,
    cards: z.object({
      students: count.meta(FIELD('Every student of the school, active or not.')),
      active: count.meta(FIELD('Pupils with at least one answer.')),
      answers: count,
      accuracy: pct,
    }),
    teachers: z.array(
      z.object({
        userId: IdSchema,
        name: z.string(),
        subjectText: z.string().nullable().meta(FIELD('Free text of the teacher profile.')),
        classes: count,
        students: count,
        active30d: count,
        ownerOnly: z.boolean().meta(FIELD('A class owner at the school who is not one of its teachers.')),
      }),
    ),
  })
  .meta({ id: 'CommandCenterSchool' })
export type CommandCenterSchool = z.infer<typeof CommandCenterSchoolSchema>

export const CommandCenterTeacherSchema = z
  .object({
    school: CommandCenterRefSchema,
    teacher: CommandCenterRefSchema,
    classes: z.array(
      z.object({
        id: IdSchema,
        name: z.string(),
        level: z.string(),
        students: count,
        active30d: count,
        answers: count,
        accuracy: pct,
      }),
    ),
  })
  .meta({ id: 'CommandCenterTeacher' })
export type CommandCenterTeacher = z.infer<typeof CommandCenterTeacherSchema>

export const CommandCenterPupilStatusSchema = z.enum(['aktif', 'tidak_aktif']).meta({ id: 'CommandCenterPupilStatus' })

export const CommandCenterClassSchema = z
  .object({
    school: CommandCenterRefSchema.nullable(),
    teacher: CommandCenterRefSchema,
    class: CommandCenterClassRefSchema,
    students: z.array(
      z.object({
        userId: IdSchema,
        name: z.string(),
        answers: count,
        accuracy: pct,
        lastActiveAt: TimestampSchema.nullable().meta(FIELD('Latest answer; null when the pupil never answered.')),
        status: CommandCenterPupilStatusSchema,
        mood: CommandCenterMoodSchema.nullable().meta(FIELD('Latest mood check-in.')),
      }),
    ),
  })
  .meta({ id: 'CommandCenterClass' })
export type CommandCenterClass = z.infer<typeof CommandCenterClassSchema>

export const CommandCenterSubjectRowSchema = z
  .object({
    code: z.string().meta(FIELD('Subject code, or UMUM for mixed free practice.')),
    label: z.string().meta(FIELD('"Latihan Bebas" for UMUM.')),
    correct: count,
    total: count,
    pct,
  })
  .meta({ id: 'CommandCenterSubjectRow' })
export type CommandCenterSubjectRow = z.infer<typeof CommandCenterSubjectRowSchema>

export const CommandCenterWeekSchema = z
  .object({
    start: DateOnlySchema.meta(FIELD('Monday.')),
    end: DateOnlySchema.meta(FIELD('Sunday.')),
    label: z.string().regex(/^\d{2}\/\d{2}$/).meta(FIELD('dd/mm of the Monday.')),
    count,
  })
  .meta({ id: 'CommandCenterWeek' })
export type CommandCenterWeek = z.infer<typeof CommandCenterWeekSchema>

export const CommandCenterMoodDotSchema = z
  .object({ date: DateOnlySchema, mood: CommandCenterMoodSchema, reason: z.string().nullable() })
  .meta({ id: 'CommandCenterMoodDot' })
export type CommandCenterMoodDot = z.infer<typeof CommandCenterMoodDotSchema>

export const CommandCenterHeadcountRowSchema = z
  .object({
    configId: IdSchema,
    subject: z.string(),
    tov: z.number().nullable(),
    etr: z.number().nullable(),
    rs: z.number().nullable(),
    grade: z.string().nullable(),
    date: DateOnlySchema,
  })
  .meta({ id: 'CommandCenterHeadcountRow' })
export type CommandCenterHeadcountRow = z.infer<typeof CommandCenterHeadcountRowSchema>

export const CommandCenterStudentSchema = z
  .object({
    school: CommandCenterRefSchema.nullable(),
    teacher: CommandCenterRefSchema.nullable(),
    class: CommandCenterClassRefSchema.nullable().meta(FIELD('First active class the viewer may open; null when none.')),
    student: CommandCenterRefSchema,
    cards: z.object({
      answers: count,
      accuracy: pct,
      activeDays: count,
      streak: count,
      consistency: pct.meta(FIELD('round(days with an answer in the last 56 days / 56 * 100).')),
    }),
    subjects: z.array(CommandCenterSubjectRowSchema),
    weeks: z.array(CommandCenterWeekSchema).length(8).meta(FIELD('8 Monday-based weeks ending with the current one, oldest first.')),
    moodTrend: z.array(CommandCenterMoodDotSchema).meta(FIELD('Check-ins of the last 30 days, oldest first.')),
    headcount: z.array(CommandCenterHeadcountRowSchema),
    insight: z.object({ texts: z.array(z.string()), source: z.literal('Rule-based Analysis') }),
  })
  .meta({ id: 'CommandCenterStudent' })
export type CommandCenterStudent = z.infer<typeof CommandCenterStudentSchema>

// ---------------------------------------------------------------------------------------------
// M17-08..11 session lists, session detail, headcount detail
// ---------------------------------------------------------------------------------------------

export const CommandCenterSessionRowSchema = z
  .object({
    id: z.string().min(1),
    completedAt: TimestampSchema,
    subjectLabel: z.string().meta(FIELD('"Umum" for a free-practice session.')),
    topic: z.string().nullable().meta(FIELD('Chapter name; "Latihan Bebas" for free practice; null when unknown.')),
    total: count,
    correct: count,
    accuracy: pct.meta(FIELD('2 decimals.')),
    minutes: count.meta(FIELD('floor(seconds / 60).')),
  })
  .meta({ id: 'CommandCenterSessionRow' })
export type CommandCenterSessionRow = z.infer<typeof CommandCenterSessionRowSchema>

export const CommandCenterSessionListSchema = z
  .object({
    totalAnswers: count,
    totalSessions: count,
    accuracy: pct.meta(FIELD('1 decimal.')),
    timeSpentMinutes: count,
    sessions: z.array(CommandCenterSessionRowSchema),
  })
  .meta({ id: 'CommandCenterSessionList' })
export type CommandCenterSessionList = z.infer<typeof CommandCenterSessionListSchema>

export const CommandCenterSessionAnswerSchema = z
  .object({
    no: z.number().int().min(1),
    correct: z.boolean(),
    questionText: z.string().meta(FIELD('Cut at 150 characters followed by "...".')),
    selectedAnswer: z.string().nullable().meta(FIELD('"{L}) {text}", null when the item has no options.')),
    correctAnswer: z.string().nullable(),
    answeredAt: TimestampSchema,
  })
  .meta({ id: 'CommandCenterSessionAnswer' })
export type CommandCenterSessionAnswer = z.infer<typeof CommandCenterSessionAnswerSchema>

export const CommandCenterSessionDetailSchema = z
  .object({
    subjectLabel: z.string(),
    topic: z.string().nullable(),
    completedAt: TimestampSchema,
    total: count,
    correctCount: count,
    wrongCount: count,
    accuracy: pct,
    timeSpent: z.object({ m: count, s: z.number().int().min(0).max(59) }),
    difficulty: z.number().int().nullable(),
    answers: z.array(CommandCenterSessionAnswerSchema),
  })
  .meta({ id: 'CommandCenterSessionDetail' })
export type CommandCenterSessionDetail = z.infer<typeof CommandCenterSessionDetailSchema>

export const CommandCenterHeadcountDetailSchema = z
  .object({
    subject: z.string(),
    totalStudents: count,
    avgTov: z.number().min(0).meta(FIELD('1 decimal mean over non-null values; 0 when none.')),
    avgEtr: z.number().min(0),
    passRate: pct.meta(FIELD('Whole percent of graded entries with grade A+ to C (inferred); 0 when none graded.')),
    students: z.array(
      z.object({
        userId: IdSchema,
        name: z.string(),
        tov: z.number().nullable(),
        etr: z.number().nullable(),
        rs: z.number().nullable(),
        grade: z.string().nullable(),
      }),
    ),
  })
  .meta({ id: 'CommandCenterHeadcountDetail' })
export type CommandCenterHeadcountDetail = z.infer<typeof CommandCenterHeadcountDetailSchema>

// Response envelopes of the drill routes.
export const CommandCenterSchoolResponseSchema = z.object({ data: CommandCenterSchoolSchema }).meta({ id: 'CommandCenterSchoolResponse' })
export const CommandCenterTeacherResponseSchema = z.object({ data: CommandCenterTeacherSchema }).meta({ id: 'CommandCenterTeacherResponse' })
export const CommandCenterClassResponseSchema = z.object({ data: CommandCenterClassSchema }).meta({ id: 'CommandCenterClassResponse' })
export const CommandCenterStudentResponseSchema = z.object({ data: CommandCenterStudentSchema }).meta({ id: 'CommandCenterStudentResponse' })
export const CommandCenterSessionListResponseSchema = z.object({ data: CommandCenterSessionListSchema }).meta({ id: 'CommandCenterSessionListResponse' })
export const CommandCenterSessionDetailResponseSchema = z.object({ data: CommandCenterSessionDetailSchema }).meta({ id: 'CommandCenterSessionDetailResponse' })
export const CommandCenterHeadcountDetailResponseSchema = z.object({ data: CommandCenterHeadcountDetailSchema }).meta({ id: 'CommandCenterHeadcountDetailResponse' })

// ---------------------------------------------------------------------------------------------
// Request params and queries
// ---------------------------------------------------------------------------------------------

export const CommandCenterIdParamsSchema = z
  .object({ id: PathId('Entity id') })
  .meta({ id: 'CommandCenterIdParams' })

export const CommandCenterTeacherParamsSchema = z
  .object({ sid: PathId('School id'), uid: PathId('Teacher user id') })
  .meta({ id: 'CommandCenterTeacherParams' })

export const CommandCenterSessionParamsSchema = z
  .object({
    sessionId: z
      .string()
      .regex(/^[A-Za-z0-9_-]+$/)
      .meta(FIELD('Practice session id (letters, digits, underscore, hyphen); anything else does not match the route (404).')),
  })
  .meta({ id: 'CommandCenterSessionParams' })

export const CommandCenterHeadcountParamsSchema = z
  .object({ configId: PathId('Headcount config id') })
  .meta({ id: 'CommandCenterHeadcountParams' })

/** `start` and `end` must be real calendar dates with start <= end, else 422 `fields.start` "Julat tarikh tidak sah.". */
export const COMMAND_CENTER_RANGE_INVALID = 'Julat tarikh tidak sah.'
export const CommandCenterStudentWeekQuerySchema = z
  .object({ start: DateOnlySchema, end: DateOnlySchema })
  .refine((q) => q.start <= q.end, { message: COMMAND_CENTER_RANGE_INVALID, path: ['start'] })
  .meta({ id: 'CommandCenterStudentWeekQuery' })
export type CommandCenterStudentWeekQuery = z.infer<typeof CommandCenterStudentWeekQuerySchema>

export const CommandCenterStudentSubjectQuerySchema = z
  .object({
    code: z.string().trim().optional().meta(FIELD('Subject code or UMUM (trimmed). An unknown or absent code gives an empty list (200).')),
  })
  .meta({ id: 'CommandCenterStudentSubjectQuery' })
export type CommandCenterStudentSubjectQuery = z.infer<typeof CommandCenterStudentSubjectQuerySchema>

// ---------------------------------------------------------------------------------------------
// C-03 server status (GET /admin/server-status)
// ---------------------------------------------------------------------------------------------

/** Host health readings for the header pill (admin only). Readings and versions only: no hostnames, paths or secrets. */
export const ServerStatusSchema = z
  .object({
    cpuPct: pct,
    ramPct: pct,
    diskPct: pct,
    uptime: z.string().regex(/^\d+d \d+h$/).meta(FIELD('"<days>d <hours>h", e.g. "204d 2h".')),
    load: z.number().min(0),
    cores: z.number().int().min(1),
    ramUsedGb: z.number().min(0).meta(FIELD('1 decimal.')),
    ramTotalGb: z.number().min(0),
    diskUsedGb: z.number().min(0),
    diskTotalGb: z.number().min(0),
  })
  .meta({ id: 'ServerStatus' })
export type ServerStatus = z.infer<typeof ServerStatusSchema>

export const ServerStatusResponseSchema = z.object({ data: ServerStatusSchema }).meta({ id: 'ServerStatusResponse' })
