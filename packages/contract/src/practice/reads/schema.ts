import { z } from '../../zod'
import { listEnvelopeOf, ListMetaSchema } from '../../common/envelope'
import { RoleCodeSchema } from '../../common/enums'
import { IdSchema } from '../../common/ids'
import { TimestampSchema } from '../../common/time'
import { PracticeModeSchema, PracticeSessionIdSchema, type PracticeMode } from '../schema'

/**
 * M05 practice read models (BE-13): dashboard, subject and chapter lists, revision, progress,
 * history, corrections, mastery, structured questions and SPM targets.
 *
 * The frontend mock (`src/modules/m05-practice/mock/handlers/*`, types in `api/types.ts`) is the wire
 * spec. Differences are listed in `docs/architecture/v2-backend-deviations.md`. Ids are `Id`
 * decimal strings (UD-1) where the mock sent integers. Every endpoint is open to any signed-in role
 * and returns only the caller's own data (mock: "Any session (A)"; card AC4: a teacher or admin
 * reads a student's figures through the BE-19/BE-20 report endpoints, not here).
 *
 * Component ids are prefixed `PracticeRead` so they never collide with BE-12's `Practice...`.
 */

// ---------------------------------------------------------------------------------------------
// Copy (BM, exact as the mock)
// ---------------------------------------------------------------------------------------------

export const PRACTICE_READS_MESSAGES = {
  /** Generic 404 of an unknown (or inactive) subject code, or an unknown structured question. */
  notFound: 'Rekod tidak dijumpai.',
  /** `PUT /spm-targets`: success flash, carried in the sibling `status` field (mock "UNVERIFIED COPY"). */
  targetsSaved: 'Target berjaya disimpan.',
  /** `PUT /spm-targets`: 422 message of every invalid key, value or body (mock "UNVERIFIED COPY"). */
  targetsInvalid: 'Gred target tidak sah.',
  /** `POST /practice/structured/{id}/attempts`: invalid `scope` or `track`. */
  invalidScope: 'Skop tidak sah.',
  /** `POST /practice/structured/{id}/attempts`: invalid `answers` (not an array, bad row, unknown or repeated sub-question). */
  invalidAnswer: 'Jawapan tidak sah.',
  /** Answer text over the limit; the mock builds it from `STRUCTURED_MAX_ANSWER_CHARS`. */
  answerTooLong: (max: number) => `Jawapan tidak boleh melebihi ${String(max)} aksara.`,
} as const

// ---------------------------------------------------------------------------------------------
// Fixed values
// ---------------------------------------------------------------------------------------------

/** History page size (BR-21): fixed, `pageSize` is not accepted. */
export const PRACTICE_READS_HISTORY_PAGE_SIZE = 15
/** Structured list page size (BR-23): fixed. */
export const PRACTICE_READS_STRUCTURED_PAGE_SIZE = 20
/** Upper bound of one structured answer text (mock "INFERRED"). */
export const PRACTICE_READS_STRUCTURED_MAX_ANSWER_CHARS = 5000
/** KBAT levels of the structured list (1-2 LOTS, 3 MOTS, 4-6 HOTS, BR-23). */
export const PRACTICE_READS_KBAT_LEVELS = [1, 2, 3, 4, 5, 6] as const
/** BR-26: the nine target grades a student may save. */
export const PRACTICE_READS_SPM_GRADES = ['A+', 'A', 'A-', 'B+', 'B', 'C+', 'C', 'D', 'E'] as const
/** Number of subjects of the SPM targets list (BR-22); `PUT` answers `saved` with it. */
export const PRACTICE_READS_SPM_TARGET_SUBJECT_COUNT = 20
/** Progress periods (BR-19); absent means '30'. */
export const PRACTICE_READS_PROGRESS_PERIODS = ['7', '30', '90', 'all'] as const
/** History periods (BR-21); an unknown value lists every session. */
export const PRACTICE_READS_HISTORY_PERIODS = ['week', 'month', 'year'] as const

