import { z } from '../../zod'
import { IdSchema } from '../../common/ids'
import { DateOnlySchema, TimestampSchema } from '../../common/time'

/**
 * M08 student performance read models (BE-19). The frontend mock (`src/modules/m08-student-performance`)
 * is the wire spec; the differences are listed in the BE-19 contract report. Ids are opaque strings
 * (`Id`); timestamps are `Timestamp` (+08:00); dates are `DateOnly`. Percentages are 0-100 numbers,
 * GPS values have 2 decimals. Minimal local shapes (`PerformanceUserRef`, `PerformanceClassCard`) overlap
 * the users/classes domains and are reconciled when those contracts merge.
 */

const count = z.number().int().min(0)
const pct = z.number().min(0).max(100)
const num = z.number()

// --- Enums -----------------------------------------------------------------------------------

export const PERFORMANCE_GRADES = ['A+', 'A', 'A-', 'B+', 'B', 'C+', 'C', 'D', 'E', 'G'] as const
export const PerformanceGradeSchema = z.enum(PERFORMANCE_GRADES).meta({ id: 'PerformanceGrade' })
export const PERFORMANCE_GPS_BANDS = ['Cemerlang', 'Baik', 'Sederhana', 'Perlu Perhatian'] as const
export const PerformanceGpsBandSchema = z.enum(PERFORMANCE_GPS_BANDS).meta({ id: 'PerformanceGpsBand' })
export const PerformanceLevelCodeSchema = z.enum(['t4', 't5']).meta({ id: 'PerformanceLevelCode' })
export const PerformanceLetterSchema = z.enum(['A', 'B', 'C', 'D']).meta({ id: 'PerformanceLetter' })
export const PerformanceDifficultySchema = z.enum(['Mudah', 'Sederhana', 'Sukar']).meta({ id: 'PerformanceDifficulty' })
export const PerformanceRiskLevelSchema = z.enum(['critical', 'high', 'medium', 'low']).meta({ id: 'PerformanceRiskLevel' })
export const PerformanceTrendSchema = z.enum(['up', 'down', 'stable']).meta({ id: 'PerformanceTrend' })
export const PerformanceSpStatusSchema = z.enum(['mahir', 'sederhana', 'lemah', 'belum'])
export const PerformancePairStatusSchema = z.enum(['on', 'below', 'none'])

const optionRef = z.object({ letter: PerformanceLetterSchema, text: z.string() })

/** Local user reference (reconcile with BE-05 users). */
export const PerformanceUserRefSchema = z
  .object({ userId: IdSchema, name: z.string() })
  .meta({ id: 'PerformanceUserRef' })

/** S4 / S10 class card (reconcile with BE-17 classes). */
export const PerformanceClassCardSchema = z
  .object({
    id: IdSchema,
    name: z.string(),
    subjectName: z.string().nullable(),
    color: z.string(),
    students: count,
    year: z.number().int(),
    joinCode: z.string(),
    isActive: z.boolean(),
  })
  .meta({ id: 'PerformanceClassCard' })

// --- S1 school performance, S2/S3 levels ------------------------------------------------------

export const PerformanceSchoolSchema = z
  .object({
    scope: z.enum(['platform', 'school']),
    header: z.object({ classCount: count, studentCount: count }),
    stats: z.object({
      students: count,
      teachers: count,
      classes: count,
      subjects: count,
      sessions: count,
      answered: count,
      accuracy: pct,
    }),
    gps: z.object({ value: num.nullable(), band: PerformanceGpsBandSchema.nullable(), entries: count }),
    distribution: z.array(z.object({ grade: PerformanceGradeSchema, count, pct })),
    trend: z.object({
      years: z.array(
        z.object({
          year: z.number().int(),
          gps: num.nullable(),
          band: PerformanceGpsBandSchema.nullable(),
          candidates: count.nullable(),
          source: z.string().nullable(),
          change: num.nullable(),
          current: z.boolean(),
        }),
      ),
      chart: z.object({
        labels: z.array(z.number().int()),
        overall: z.array(num.nullable()),
        subjects: z.array(z.object({ name: z.string(), color: z.string(), data: z.array(num.nullable()) })),
      }),
    }),
    subjects: z.array(
      z.object({
        subjectId: IdSchema,
        name: z.string(),
        gps: num.nullable(),
        grade: PerformanceGradeSchema.nullable(),
        entries: count,
        onTrack: count,
        below: count,
        noTarget: count,
        achievementPct: num.nullable(),
      }),
    ),
    levels: z.array(
      z.object({ code: PerformanceLevelCodeSchema, accuracy: pct, classes: count, students: count, sessions: count }),
    ),
    teachers: z.array(
      z.object({
        userId: IdSchema,
        name: z.string(),
        classCount: count,
        studentCount: count,
        accuracy: pct,
        onTrack: count.nullable(),
        below: count.nullable(),
      }),
    ),
  })
  .meta({ id: 'PerformanceSchool' })

