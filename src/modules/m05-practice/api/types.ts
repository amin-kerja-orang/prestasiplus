/**
 * M05 API types (SRS M05 v1.17 §6.8, §7 #1–#14 and the session calls #4–#6, #23; build-plan M05-T1).
 * UI tasks read this file and do not change it (build-plan §S.3 rule 5). JSON is camelCase; times are
 * ISO 8601 with `+08:00`; ids of subjects, levels and chapters are the M03 integers.
 *
 * #15–#21 (structured, SPM targets, remedial, missions) are typed at the end of the file (M05-T2).
 */

/** DATA-M05-01 `mode` (§6.1, BR-35). */
export type PracticeMode =
  | 'random'
  | 'chapter'
  | 'revision'
  | 'past_year'
  | 'latih_tubi'
  | 'ramalan'
  | 'mission'
  | 'remedial'
  | 'question_set'
  | 'pksk'

// ---------------------------------------------------------------------------------------------
// Shared shapes (§6.8)
// ---------------------------------------------------------------------------------------------

/** A practice subject (BR-01): M03 fields plus the two M04 counts (BR-05). */
export interface PracticeSubject {
  id: number
  code: string
  name: string
  nameEn: string
  /** M03 `icon` (BR-05 of M03: Lucide name, Font Awesome class, emoji, or `null`). */
  icon: string | null
  color: string
  isCore: boolean
  /** Q-ELIGIBLE(subject): S1 and S2 "{n} soalan". */
  approvedCount: number
  /** Q-ACTIVE(subject): S1 "Statistik Subjek". */
  bankCount: number
}

export interface TrialStatus {
  /** `true` while the user has no active subscription (BR-07). */
  active: boolean
  used: number
  limit: number
  remaining: number
}

export type DifficultyCounts = Record<'1' | '2' | '3' | '4' | '5', number>

/** #3 `GET /api/practice/subjects/:code` (S3, BR-11, BR-12). */
export interface SubjectConfig {
  subject: PracticeSubject
  /** Q-PRACTICE(subject): "Semua Tahap". */
  total: number
  /** The offered levels (Tingkatan 4–5 linked to the subject, D54), in level order, with Q-PRACTICE counts. */
  levels: { id: number; code: string; name: string; count: number }[]
  /** Difficulty 1–5 over the offered levels. */
  difficultyStats: DifficultyCounts
  /** Difficulty 1–5 per offered level id. */
  difficultyByLevel: Record<string, DifficultyCounts>
  /** Test fixture `setSubjectiveCounts` (FR-M05-49); empty in the seed. */
  subjectiveCounts: Record<string, number>
  trial: TrialStatus
}

// ---------------------------------------------------------------------------------------------
// #1 Dashboard
// ---------------------------------------------------------------------------------------------

export type GreetingPeriod = 'Pagi' | 'Tengah Hari' | 'Petang' | 'Malam'
export type QuestDifficulty = 'easy' | 'medium' | 'hard'

export interface DashboardQuest {
  /** The M14 challenge id as text. */
  key: string
  /** Emoji tile (M14 `icon`). */
  emoji: string
  title: string
  /** `easy` = "Mudah", `medium` = "Sederhana", `hard` = "Sukar". */
  difficulty: QuestDifficulty
  description: string
  target: number
  /** Syiling reward ("+{reward}"). */
  reward: number
  progress: number
  completed: boolean
}

export interface DashboardBanner {
  type: string
  title: string
  body: string | null
}

export interface DashboardBadge {
  id: number
  name: string
  icon: string
  rarityLabel: string | null
  awardedAt: string
}

export interface DashboardArticle {
  slug: string
  title: string
  /** The category label as shown in the chip ("Tips Belajar"…). */
  category: string
  publishedAt: string | null
}

export interface DashboardLevelPill {
  code: string
  name: string
  stage: 'primary' | 'lower_secondary' | 'upper_secondary'
  /** Q-ACTIVE(level). */
  count: number
}

export interface DashboardRecentQuestion {
  id: number
  subjectName: string
  difficulty: number
  /** Cut at 100 characters + "..." (BR-29). */
  text: string
  createdAt: string
  levelCode: string
}

