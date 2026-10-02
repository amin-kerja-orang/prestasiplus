/**
 * M08 API types (SRS M08 v1.11 §7; build-plan M08-T1, §S.3 rule 5). Response bodies are the `data`
 * of the envelope. The headcount endpoints #12–#17 and #24–#29 are typed by M08-T1b (`api/headcount*`).
 * UI tasks import these and do not change this file. Percentages are numbers 0–100 (the display cap of
 * FR-M08-124 is applied by the server on accuracies that are shown); GPS values have 2 decimals.
 */

export type Grade = 'A+' | 'A' | 'A-' | 'B+' | 'B' | 'C+' | 'C' | 'D' | 'E' | 'G'
export type GpsBand = 'Cemerlang' | 'Baik' | 'Sederhana' | 'Perlu Perhatian'
export type Letter = 'A' | 'B' | 'C' | 'D'
export type DifficultyLevel = 'Mudah' | 'Sederhana' | 'Sukar'
export type RiskLevel = 'critical' | 'high' | 'medium' | 'low'
export type Trend = 'up' | 'down' | 'stable'

// ---------------------------------------------------------------------------------------------
// #1 GET /api/performance/school (S1)
// ---------------------------------------------------------------------------------------------

export interface SchoolPerformance {
  scope: 'platform' | 'school'
  header: { classCount: number; studentCount: number }
  stats: {
    students: number
    teachers: number
    classes: number
    subjects: number
    sessions: number
    answered: number
    /** Q-SESS-MEAN-ACC, 1 decimal. */
    accuracy: number
  }
  gps: { value: number | null; band: GpsBand | null; entries: number }
  distribution: { grade: Grade; count: number; pct: number }[]
  trend: {
    /** One row per history year plus the current year (`gps` null, "Tiada data"). `change` = gps − previous year's gps (null for the first and the current year). */
    years: {
      year: number
      gps: number | null
      band: GpsBand | null
      candidates: number | null
      source: string | null
      change: number | null
      current: boolean
    }[]
    chart: {
      labels: number[]
      overall: (number | null)[]
      subjects: { name: string; color: string; data: (number | null)[] }[]
    }
  }
  subjects: {
    subjectId: number
    name: string
    gps: number | null
    grade: Grade | null
    entries: number
    onTrack: number
    below: number
    noTarget: number
    achievementPct: number | null
  }[]
  levels: {
    code: 't4' | 't5'
    accuracy: number
    classes: number
    students: number
    sessions: number
  }[]
  teachers: {
    userId: number
    name: string
    classCount: number
    studentCount: number
    accuracy: number
    onTrack: number | null
    below: number | null
  }[]
}

// ---------------------------------------------------------------------------------------------
// #2, #3 (S2, S3)
// ---------------------------------------------------------------------------------------------

export interface LevelCard {
  code: 't4' | 't5'
  name: string
  classes: number
  students: number
}

export interface LevelClassRow {
  classId: number
  kind: 'classroom' | 'school_class'
  name: string
  /** "Tiada Subjek" when the class has none; "Kelas Sekolah" for school classes. */
  subject: string
  teacher: string | null
  students: number
  sessions: number
  accuracy: number
  onTrack: number
  below: number
  /** `/prestasi/kelas/{id}` for classrooms, null for school classes (DV-06). */
  href: string | null
}

export interface LevelDetail {
  code: 't4' | 't5'
  name: string
  classes: number
  students: number
  subjects: number
  accuracy: number
  sessions: number
  onTrack: number
  below: number
  onTrackPct: number
  classRows: LevelClassRow[]
  topStudents: {
    userId: number
    name: string
    sessions: number
    answered: number
    accuracy: number
  }[]
  atRisk: {
    userId: number
    name: string
    className: string
    checkpoint: number
    ar: number
    target: number
    gap: number
  }[]
}

// ---------------------------------------------------------------------------------------------
// #4 GET /api/performance/classes (S4) and #10 GET /api/item-analysis/classes (S10)
// ---------------------------------------------------------------------------------------------

export interface ClassCard {
  id: number
  name: string
  subjectName: string | null
  color: string
  students: number
  year: number
  joinCode: string
  isActive: boolean
}

// ---------------------------------------------------------------------------------------------
// #6 GET /api/performance/students/:userId (S6)
// ---------------------------------------------------------------------------------------------

export interface WeakTopic {
  spId: number
  label: string
  code: string | null
  subjectCode: string
  levelId: number | null
  attempts: number
  accuracy: number
  focusCount: number
}

