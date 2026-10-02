/**
 * Row types of the M05 stores (SRS M05 v1.16 §6.1–§6.4, §6.6, §6.7, §6.9; DATA-M05-01/02/03/04/06/11).
 * Owner: M05 (D12). Other modules receive these shapes from the `practice` repositories only.
 *
 * Times are ISO 8601 with `+08:00` (`toIsoMyt`); rows also carry the epoch-ms twin
 * (`answeredAtMs`, `completedAtMs`) that filters and sorts read without formatting a date per row.
 */

/** DATA-M05-01 `mode` (BR-35 classification in `../repository/rules.ts`). */
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

export type SessionStatus = 'in_progress' | 'completed'

/**
 * Spec facets shared by both datasets (§6.14.1 cells; `./calendar.ts`):
 * - `seg` — `mon` = the M11 monitoring segment (a student of grade 10/11 at a school outside
 *   900001–900099), `oth` = every other row;
 * - `schoolId` — the pupil's school for `mon` rows, else null;
 * - `week` — M11 week 0–32 (`mon` and P rows), null for non-P rows;
 * - `band` — the window bucket at the clock (`mon` and P rows), null for non-P rows;
 * - `inP` — M17 population P: an active student outside the fixture schools.
 */
export interface SpecFacets {
  seg: 'mon' | 'oth'
  schoolId: number | null
  week: number | null
  band: number | null
  inP: boolean
}

export type AnswerFacetKey = keyof SpecFacets | 'isCorrect' | 'hasSession'
export type AnswerCheapKey = 'userId' | 'sessionId' | 'answeredAt' | 'answeredAtMs'

/** DATA-M05-02 QuizAnswer (the answer log). */
export interface AnswerRow extends SpecFacets {
  /** 1–478,499 in the dataset; runtime answers ≥ 9,000,001. */
  id: number
  sessionId: string | null
  /** `sessionId !== null` (facet: Q-ANS-NOSESSION). */
  hasSession: boolean
  userId: number
  questionId: number
  subjectId: number | null
  levelId: number | null
  chapterId: number | null
  /** Index into M04 `Question.options`; null only for PKSK items without options. */
  selectedOptionId: number | null
  isCorrect: boolean
  answeredAt: string
  answeredAtMs: number
}

export type SessionFacetKey = keyof SpecFacets | 'missionId' | 'status'
export type SessionCheapKey =
  | 'userId'
  | 'mode'
  | 'subjectId'
  | 'questionCount'
  | 'correctCount'
  | 'timeSpent'
  | 'coinsEarned'
  | 'pointsEarned'
  | 'completedAt'
  | 'completedAtMs'
  | 'remedialTestId'
  | 'questionSetId'

/** DATA-M05-01 PracticeSession. */
export interface SessionRow extends SpecFacets {
  /** "A2"… anchors, "g1"… generated, opaque runtime ids (`s_…`). */
  id: string
  userId: number
  mode: PracticeMode
  subjectId: number | null
  levelId: number | null
  difficulty: number | null
  chapterId: number | null
  year: number | null
  setNo: number | null
  targetQuestionId: number | null
  missionId: number | null
  remedialTestId: number | null
  questionSetId: number | null
  timeLimitSec: number | null
  pkskDomainId: number | null
  pkskTargetLevel: 'T1' | 'T4' | null
  /** Served order. */
  questionIds: number[]
  questionCount: number
  status: SessionStatus
  correctCount: number
  /** Seconds (BR-30 cap). */
  timeSpent: number
  coinsEarned: number
  pointsEarned: number
  startedAt: string
  /** null while in progress. */
  completedAt: string | null
  /** 0 while in progress. */
  completedAtMs: number
}

/** DATA-M05-03 RevisionQueueItem (key `userId:questionId`). */
export interface QueueRow {
  id: string
  userId: number
  questionId: number
  subjectId: number
  wrongTimes: number
  lastWrongAt: string
}

/** DATA-M05-11 SubjectMastery (key `userId:subjectId`). */
export interface MasteryRow {
  id: string
  userId: number
  subjectId: number
  correct: number
  answered: number
  lastAnsweredAt: string | null
}

export type SpmGrade = 'A+' | 'A' | 'A-' | 'B+' | 'B' | 'C+' | 'C' | 'D' | 'E'

/** DATA-M05-04 SpmTarget (key `userId:subjectId`). */
export interface SpmTargetRow {
  id: string
  userId: number
  subjectId: number
  targetGrade: SpmGrade
  updatedAt: string
}

/** DATA-M05-06 StructuredAttempt (LS-7; written by M05-T2). */
export interface StructuredAttemptRow {
  id: string
  userId: number
  structuredQuestionId: number
  scope: 'spm' | null
  track: 'bahasa' | null
  answers: { subQuestionId: number; text: string }[]
  marks: { subQuestionId: number; awarded: number; max: number }[]
  totalAwarded: number
  totalMax: number
  submittedAt: string
}

/** One stored answer check of an in-progress session (BR-30; key `sessionId:questionId`). */
export interface CheckRow {
  id: string
  sessionId: string
  userId: number
  questionId: number
  selectedOptionId: number
  isCorrect: boolean
  checkedAt: string
  checkedAtMs: number
  /** Order of the check within the session. */
  seq: number
}

/** DATA-M05-07 SubjectUsage (S1 "Digunakan", seed 0; URS OQ-12). */
export interface SubjectUsageRow {
  id: number
  usedCount: number
}