export interface DashboardSubjectStat {
  id: number
  name: string
  icon: string | null
  color: string
  /** Q-ACTIVE(subject). */
  bankCount: number
  /** Mean `difficultyLevel` of the subject's active questions, 2 decimals; 0 when none. */
  avgDifficulty: number
  usedCount: number
}

export interface Dashboard {
  user: { id: number; name: string; role: string }
  greetingPeriod: GreetingPeriod
  trial: TrialStatus
  streak: { count: number; practisedToday: boolean }
  wallet: { coins: number; points: number; level: number; levelProgressPct: number }
  week: { sessions: number; accuracyPct: number }
  banners: DashboardBanner[]
  quests: DashboardQuest[]
  questsCompleted: number
  badges: DashboardBadge[]
  /** Distinct eligible questions in the revision queue (BR-14). */
  revisionTotal: number
  articles: DashboardArticle[]
  subjects: PracticeSubject[]
  stats: {
    totalQuestions: number
    activeSubjects: number
    activeLevels: number
    approvedQuestions: number
  }
  levelPills: DashboardLevelPill[]
  recentQuestions: DashboardRecentQuestion[]
  difficultyChart: { level: number; count: number }[]
  subjectStats: DashboardSubjectStat[]
}

// ---------------------------------------------------------------------------------------------
// #7, #8 Chapters
// ---------------------------------------------------------------------------------------------

export interface ChapterSubject {
  code: string
  name: string
  icon: string | null
  color: string
  chapterCount: number
  questionCount: number
}

export interface ChapterCard {
  id: number
  number: number | null
  name: string
  total: number
  answered: number
  correct: number
  /** 0–100, 1 decimal (BR-16). */
  scorePct: number
  remaining: number
  state: 'open' | 'locked'
  complete: boolean
}

export interface ChapterSubjectDetail {
  subject: { code: string; name: string; color: string }
  levels: { id: number; name: string; count: number }[]
  /** The level shown; `null` when the subject offers none. */
  levelId: number | null
  chapters: ChapterCard[]
}

// ---------------------------------------------------------------------------------------------
// #9, #10 Revision
// ---------------------------------------------------------------------------------------------

export interface RevisionSubjectCard {
  code: string
  name: string
  nameEn: string
  icon: string | null
  color: string
  count: number
}

export interface RevisionOverview {
  total: number
  subjects: RevisionSubjectCard[]
}

export interface RevisionSubject {
  subject: { id: number; code: string; name: string; color: string }
  count: number
}

// ---------------------------------------------------------------------------------------------
// #11 Progress
// ---------------------------------------------------------------------------------------------

export type ProgressPeriod = '7' | '30' | '90' | 'all'

export interface ProgressSubject {
  code: string
  name: string
  color: string
  answered: number
  correct: number
  wrong: number
  accuracyPct: number
  /** Daily accuracy values, oldest first (the sparkline points, BR-19). */
  trend: number[]
}

export interface Progress {
  /** `null` for an unknown `period` (no chip active, zero figures). */
  period: ProgressPeriod | null
  answered: number
  /** 1 decimal; `null` when nothing was answered. */
  accuracyPct: number | null
  sessions: number
  /** Whole minutes (floor of the seconds ÷ 60). */
  minutes: number
  chart: { labels: string[]; accuracy: number[]; counts: number[] }
  weakSubjects: {
    code: string
    name: string
    color: string
    answered: number
    accuracyPct: number
  }[]
  subjects: ProgressSubject[]
}

// ---------------------------------------------------------------------------------------------
// #12 History
// ---------------------------------------------------------------------------------------------

export type HistoryPeriod = 'week' | 'month' | 'year'

export interface HistoryItem {
  id: string
  mode: PracticeMode
  badge: { label: string; icon: string; color: string }
  completedAt: string
  questionCount: number
  correctCount: number
  wrongCount: number
  /** 0–100, 2 decimals. */
  accuracyPct: number
  timeSpent: number
  coinsEarned: number
}

export interface HistoryTotals {
  sessions: number
  answered: number
  /** 1 decimal. */
  avgAccuracyPct: number
  coins: number
}