/** Mastery scale labels L0 to L10 (BR-20, mock "Mastery levels"). */
export const PRACTICE_READS_MASTERY_LABELS = [
  'Pemula',
  'Mula Belajar',
  'Aktif',
  'Tekun',
  'Mahir',
  'Pakar Muda',
  'Cemerlang',
  'Master',
  'Grandmaster',
  'Legend',
  'Mythical',
] as const
/** Correct answers needed for L0 to L10 (BR-20; L4 and up are mock placeholders, URS OQ-4). */
export const PRACTICE_READS_MASTERY_THRESHOLDS = [0, 10, 25, 50, 100, 200, 350, 550, 800, 1100, 1500] as const

/** History badge per session mode (mock "Session types"; copy is mostly the mock's proposal). */
export const PRACTICE_READS_HISTORY_BADGES: Readonly<Record<PracticeMode, { label: string; icon: string; color: string }>> = {
  past_year: { label: 'Latihan', icon: 'fa-book', color: '#6B7280' },
  latih_tubi: { label: 'Latihan', icon: 'fa-book', color: '#6B7280' },
  random: { label: 'Latihan', icon: 'fa-book', color: '#6B7280' },
  chapter: { label: 'Bab', icon: 'fa-layer-group', color: '#0D9488' },
  revision: { label: 'Ulang Kaji', icon: 'fa-redo-alt', color: '#EA580C' },
  ramalan: { label: 'Tracking A', icon: 'fa-book', color: '#6B7280' },
  mission: { label: 'Latihan', icon: 'fa-book', color: '#6B7280' },
  remedial: { label: 'Latihan', icon: 'fa-book', color: '#6B7280' },
  question_set: { label: 'Latihan', icon: 'fa-book', color: '#6B7280' },
  pksk: { label: 'PKSK', icon: 'fa-book', color: '#6B7280' },
}

const count = () => z.number().int().min(0)
const percent = () => z.number().min(0).max(100)

// ---------------------------------------------------------------------------------------------
// Shared shapes
// ---------------------------------------------------------------------------------------------

/** A practice subject (BR-01) with the two M04 counts (BR-05). */
export const PracticeReadSubjectSchema = z
  .strictObject({
    id: IdSchema,
    code: z.string().min(1),
    name: z.string(),
    nameEn: z.string(),
    icon: z.string().nullable().meta({ description: 'Lucide name, Font Awesome class, emoji or null (M03 BR-05).' }),
    color: z.string(),
    isCore: z.boolean(),
    approvedCount: count().meta({ description: 'Eligible questions of the subject (Q-ELIGIBLE), "{n} soalan".' }),
    bankCount: count().meta({ description: 'Active questions of the subject (Q-ACTIVE), "Statistik Subjek".' }),
  })
  .meta({ id: 'PracticeReadSubject' })
export type PracticeReadSubject = z.infer<typeof PracticeReadSubjectSchema>

/** Free-trial state (BR-07): `active` while the user has no active subscription. */
export const PracticeReadTrialStatusSchema = z
  .strictObject({
    active: z.boolean(),
    used: count(),
    limit: count(),
    remaining: count(),
  })
  .meta({ id: 'PracticeReadTrialStatus' })

export const PracticeReadDifficultyCountsSchema = z
  .strictObject({ '1': count(), '2': count(), '3': count(), '4': count(), '5': count() })
  .meta({ id: 'PracticeReadDifficultyCounts', description: 'Question counts for difficulty 1 to 5.' })

// ---------------------------------------------------------------------------------------------
// GET /dashboard
// ---------------------------------------------------------------------------------------------

export const PracticeReadGreetingPeriodSchema = z
  .enum(['Pagi', 'Tengah Hari', 'Petang', 'Malam'])
  .meta({ id: 'PracticeReadGreetingPeriod', description: 'Greeting by the Malaysia-time hour (BR-02).' })

export const PracticeReadQuestSchema = z
  .strictObject({
    key: z.string().min(1).meta({ description: 'The M14 challenge id as text.' }),
    emoji: z.string(),
    title: z.string(),
    difficulty: z.enum(['easy', 'medium', 'hard']).meta({ description: 'Mudah, Sederhana, Sukar.' }),
    description: z.string(),
    target: count(),
    reward: count().meta({ description: 'Syiling reward ("+{reward}").' }),
    progress: count(),
    completed: z.boolean(),
  })
  .meta({ id: 'PracticeReadQuest' })

