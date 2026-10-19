/**
 * Row types of the M10 shared stores (SRS M10 v1.15 §6.2–§6.9, DATA-M10-01/02/04/05/09/10; F-30).
 * Integer ids where live shows them; datetimes ISO 8601 with +08:00; dates `YYYY-MM-DD`.
 */

/** `classroom` = created by a teacher (S4/S5); `school_class` = the "Kelas Sekolah" rows of M08 S3. */
export type ClassroomKind = 'classroom' | 'school_class'

export type EducationLevelSlug =
  | 'tahun-1'
  | 'tahun-2'
  | 'tahun-3'
  | 'tahun-4'
  | 'tahun-5'
  | 'tahun-6'
  | 'tingkatan-1'
  | 'tingkatan-2'
  | 'tingkatan-3'
  | 'tingkatan-4'
  | 'tingkatan-5'

/** The record key of a class: (`kind`, `id`), never the bare id (XL2-24, XL2-44). */
export interface ClassRef {
  kind: ClassroomKind
  id: number
}

/** DATA-M10-01 Classroom. `id` is the store key `"{kind}:{classId}"`; use `classId` for the live id. */
export interface ClassroomRow {
  id: string
  kind: ClassroomKind
  /** The live / runtime class id (the `{n}` of `sc-{n}` for a school class). */
  classId: number
  name: string
  /** Owner; `null` for school classes. */
  teacherId: number | null
  schoolId: number | null
  /** `null` = "Tiada Subjek". */
  subjectId: number | null
  educationLevel: EducationLevelSlug
  /** M03 level id derived from the slug (`tahun-n` → n, `tingkatan-n` → 6 + n; BR-M10-03). */
  levelId: number
  academicYear: number
  description: string | null
  joinCode: string
  isActive: boolean
  createdAt: string
}

export type EnrolmentStatus = 'active' | 'removed'
export type EnrolmentSource = 'code' | 'teacher' | 'school_admin' | 'complimentary'

/**
 * DATA-M10-02 ClassroomStudent. `id` is the store key `"{kind}:{classroomId}:{studentId}"`, unique per
 * (`classroomKind`, `classroomId`, `studentId`). `educationLevel` / `levelId` are denormalised from
 * the class for the level cards (M08 T4 149 / T5 3,911).
 */
export interface EnrolmentRow {
  id: string
  classroomKind: ClassroomKind
  classroomId: number
  /** `"{classroomKind}:{classroomId}"` = the `id` of the class row (indexed). */
  classKey: string
  studentId: number
  status: EnrolmentStatus
  source: EnrolmentSource
  joinedAt: string
  educationLevel: EducationLevelSlug
  levelId: number
}

/** DATA-M10-10 DSKP. */
export interface DskpBidangRow {
  id: number
  subjectId: number
  educationLevelId: number
  code: string | null
  name: string
  createdBy: number | null
}

export interface DskpSkRow {
  id: number
  bidangId: number
  code: string
  description: string
  createdBy: number | null
}

export interface DskpSpRow {
  id: number
  skId: number
  code: string
  description: string
  createdBy: number | null
}

export type MissionType = 'latih_tubi' | 'tracking_a' | 'youtube'

/** DATA-M10-04 Mission. */
export interface MissionRow {
  id: number
  teacherId: number
  title: string
  missionType: MissionType
  /** `bank_soalan` for every type (DV-M10-02). */
  missionSource: 'bank_soalan'
  /** `YYYY-MM-DD`. */
  missionDate: string
  subjectId: number
  /** `null` = "Semua Bab". */
  chapterId: number | null
  questionCount: number
  coinsPerCorrect: number
  resourceTitle: string | null
  resourceUrl: string | null
  resourceNote: string | null
  /** The BR-M10-04 students at launch (XL2-42). */
  recipientIds: number[]
  createdAt: string
}

export type RemedialStatus = 'active' | 'completed' | 'cancelled'

/** DATA-M10-09 RemedialTest. */
export interface RemedialTestRow {
  id: number
  teacherId: number
  studentId: number
  subjectId: number
  subjectCode: string
  subjectName: string
  questionIds: number[]
  totalQuestions: number
  status: RemedialStatus
  beforeAccuracy: number
  afterAccuracy: number | null
  createdAt: string
  completedAt: string | null
}

export type QuestionSetStatus = 'draft' | 'scheduled' | 'published'

/** DATA-M10-05 QuestionSet. */
export interface QuestionSetRow {
  id: number
  teacherId: number
  classroomKind: ClassroomKind
  classroomId: number
  /** Derived from the class subject (the M05 seam reads it). */
  subjectId: number | null
  title: string
  description: string | null
  groupTag: string | null
  timeLimitMinutes: number | null
  maxAttempts: number
  status: QuestionSetStatus
  scheduledAt: string | null
  questionIds: number[]
  createdAt: string
}

/** The viewer of `remedialTests.get` (the caller resolves it from the session). */
export interface Viewer {
  id: number
  role: string
}