// ---------------------------------------------------------------------------------------------
// #13 Corrections
// ---------------------------------------------------------------------------------------------

export interface CorrectionSummary {
  before: number
  after: number
  delta: number
  questions: number
}

export interface Corrections {
  /** `YYYY-MM`. */
  month: string
  prevMonth: string
  /** `null` when the shown month is the current one (or later). */
  nextMonth: string | null
  summary: CorrectionSummary | null
  subjects: {
    name: string
    color: string
    questions: number
    before: number
    after: number
    delta: number
  }[]
}

// ---------------------------------------------------------------------------------------------
// #14 Mastery
// ---------------------------------------------------------------------------------------------

export interface MasteryCard {
  code: string
  name: string
  icon: string | null
  color: string
  /** 0–10. */
  level: number
  label: string
  correct: number
  answered: number
  accuracyPct: number
  /** `null` at level 10. */
  nextLevel: number | null
  nextThreshold: number | null
  /** 0–100, 1 decimal. */
  barPct: number
  /** From level 2 (`1 + 0.05 × (level − 1)`), else `null`. */
  xpMultiplier: number | null
  lastAnsweredAt: string | null
}

export interface Mastery {
  scale: { level: number; label: string }[]
  subjects: MasteryCard[]
}

// ---------------------------------------------------------------------------------------------
// #4–#6, #23 Sessions (handlers written by F-26)
// ---------------------------------------------------------------------------------------------

/** #4 request body (one shape per mode, SRS §7 #4). */
export interface StartSessionRequest {
  mode: PracticeMode
  subjectCode?: string
  levelId?: number | null
  difficulty?: number | null
  count?: number
  chapterId?: number
  year?: number
  setNo?: number
  targetQuestionId?: number | null
  missionId?: number
  remedialTestId?: number
  questionSetId?: number
}

export interface QuizQuestion {
  id: number
  questionText: string
  textDirection: 'ltr' | 'rtl'
  scriptType: 'rumi' | 'arab' | 'jawi' | 'mixed'
  wrongTimes: number
  hasDskp: boolean
  contributor: { name: string; profileUrl: string | null } | null
  options: { id: number; label: string; text: string }[]
}

export interface StartSessionResponse {
  sessionId: string
  mode: PracticeMode
  subject: { code: string; name: string; color: string } | null
  chapter?: { id: number; number: number | null; name: string | null }
  questions: QuizQuestion[]
  revisionMeta?: { selected: number; totalWrong: number }
  timeLimitSec?: number | null
}

export interface CheckAnswerResponse {
  isCorrect: boolean
  correctOptionId: number
  feedback: string
  explanation: string | null
}

export interface SubmitSessionResponse {
  results: {
    score: number
    total: number
    gamification: {
      coinsEarned: number
      streakCount: number
      pointsEarned: number
      totalBalance: number
    }
  }
}

export interface SessionListItem {
  id: string
  mode: PracticeMode
  subjectId: number | null
  /** `UMUM` for mixed free practice. */
  subjectCode: string | null
  questionCount: number
  correctCount: number
  percent: number
  coinsEarned: number
  timeSpent: number
  completedAt: string | null
}

export interface SessionListStats {
  sessions: number
  avgAccuracyPct: number
  coins: number
  answered: number
}

// ---------------------------------------------------------------------------------------------
// #15–#17 Structured questions (M05-T2)
// ---------------------------------------------------------------------------------------------

export type StructuredScope = 'spm'
export type StructuredTrack = 'bahasa'

/** #15 one card of S10 and of its SPM variants. */
export interface StructuredCard {
  id: number
  subjectId: number
  subjectName: string
  /** 1–6 (LOTS 1–2, MOTS 3, HOTS 4–6, BR-23). */
  kbatLevel: number
  estimatedMinutes: number
  isTrial: boolean
  /** The first 200 characters of the stimulus (plus "..."), `line-clamp-3` / `pre-line`. */
  preview: string
  topic: string | null
  /** The teacher's name, or "Guru Pakar" when the creator is not a teacher. */
  author: string
  /** The author's school; `null` when there is none (omit the " · {school}" part). */
  school: string | null
  /** "{n} soalan": every sub-question. */
  subQuestionCount: number
  /** M03 level name, e.g. "Tingkatan 5". */
  levelName: string
  /** "{parts} bahagian": the top-level parts (SPM variant cards). */
  parts: number
  /** "{marks} markah" (SPM variant cards). */
  marks: number
}