export interface StudentPerformance {
  user: { id: number; name: string; initial: string }
  heroAccuracy: number
  streak: number
  stats: { sessions: number; accuracy: number; answered: number; seconds: number }
  headcount: {
    configId: number
    subject: string
    className: string
    year: number
    status: 'on' | 'below' | 'none'
    tov: number | null
    chips: { label: string; value: number | null; tone: 'on' | 'below' | 'none' }[]
    etr: number | null
  }[]
  mastery: {
    subjectCode: string
    subjectName: string
    color: string
    accuracy: number
    sessions: number
    answered: number
  }[]
  activity: { streakCurrent: number; streakBest: number; koinTotal: number; practiceDays: number }
  badges: { icon: string; name: string }[]
  heatmap: { date: string; sessions: number }[]
  weakTopics: WeakTopic[]
  suggestions: { kind: string; text: string }[]
}

// ---------------------------------------------------------------------------------------------
// #7 GET /api/analytics/me (S7)
// ---------------------------------------------------------------------------------------------

export interface WeakSp {
  spId: number
  code: string
  title: string
  subjectName: string
  subjectCode: string
  answered: number
  accuracy: number
  available: number
  focusCount: number
}

export interface AnalyticsSubject {
  subjectId: number
  name: string
  code: string
  accuracy: number
  answered: number
  trend: Trend
  projection: { low: Grade; high: Grade }
  counts: { mahir: number; sederhana: number; lemah: number; belum: number }
  ringTotal: number
  weak: WeakSp[]
  map: {
    caption: string
    tiles: {
      spId: number
      code: string
      title: string
      status: 'mahir' | 'sederhana' | 'lemah' | 'belum'
    }[]
  }
}

export interface Analytics {
  userLevelId: number | null
  topWeak: WeakSp[]
  subjects: AnalyticsSubject[]
}

// ---------------------------------------------------------------------------------------------
// #9 GET /api/item-analysis/school[/:schoolId] (S9)
// ---------------------------------------------------------------------------------------------

export interface SchoolItemQuestion {
  rank: number
  questionId: number
  stem: string
  subjectName: string
  chips: string[]
  level: DifficultyLevel
  wrongPct: number
  attempts: number
  pupils: number
  pupilsPct: number
  wrongPupils: { userId: number; name: string; classLabel: string; wrongOption: Letter }[]
  correctOption: { letter: Letter; text: string }
  popularWrongOption: { letter: Letter; text: string } | null
  popularWrongCount: number
}

export interface SchoolItemAnalysis {
  school: {
    id: number
    name: string
    code: string | null
    type: string
    district: string | null
    state: string
  }
  /** "" = the route without a school id (own school), else the id copy variant (FR-M08-60 / 143). */
  variant: 'own' | 'byId'
  tingkatan: 'T4' | 'T5' | null
  students: number
  /** null = no header for this view: its question list is observed but no header figure is (D11, DV-M08-32). */
  answers: number | null
  correct: number | null
  accuracy: number | null
  difficulty: { mudah: number; sederhana: number; sukar: number }
  gps: {
    value: number | null
    band: GpsBand | null
    entries: number
    years: { year: number; gps: number }[]
  }
  subjects: {
    subjectId: number
    name: string
    pupils: number
    questions: number
    accuracy: number
    wrong: number
  }[]
  questions: SchoolItemQuestion[]
}

// ---------------------------------------------------------------------------------------------
// #11 GET /api/item-analysis/classes/:id (S11)
// ---------------------------------------------------------------------------------------------

export interface ItemAnalysis {
  questionCount: number
  summary: { mudah: number; sederhana: number; sukar: number }
  difficulty: {
    questionId: number
    text: string
    subject: string
    topic: string | null
    subtopic: string | null
    attempts: number
    students: number
    accuracy: number
    index: number
    level: DifficultyLevel
    wrongStudents: { userId: number; name: string; times: number }[]
    correctOption: { letter: Letter; text: string }
    popularWrong: { letter: Letter; text: string; times: number } | null
  }[]
  discrimination: {
    sufficient: boolean
    rows: {
      questionId: number
      text: string
      upperPct: number
      lowerPct: number
      index: number
      status: 'Sangat Baik' | 'Baik' | 'Sederhana' | 'Lemah'
    }[]
  }
}

export interface ClassItemAnalysis {
  class: {
    id: number
    name: string
    subjectName: string | null
    levelSlug: string
    year: number
    students: number
  }
  analysis: ItemAnalysis
}

