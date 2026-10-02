/**
 * Response types of the Command Center drill-down endpoints (SRS M17 v1.12 §7 #6–#13; M17-T1a).
 * One set serves the admin pages S4–S7 (`/admin/command-center/…`) and the teacher mount of M10
 * (`/guru/command-center/…`, FR-M17-60): the endpoints are the same, the server scopes them.
 *
 * Datetimes are ISO 8601 with +08:00; dates `YYYY-MM-DD`; accuracies are percentages rounded as
 * the page prints them (1 decimal, 2 decimals in the session tables, BR-M17-06).
 */

/** Mood values (BR-M17-25); the same literals as the F-33 `moodCheckins` store. */
export type Mood = 'happy' | 'okay' | 'sad' | 'stressed'

/** `{id, name}` of a school, teacher or pupil. */
export interface CcRef {
  id: number
  name: string
}

/** The class chip of the info bars: `level` is "T{n}" (Tingkatan) or "D{n}" (Darjah). */
export interface CcClassRef {
  id: number
  name: string
  level: string
}

// --- #6 S4 -------------------------------------------------------------------------------------

export interface CcSchoolCards {
  /** Every student of the school, active or not (BR-M17-03, DV-M02-15). */
  students: number
  /** Q-M17-SCH-ENGAGED: pupils of P with at least one answer. */
  active: number
  /** Q-M17-SCH-ANS: answers of P at the school. */
  answers: number
  accuracy: number
}

export interface CcSchoolTeacher {
  userId: number
  name: string
  /** Free text of the teacher profile, `null` prints "-". */
  subjectText: string | null
  /** Active classes owned at the school. */
  classes: number
  /** Distinct active members of those classes. */
  students: number
  /** Members with an answer in the last 30 days. */
  active30d: number
  /** DV-M17-22: an owner of a class at the school who is not one of its teachers. */
  ownerOnly: boolean
}

export interface CcSchool {
  school: CcRef
  cards: CcSchoolCards
  teachers: CcSchoolTeacher[]
}

// --- #7 S5 -------------------------------------------------------------------------------------

export interface CcTeacherClass {
  id: number
  name: string
  level: string
  students: number
  active30d: number
  answers: number
  accuracy: number
}

export interface CcTeacher {
  school: CcRef
  teacher: CcRef
  classes: CcTeacherClass[]
}

// --- #8 S6 -------------------------------------------------------------------------------------

export type CcPupilStatus = 'aktif' | 'tidak_aktif'

export interface CcClassStudent {
  userId: number
  name: string
  answers: number
  accuracy: number
  /** Latest answer, `null` when the pupil never answered ("-"). */
  lastActiveAt: string | null
  status: CcPupilStatus
  /** The latest mood check-in, `null` prints "-". */
  mood: Mood | null
}

export interface CcClass {
  school: CcRef | null
  teacher: CcRef
  class: CcClassRef
  students: CcClassStudent[]
}

// --- #9 S7 -------------------------------------------------------------------------------------

export interface CcStudentCards {
  answers: number
  accuracy: number
  activeDays: number
  streak: number
  /** round(days with an answer in the last 56 days ÷ 56 × 100). */
  consistency: number
}

export interface CcSubjectRow {
  /** M03 subject code, or `UMUM` for mixed free practice. */
  code: string
  /** "Latihan Bebas" for `UMUM` (DV-M17-21). */
  label: string
  correct: number
  total: number
  pct: number
}

export interface CcWeek {
  /** Monday, `YYYY-MM-DD`. */
  start: string
  /** Sunday, `YYYY-MM-DD`. */
  end: string
  /** `dd/mm` of the Monday. */
  label: string
  count: number
}

export interface CcMoodDot {
  date: string
  mood: Mood
  reason: string | null
}

export interface CcHeadcountRow {
  configId: number
  subject: string
  tov: number | null
  etr: number | null
  rs: number | null
  grade: string | null
  /** `dd/mm/yyyy` is printed from this `YYYY-MM-DD`. */
  date: string
}

export interface CcInsight {
  texts: string[]
  source: 'Rule-based Analysis'
}

export interface CcStudent {
  school: CcRef | null
  teacher: CcRef | null
  /** The pupil's first active class (INFERRED), `null` when the viewer's scope has none. */
  class: CcClassRef | null
  student: CcRef
  cards: CcStudentCards
  subjects: CcSubjectRow[]
  /** The 8 Monday-based weeks ending with the current one, oldest first. */
  weeks: CcWeek[]
  /** Check-ins of the last 30 days, oldest first. */
  moodTrend: CcMoodDot[]
  headcount: CcHeadcountRow[]
  insight: CcInsight
}

// --- #10, #11 session lists --------------------------------------------------------------------

export interface CcSessionRow {
  id: string
  completedAt: string
  /** "Umum" for a free-practice session (as observed in the week table). */
  subjectLabel: string
  /** Chapter name; "Latihan Bebas" for free practice; `null` prints "-". */
  topic: string | null
  total: number
  correct: number
  /** 2 decimals ("80.00%"). */
  accuracy: number
  /** floor(seconds ÷ 60). */
  minutes: number
}

export interface CcSessionList {
  totalAnswers: number
  totalSessions: number
  /** 1 decimal. */
  accuracy: number
  timeSpentMinutes: number
  sessions: CcSessionRow[]
}

// --- #12 session detail ------------------------------------------------------------------------

export interface CcSessionAnswer {
  no: number
  correct: boolean
  /** Cut at 150 characters + "...". */
  questionText: string
  /** "{L}) {text}", `null` when the item has no options. */
  selectedAnswer: string | null
  correctAnswer: string | null
  answeredAt: string
}

export interface CcSessionDetail {
  subjectLabel: string
  topic: string | null
  completedAt: string
  total: number
  correctCount: number
  wrongCount: number
  accuracy: number
  timeSpent: { m: number; s: number }
  difficulty: number | null
  answers: CcSessionAnswer[]
}

// --- #13 headcount detail ----------------------------------------------------------------------

export interface CcHeadcountStudent {
  userId: number
  name: string
  tov: number | null
  etr: number | null
  rs: number | null
  grade: string | null
}

export interface CcHeadcountDetail {
  subject: string
  totalStudents: number
  /** Means over non-null values, 1 decimal, 0 when none. */
  avgTov: number
  avgEtr: number
  /** Whole percent of graded entries with grade A+ … C (INFERRED), 0 when none graded. */
  passRate: number
  students: CcHeadcountStudent[]
}