export interface StructuredListMeta {
  /** Echo of the variant actually applied: `scope` is `null` when absent or unknown. */
  scope: StructuredScope | null
  /** `bahasa` only together with `scope = 'spm'`, else `null`. */
  track: StructuredTrack | null
  /** The "Subjek" options (without "Semua Subjek"): plain = 31 by name; Subjektif / Bahasa = FR-M05-134 order. */
  subjectOptions: { id: number; name: string }[]
}

/** #16 the answer page (Q3). */
export interface StructuredDetail {
  id: number
  subjectId: number
  subjectName: string
  levelName: string
  stimulus: string
  /** M04 value; `null` when the set has no image (never generated). */
  stimulusImage: string | null
  subQuestions: { id: number; label: string; text: string; marks: number }[]
  /** `/latihan-berstruktur`, or the SPM variant list of FR-M05-137. */
  backUrl: string
}

export interface StructuredAttemptRequest {
  answers: { subQuestionId: number; text: string }[]
  scope?: StructuredScope | null
  track?: StructuredTrack | null
}

/** #17 DATA-M05-06 StructuredAttempt + the model answers. */
export interface StructuredAttemptResult {
  id: string
  userId: number
  structuredQuestionId: number
  scope: StructuredScope | null
  track: StructuredTrack | null
  answers: { subQuestionId: number; text: string }[]
  marks: { subQuestionId: number; awarded: number; max: number }[]
  totalAwarded: number
  totalMax: number
  submittedAt: string
  modelAnswers: { subQuestionId: number; text: string }[]
}

// ---------------------------------------------------------------------------------------------
// #18, #19 SPM targets (M05-T2)
// ---------------------------------------------------------------------------------------------

export type SpmGrade = 'A+' | 'A' | 'A-' | 'B+' | 'B' | 'C+' | 'C' | 'D' | 'E'

export interface SpmTargetRow {
  /** M03 subject id. */
  id: number
  name: string
  target: SpmGrade | null
  /** 0 without progress (BR-27: only the `setSpmProgress` fixture sets it). */
  answered: number
  /** 1 decimal; `null` = "Belum mula". */
  accuracyPct: number | null
  band: 'green' | 'amber' | 'red' | null
  /** A+ … E, or "G" below 40 (BR-27); `null` = "-". */
  predictedGrade: string | null
}

export interface SpmTargets {
  subjects: SpmTargetRow[]
}

/** #19 `{data:{saved}, status}`. */
export interface SaveSpmTargetsResult {
  data: { saved: number }
  status: string
}

// ---------------------------------------------------------------------------------------------
// #20, #21 Remedial tests and missions (M05-T2)
// ---------------------------------------------------------------------------------------------

export interface RemedialTestItem {
  id: number
  subjectName: string
  totalQuestions: number
  status: 'active' | 'completed'
  createdAt: string
  teacherName: string
}

export interface MissionItem {
  id: number
  title: string
  /** "Latih Tubi SPM" / "Tracking A" / "Soalan & Rujukan". */
  typeLabel: string
  subjectName: string
  questionCount: number
  coinsPerCorrect: number
  resourceTitle: string | null
  resourceUrl: string | null
  resourceNote: string | null
  status: 'new' | 'in_progress' | 'completed'
}

/** #20b `GET /api/remedial-tests/:id`: the Q4 read-only preview of the test's teacher or an admin. */
export interface RemedialPreview {
  id: number
  subjectName: string
  status: 'active' | 'completed' | 'cancelled'
  totalQuestions: number
  createdAt: string
  teacherName: string
  studentName: string
  questions: {
    id: number
    questionText: string
    textDirection: 'ltr' | 'rtl'
    scriptType: 'rumi' | 'arab' | 'jawi' | 'mixed'
    options: { id: number; label: string; text: string }[]
    /** Index into `options` of the correct one; `null` when the question has none. */
    correctOptionId: number | null
  }[]
}