// ---------------------------------------------------------------------------------------------
// #18–#20 Timeline and the public profile (S16–S18)
// ---------------------------------------------------------------------------------------------

export type TimelineCategory = 'sijil' | 'pencapaian' | 'aktiviti' | 'cerita' | 'lain'

export interface TimelinePost {
  id: number
  userId: number
  title: string
  category: TimelineCategory
  eventDate: string | null
  story: string | null
  photos: { url: string; caption: string | null }[]
  createdAt: string
}

export interface Timeline {
  profileUrl: string
  posts: TimelinePost[]
}

/** #19 body fields (multipart `title`, `category`, `eventDate?`, `story?`, `photos[]`, `captions[i]?`). */
export interface TimelineInput {
  title: string
  category: TimelineCategory
  eventDate?: string
  story?: string
  photos: File[]
  captions?: string[]
}

export interface PublicProfile {
  id: number
  name: string
  firstName: string
  schoolName: string | null
  levelName: string
  joinedAt: string
  daysWith: number
  tier: {
    /** M14 tier key (bronze, silver, gold, platinum); the page maps it to the live label. */
    key: string
    name: string
    emoji: string
    level: number
    /** 1-based position of the tier by minSyiling (Bronze 1 ... Platinum 4); the S18 "Tahap" (INFERRED). */
    ordinal: number
    progressPct: number
    toNext: number | null
    nextName: string | null
    /** Key of the next tier, or null at the top. */
    nextKey: string | null
  }
  syiling: number
  streak: { current: number; best: number }
  accuracy: number
  activity: { sessions: number; practiceDays: number; correct: number; bestStreak: number }
  posts: TimelinePost[]
}

// ---------------------------------------------------------------------------------------------
// #21, #22 Ranking and leaderboard (S19, S20)
// ---------------------------------------------------------------------------------------------

export type RankingScope = 'nasional' | 'negeri' | 'daerah' | 'sekolah'

export interface Ranking {
  scope: RankingScope | null
  title: string
  showFooter: boolean
  states: string[]
  rows: {
    rank: number
    userId: number | null
    name: string
    schoolName: string
    tahap: number
    correct: number
    accuracy: number
  }[]
  total: number
}

export type LeaderboardPeriod = 'all' | 'week' | 'month'

export interface Leaderboard {
  period: LeaderboardPeriod
  me: { rank: number | null; coins: number; sessions: number; accuracy: number }
  rows: {
    rank: number
    userId: number | null
    name: string
    avatarUrl: string | null
    coins: number
    sessions: number
    accuracy: number
  }[]
  participants: number
}

// ---------------------------------------------------------------------------------------------
// #5 GET /api/performance/classes/:id (S5) and #8 GET /api/analytics/classes (S8): TYPES ONLY.
// The handlers of these two endpoints are not in M08-T1's scope (build-plan §2.7a lists #1–#4, #6, #7,
// #9–#11, #18–#23); they are assigned to no task yet (reported), and M08-T7 needs them.
// ---------------------------------------------------------------------------------------------

export interface ClassDashboard {
  class: {
    id: number
    name: string
    school: string
    subject: string | null
    year: number
    joinCode: string
  }
  stats: {
    students: number
    accuracy: number
    sessions: number
    answered: number
    avgMinutes: number
    active7d: number
  }
  headcount: {
    configId: number
    onTrack: number
    below: number
    noData: number
    pct: { on: number; below: number; none: number }
    avgTov: number | null
    avgEtr: number | null
  } | null
  attention: { userId: number; name: string; sessions: number; accuracy: number | null }[]
  trend: { date: string; sessions: number; avgAccuracy: number; activeStudents: number }[]
  ranking: {
    rank: number
    userId: number
    name: string
    sessions: number
    answered: number
    accuracy: number | null
    headcount: 'on' | 'below' | 'na'
    lastActiveAt: string | null
  }[]
}

export interface ClassAnalytics {
  options: {
    classes: { id: number; name: string }[]
    subjects: { id: number; name: string }[]
    selected: { classroomId: number | null; subjectId: number | null; riskLevel: RiskLevel | '' }
  }
  summary: { students: number; accuracy: number; atRisk: number; good: number } | null
  rows: {
    userId: number
    name: string
    accuracy: number
    answered: number
    trend: Trend
    projection: { low: Grade; high: Grade }
    riskLevel: RiskLevel
  }[]
}