export const PerformanceLevelCardSchema = z
  .object({ code: PerformanceLevelCodeSchema, name: z.string(), classes: count, students: count })
  .meta({ id: 'PerformanceLevelCard' })

export const PerformanceLevelDetailSchema = z
  .object({
    code: PerformanceLevelCodeSchema,
    name: z.string(),
    classes: count,
    students: count,
    subjects: count,
    accuracy: pct,
    sessions: count,
    onTrack: count,
    below: count,
    onTrackPct: pct,
    classRows: z.array(
      z.object({
        classId: IdSchema,
        kind: z.enum(['classroom', 'school_class']),
        name: z.string(),
        subject: z.string().meta({ description: '"Tiada Subjek" without a subject; "Kelas Sekolah" for school classes.' }),
        teacher: z.string().nullable(),
        students: count,
        sessions: count,
        accuracy: pct,
        onTrack: count,
        below: count,
        href: z.string().nullable().meta({ description: '/prestasi/kelas/{id} for classrooms, null for school classes.' }),
      }),
    ),
    topStudents: z.array(
      z.object({ userId: IdSchema, name: z.string(), sessions: count, answered: count, accuracy: pct }),
    ),
    atRisk: z.array(
      z.object({
        userId: IdSchema,
        name: z.string(),
        className: z.string(),
        checkpoint: z.number().int(),
        ar: num,
        target: num,
        gap: num,
      }),
    ),
  })
  .meta({ id: 'PerformanceLevelDetail' })

// --- S5 class dashboard, S6 student, S7 analytics, S8 class analytics -------------------------

export const PerformanceClassDashboardSchema = z
  .object({
    class: z.object({
      id: IdSchema,
      name: z.string(),
      school: z.string(),
      subject: z.string().nullable(),
      year: z.number().int(),
      joinCode: z.string(),
    }),
    stats: z.object({ students: count, accuracy: pct, sessions: count, answered: count, avgMinutes: num, active7d: count }),
    headcount: z
      .object({
        configId: IdSchema,
        onTrack: count,
        below: count,
        noData: count,
        pct: z.object({ on: pct, below: pct, none: pct }),
        avgTov: num.nullable(),
        avgEtr: num.nullable(),
      })
      .nullable(),
    attention: z.array(z.object({ userId: IdSchema, name: z.string(), sessions: count, accuracy: pct.nullable() })),
    trend: z.array(z.object({ date: DateOnlySchema, sessions: count, avgAccuracy: pct, activeStudents: count })),
    ranking: z.array(
      z.object({
        rank: z.number().int().min(1),
        userId: IdSchema,
        name: z.string(),
        sessions: count,
        answered: count,
        accuracy: pct.nullable(),
        headcount: z.enum(['on', 'below', 'na']),
        lastActiveAt: TimestampSchema.nullable(),
      }),
    ),
  })
  .meta({ id: 'PerformanceClassDashboard' })

const weakSp = z.object({
  spId: IdSchema,
  code: z.string(),
  title: z.string(),
  subjectName: z.string(),
  subjectCode: z.string(),
  answered: count,
  accuracy: pct,
  available: count,
  focusCount: count,
})