export const PracticeReadBannerSchema = z
  .strictObject({ type: z.string(), title: z.string(), body: z.string().nullable() })
  .meta({ id: 'PracticeReadBanner' })

export const PracticeReadDashboardBadgeSchema = z
  .strictObject({
    id: IdSchema,
    name: z.string(),
    icon: z.string(),
    rarityLabel: z.string().nullable(),
    awardedAt: TimestampSchema,
  })
  .meta({ id: 'PracticeReadDashboardBadge' })

export const PracticeReadArticleSchema = z
  .strictObject({
    slug: z.string().min(1),
    title: z.string(),
    category: z.string().meta({ description: 'Category label as shown in the chip ("Tips Belajar"...).' }),
    publishedAt: TimestampSchema.nullable(),
  })
  .meta({ id: 'PracticeReadArticle' })

export const PracticeReadLevelPillSchema = z
  .strictObject({
    code: z.string().min(1),
    name: z.string(),
    stage: z.enum(['primary', 'lower_secondary', 'upper_secondary']),
    count: count().meta({ description: 'Active questions of the level (Q-ACTIVE).' }),
  })
  .meta({ id: 'PracticeReadLevelPill' })

export const PracticeReadRecentQuestionSchema = z
  .strictObject({
    id: IdSchema,
    subjectName: z.string(),
    difficulty: z.number().int().min(1).max(5),
    text: z.string().max(103).meta({ description: 'Cut at 100 characters plus "..." (BR-29).' }),
    createdAt: TimestampSchema,
    levelCode: z.string(),
  })
  .meta({ id: 'PracticeReadRecentQuestion' })

export const PracticeReadSubjectStatSchema = z
  .strictObject({
    id: IdSchema,
    name: z.string(),
    icon: z.string().nullable(),
    color: z.string(),
    bankCount: count(),
    avgDifficulty: z.number().min(0).max(5).meta({ description: 'Mean difficulty of the active questions, 2 decimals; 0 when none.' }),
    usedCount: count(),
  })
  .meta({ id: 'PracticeReadSubjectStat' })

export const PracticeReadDashboardSchema = z
  .strictObject({
    user: z.strictObject({ id: IdSchema, name: z.string(), role: RoleCodeSchema }),
    greetingPeriod: PracticeReadGreetingPeriodSchema,
    trial: PracticeReadTrialStatusSchema,
    streak: z.strictObject({ count: count(), practisedToday: z.boolean() }),
    wallet: z.strictObject({ coins: count(), points: count(), level: count(), levelProgressPct: percent() }),
    week: z.strictObject({
      sessions: count(),
      accuracyPct: z.number().int().min(0).max(100).meta({ description: 'Correct / answered this Monday-Sunday week, integer (BR-25).' }),
    }),
    banners: z.array(PracticeReadBannerSchema),
    quests: z.array(PracticeReadQuestSchema),
    questsCompleted: count(),
    badges: z.array(PracticeReadDashboardBadgeSchema),
    revisionTotal: count().meta({ description: 'Distinct queued questions that still have an active question link (BR-14).' }),
    articles: z.array(PracticeReadArticleSchema),
    subjects: z.array(PracticeReadSubjectSchema),
    stats: z.strictObject({
      totalQuestions: count(),
      activeSubjects: count(),
      activeLevels: count(),
      approvedQuestions: count(),
    }),
    levelPills: z.array(PracticeReadLevelPillSchema),
    recentQuestions: z.array(PracticeReadRecentQuestionSchema),
    difficultyChart: z.array(z.strictObject({ level: z.number().int().min(1).max(5), count: count() })),
    subjectStats: z.array(PracticeReadSubjectStatSchema).meta({ description: 'By bankCount descending, ties by id.' }),
  })
  .meta({ id: 'PracticeReadDashboard' })
export type PracticeReadDashboard = z.infer<typeof PracticeReadDashboardSchema>

