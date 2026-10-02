/**
 * Response shapes of the M11 mock API (SRS M11 v1.10 §6.4, §7). Shared by the mock handlers and the
 * UI tasks (build-plan §S.3 rule 5: UI tasks import these and do not change this file).
 *
 * Integer ids throughout (M02 ids); datetimes are ISO 8601 with `+08:00`; percentages are numbers
 * rounded to 1 decimal (the client drops a trailing ".0", BR-M11-11).
 */

// --- shared ----------------------------------------------------------------------------------

export type TahapKey = 'Cemerlang' | 'Sederhana' | 'Rendah' | 'Kritikal' | 'Tiada Langsung'

/** BR-M11-10 periods; '' = all time. Any other value is treated as '' (INFERRED). */
export type MonitoringPeriod = '' | '7d' | '30d' | '3m'

/** A pupil as the S1 lists show them. */
export interface StudentLite {
  id: number
  name: string
  email: string
  avatarUrl: string | null
  neverLoggedIn: boolean
}

// --- #1 S1 teacher report ----------------------------------------------------------------------

export interface ReportClassOption {
  id: number
  name: string
}

export interface TeacherReportActivityTypes {
  kuiz: number
  struktur: number
  latihTubi: number
  trackingA: number
  battle: number
  permainan: number
}

export interface TeacherReportScoreTypes {
  kuiz: number | null
  struktur: number | null
  latihTubi: number | null
  trackingA: number | null
  battle: number | null
}

export interface TeacherReport {
  /** 7, 30 or 90 (anything else is 30, BR-M11-06). */
  range: 7 | 30 | 90
  /** The selected own class, or null ("Semua Kelas"); a class that is not an own class is ignored. */
  classroomId: number | null
  options: { classes: ReportClassOption[] }
  population: { total: number; loggedIn: number; practised: number }
  activity: { total: number; byType: TeacherReportActivityTypes }
  /** `overall` is null when there is no scored activity ("-%"). */
  score: { overall: number | null; byType: TeacherReportScoreTypes }
  /** One entry per day of the range ending today; `date` is `dd/mm`. */
  trend: { date: string; count: number }[]
  /** Every population pupil who never logged in, name A→Z (the S1 login panel). */
  notLoggedIn: StudentLite[]
  /** The first 10 pupils without a practice session, name A→Z (the S1 list card, BR-M11-07). */
  notPractised: StudentLite[]
  /**
   * Additive to the SRS shape (the S1 latihan panel lists every such pupil, FR-M11-19; the contract
   * field above is capped at 10): all pupils without a practice session, name A→Z.
   */
  notPractisedAll: StudentLite[]
  /** Up to 10 pupils with ≥ 1 activity in the range, activities descending then name A→Z. */
  mostActive: (StudentLite & { activities: number })[]
}

// --- #3 S2 monitoring overview --------------------------------------------------------------------

export interface MonitoringKpi {
  schools: number
  students: number
  engaged: number
  engagementPct: number
  answers: number
  avgPerStudent: number
  teachers: number
  teachersLoggedIn: number
  teacherPct: number
}

export interface SchoolEngagementRow {
  schoolId: number
  name: string
  /** null when the school has no code (shown "-"). */
  code: string | null
  state: string
  registered: number
  engaged: number
  pct: number
  tahap: TahapKey
}

export interface TeacherEngagementRow {
  schoolId: number
  name: string
  code: string | null
  state: string
  registered: number
  loggedIn: number
  pct: number
  tahap: TahapKey
}

/**
 * `zero` = no answers ("-", slate); `first` = blue (week 1 with answers, or equal to the previous
 * week, BR-M11-15); `up` = green; `down` = red.
 */
export type WeeklyCellClass = 'zero' | 'first' | 'up' | 'down'

export interface WeeklyRow {
  schoolId: number
  name: string
  code: string | null
  cells: { k: number; count: number; cls: WeeklyCellClass; best: boolean }[]
  trend: 'up' | 'down' | 'same'
  best: { k: number; count: number } | null
}

export interface Signal {
  schoolId: number
  name: string
  kind: 'best' | 'rendah' | 'kritikal' | 'tiada' | 'motivasi' | 'hubungi' | 'handsOn'
  registered: number
  engaged: number
  pct: number
  teachersLoggedIn: number
}

export interface MonitoringOverview {
  filters: { period: MonitoringPeriod; state: string; tahap: string }
  kpi: MonitoringKpi
  studentRows: SchoolEngagementRow[]
  teacherRows: TeacherEngagementRow[]
  weeks: { k: number; from: string; to: string }[]
  weekly: WeeklyRow[]
  signals: { best: Signal[]; attention: Signal[]; suggestions: Signal[] }
}