export const PerformanceStudentSchema = z
  .object({
    user: z.object({ id: IdSchema, name: z.string(), initial: z.string() }),
    heroAccuracy: pct,
    streak: count,
    stats: z.object({ sessions: count, accuracy: pct, answered: count, seconds: count }),
    headcount: z.array(
      z.object({
        configId: IdSchema,
        subject: z.string(),
        className: z.string(),
        year: z.number().int(),
        status: PerformancePairStatusSchema,
        tov: num.nullable(),
        chips: z.array(z.object({ label: z.string(), value: num.nullable(), tone: PerformancePairStatusSchema })),
        etr: num.nullable(),
      }),
    ),
    mastery: z.array(
      z.object({ subjectCode: z.string(), subjectName: z.string(), color: z.string(), accuracy: pct, sessions: count, answered: count }),
    ),
    activity: z.object({ streakCurrent: count, streakBest: count, koinTotal: count, practiceDays: count }),
    badges: z.array(z.object({ icon: z.string(), name: z.string() })),
    heatmap: z.array(z.object({ date: DateOnlySchema, sessions: count })),
    weakTopics: z.array(
      z.object({
        spId: IdSchema,
        label: z.string(),
        code: z.string().nullable(),
        subjectCode: z.string(),
        levelId: IdSchema.nullable(),
        attempts: count,
        accuracy: pct,
        focusCount: count,
      }),
    ),
    suggestions: z.array(z.object({ kind: z.string(), text: z.string() })),
  })
  .meta({ id: 'PerformanceStudent' })

export const PerformanceAnalyticsSchema = z
  .object({
    userLevelId: IdSchema.nullable(),
    topWeak: z.array(weakSp),
    subjects: z.array(
      z.object({
        subjectId: IdSchema,
        name: z.string(),
        code: z.string(),
        accuracy: pct,
        answered: count,
        trend: PerformanceTrendSchema,
        projection: z.object({ low: PerformanceGradeSchema, high: PerformanceGradeSchema }),
        counts: z.object({ mahir: count, sederhana: count, lemah: count, belum: count }),
        ringTotal: count,
        weak: z.array(weakSp),
        map: z.object({
          caption: z.string(),
          tiles: z.array(z.object({ spId: IdSchema, code: z.string(), title: z.string(), status: PerformanceSpStatusSchema })),
        }),
      }),
    ),
  })
  .meta({ id: 'PerformanceAnalytics' })

/** `riskLevel` accepts '' (all); an unknown value is treated as '' by the mock. */
export const PerformanceClassAnalyticsQuerySchema = z
  .object({
    classroomId: IdSchema.optional(),
    subjectId: IdSchema.optional(),
    riskLevel: z.union([PerformanceRiskLevelSchema, z.literal('')]).optional(),
  })
  .meta({ id: 'PerformanceClassAnalyticsQuery' })

export const PerformanceClassAnalyticsSchema = z
  .object({
    options: z.object({
      classes: z.array(z.object({ id: IdSchema, name: z.string() })),
      subjects: z.array(z.object({ id: IdSchema, name: z.string() })),
      selected: z.object({
        classroomId: IdSchema.nullable(),
        subjectId: IdSchema.nullable(),
        riskLevel: z.union([PerformanceRiskLevelSchema, z.literal('')]),
      }),
    }),
    summary: z.object({ students: count, accuracy: pct, atRisk: count, good: count }).nullable(),
    rows: z.array(
      z.object({
        userId: IdSchema,
        name: z.string(),
        accuracy: pct,
        answered: count,
        trend: PerformanceTrendSchema,
        projection: z.object({ low: PerformanceGradeSchema, high: PerformanceGradeSchema }),
        riskLevel: PerformanceRiskLevelSchema,
      }),
    ),
  })
  .meta({ id: 'PerformanceClassAnalytics' })

// --- S9 school item analysis, S11 class item analysis -----------------------------------------

export const PerformanceItemAnalysisQuerySchema = z
  .object({ tingkatan: z.string().optional().meta({ description: 'T4 or T5; any other value is ignored (null).' }) })
  .meta({ id: 'PerformanceItemAnalysisQuery' })