// ---------------------------------------------------------------------------------------------
// GET /practice/subjects, /practice/subjects/{code}
// ---------------------------------------------------------------------------------------------

export const PracticeReadCodeParamsSchema = z.object({
  code: z.string().min(1).max(32).meta({ description: 'Subject code, case-insensitive; an unknown or inactive subject is 404.' }),
})

export const PracticeReadSubjectListResponseSchema = listEnvelopeOf(PracticeReadSubjectSchema).meta({
  id: 'PracticeReadSubjectListResponse',
})

export const PracticeReadSubjectLevelSchema = z
  .strictObject({ id: IdSchema, code: z.string(), name: z.string(), count: count() })
  .meta({ id: 'PracticeReadSubjectLevel' })

export const PracticeReadSubjectConfigSchema = z
  .strictObject({
    subject: PracticeReadSubjectSchema,
    total: count().meta({ description: 'Practice questions over every offered level ("Semua Tahap").' }),
    levels: z.array(PracticeReadSubjectLevelSchema).meta({ description: 'Offered levels (Darjah 1-4 linked to the subject), in level order (BR-11).' }),
    difficultyStats: PracticeReadDifficultyCountsSchema,
    difficultyByLevel: z.record(z.string(), PracticeReadDifficultyCountsSchema).meta({ description: 'Keyed by level id.' }),
    subjectiveCounts: z.record(z.string(), count()).meta({ description: 'Subjective counts by key (FR-M05-49); the mock keeps it empty (test fixture).' }),
    trial: PracticeReadTrialStatusSchema,
  })
  .meta({ id: 'PracticeReadSubjectConfig' })
export type PracticeReadSubjectConfig = z.infer<typeof PracticeReadSubjectConfigSchema>

// ---------------------------------------------------------------------------------------------
// GET /practice/chapter-subjects, /practice/chapter-subjects/{code}
// ---------------------------------------------------------------------------------------------

export const PracticeReadChapterSubjectSchema = z
  .strictObject({
    code: z.string().min(1),
    name: z.string(),
    icon: z.string().nullable(),
    color: z.string(),
    chapterCount: count(),
    questionCount: count(),
  })
  .meta({ id: 'PracticeReadChapterSubject' })

export const PracticeReadChapterSubjectListResponseSchema = listEnvelopeOf(PracticeReadChapterSubjectSchema).meta({
  id: 'PracticeReadChapterSubjectListResponse',
})

export const PracticeReadChapterSubjectQuerySchema = z.object({
  levelId: z.string().optional().meta({
    description:
      'Offered level id. An unknown or non-offered value (or a non-number) falls back to the first offered level; never 422 (mock).',
  }),
})

export const PracticeReadChapterCardSchema = z
  .strictObject({
    id: IdSchema,
    number: z.number().int().nullable(),
    name: z.string(),
    total: count(),
    answered: count(),
    correct: count(),
    scorePct: percent().meta({ description: '1 decimal (BR-16).' }),
    remaining: count(),
    state: z.enum(['open', 'locked']),
    complete: z.boolean(),
  })
  .meta({ id: 'PracticeReadChapterCard' })

export const PracticeReadChapterSubjectDetailSchema = z
  .strictObject({
    subject: z.strictObject({ code: z.string(), name: z.string(), color: z.string() }),
    levels: z.array(z.strictObject({ id: IdSchema, name: z.string(), count: count() })),
    levelId: IdSchema.nullable().meta({ description: 'The level shown; null when the subject offers none.' }),
    chapters: z.array(PracticeReadChapterCardSchema),
  })
  .meta({ id: 'PracticeReadChapterSubjectDetail' })

// ---------------------------------------------------------------------------------------------
// GET /practice/revision, /practice/revision/{code}
// ---------------------------------------------------------------------------------------------

export const PracticeReadRevisionSubjectCardSchema = z
  .strictObject({
    code: z.string().min(1),
    name: z.string(),
    nameEn: z.string(),
    icon: z.string().nullable(),
    color: z.string(),
    count: z.number().int().min(1),
  })
  .meta({ id: 'PracticeReadRevisionSubjectCard' })

