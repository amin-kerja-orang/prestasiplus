/**
 * M10 Command Center API types (SRS M10 v1.18 §7 #2–#10; build-plan M10-T3). The S2 page task
 * (M10-T4) reads this file and does not change it (build-plan §S.3 rule 5).
 *
 * Bodies are the **bare** objects of the SRS (no `{data}` envelope, as live); errors use the shared
 * `{error: {code, message, fields?}}` form. JSON is camelCase; times are ISO 8601 with `+08:00`
 * unless a field says `HH:mm`. Percentages are whole numbers except where noted. Every figure is
 * scoped to the viewer's own students (BR-M10-04) and read from the M05 answer log.
 */

import type { EducationLevelSlug, RemedialStatus } from './types'

// ---------------------------------------------------------------------------------------------
// #2 GET /api/guru/command-center/live-data
// ---------------------------------------------------------------------------------------------

export interface CcClassRow {
  /** The class id (a `classroom`). */
  id: number
  name: string
  /** The slug, shown as is ("tingkatan-5"). */
  educationLevel: EducationLevelSlug
  studentCount: number
  /** Members with at least one answer in the last 7 days. */
  active: number
  accuracy: number
}

export interface CcStudentRank {
  studentId: number
  name: string
  answered: number
  accuracy: number
}

export interface CcFeedItem {
  studentId: number
  /** `HH:mm` (Asia/Kuala_Lumpur). Escape it when rendering (SEC-M10-13). */
  time: string
  student: string
  subject: string
  isCorrect: boolean
}

export interface CcRecentBadge {
  studentId: number
  student: string
  badge: string
  icon: string
  awardedAt: string
}

export interface CcEngagement {
  champion: number
  consistent: number
  developing: number
  minimum: number
  disengaged: number
}

export interface CcMood {
  happy: number
  okay: number
  sad: number
  stressed: number
}

/**
 * BR-M10-08 / BR-M10-10. For each count `x` the body has `x` (the text of the tile: digits with "," between
 * thousands) and `xRaw` (the number). The page keeps "--" on the two tiles "Pelajar Berdaftar" and
 * "Soalan Dijawab" while the raw value is 0, and animates from the previous raw value.
 */
export interface CcLiveData {
  teacherName: string
  totalStudents: string
  totalStudentsRaw: number
  activeStudents: string
  activeStudentsRaw: number
  totalAnswered: string
  totalAnsweredRaw: number
  answeredToday: string
  answeredTodayRaw: number
  answeredWeek: string
  answeredWeekRaw: number
  /** round((week − previous 7 days) ÷ previous × 100); 0 when the previous week has no answer. */
  weekChange: number
  /** round(correct ÷ answered × 100) over all answers; 0 when none. */
  accuracy: number
  /** GPS of the viewer's headcount entries (2 decimals); `null` shows "--"; the admin mirror is 4.69. */
  gpsOverall: number | null
  classes: CcClassRow[]
  /** Top 5 by accuracy among students with at least 10 answers (PROPOSED; no panel reads it yet). */
  topStudents: CcStudentRank[]
  /** Top 10 by answers in the last 7 days (students with none are not listed). */
  leaderboardWeek: CcStudentRank[]
  /** The 5 latest awards to the viewer's students (M14 DATA-M14-20), newest first. */
  recentBadges: CcRecentBadge[]
  engagement: CcEngagement
  /** The last 10 answers, newest first. */
  recentFeed: CcFeedItem[]
  /** Mean reaction score 0–10 (M12 NPS) of the students' feedback, 1 decimal; 0 when none. */
  kirkT1: number
  kirkT1Count: number
  /** Accuracy of the last 30 days, the 30 before, and the difference. */
  kirkT2Accuracy: number
  kirkT2Delta: number
  kirkT2Prev: number
  /** Students with an answer in the last 30 days, the difference to the 30 before, and that count. */
  kirkT3Active: number
  kirkT3Delta: number
  kirkT3Prev: number
  /** `gpsOverall`, or 0. */
  kirkT4Gps: number
  mood: CcMood
  generatedAt: string
}