export const PerformanceSchoolItemAnalysisSchema = z
  .object({
    school: z.object({
      id: IdSchema,
      name: z.string(),
      code: z.string().nullable(),
      type: z.string(),
      district: z.string().nullable(),
      state: z.string(),
    }),
    variant: z.enum(['own', 'byId']),
    tingkatan: z.enum(['T4', 'T5']).nullable(),
    students: count,
    answers: count.nullable(),
    correct: count.nullable(),
    accuracy: pct.nullable(),
    difficulty: z.object({ mudah: count, sederhana: count, sukar: count }),
    gps: z.object({
      value: num.nullable(),
      band: PerformanceGpsBandSchema.nullable(),
      entries: count,
      years: z.array(z.object({ year: z.number().int(), gps: num })),
    }),
    subjects: z.array(
      z.object({ subjectId: IdSchema, name: z.string(), pupils: count, questions: count, accuracy: pct, wrong: count }),
    ),
    questions: z.array(
      z.object({
        rank: z.number().int().min(1),
        questionId: IdSchema,
        stem: z.string(),
        subjectName: z.string(),
        chips: z.array(z.string()),
        level: PerformanceDifficultySchema,
        wrongPct: pct,
        attempts: count,
        pupils: count,
        pupilsPct: pct,
        wrongPupils: z.array(
          z.object({ userId: IdSchema, name: z.string(), classLabel: z.string(), wrongOption: PerformanceLetterSchema }),
        ),
        correctOption: optionRef,
        popularWrongOption: optionRef.nullable(),
        popularWrongCount: count,
      }),
    ),
  })
  .meta({ id: 'PerformanceSchoolItemAnalysis' })

export const PerformanceClassItemAnalysisSchema = z
  .object({
    class: z.object({
      id: IdSchema,
      name: z.string(),
      subjectName: z.string().nullable(),
      levelSlug: z.string(),
      year: z.number().int(),
      students: count,
    }),
    analysis: z.object({
      questionCount: count,
      summary: z.object({ mudah: count, sederhana: count, sukar: count }),
      difficulty: z.array(
        z.object({
          questionId: IdSchema,
          text: z.string(),
          subject: z.string(),
          topic: z.string().nullable(),
          subtopic: z.string().nullable(),
          attempts: count,
          students: count,
          accuracy: pct,
          index: z.number().min(0).max(1),
          level: PerformanceDifficultySchema,
          wrongStudents: z.array(z.object({ userId: IdSchema, name: z.string(), times: count })),
          correctOption: optionRef,
          popularWrong: optionRef.extend({ times: count }).nullable(),
        }),
      ),
      discrimination: z.object({
        sufficient: z.boolean(),
        rows: z.array(
          z.object({
            questionId: IdSchema,
            text: z.string(),
            upperPct: pct,
            lowerPct: pct,
            index: z.number().min(-1).max(1),
            status: z.enum(['Sangat Baik', 'Baik', 'Sederhana', 'Lemah']),
          }),
        ),
      }),
    }),
  })
  .meta({ id: 'PerformanceClassItemAnalysis' })

// --- Timeline, public profile, rankings, leaderboard ------------------------------------------

export const PERFORMANCE_TIMELINE_CATEGORIES = ['sijil', 'pencapaian', 'aktiviti', 'cerita', 'lain'] as const
export const PerformanceTimelineCategorySchema = z
  .enum(PERFORMANCE_TIMELINE_CATEGORIES)
  .meta({ id: 'PerformanceTimelineCategory' })

export const PerformanceTimelinePostSchema = z
  .object({
    id: IdSchema,
    userId: IdSchema,
    title: z.string(),
    category: PerformanceTimelineCategorySchema,
    eventDate: DateOnlySchema.nullable(),
    story: z.string().nullable(),
    photos: z.array(z.object({ url: z.string().min(1), caption: z.string().nullable() })),
    createdAt: TimestampSchema,
  })
  .meta({ id: 'PerformanceTimelinePost' })

export const PerformanceTimelineSchema = z
  .object({ profileUrl: z.string(), posts: z.array(PerformanceTimelinePostSchema) })
  .meta({ id: 'PerformanceTimeline' })