export const PracticeReadRevisionOverviewSchema = z
  .strictObject({
    total: count().meta({ description: 'Distinct queued questions that still have an active question link (BR-14, XL-19).' }),
    subjects: z.array(PracticeReadRevisionSubjectCardSchema).meta({ description: 'BR-01 order; only subjects with queued questions (FR-M05-70).' }),
  })
  .meta({ id: 'PracticeReadRevisionOverview' })

export const PracticeReadRevisionSubjectSchema = z
  .strictObject({
    subject: z.strictObject({ id: IdSchema, code: z.string(), name: z.string(), color: z.string() }),
    count: count().meta({ description: '0 is a 200: the screen then goes back to the overview with an info flash (FR-M05-72).' }),
  })
  .meta({ id: 'PracticeReadRevisionSubject' })

// ---------------------------------------------------------------------------------------------
// GET /practice/progress
// ---------------------------------------------------------------------------------------------

export const PracticeReadProgressQuerySchema = z.object({
  period: z.string().optional().meta({
    description:
      "'7', '30' (default), '90' or 'all'. Any other value is not an error: 200 with period null and zero figures (mock).",
  }),
})

export const PracticeReadProgressSubjectSchema = z
  .strictObject({
    code: z.string(),
    name: z.string(),
    color: z.string(),
    answered: count(),
    correct: count(),
    wrong: count(),
    accuracyPct: percent().meta({ description: '1 decimal.' }),
    trend: z.array(percent()).meta({ description: 'Daily accuracy values, oldest first (sparkline, BR-19).' }),
  })
  .meta({ id: 'PracticeReadProgressSubject' })

export const PracticeReadProgressSchema = z
  .strictObject({
    period: z.enum(PRACTICE_READS_PROGRESS_PERIODS).nullable().meta({ description: 'null for an unknown period (no chip active, zero figures).' }),
    answered: count().meta({ description: 'All answers in the window, with or without a session.' }),
    accuracyPct: percent().nullable().meta({ description: '1 decimal; null when nothing was answered.' }),
    sessions: count(),
    minutes: count().meta({ description: 'Whole minutes: floor of the seconds / 60.' }),
    chart: z.strictObject({
      labels: z.array(z.string()).meta({ description: 'Day labels "DD/MM", oldest first.' }),
      accuracy: z.array(percent()),
      counts: z.array(count()),
    }),
    weakSubjects: z.array(
      z.strictObject({ code: z.string(), name: z.string(), color: z.string(), answered: count(), accuracyPct: percent() }),
    ).meta({ description: 'Subjects under 50 % accuracy (BR-19, inferred threshold).' }),
    subjects: z.array(PracticeReadProgressSubjectSchema).meta({ description: 'Most answers first, then the M03 subject order.' }),
  })
  .meta({ id: 'PracticeReadProgress' })
export type PracticeReadProgress = z.infer<typeof PracticeReadProgressSchema>

// ---------------------------------------------------------------------------------------------
// GET /practice/history
// ---------------------------------------------------------------------------------------------

export const PracticeReadHistoryQuerySchema = z.object({
  period: z.string().optional().meta({
    description: "'week' (Monday-Sunday), 'month' or 'year' (calendar, Malaysia time). Any other value lists every session; never 422.",
  }),
  page: z.string().optional().meta({ description: 'Page number; a missing or invalid value means page 1 (mock, Laravel style). The page size is fixed at 15.' }),
})

export const PracticeReadHistoryItemSchema = z
  .strictObject({
    id: PracticeSessionIdSchema,
    mode: PracticeModeSchema,
    badge: z.strictObject({ label: z.string(), icon: z.string(), color: z.string() }),
    completedAt: TimestampSchema,
    questionCount: count(),
    correctCount: count(),
    wrongCount: count(),
    accuracyPct: percent().meta({ description: '2 decimals.' }),
    timeSpent: count(),
    coinsEarned: count(),
  })
  .meta({ id: 'PracticeReadHistoryItem' })
export type PracticeReadHistoryItem = z.infer<typeof PracticeReadHistoryItemSchema>

