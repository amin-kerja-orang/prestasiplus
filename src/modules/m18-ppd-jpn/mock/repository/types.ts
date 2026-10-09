/**
 * Row types and read models of the M18 mock (SRS M18 v1.8 §6.2, §6.5, §6.7).
 */

export type InterventionType =
  | 'kaunseling'
  | 'kelas_tambahan'
  | 'tugasan_khas'
  | 'hubungi_ibubapa'
  | 'mentor_rakan'
  | 'bimbingan'
  | 'lain'

export type InterventionStatus = 'done' | 'planned'

export type Effectiveness = 'belum_dinilai' | 'berkesan' | 'sederhana' | 'tidak_berkesan'

/** DATA-M18-01 AmaranIntervention. */
export interface AmaranInterventionRow {
  id: number
  studentId: number
  teacherId: number
  schoolId: number
  classroomId: number | null
  type: InterventionType
  /** `YYYY-MM-DD`. */
  interventionDate: string
  status: InterventionStatus
  notes: string
  followUp: string | null
  effectiveness: Effectiveness
  createdAt: string
  updatedAt: string
}

/** DATA-M18-04 CorrectionSubject (`id` = `"{schoolId}:{subjectId}"`). */
export interface CorrectionSubjectRow {
  id: string
  schoolId: number
  subjectId: number
  /** "Order as stored" (BR-M18-16): position within the school's rows. */
  position: number
  pupils: number
  pupilsWeak: number
  questions: number | null
  accuracy: number | null
  accuracyBefore: number | null
  accuracyAfter: number | null
  avgLevel: number | null
}

/** BR-M18-14 statuses: Hijau "On Track", Kuning "Perlu Perhatian", Merah "Berisiko Tinggi". */
export type RiskStatus = 'on_track' | 'watch' | 'high'

/** The tingkatan filter of the S22 / S28 pills (`T4` / `T5`). */
export type Tingkatan = 4 | 5

/** The consumer contract XR-M27-08: `onTrack` = Hijau, `watch` = Kuning, `high` = Merah. */
export interface RiskTally {
  total: number
  onTrack: number
  watch: number
  high: number
}

export interface PupilClassRef {
  kind: 'classroom' | 'school_class'
  id: number
  name: string
  level: string
}

/** One pupil's risk (BR-M18-13) with the inputs behind it. */
export interface PupilRiskRow {
  userId: number
  name: string
  schoolId: number
  /** 1–11 (Darjah 1–6 = 1–6, Tingkatan 1–5 = 7–11), or null. */
  grade: number | null
  isActive: boolean
  /** 0–100, one decimal. */
  score: number
  status: RiskStatus
  /** Mean practice-session accuracy in percent (unrounded), or null without a completed session. */
  accuracy: number | null
  sessions: number
  /** The stored activity date (M01 / M02 `lastActiveAt`), or null. */
  lastActiveAt: string | null
  /** Whole days since `lastActiveAt` at the evaluation clock, or null. */
  daysSinceActive: number | null
  /** Mean mastery level over the pupil's records, or null without records. */
  masteryMean: number | null
  masteryRecords: number
  /** The three components (BR-M18-13). */
  a: number
  e: number
  m: number
  /** No session, no `lastActiveAt`, no mastery record (the score-80 case, BR-M18-15). */
  neverActive: boolean
  /** Active classes of the pupil (any owner), by class id ascending. */
  classes: PupilClassRef[]
  /** Level numbers (4 / 5) of the pupil's classes (the S22 / S28 `tingkatan` filter is class based). */
  classTingkatan: Tingkatan[]
}

/** #21 `PupilRisk` (§6.7) plus the fields S4 needs (M27 FR-M27-76). */
export interface PupilRiskView {
  rank: number
  userId: number
  /** Alias of `userId` (M27 S4 contract). */
  studentId: number
  name: string
  /** "Tingkatan n" / "Darjah n" from the grade, or null. */
  levelLabel: string | null
  /** Tingkatan number from the grade (1-5), or null for primary pupils. */
  tingkatan: number | null
  /** First class name, or null when the pupil is in no class. */
  className: string | null
  classLabel: string
  score: number
  status: RiskStatus
  /** Mean session accuracy in percent (1 decimal), or null. */
  accuracy: number | null
  /** `lastActiveAt` as `yyyy-mm-dd`, or null. */
  engagement: string | null
  /** Mean mastery level (1 decimal), or null. */
  mastery: number | null
  accuracyText: string
  engagementText: string
  masteryText: string
}

/** BR-M18-16 subject weakness row. */
export interface SubjectRiskRow {
  subjectId: number
  subjectName: string
  weak: number
  total: number
  pct: number
}

/** §6.7 `RiskTally` of the endpoints (`green` / `yellow` / `red` + integer percentages). */
export interface RiskTallyView {
  green: number
  yellow: number
  red: number
  total: number
  pct: { green: number; yellow: number; red: number }
}

export type RiskScope =
  | { kind: 'school'; schoolId: number }
  | { kind: 'district'; district: string; state: string }
  | { kind: 'state'; state: string }

export interface RiskOptions {
  /** Epoch ms of the evaluation; default the app clock (the project clock in the mock). */
  now?: number
  /** Only pupils in classes of this level (FN-M18-4.6.1). */
  tingkatan?: Tingkatan
}