export const PERFORMANCE_TIMELINE_LIMITS = {
  titleMax: 150,
  storyMax: 2000,
  captionMax: 200,
  photosMin: 1,
  photosMax: 5,
  photoMaxBytes: 2 * 1024 * 1024,
  photoTypes: ['image/jpeg', 'image/png', 'image/webp'],
} as const

/**
 * `POST /timeline` body (multipart/form-data): `photos` repeats (or `photos[]`), `captions[i]` per photo
 * (trimmed, truncated to 200, empty = null). Limits are in `PERFORMANCE_TIMELINE_LIMITS`.
 */
export const PerformanceTimelineCreateRequestSchema = z
  .object({
    title: z.string().trim().min(1).max(PERFORMANCE_TIMELINE_LIMITS.titleMax),
    category: PerformanceTimelineCategorySchema,
    eventDate: DateOnlySchema.optional(),
    story: z.string().max(PERFORMANCE_TIMELINE_LIMITS.storyMax).optional(),
    photos: z.array(z.string().meta({ format: 'binary' })).min(1).max(5),
    captions: z.array(z.string()).optional(),
  })
  .meta({ id: 'PerformanceTimelineCreateRequest' })

export const PerformancePublicProfileSchema = z
  .object({
    id: IdSchema,
    name: z.string(),
    firstName: z.string(),
    schoolName: z.string().nullable(),
    levelName: z.string(),
    joinedAt: TimestampSchema,
    daysWith: count,
    tier: z.object({
      key: z.string(),
      name: z.string(),
      emoji: z.string(),
      level: count,
      ordinal: z.number().int().min(1),
      progressPct: pct,
      toNext: count.nullable(),
      nextName: z.string().nullable(),
      nextKey: z.string().nullable(),
    }),
    syiling: count,
    streak: z.object({ current: count, best: count }),
    accuracy: pct,
    activity: z.object({ sessions: count, practiceDays: count, correct: count, bestStreak: count }),
    posts: z.array(PerformanceTimelinePostSchema),
  })
  .meta({ id: 'PerformancePublicProfile' })

export const PerformanceRankingQuerySchema = z
  .object({
    scope: z.string().optional().meta({ description: 'nasional (default) | negeri | daerah | sekolah; unknown gives scope null, rows unfiltered.' }),
    subjectId: IdSchema.optional(),
    tingkatan: z.string().optional().meta({ description: 'T4 or T5.' }),
    negeri: z.string().optional().meta({ description: 'State name; used when scope = negeri.' }),
  })
  .meta({ id: 'PerformanceRankingQuery' })

export const PerformanceRankingSchema = z
  .object({
    scope: z.enum(['nasional', 'negeri', 'daerah', 'sekolah']).nullable(),
    title: z.string(),
    showFooter: z.boolean(),
    states: z.array(z.string()),
    rows: z.array(
      z.object({
        rank: z.number().int().min(1),
        userId: IdSchema.nullable(),
        name: z.string(),
        schoolName: z.string(),
        tahap: count,
        correct: count,
        accuracy: pct,
      }),
    ),
    total: count,
  })
  .meta({ id: 'PerformanceRanking' })

export const PerformanceLeaderboardQuerySchema = z
  .object({ period: z.string().optional().meta({ description: 'all | week | month; unknown = week.' }) })
  .meta({ id: 'PerformanceLeaderboardQuery' })

export const PerformanceLeaderboardSchema = z
  .object({
    period: z.enum(['all', 'week', 'month']),
    me: z.object({ rank: z.number().int().min(1).nullable(), coins: count, sessions: count, accuracy: pct }),
    rows: z.array(
      z.object({
        rank: z.number().int().min(1),
        userId: IdSchema.nullable(),
        name: z.string(),
        avatarUrl: z.string().nullable(),
        coins: count,
        sessions: count,
        accuracy: pct,
      }),
    ),
    participants: count,
  })
  .meta({ id: 'PerformanceLeaderboard' })

// --- Headcount (TOV / RS) ---------------------------------------------------------------------

