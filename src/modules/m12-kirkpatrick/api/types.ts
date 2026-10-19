/**
 * M12 API types (SRS M12 v1.6 §6.8 read models, §7 endpoints #1-#14; build-plan M12-T1). Dates are `YYYY-MM-DD`
 * (day keys) or ISO 8601 with +08:00 (timestamps). Percentages are numbers rounded half-up to 1 decimal; the
 * screens print them without a trailing ".0" (BR-M12-33). `null` marks "no data" ("-" on the screens).
 */

export type BandKey = 'champion' | 'konsisten' | 'berkembang' | 'minimum' | 'tidakTerlibat'

export type SpmGrade = 'A+' | 'A' | 'A-' | 'B+' | 'B' | 'C+' | 'C' | 'D' | 'E' | 'G'

/** `school_id` and `state` of the page query, passed as `schoolId` and `state` (§7). */
export interface ScopeQuery {
  schoolId?: number | null
  state?: string | null
}

export interface BandCount {
  key: BandKey
  count: number
  /** count / T4/T5 x 100, 1 decimal (0 when T4/T5 is 0). */
  pct: number
}

/** #14 `GET /api/kirkpatrick/filter-options`. */
export interface FilterOptions {
  schools: { id: number; name: string }[]
  states: string[]
}

export interface ComparisonPanel {
  /** `YYYY-MM`. */
  month: string
  /** Day keys of the range shown "dd Mmm yyyy - dd Mmm yyyy". */
  from: string
  to: string
  active: number
  accuracy: number
  answers: number
  champions: number
}

export interface Comparison {
  /** "{Bulan} {yyyy} vs {Bulan} {yyyy}", or "Tiada Data vs Tiada Data". */
  subtitle: string
  /** `null` when no month has an answer in scope. */
  before: ComparisonPanel | null
  after: ComparisonPanel | null
  delta: { active: number; accuracy: number; answers: number; champions: number } | null
  sentences: string[]
}

/** #1 `GET /api/kirkpatrick/overview` (S1). */
export interface Overview {
  scope: { schoolId: number | null; state: string | null }
  t4: {
    /** `null` when the school has no SPM history row ("Belum Ada Data"). */
    gps: number | null
    gpsYear: number | null
    /** DC-M12-02. */
    recordsLabel: number
  }
  t3: { active: number; t4t5: number; sessions: number; accuracy: number }
  t2: { accuracy: number; answers: number }
  t1: { satisfaction: number; responses: number }
  comparison: Comparison
  kpi: {
    t4t5: number
    answers: number
    teachersLoggedIn: number
    teachers: number
    accuracy: number
  }
  bands: BandCount[]
}

/** #2 `GET /api/kirkpatrick/reaction` (S2; ignores the scope). */
export interface Reaction {
  npsStudent: number
  npsTeacher: number
  npsAdmin: number
  satisfaction: number
}

export type SubjectStatus = 'Mastered' | 'Developing' | 'Beginning'

/** #3 `GET /api/kirkpatrick/learning` (S3). */
export interface Learning {
  kpi: {
    answers: number
    accuracy: number
    avgScore: number
    sessionsCompleted: number
    sessions: number
    completionPct: number
  }
  subjects: {
    subjectId: number
    name: string
    answers: number
    accuracy: number
    status: SubjectStatus
  }[]
  schools: {
    schoolId: number
    name: string
    students: number
    answers: number
    accuracy: number
    avgScore: number
    subjects: number
  }[]
}

export interface BehaviorSchoolRow {
  schoolId: number
  name: string
  /** School code, or `null` ("-"). */
  code: string | null
  students: number
  active: number
  answers: number
  sessions: number
  /** answers / active, 1 decimal (0 when no active student). */
  perActive: number
  score: number
  tahap: BandKey
}

export interface BehaviorAlert {
  /** 1 never logged in (red), 2 teacher logged in without answers (red), 3 active above 50% (green). */
  list: 1 | 2 | 3
  schoolId: number
  name: string
  kind: 'never' | 'teacher' | 'good'
  /** Students (list 1) or teachers (list 2). */
  n?: number
  /** Active share in percent, 1 decimal (list 3). */
  pct?: number
}

/** #4 `GET /api/kirkpatrick/behavior` (S4). */
export interface Behavior {
  kpi: {
    t4t5: number
    active: number
    sessions: number
    answers: number
    accuracy: number
    teacherPct: number
    teachersLoggedIn: number
    teachers: number
  }
  bands: BandCount[]
  schools: BehaviorSchoolRow[]
  /** 7 rows (Isnin ... Ahad) of 18 cells (06:00 ... 23:00). */
  heat: { max: number; cells: number[][] }
  alerts: BehaviorAlert[]
  /** Always 0 in the prototype (mood store owner M26 is not built, BR-M12-15). */
  moodCount: number
}

export interface ResultsSchoolRow {
  schoolId: number
  name: string
  students: number
  active: number
  /** `null` when the school has no active student. */
  accuracy: number | null
  answers: number | null
  /** The stored score; `null` when the school has no active student and no session. */
  engagement: number | null
  tahap: BandKey
  /** Rendered faded (no active student). */
  faded: boolean
}

