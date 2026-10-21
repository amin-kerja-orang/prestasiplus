/** M06 API types (SRS M06 v1.4 §6, §7). JSON camelCase; dates ISO 8601 +08:00. */

export type TargetType = 'spm' | 'custom' | 'latihan'
export type SetStatus = 'bersih' | 'bank_besar' | 'belum_cukup'
export type MockStatus = 'in_progress' | 'submitted'
export type MockGrade = 'A+' | 'A' | 'B+' | 'B' | 'C' | 'D' | 'E' | 'G'
export type HeroClass = 'good' | 'mid' | 'bad'

/**
 * An entity id: a number in the in-browser mock, an opaque string on the real API (BE-41, UD-1;
 * subject ids and question ids are decimal strings, a mock exam id is a uuid). Never parse it.
 */
export type WireId = number | string

/** #1 `GET /api/spm/overview` (S1). */
export interface SpmOverview {
  stats: {
    totalQuestions: number
    subjectCount: number
    yearsAvailable: number
    trackingAQuestions: number
  }
  modules: { databank: number; latihTubi: number; trackingA: number; subjektifSets: number }
  me: { sessions: number; avgAccuracy: number; coins: number; answered: number }
}

/** `GET /api/education-levels` item, the fields S4 reads (M03 owns the full shape). */
export interface EducationLevel {
  id: WireId
  /** 10 = Tingkatan 4, 11 = Tingkatan 5 (SPM levels); null for levels without a grade. */
  grade: number | null
}

/** #2 row (S2). */
export interface DatabankSubject {
  code: string
  name: string
  nameEn: string
  icon: string | null
  color: string
  databankCount: number
}

/** #3 card (S3). */
export interface LatihTubiCard {
  code: string
  name: string
  nameEn: string
  icon: string | null
  color: string
  total: number
  targetType: TargetType | null
  targetSize: number | null
  locked: boolean
}
export interface LatihTubiList {
  teras: LatihTubiCard[]
  elektif: LatihTubiCard[]
}

/**
 * #4 (S4). Level keys are the education level ids of Tingkatan 4 and Tingkatan 5: the M03 ids 10 and
 * 11 in the mock, the `education_levels` id strings on the real API (BE-41 open question 7).
 */
export interface LatihTubiConfig {
  code: string
  name: string
  icon: string | null
  color: string
  total: number
  targetType: TargetType | null
  targetSize: number | null
  levelCounts: Record<string, number>
  /** Difficulty 1-5 -> count. */
  difficultyStats: Record<'1' | '2' | '3' | '4' | '5', number>
  difficultyByLevel: Record<string, Record<'1' | '2' | '3' | '4' | '5', number>>
  countOptions: { value: number; label: string; isTarget: boolean }[]
  defaultCount: number
}

export interface OpenSubjectCard {
  subjectId: WireId
  code: string
  name: string
  nameEn: string
  icon: string | null
  color: string
  /** Σ readyCount of the startable sets. */
  readyQuestions: number
  bankBesarSets: number
  bersihSets: number
  targetType: TargetType | null
  targetSize: number | null
  /** Σ bankSource of the bank-besar sets, or null. */
  bankSource: number | null
  startableSets: number
}

export interface ReadinessTile {
  code: string
  name: string
  targetSize: number
  bersih: number
  bankBesar: number
  locked: number
  total: number
  /** round((bersih + bankBesar) / total x 100), 0 without sets. */
  readiness: number
  /** First 6 locked sets. */
  lockedSets: { setNo: number; readyCount: number; target: number }[]
  hasBankBesar: boolean
}
export interface Readiness {
  summary: { bersih: number; bankBesar: number; locked: number }
  tiles: ReadinessTile[]
}

/** #5 (S5). `readiness` is null for non-admins (BR-M06-30). */
export interface TrackingAHub {
  objectiveLane: { subjects: number; sets: number; questions: number }
  bahasaLane: { subjects: 2; sets: number }
  readiness: Readiness | null
  /** `icon` and `color` are sent by the mock and the real API although S5 does not use them. */
  bahasa: {
    subjectId: WireId
    code: string
    name: string
    nameEn: string
    sets: number
    icon?: string | null
    color?: string
  }[]
  openSubjects: OpenSubjectCard[]
}

export interface TrackingASetCard {
  setNo: number
  status: SetStatus
  readyCount: number
  bankSource: number | null
  dskpTagged: number
  dskpTotal: number
}

/** #6 (S6) or the BM/BI redirect. */
export interface TrackingASubject {
  code: string
  name: string
  icon: string | null
  color: string
  targetType: TargetType | null
  targetSize: number | null
  summary: { bersih: number; bankBesar: number; readyQuestions: number; belumCukup: number }
  sets: TrackingASetCard[]
}
export type TrackingASubjectResult = TrackingASubject | { redirect: string }

/** #7 (S8). */
export interface SubjektifOverview {
  stats: {
    setsAnswered: number
    subjectsTried: number
    /** Best attempt percentage (rounded) or null ("Belum Ada"). */
    bestScore: number | null
    bestSetsSaved: number
  }
  subjects: {
    subjectId: WireId
    name: string
    nameEn: string
    group: 'teras' | 'elektif'
    icon: string | null
    color: string
    sets: number
  }[]
}

// --- mock exams ------------------------------------------------------------------------------

export interface MockListItem {
  id: WireId
  subject: string
  paperNumber: 1 | 2
  status: MockStatus
  createdAt: string
  score: number | null
  maxScore: number
  percent: number | null
  grade: MockGrade | null
}

/** #14: no answer keys (provisional shape, L-8). */
export interface MockExamView {
  id: WireId
  subject: string
  paperNumber: 1 | 2
  status: MockStatus
  createdAt: string
  items: { no: number; text: string; options?: string[]; maxMarks: number }[]
}

export interface MockItem {
  no: number
  questionId: WireId
  text: string
  options?: string[]
  /** P1: a letter. P2: the model answer. */
  modelAnswer: string
  studentAnswer: string | null
  marks: number | null
  maxMarks: number
  feedback: string | null
  topic: string
}

/** #15 / #16. */
export interface MockResult {
  id: WireId
  subject: string
  paperNumber: 1 | 2
  score: number
  maxScore: number
  percent: number
  grade: MockGrade
  heroClass: HeroClass
  weakTopics: { topic: string; wrongCount: number }[]
  items: MockItem[]
}

export interface MockAnswerInput {
  no: number
  answer: string
}

/** #17 (shape kept as live for the page script). */
export type WalkthroughResponse = { ok: true; walkthrough: string } | { ok: false; error: string }

/** Provisional M24 contract (`GET /api/duta/recommendations`, SRS M06 §6.8). */
export interface DutaCard {
  slug: string
  name: string
  initials: string
  tier: 'bintang' | 'inspirasi' | 'tetamu'
  tagline: string
  subject: string
  state: string
  rating: number
  active: boolean
}