export const PerformanceHeadcountModeSchema = z.enum(['auto', 'manual']).meta({ id: 'PerformanceHeadcountMode' })
const toneCell = z.enum(['above', 'on', 'below', 'na'])

export const PerformanceHeadcountListItemSchema = z
  .object({
    id: IdSchema,
    className: z.string(),
    subjectName: z.string(),
    levelName: z.string(),
    year: z.number().int(),
    mode: PerformanceHeadcountModeSchema,
    activeOtrs: z.number().int().min(2).max(5),
    students: count,
  })
  .meta({ id: 'PerformanceHeadcountListItem' })

export const PerformanceHeadcountDashboardSchema = z
  .object({
    configs: z.array(
      z.object({
        id: IdSchema,
        level: IdSchema,
        levelName: z.string(),
        className: z.string(),
        subjectName: z.string(),
        year: z.number().int(),
        onTrack: count,
        offTrack: count,
        noData: count,
        totalStudents: count,
        chart: z.object({ labels: z.array(z.string()), target: z.array(num.nullable()), actual: z.array(num.nullable()) }),
      }),
    ),
  })
  .meta({ id: 'PerformanceHeadcountDashboard' })

export const PerformanceHeadcountFormOptionsSchema = z
  .object({
    classes: z.array(z.object({ id: IdSchema, name: z.string() })),
    subjects: z.array(z.object({ id: IdSchema, name: z.string(), code: z.string() })),
    levels: z.array(z.object({ id: IdSchema, name: z.string() })),
    defaultYear: z.number().int(),
  })
  .meta({ id: 'PerformanceHeadcountFormOptions' })

