/**
 * Row types of the M08-owned stores (SRS M08 v1.11 §6.5–§6.9; DATA-M08-04…-11). Integer ids where the
 * live site shows them; datetimes ISO 8601 with +08:00; dates `YYYY-MM-DD`. Stores M08 does not own
 * (sessions, answers, classes, users, wallets) are read through their owners' repositories only (D12).
 */

import type { Grade } from './rules'

export type Letter = 'A' | 'B' | 'C' | 'D'

/** DATA-M08-04 SpRecord: one per (user, subject, DSKP SP). `id` = `"{userId}:{subjectId}:{spId}"`. */
export interface SpRecordRow {
  id: string
  userId: number
  subjectId: number
  dskpSpId: number
  answered: number
  correct: number
  /** Insertion order: the tie-break of equal accuracies (the observed card order, S7). */
  seq: number
  /**
   * `anchor` = the observed S7 record set (the admin's); `log` = derived from the user's answers on questions
   * that carry a `dskpSpId` (BR-M08-12). S6 weak topics read `log` records only; S7 reads both (SRS §6.10
   * shows weak SPs on S7 for the admin but "Tiada topik lemah!" on S6).
   */
  origin: 'anchor' | 'log'
}

export type RiskLevel = 'critical' | 'high' | 'medium' | 'low'
export type Trend = 'up' | 'down' | 'stable'

/** DATA-M08-05 RiskProfile, stored per (user, class, subject). `id` = `"{userId}:{classroomId}:{subjectId}"`. */
export interface RiskProfileRow {
  id: string
  userId: number
  classroomId: number
  subjectId: number
  accuracy: number
  answered: number
  trend: Trend
  gradeLow: Grade
  gradeHigh: Grade
  riskLevel: RiskLevel
}

export type TimelineCategory = 'sijil' | 'pencapaian' | 'aktiviti' | 'cerita' | 'lain'

/** DATA-M08-06 TimelinePost (photo `url` is a data URL in the mock). */
export interface TimelinePostRow {
  id: number
  userId: number
  title: string
  category: TimelineCategory
  eventDate: string | null
  story: string | null
  photos: { url: string; caption: string | null }[]
  createdAt: string
}

export interface RankingFigure {
  correct: number
  accuracy: number
  /** The pupil's "Tahap" (level badge "L{n}") for this figure. */
  tahap: number
}

/** DATA-M08-07 RankingEntry. `figures.all` and `figures["{subjectId}"]`. `userId` is null while M01 holds no user for the observed name (XR). */
export interface RankingEntryRow {
  id: number
  userId: number | null
  name: string
  schoolName: string
  state: string
  district: string
  levelId: number
  figures: Record<string, RankingFigure>
}

export type StandingPeriod = 'week' | 'month' | 'all'

/** DATA-M08-08 LeaderboardStanding: documented display data of the observed and generated learners (BR-M08-28). */
export interface StandingRow {
  id: string
  period: StandingPeriod
  /** Insertion order, the ordering key after coins / accuracy. */
  seq: number
  userId: number | null
  name: string
  coins: number
  sessions: number
  accuracy: number
  source: 'observed' | 'generated'
}

/** DATA-M08-09 SchoolSpmHistory. `schoolId` null = the platform. `id` = `"{schoolId|platform}:{year}"`. */
export interface SpmHistoryRow {
  id: string
  schoolId: number | null
  year: number
  gps: number
  candidates: number
  source: string
  gradeCounts: number[] | null
  subjects: { subjectName: string; gps: number; candidates: number }[]
}

export interface ItemWrongPupil {
  userId: number
  classLabel: string
  wrongOption: Letter
}

/** DATA-M08-11 ItemStatistic. `id` = `"{scopeKind}:{scopeId}:{tingkatan|all}:{questionId}"`. */
export interface ItemStatisticRow {
  id: string
  scopeKind: 'ppd' | 'state' | 'school'
  scopeId: string | number
  tingkatan: 'T4' | 'T5' | null
  questionId: number
  rank: number
  attempts: number
  pupils: number
  wrong: number
  wrongPupils: ItemWrongPupil[]
  popularWrongOption: Letter | null
  popularWrongCount: number
}

/** DATA-M08-10 LearnerActivityStats (stored part; coins, streak and badges are M14's). `id` = userId. */
export interface ActivityRow {
  id: number
  userId: number
  practiceDays: number
  lastPracticeAt: string | null
  joinedAt: string
  profileLevelId: number
}

/** S9 school summary (DISPLAY_CONSTANT, DV-M08-32); id is "{schoolId}:{tingkatan|all}". */
export interface ItemSummaryRow {
  id: string
  schoolId: number
  tingkatan: 'T4' | 'T5' | null
  students: number
  answers: number
  accuracy: number
  subjects: { name: string; pupils: number; questions: number; accuracy: number; wrong: number }[]
}