// ---------------------------------------------------------------------------------------------
// #3 GET /api/guru/command-center/drill
// ---------------------------------------------------------------------------------------------

export const CC_DRILL_TYPES = [
  'students',
  'today',
  'subjects',
  'gps',
  'kirk',
  'mood',
  'engagement',
] as const
export type CcDrillType = (typeof CC_DRILL_TYPES)[number]

/** `filter` of `kirk`. */
export type CcKirkFilter = 't1' | 't2' | 't3' | 't4'
/** `filter` of `mood`. */
export type CcMoodName = keyof CcMood
/** `filter` of `engagement`. */
export type CcEngagementBand = keyof CcEngagement

/**
 * `filter` per type: `students` `active` (only students with an answer today); `today` `aktiviti`
 * (the panel "Aktiviti Hari Ini"; no filter = the tile "Soalan Dijawab"); `kirk` `t1`…`t4` (required);
 * `mood` one of the four moods; `engagement` one of the five bands. Anything else is a 422.
 */
export interface CcDrillStudentRow {
  studentId: number
  name: string
  /** The viewer's classes the student is in, joined by ", ". */
  className: string
  answered: number
  accuracy: number
  lastActiveAt: string | null
  /** "Aktif" when the student answered today, else "Login". */
  status: 'Aktif' | 'Log Masuk'
}

export interface CcDrillTodayRow {
  studentId: number
  /** `HH:mm` of the last answer of the pair today. */
  time: string
  student: string
  subject: string
  answered: number
  correct: number
  accuracy: number
}

export interface CcDrillSubjectRow {
  subject: string
  answered: number
  correct: number
  accuracy: number
  students: number
}

export interface CcDrillGpsRow {
  subject: string
  gps: number
  /** The drill's own grade scale (≤ 1.5 A+ … else E). */
  grade: string
  students: number
  /** "Anggaran OTR" (the M08 estimate from the headcount marks). */
  source: string
}

/** `kirk` t1: one row per feedback response. `relevance` and `usefulness` are not stored (null). */
export interface CcDrillKirkRow {
  studentId: number
  name: string
  /** The reaction score 0–10 ("Purata"). */
  average: number
  /** Satisfaction 1–5 ("Kepuasan"). */
  satisfaction: number
  relevance: null
  usefulness: null
  /** `YYYY-MM` month of the response. */
  date: string
}

export interface CcDrillMoodRow {
  studentId: number
  name: string
  mood: CcMoodName
  /** `YYYY-MM-DD`. */
  date: string
  reason: string | null
}

export interface CcDrillEngagementRow {
  studentId: number
  name: string
  band: CcEngagementBand
  /** Distinct answer days in the last 7 days. */
  days: number
  answeredWeek: number
  accuracy: number
  lastActiveAt: string | null
}

/** The "vs" cards of `kirk` t2–t4 ("Bulan Ini" / "Bulan Lepas" = last 30 days / the 30 before). */
export interface CcDrillVs {
  accuracyNow: number
  accuracyPrev: number
  accuracyChange: number
  answersNow: number
  answersPrev: number
  activeNow: number
  activePrev: number
  /** Students whose first answer is inside the last 30 days. */
  newStudents: number
}

export interface CcDrillRowMap {
  students: CcDrillStudentRow
  today: CcDrillTodayRow
  subjects: CcDrillSubjectRow
  gps: CcDrillGpsRow
  kirk: CcDrillKirkRow
  mood: CcDrillMoodRow
  engagement: CcDrillEngagementRow
}

/**
 * DV-M10-04: `title` is the label of the clicked tile or panel ("Pelajar Berdaftar", "Soalan Dijawab" /
 * "Aktiviti Hari Ini", "Ketepatan Purata", "GPS Sekolah", "Kirkpatrick T1"…"T4", "Mood Pelajar",
 * "Penglibatan Pelajar"). `extra` + `vsLabel` ("Bulan Ini vs Bulan Lepas") come with `kirk` t2–t4 (whose
 * `students` is empty). The page shows "Tiada data" when `students` is empty and there is no `extra`.
 */