export const PerformanceHeadcountCreateRequestSchema = z
  .object({
    classroomId: IdSchema,
    subjectId: IdSchema,
    educationLevelId: IdSchema,
    academicYear: z.number().int().min(2020).max(2100),
    activeOtrs: z.union([z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
    mode: PerformanceHeadcountModeSchema,
  })
  .meta({ id: 'PerformanceHeadcountCreateRequest' })

export const PerformanceHeadcountAutoSetupRequestSchema = z
  .object({
    levels: z
      .array(z.string().min(1))
      .min(1)
      .meta({ description: 'Level ids, or the codes D1..D6 / T1..T5 (T1..T5 = Tingkatan 1..5).' }),
  })
  .meta({ id: 'PerformanceHeadcountAutoSetupRequest' })

export const PerformanceHeadcountDropRequestSchema = z
  .object({ action: z.enum(['drop', 'restore']), studentIds: z.array(IdSchema).min(1) })
  .meta({ id: 'PerformanceHeadcountDropRequest' })

export const PerformanceHeadcountSortQuerySchema = z
  .object({ sort: z.string().optional().meta({ description: 'ranking (default) | name; unknown = ranking.' }) })
  .meta({ id: 'PerformanceHeadcountSortQuery' })

const cell = z.object({
  target: num.nullable(),
  targetGrade: PerformanceGradeSchema.nullable(),
  ar: num.nullable(),
  arGrade: PerformanceGradeSchema.nullable(),
})

export const PerformanceHeadcountStudentSchema = z
  .object({
    student: z.object({ id: IdSchema, name: z.string(), school: z.string().nullable() }),
    sections: z.array(
      z.object({
        configId: IdSchema,
        subject: z.string(),
        school: z.string().nullable(),
        levelName: z.string(),
        className: z.string(),
        year: z.number().int(),
        status: PerformancePairStatusSchema,
        tov: num.nullable(),
        etr: num.nullable(),
        rs: z.object({ value: num, recordedAt: TimestampSchema.nullable() }).nullable(),
        projection: z
          .object({
            value: num,
            variant: z.enum(['green', 'amber', 'red']),
            trend: z.enum(['Meningkat', 'Stabil', 'Menurun']),
            confidence: z.enum(['Tinggi', 'Sederhana', 'Rendah']),
          })
          .nullable(),
        rows: z.array(cell.extend({ checkpoint: z.number().int(), tone: z.enum(['on', 'below', 'noAr', 'noTarget']) })),
        prediction: z
          .object({ etr: num, rs: num, diff: num, verdict: z.enum(['Ramalan Tepat', 'Hampir Tepat', 'Selisih Besar']) })
          .nullable(),
        chart: z.object({
          labels: z.array(z.string()),
          target: z.array(num.nullable()),
          actual: z.array(num.nullable()),
          projection: z.array(num.nullable()),
          rs: num.nullable(),
        }),
      }),
    ),
  })
  .meta({ id: 'PerformanceHeadcountStudent' })

export const PerformanceHeadcountSummarySchema = z
  .object({
    config: z.object({
      id: IdSchema,
      subject: z.string(),
      className: z.string(),
      levelName: z.string(),
      year: z.number().int(),
      activeOtrs: z.number().int(),
    }),
    students: count,
    avgTov: num.nullable(),
    avgEtr: num.nullable(),
    otrs: z.array(z.object({ n: z.number().int().min(1), above: count, onTrack: count, below: count, na: count })),
  })
  .meta({ id: 'PerformanceHeadcountSummary' })

export const PerformanceHeadcountDetailSchema = z
  .object({
    config: z.object({
      id: IdSchema,
      subject: z.string(),
      className: z.string(),
      levelName: z.string(),
      year: z.number().int(),
      teacherName: z.string(),
      status: z.literal('active'),
      activeOtrs: z.number().int(),
    }),
    chips: z.object({ onTrack: count, below: count, empty: count, total: count }),
    rows: z.array(
      z.object({
        userId: IdSchema,
        name: z.string(),
        tov: num.nullable(),
        tovGrade: PerformanceGradeSchema.nullable(),
        cells: z.array(cell.extend({ tone: toneCell })),
        etr: num.nullable(),
        etrGrade: PerformanceGradeSchema.nullable(),
        dropped: z.boolean(),
      }),
    ),
    averages: z.object({
      tov: num.nullable(),
      otrs: z.array(num.nullable()),
      ars: z.array(num.nullable()),
      etr: num.nullable(),
    }),
  })
  .meta({ id: 'PerformanceHeadcountDetail' })

// --- Exact BM copy (mock handlers) ------------------------------------------------------------

export const PERFORMANCE_HEADCOUNT_MESSAGES = {
  duplicate: {
    auto: 'Headcount Auto untuk kelas, subjek dan tahun ini sudah wujud.',
    manual: 'Headcount Manual untuk kelas, subjek dan tahun ini sudah wujud.',
  },
  classRequired: 'Kelas diperlukan.',
  classInvalid: 'Kelas tidak sah.',
  subjectInvalid: 'Subjek tidak sah.',
  levelInvalid: 'Tingkatan tidak sah.',
  yearInvalid: 'Tahun akademik mesti antara 2020 dan 2100.',
  otrInvalid: 'Bilangan OTR mesti 2, 3, 4 atau 5.',
  modeInvalid: 'Mod pengiraan tidak sah.',
  levelsRequired: 'Pilih sekurang-kurangnya satu tingkatan.',
  studentsRequired: 'Pilih sekurang-kurangnya seorang murid.',
  studentsInvalid: 'Murid tidak sah.',
  actionInvalid: 'Tindakan tidak sah.',
} as const

export const PERFORMANCE_TIMELINE_MESSAGES = {
  titleRequired: 'Tajuk diperlukan.',
  titleTooLong: 'Tajuk terlalu panjang (maks 150 aksara).',
  categoryInvalid: 'Kategori tidak sah.',
  dateInvalid: 'Tarikh tidak sah.',
  storyTooLong: 'Cerita terlalu panjang (maks 2000 aksara).',
  photosRequired: 'Sila muat naik sekurang-kurangnya 1 gambar.',
  photoInvalid: 'Gambar tidak sah (JPEG, PNG atau WebP, maks 2MB).',
} as const

/** Generic mock copy: 401 "Unauthenticated.", 403 "This action is unauthorized.", 404 "Not Found.". */
export const PERFORMANCE_ERROR_MESSAGES = {
  unauthorized: 'Unauthenticated.',
  forbidden: 'This action is unauthorized.',
  notFound: 'Not Found.',
} as const