export const PracticeReadHistoryTotalsSchema = z
  .strictObject({
    sessions: count(),
    answered: count(),
    avgAccuracyPct: percent().meta({ description: '1 decimal; sessions with no question add no accuracy.' }),
    coins: count(),
  })
  .meta({ id: 'PracticeReadHistoryTotals' })

/** Standard list meta plus `totals`, which are all-time and never filtered by `period` (BR-21). */
export const PracticeReadHistoryMetaSchema = ListMetaSchema.extend({ totals: PracticeReadHistoryTotalsSchema }).meta({
  id: 'PracticeReadHistoryMeta',
})

export const PracticeReadHistoryResponseSchema = z
  .object({ data: z.array(PracticeReadHistoryItemSchema), meta: PracticeReadHistoryMetaSchema })
  .meta({ id: 'PracticeReadHistoryResponse' })

// ---------------------------------------------------------------------------------------------
// GET /practice/corrections
// ---------------------------------------------------------------------------------------------

const MonthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/)

export const PracticeReadCorrectionsQuerySchema = z.object({
  month: z.string().optional().meta({ description: 'YYYY-MM. A missing or malformed value shows the current month (DV-M05-13); never 422.' }),
})

export const PracticeReadCorrectionsSchema = z
  .strictObject({
    month: MonthSchema,
    prevMonth: MonthSchema,
    nextMonth: MonthSchema.nullable().meta({ description: 'null when the shown month is the current one (or later).' }),
    summary: z
      .strictObject({
        before: percent().meta({ description: '1 decimal.' }),
        after: percent(),
        delta: z.number().meta({ description: 'after - before, 1 decimal; may be negative.' }),
        questions: count(),
      })
      .nullable()
      .meta({ description: 'null when the month has no first attempts.' }),
    subjects: z.array(
      z.strictObject({ name: z.string(), color: z.string(), questions: count(), before: percent(), after: percent(), delta: z.number() }),
    ),
  })
  .meta({ id: 'PracticeReadCorrections' })

// ---------------------------------------------------------------------------------------------
// GET /practice/mastery
// ---------------------------------------------------------------------------------------------

export const PracticeReadMasteryCardSchema = z
  .strictObject({
    code: z.string(),
    name: z.string(),
    icon: z.string().nullable(),
    color: z.string(),
    level: z.number().int().min(0).max(10),
    label: z.string(),
    correct: count(),
    answered: count(),
    accuracyPct: percent().meta({ description: '1 decimal.' }),
    nextLevel: z.number().int().min(1).max(10).nullable().meta({ description: 'null at level 10.' }),
    nextThreshold: count().nullable(),
    barPct: percent().meta({ description: '1 decimal; 100 at level 10.' }),
    xpMultiplier: z.number().min(1).nullable().meta({ description: '1 + 0.05 x (level - 1) from level 2, else null.' }),
    lastAnsweredAt: TimestampSchema.nullable(),
  })
  .meta({ id: 'PracticeReadMasteryCard' })

export const PracticeReadMasterySchema = z
  .strictObject({
    scale: z.array(z.strictObject({ level: z.number().int().min(0).max(10), label: z.string() })),
    subjects: z.array(PracticeReadMasteryCardSchema).meta({ description: 'Active subjects the caller has answered, in M03 order.' }),
  })
  .meta({ id: 'PracticeReadMastery' })
export type PracticeReadMastery = z.infer<typeof PracticeReadMasterySchema>

// ---------------------------------------------------------------------------------------------
// GET /practice/structured, /practice/structured/{id}, POST /practice/structured/{id}/attempts
// ---------------------------------------------------------------------------------------------

export const PracticeReadStructuredScopeSchema = z.enum(['spm']).meta({ id: 'PracticeReadStructuredScope' })
export const PracticeReadStructuredTrackSchema = z.enum(['bahasa']).meta({ id: 'PracticeReadStructuredTrack' })