export interface CcDrill<T extends CcDrillType = CcDrillType> {
  title: string
  students: CcDrillRowMap[T][]
  extra?: CcDrillVs
  vsLabel?: string
}

// ---------------------------------------------------------------------------------------------
// #4–#6 Smart Remedial
// ---------------------------------------------------------------------------------------------

export interface CcWeakTopic {
  /** The subject name ("Kimia"); `generate` takes it back as `subject`. */
  subject: string
  topicName: string
  /** 1 decimal, below 50. */
  accuracy: number
}

export interface CcWeakStudent {
  studentId: number
  name: string
  weakTopics: CcWeakTopic[]
  weakestAccuracy: number
}

export interface CcExistingRemedial {
  id: number
  studentId: number
  status: RemedialStatus
  totalQuestions: number
  afterAccuracy: number | null
}

/**
 * BR-M10-11. `existingRemedials` lists the viewer's tests that are `active` or `completed` (URS
 * FN-M10-2.2.11: a completed one shows "Selesai ({afterAccuracy}%)"); cancelled ones are not listed.
 */
export interface CcRemedialScan {
  weakStudents: CcWeakStudent[]
  existingRemedials: CcExistingRemedial[]
}

/** #5: `subject` is a subject name, code or id (the scan's `weakTopics[].subject` works). */
export interface CcRemedialGenerateRequest {
  studentId: number
  subject: string
}

export interface CcRemedialGenerateResponse {
  quizId: number
  totalQuestions: number
}

export interface CcRemedialCancelRequest {
  quizId: number
}

// ---------------------------------------------------------------------------------------------
// #7 predictive, #8 evaluate
// ---------------------------------------------------------------------------------------------

export type CcRisk = 'kritikal' | 'tinggi' | 'sederhana' | 'rendah'
export type CcTrendLabel = 'Naik' | 'Turun' | 'Stabil'

export interface CcPrediction {
  studentId: number
  studentName: string
  /** Whole percent over all answers. */
  overallAccuracy: number
  /** Accuracy of the last 14 days minus the 14 before (0 when either has no answer). */
  trend: number
  trendLabel: CcTrendLabel
  /** Active days in the last 30 ÷ 30 × 100, whole percent. */
  consistency: number
  predictedGrade: string
  predictedGps: number
  risk: CcRisk
}

/** BR-M10-14: students with at least 10 answers, weakest accuracy first. */
export interface CcPredictive {
  predictions: CcPrediction[]
  /** All ten grades (A+ … G) with their counts (0 allowed). */
  gradeDistribution: Record<string, number>
  /** 2 decimals; 0 when nobody is predicted. */
  avgPredictedGps: number
  /** `kritikal` + `tinggi`. */
  atRiskCount: number
  totalPredicted: number
}

export type CcEvaluationRisk = 'critical' | 'high' | 'medium'

export interface CcEvaluationAlert {
  message: string
  suggestion: string
}

export interface CcEvaluation {
  summary: {
    totalStudents: number
    atRisk: number
    critical: number
    high: number
    medium: number
  }
  /** Students with at least one alert, riskiest first. */
  alerts: {
    studentId: number
    name: string
    riskLevel: CcEvaluationRisk
    alerts: CcEvaluationAlert[]
  }[]
}

// ---------------------------------------------------------------------------------------------
// #9 achievements, #10 badge holders
// ---------------------------------------------------------------------------------------------

export interface CcBadgeStat {
  id: number
  name: string
  icon: string
  /** The rarity colour (PROPOSED; the page derives the rarity label from `holders`). */
  color: string
  holders: number
}

export interface CcAchievements {
  totalStudents: number
  /** Awards dated today. */
  totalNew: number
  badgeStats: CcBadgeStat[]
  /** Top 5 students by number of badges (those with none are not listed). */
  topCollectors: { name: string; count: number }[]
  /** Awards dated today (BR-M10-16: the prototype awards nothing on GET). */
  newAwards: {
    studentId: number
    name: string
    badgeName: string
    icon: string
    awardedAt: string
  }[]
}

export interface CcBadgeHolders {
  badge: { name: string; description: string }
  holders: { studentId: number; name: string; accuracy: number; awardedAt: string }[]
}
