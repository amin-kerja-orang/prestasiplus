/**
 * Read port over the Bijak aggregate (owner BE-16: `exam_attempts` + `attempt_results`). BE-19 never
 * defines attempt tables. The default answers "nothing"; BE-16's adapter replaces it (see
 * `PerformancePorts.provideBijak`). Units are MARKS (US-33.4). `is_test` rows are never returned: the
 * port has no parameter to ask for them.
 */
export type BijakSittingStatus = 'submitted' | 'auto_submitted' // abandoned / in_progress never returned
export type BijakMode = 'exam' | 'latihan'
export type OptionLetter = 'A' | 'B' | 'C' | 'D'

export interface BijakSittingFact {
  attemptId: string
  userId: string
  /** `users.school_id` of the pupil (exam_attempts has no school column). */
  schoolId: string | null
  subjectId: string
  subjectCode: string
  subjectName: string
  /** "Start type" of AC-33.1. */
  paperKind: 'pilihan' | 'jana'
  mode: BijakMode
  status: BijakSittingStatus
  score: number
  maxScore: number
  /** Questions the pupil answered (a non-blank response). NOT the paper's question count and not `maxScore` (marks). */
  answeredCount: number
  /** Waiting for a person to mark: counts as a sitting, never in accuracy. */
  provisional: boolean
  pendingReview: number
  durationSeconds: number
  startedAt: Date
  submittedAt: Date
}

export interface BijakSittingQuery {
  userIds?: readonly string[]
  schoolIds?: readonly string[]
  state?: string
  district?: string
  subjectId?: string
  /** Default: both. */
  modes?: readonly BijakMode[]
  /** [from, to) on submittedAt. */
  submittedFrom?: Date
  submittedTo?: Date
}

export type BijakGroupBy = 'user' | 'user_subject' | 'subject' | 'school' | 'day' | 'user_day'

/** One row per group key (a SQL GROUP BY in the real adapter). */
export interface BijakTotals {
  userId?: string
  subjectId?: string
  /** Present when grouped by subject. */
  subjectName?: string
  schoolId?: string
  /** MYT date, yyyy-mm-dd. */
  day?: string
  sittings: number
  score: number
  max: number
  /** Answered questions (sum of the sittings' `answeredCount`). */
  answered: number
  seconds: number
  /** Non-provisional sittings only (the accuracy base). */
  gradedScore: number
  gradedMax: number
  /** Distinct pupils behind the row (privacy cohort size). */
  pupils: number
  lastSubmittedAt: Date
}

/** One row per (submitted attempt, MCQ question). Stem and options are the pinned snapshot, not a live join. */
export interface BijakItemFact {
  attemptId: string
  userId: string
  schoolId: string | null
  questionId: string
  questionVersion: number
  subjectId: string
  subjectName: string
  topic: string | null
  subtopic: string | null
  stem: string
  options: { letter: OptionLetter; text: string }[]
  correctLetter: OptionLetter
  /** null = left blank. */
  chosenLetter: OptionLetter | null
  awarded: number
  max: number
}

export type BijakItemQuery = Omit<BijakSittingQuery, 'submittedFrom' | 'submittedTo'> & {
  questionIds?: readonly string[]
}

export interface BijakAggregatePort {
  /** Class / pupil scale. */
  sittings(q: BijakSittingQuery): Promise<BijakSittingFact[]>
  /** School / platform scale. */
  totals(q: BijakSittingQuery, groupBy: BijakGroupBy): Promise<BijakTotals[]>
  items(q: BijakItemQuery): Promise<BijakItemFact[]>
}

export const BIJAK_AGGREGATE_PORT = Symbol('BIJAK_AGGREGATE_PORT')

/** Default until BE-16's adapter is registered: no sittings, so every report is its empty payload. */
export class EmptyBijakAggregate implements BijakAggregatePort {
  async sittings(): Promise<BijakSittingFact[]> {
    return []
  }
  async totals(): Promise<BijakTotals[]> {
    return []
  }
  async items(): Promise<BijakItemFact[]> {
    return []
  }
}