export const PracticeReadStructuredListQuerySchema = z.object({
  subjectId: z.string().optional().meta({ description: 'Subject filter. An empty value is no filter; an unknown or non-numeric value matches nothing (200, empty list).' }),
  kbatLevel: z.string().optional().meta({ description: '1 to 6. An empty value is no filter; any other value matches nothing (200, empty list).' }),
  page: z.string().optional().meta({ description: 'Page number; a missing or invalid value means page 1. The page size is fixed at 20.' }),
  scope: z.string().optional().meta({ description: "'spm' selects the SPM variant (Subjektif). Any other value is ignored." }),
  track: z.string().optional().meta({ description: "'bahasa' (BM then BI) only together with scope=spm; otherwise ignored." }),
})

export const PracticeReadStructuredDetailQuerySchema = z.object({
  scope: z.string().optional().meta({ description: "Only decides backUrl; 'spm' or ignored." }),
  track: z.string().optional().meta({ description: "Only decides backUrl; 'bahasa' together with scope=spm, else ignored." }),
})

export const PracticeReadStructuredParamsSchema = z.object({ id: IdSchema })

export const PracticeReadStructuredCardSchema = z
  .strictObject({
    id: IdSchema,
    subjectId: IdSchema,
    subjectName: z.string(),
    kbatLevel: z.number().int().min(1).max(6),
    estimatedMinutes: count(),
    isTrial: z.boolean(),
    preview: z.string().max(203).meta({ description: 'First 200 characters of the stimulus plus "..." when longer.' }),
    topic: z.string().nullable(),
    author: z.string().min(1).meta({ description: 'The teacher name, or "Guru Pakar" when the creator is not a teacher.' }),
    school: z.string().nullable().meta({ description: 'The author school; null when there is none.' }),
    subQuestionCount: count().meta({ description: '"{n} soalan": every sub-question.' }),
    levelName: z.string().meta({ description: 'M03 level name, e.g. "Tingkatan 5".' }),
    parts: count().meta({ description: '"{parts} bahagian": the top-level parts.' }),
    marks: count().meta({ description: '"{marks} markah".' }),
  })
  .meta({ id: 'PracticeReadStructuredCard' })

export const PracticeReadStructuredListMetaSchema = ListMetaSchema.extend({
  scope: PracticeReadStructuredScopeSchema.nullable().meta({ description: 'Echo of the variant applied; null when absent or unknown.' }),
  track: PracticeReadStructuredTrackSchema.nullable().meta({ description: "'bahasa' only together with scope 'spm'." }),
  subjectOptions: z
    .array(z.strictObject({ id: IdSchema, name: z.string() }))
    .meta({ description: 'The "Subjek" options (without "Semua Subjek"): plain list by name; SPM variants in the FR-M05-134 order.' }),
}).meta({ id: 'PracticeReadStructuredListMeta' })

export const PracticeReadStructuredListResponseSchema = z
  .object({ data: z.array(PracticeReadStructuredCardSchema), meta: PracticeReadStructuredListMetaSchema })
  .meta({ id: 'PracticeReadStructuredListResponse' })

/** The answer page. Strict on purpose: model answers appear only in the attempt result. */
export const PracticeReadStructuredDetailSchema = z
  .strictObject({
    id: IdSchema,
    subjectId: IdSchema,
    subjectName: z.string(),
    levelName: z.string(),
    stimulus: z.string(),
    stimulusImage: z.string().nullable().meta({ description: 'null when the set has no image.' }),
    subQuestions: z.array(z.strictObject({ id: IdSchema, label: z.string(), text: z.string(), marks: count() })),
    backUrl: z.string().min(1).meta({ description: '"/latihan-berstruktur", or the SPM variant list of FR-M05-137 (a frontend route).' }),
  })
  .meta({ id: 'PracticeReadStructuredDetail' })
export type PracticeReadStructuredDetail = z.infer<typeof PracticeReadStructuredDetailSchema>

export const PracticeReadStructuredAttemptRequestSchema = z
  .object({
    answers: z
      .array(
        z.object({
          subQuestionId: IdSchema,
          text: z.string().max(PRACTICE_READS_STRUCTURED_MAX_ANSWER_CHARS),
        }),
      )
      .meta({ description: 'One row per answered sub-question; an unknown or repeated subQuestionId is 422.' }),
    scope: PracticeReadStructuredScopeSchema.nullable().optional(),
    track: PracticeReadStructuredTrackSchema.nullable().optional().meta({ description: "Needs scope 'spm'." }),
  })
  .meta({ id: 'PracticeReadStructuredAttemptRequest' })