// --- #4 S3 school detail -------------------------------------------------------------------------

export type StudentStatus = 'aktif' | 'login' | 'never'
export type FlagLevel = 'review' | 'excluded'

export interface SchoolDetailStudent {
  id: number
  name: string
  email: string
  level: 'T4' | 'T5'
  answers: number
  status: StudentStatus
  /** S3 definition: ≥ 1 answer and not `excluded` (BR-M11-09, DV-M11-21). */
  engaged: boolean
  flag: FlagLevel | null
  lastLoginAt: string | null
  lastActivityAt: string | null
}

export interface SchoolDetailTeacher {
  id: number
  name: string
  email: string
  loggedIn: boolean
  lastLoginAt: string | null
  createdAt: string
}

export interface SchoolDetail {
  school: { id: number; name: string; code: string | null; state: string }
  subscription: { status: 'active' | 'cancelled' | 'expired'; endsAt: string } | null
  /** Null when the school has no flagged account; n = review + excluded, m = excluded (BR-M11-17). */
  warning: { review: number; excluded: number } | null
  tahap: TahapKey
  pct: number
  cards: {
    students: number
    engaged: number
    answers: number
    teachers: number
    teachersLoggedIn: number
  }
  flags: { review: number; excluded: number }
  students: SchoolDetailStudent[]
  teachers: SchoolDetailTeacher[]
}

// --- #5 S4 student detail ------------------------------------------------------------------------

export interface StudentAnswerOption {
  label: 'A' | 'B' | 'C' | 'D'
  text: string
}

export interface StudentAnswerRow {
  questionId: number
  /** The question HTML (M04 `questionText`). */
  html: string
  textPlain: string
  subjectName: string
  chapterLabel: string | null
  source: string | null
  difficulty: number
  answeredAt: string
  selectedLabel: 'A' | 'B' | 'C' | 'D' | null
  correctLabel: 'A' | 'B' | 'C' | 'D' | null
  isCorrect: boolean
  /** Empty when the question has no options (deleted-options state, FR-M11-71). */
  options: StudentAnswerOption[]
  explanation: string | null
}

export type TopicBadge = 'Kuat' | 'Sederhana' | 'Lemah'
export type GapSeverity = 'Kritikal' | 'Lemah' | 'Perlu Perhatian'

export interface StudentDetail {
  school: { id: number; name: string }
  student: {
    id: number
    name: string
    email: string
    level: 'T4' | 'T5'
    lastActivityAt: string | null
  }
  cards: { answered: number; correct: number; wrong: number; accuracy: number }
  subjects: { subjectId: number; name: string; correct: number; total: number; pct: number }[]
  topics: {
    subjectId: number
    subjectName: string
    rows: {
      bab: number | null
      name: string
      correct: number
      total: number
      pct: number
      badge: TopicBadge
    }[]
  }[]
  answers: { available: number; total: number; rows: StudentAnswerRow[] }
  wrong: { count: number; unique: number; rows: StudentAnswerRow[] }
  gaps: {
    count: number
    items: {
      group: string
      subjectName: string
      pct: number
      correct: number
      total: number
      severity: GapSeverity
      availableQuestions: number
    }[]
    strong: { group: string; subjectName: string; pct: number; answered: number }[]
    untried: string[]
  }
  observations: {
    kind: 'strong' | 'weak'
    subjectName: string
    pct: number
    wrong: number
    total: number
  }[]
}

// --- #6 S5 teacher detail --------------------------------------------------------------------------

export interface TeacherDetail {
  school: { id: number; name: string }
  teacher: { id: number; name: string; email: string; lastLoginAt: string | null }
  cards: { students: number; engaged: number; pct: number; needAttention: number }
  students: {
    id: number
    name: string
    level: 'T4' | 'T5'
    answers: number
    accuracy: number | null
    status: StudentStatus
  }[]
  suggestions: { neverLoggedIn: number; lowAccuracy: number; answered: number }
}

// --- #7 export ---------------------------------------------------------------------------------------

export type ExportFormat = 'pdf' | 'csv'

export interface MonitoringExport {
  filename: string
  rows: SchoolEngagementRow[]
}

// --- #8 S6 item analysis -----------------------------------------------------------------------------

export interface ItemAnalysisRow {
  questionId: number
  textPlain: string
  subjectName: string
  attempts: number
  /** % correct, 1 decimal. */
  pct: number
  band: 'mudah' | 'sederhana' | 'sukar'
  /** Upper-group p − lower-group p (3 decimals); null when it cannot be computed. */
  discrimination: number | null
}

export interface ItemAnalysis {
  options: {
    subjects: { id: number; name: string }[]
    classes: ReportClassOption[]
  }
  rows: ItemAnalysisRow[]
}