export interface AlesaRow {
  userId: number
  name: string
  schoolName: string
  accuracy: number
  grade: SpmGrade
  confidence: 'rendah' | 'sederhana' | 'tinggi'
  /** Stored band of the Cadangan text. */
  cadanganBand: 'A' | 'B' | 'C' | 'D/E'
  /** True when the row is the observed stored row resolved to an exact student; false for a generated row or a substitute. */
  observed: boolean
}

/** #5 `GET /api/kirkpatrick/results` (S5). */
export interface Results {
  kpi: {
    /** `null` when the school has no SPM history row. */
    gps: number | null
    gpsYear: number | null
    /** DC-M12-01 ("41 rekod"). */
    recordsLabel: number
    /** `pass`, `passPct`, `gradeA`, `gradeAPct` are `null` when the history row has candidates but no grade counts (school 8880). */
    passPct: number | null
    pass: number | null
    candidates: number
    gradeA: number | null
    gradeAPct: number | null
    accuracy: number
    answers: number
    active: number
    activePct: number
    t4t5: number
    /** DC-M12-02 ("Rekod Headcount"). */
    records: number
  }
  /** `null` when the scope has no history row (the card is not rendered). */
  distribution: {
    year: number
    candidates: number
    rows: { grade: SpmGrade; n: number; pct: number }[]
  } | null
  subjectGps: {
    year: number
    rows: { name: string; gps: number; grade: SpmGrade; candidates: number; prev: number | null }[]
  }
  trend: { years: number[]; rows: { name: string; values: (number | null)[] }[] }
  schools: ResultsSchoolRow[]
  predictions: {
    userId: number
    name: string
    schoolId: number
    schoolName: string
    answers: number
    accuracy: number
    grade: SpmGrade
  }[]
  alesa: { lulus: number; gagal: number; intervensi: number; rows: AlesaRow[] }
  roi: { active: number; perStudent: number; accuracy: number; gps: number | null }
  insights: {
    active: number
    t4t5: number
    pct: number
    accuracy: number
    grade: SpmGrade
    year: number | null
    gps: number | null
  }
}

/** #6 `GET /api/kirkpatrick/chain` (S6). */
export interface Chain {
  t1: { nps: number; satisfaction: number; responses: number }
  t2: { accuracy: number; answers: number; avgScore: number }
  t3: { active: number; t4t5: number; pct: number; sessions: number; bands: BandCount[] }
  t4: { gps: number | null; r: number; strength: 'Lemah' | 'Sederhana' | 'Kuat' }
  correlation: { bands: { label: string; n: number; acc: number }[]; r: number }
}

export type AlertType = 'mood' | 'inactive' | 'declining'
export type Mood = 'happy' | 'okay' | 'sad' | 'stressed'
export type InterventionStatus = 'Menunggu Semakan' | 'Meningkat' | 'Menurun' | null

/** DATA-M12-02 (repository `kirkpatrickInterventions`). */
export interface KirkpatrickIntervention {
  id: number
  studentId: number
  alertType: AlertType
  /** `YYYY-MM-DD`. */
  actionDate: string
  alertDescription: string
  actionTaken: string
  beforeAccuracy: number | null
  afterAccuracy: number | null
  beforeMood: Mood | null
  afterMood: Mood | null
  createdBy: number
  createdAt: string
  updatedAt: string
}

export interface InterventionRow extends KirkpatrickIntervention {
  /** Derived (BR-M12-26); `null` when equal / before missing (counted only in the total). */
  status: InterventionStatus
  studentName: string | null
}

/** #8 `GET /api/kirkpatrick/interventions` (S7). */
export interface InterventionList {
  kpi: { total: number; pending: number; up: number; down: number }
  rows: InterventionRow[]
}

/** #9 `POST /api/kirkpatrick/interventions` body. */
export interface InterventionInput {
  studentId: number
  alertType: AlertType
  actionDate: string
  alertDescription: string
  actionTaken: string
  beforeAccuracy?: number | null
  afterAccuracy?: number | null
  beforeMood?: Mood | null
  afterMood?: Mood | null
}

/** #10 `GET /api/kirkpatrick/students/:id` (S8). */
export interface StudentKirkpatrick {
  student: { id: number; name: string; schoolName: string; grade: number | null }
  activeDays: number
  answers: number
  accuracy: number
  konsistensi: number
  streak: number
  strongest: { subjectName: string; accuracy: number } | null
  weakest: { subjectName: string; accuracy: number } | null
  headcount: { year: number; rows: { subjectName: string; tov: number | null }[] }
  platform: { subjectName: string; accuracy: number; answers: number }[]
}

/** #11 `GET /api/kirkpatrick/me` (S9). */
export interface MyKirkpatrick {
  /** `null` when the viewer has no headcount TOV in the current year. */
  headcount: { year: number; rows: { subjectName: string; tov: number | null }[] } | null
  /** 30 days, today - 29 ... today; `date` is `dd/mm`. */
  days: { date: string; answers: number }[]
}

/** #12 `GET /api/feedback/status` (S10). */
export interface FeedbackStatus {
  /** `YYYY-MM`. */
  month: string
  answered: boolean
}

/** DATA-M12-01. */
export interface FeedbackResponse {
  id: number
  userId: number
  role: string
  /** The respondent's school at response time (the school filter of Q-M12-T1, XR-M17-21). */
  schoolId: number | null
  month: string
  nps: number
  satisfaction: number
  createdAt: string
}

/** #13 `POST /api/feedback` body. */
export interface FeedbackInput {
  nps: number
  satisfaction: number
}