export type PracticeReadStructuredAttemptRequest = z.infer<typeof PracticeReadStructuredAttemptRequestSchema>

/** The stored attempt (DATA-M05-06) plus the model answers, revealed after submitting. */
export const PracticeReadStructuredAttemptResultSchema = z
  .strictObject({
    id: IdSchema,
    userId: IdSchema,
    structuredQuestionId: IdSchema,
    scope: PracticeReadStructuredScopeSchema.nullable(),
    track: PracticeReadStructuredTrackSchema.nullable(),
    answers: z.array(z.strictObject({ subQuestionId: IdSchema, text: z.string() })),
    marks: z.array(z.strictObject({ subQuestionId: IdSchema, awarded: count(), max: count() })),
    totalAwarded: count(),
    totalMax: count(),
    submittedAt: TimestampSchema,
    modelAnswers: z.array(z.strictObject({ subQuestionId: IdSchema, text: z.string() })),
  })
  .meta({ id: 'PracticeReadStructuredAttemptResult' })
export type PracticeReadStructuredAttemptResult = z.infer<typeof PracticeReadStructuredAttemptResultSchema>

// ---------------------------------------------------------------------------------------------
// GET /spm-targets, PUT /spm-targets
// ---------------------------------------------------------------------------------------------

export const PracticeReadSpmGradeSchema = z.enum(PRACTICE_READS_SPM_GRADES).meta({ id: 'PracticeReadSpmGrade' })

export const PracticeReadSpmTargetRowSchema = z
  .strictObject({
    id: IdSchema.meta({ description: 'M03 subject id.' }),
    name: z.string(),
    target: PracticeReadSpmGradeSchema.nullable(),
    answered: count().meta({ description: '0 without progress.' }),
    accuracyPct: percent().nullable().meta({ description: '1 decimal; null = "Belum mula".' }),
    band: z.enum(['green', 'amber', 'red']).nullable().meta({ description: 'green >= 70, amber 50-69, red < 50 (BR-27).' }),
    predictedGrade: z
      .enum([...PRACTICE_READS_SPM_GRADES, 'G'])
      .nullable()
      .meta({ description: 'A+ to E, or "G" below 40 (BR-27); null = "-".' }),
  })
  .meta({ id: 'PracticeReadSpmTargetRow' })

export const PracticeReadSpmTargetsSchema = z
  .strictObject({ subjects: z.array(PracticeReadSpmTargetRowSchema) })
  .meta({ id: 'PracticeReadSpmTargets', description: 'The 20 SPM subjects of BR-22 in display order, with the caller own targets.' })
export type PracticeReadSpmTargets = z.infer<typeof PracticeReadSpmTargetsSchema>

export const PracticeReadSpmTargetsSaveRequestSchema = z
  .object({
    targets: z
      .record(IdSchema, z.union([PracticeReadSpmGradeSchema, z.literal('')]))
      .meta({
        description:
          'Subject id (canonical decimal, one of the 20 SPM subjects) to a grade; "" or a missing subject clears its target. Replaces all 20 values (BR-26). An unknown key, a non-canonical key ("01") or a grade outside the nine is 422 on targets.<key>.',
      }),
  })
  .meta({ id: 'PracticeReadSpmTargetsSaveRequest' })
export type PracticeReadSpmTargetsSaveRequest = z.infer<typeof PracticeReadSpmTargetsSaveRequestSchema>

/** `{ data: { saved }, status }`: the flash message is a sibling of `data`, as the mock sends it. */
export const PracticeReadSpmTargetsSaveResponseSchema = z
  .strictObject({
    data: z.strictObject({ saved: z.literal(PRACTICE_READS_SPM_TARGET_SUBJECT_COUNT) }),
    status: z.literal(PRACTICE_READS_MESSAGES.targetsSaved),
  })
  .meta({ id: 'PracticeReadSpmTargetsSaveResponse' })
