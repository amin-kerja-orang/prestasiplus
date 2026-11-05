/**
 * M10 API types (SRS M10 v1.18 §6, §7 #1, #11–#17, #35–#44, #51–#60, #63, #73–#75; build-plan M10-T1).
 * UI tasks read this file and do not change it (build-plan §S.3 rule 5). JSON is camelCase; times are
 * ISO 8601 with `+08:00`; ids of subjects, levels and chapters are the M03 integers; class ids are the
 * live / runtime class ids (`classId` of the store), with the `kind` beside them.
 *
 * The other M10 endpoints (#2–#10 M10-T3, #18–#34, #45–#50, #59–#72) are typed by the tasks that build
 * them.
 */

/** DATA-M10-01 `educationLevel` (BR-M10-03). */
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

export type ClassroomKind = 'classroom' | 'school_class'

// ---------------------------------------------------------------------------------------------
// #1 GET /api/guru/dashboard (S1)
// ---------------------------------------------------------------------------------------------

export interface GuruDashboard {
  /** BR-M10-05. */
  checklist: { hasClass: boolean; hasStudents: boolean; hasMission: boolean }
  /** BR-M10-06. `assignments` is always 0 (no assignment entity, OQ-M10-11). */
  stats: {
    activeClasses: number
    totalClasses: number
    students: number
    questions: number
    questionsApproved: number
    assignments: number
  }
  /** Always empty in the prototype (FR-M10-11, L-M10-01). */
  today: { students: never[]; topics: never[]; actions: never[] }
  /** Always empty (FR-M10-12, L-M10-01). */
  peerTutor: never[]
  /** The viewer's active classes (FR-M10-13). */
  classes: { id: number; name: string; studentCount: number }[]
  /** Always empty (FR-M10-13, OQ-M10-11). */
  submissions: never[]
}

// ---------------------------------------------------------------------------------------------
// #11 GET /api/guru/remedial-progress (S3)
// ---------------------------------------------------------------------------------------------

export type RemedialStatus = 'active' | 'completed' | 'cancelled'

export interface RemedialProgress {
  /** BR-M10-13. */
  stats: { total: number; completed: number; students: number; avgImprovement: number }
  rows: {
    id: number
    studentName: string
    subjectName: string
    status: RemedialStatus
    beforeAccuracy: number
    afterAccuracy: number | null
  }[]
}

// ---------------------------------------------------------------------------------------------
// #12–#14 classes (S4, S5)
// ---------------------------------------------------------------------------------------------

/** DATA-M10-01 Classroom plus the S4 fields. */
export interface GuruClass {
  id: number
  kind: ClassroomKind
  teacherId: number | null
  schoolId: number | null
  name: string
  subjectId: number | null
  /** `null` = "Tiada Subjek". */
  subjectName: string | null
  educationLevel: EducationLevelSlug
  levelId: number
  /** "Tahun n" / "Ting. n". */
  levelLabel: string
  academicYear: number
  description: string | null
  joinCode: string
  isActive: boolean
  createdAt: string
  /** Active enrolments (BR-M10-04). */
  studentCount: number
}

export interface CreateClassRequest {
  /** Sent as a string id in http mode (`ClassCreateRequestSchema`, DEMO-FIX-1 D-01). */
  schoolId?: number | string | null
  name: string
  /** The `<select>` value or a mock number; sent as a string id in http mode. */
  subjectId: number | string
  educationLevel: EducationLevelSlug
  description?: string | null
}

export interface ClassQrData {
  name: string
  /** School name, or `null` when the class has none. */
  school: string | null
  /** BR-M10-02: `https://prestasiplus.my/kelas-saya?kod={code}` (PROPOSED). */
  joinUrl: string
}

// ---------------------------------------------------------------------------------------------
// #15–#17 students (S6)
// ---------------------------------------------------------------------------------------------

export type StudentTab = 'mine' | 'school'

export interface GuruStudent {
  id: number
  name: string
  /** M03 level name of the student's grade, or `null`. */
  levelName: string | null
  /** The viewer's own classes the student is actively enrolled in (names are not unique). */
  classNames: string[]
  /**
   * The same classes with their ids, in the order of `classNames` (SW5-03). Absent on an API that
   * predates the field: the page then falls back to the names.
   */
  classes?: GuruStudentClass[]
}

/** One class chip of a student row: the id tells two classes with the same name apart. */
export interface GuruStudentClass {
  id: number
  name: string
}

export interface GuruStudentsMeta {
  /** Students matching the tab and search (the school tab returns at most 200 rows). */
  count: number
  /** Whether the teacher profile has a school (BR-M10-30). */
  schoolSet: boolean
}

export interface ClassroomStudent {
  classroomKind: ClassroomKind
  classroomId: number
  studentId: number
  status: 'active' | 'removed'
  source: 'code' | 'teacher' | 'school_admin' | 'complimentary'
  joinedAt: string
}

// ---------------------------------------------------------------------------------------------
// #35–#44 chapters, topics, DSKP (S16, S18, S22)
// ---------------------------------------------------------------------------------------------

export interface ChapterOption {
  id: number
  chapterNumber: number | null
  name: string
}

export interface TopicOption {
  id: number
  topicNumber: string | null
  name: string
}

/** A create that failed answers `200 {error}` as live (#36, #38, #42–#44). */
export interface ErrorBodyLive {
  error: string
}

export interface BidangOption {
  id: number
  code: string | null
  name: string
}

export interface SkOption {
  id: number
  code: string
  description: string
}

export type SpOption = SkOption

// ---------------------------------------------------------------------------------------------
// #51–#58 contributions and questions (S21–S24)
// ---------------------------------------------------------------------------------------------

export interface ContributionTier {
  name: string
  threshold: number
  /** Font Awesome class (`fa-seedling`, …), resolved by `AppIcon` (BR-05). */
  icon: string
  reached: boolean
}

export interface Contributions {
  /** Jumlah / Diluluskan / Menunggu / Digunakan (BR-M10-21). */
  stats: { total: number; approved: number; pending: number; used: number }
  tiers: ContributionTier[]
  /** BR-M10-23: `null` when every tier is reached (UNVERIFIED). */
  nextTier: { name: string; threshold: number } | null
  /** "Pecahan Subjek": top 10 subjects + "Lain", all by count descending. */
  breakdown: { label: string; count: number }[]
}

/** The teacher form is multiple choice only (FR-GUR-44-9, API-GUR-18). */
export type QuestionType = 'mcq'
/** The teacher's three status words (FR-GUR-44-10): Menunggu Semakan / Diluluskan / Ditolak. */
export type QuestionStatus = 'pending' | 'approved' | 'rejected'
export type ScriptType = 'rumi' | 'arab' | 'jawi' | 'mixed'

/** One card of "Soalan Saya" (FN-M10-7.1.8). */
export interface ContributedQuestion {
  id: number
  questionType: QuestionType
  questionText: string
  subjectId: number | null
  subjectName: string
  educationLevelId: number | null
  /** M03 level name ("Darjah 6"). */
  levelName: string
  /** Kesukaran 1 (Sangat mudah) to 5 (Sangat sukar); never derived from TP. */
  difficultyLevel: number
  dskpTagged: boolean
  status: QuestionStatus
  /** The admin's reason of a `rejected` item ("Sebab: {reason}"); `null` otherwise. */
  rejectionReason: string | null
  /** Edit and Padam show only when true (a rejected item can be editable). */
  editable: boolean
  isActive: boolean
  options: string[] | null
  /** Index 0–3 of the correct option (MCQ). */
  correctAnswer: number | null
  explanation: string | null
  /** Source shown in the open card (`sourceSet`, else `sourceType`), or `null`. */
  source: string | null
  createdAt: string
}

/** #54: the summary plus the S23 / S24 fields and the usage statistics. */
export interface ContributedQuestionDetail extends ContributedQuestion {
  questionImage: string | null
  optionImages: (string | null)[]
  language: 'bm' | 'en'
  scriptType: ScriptType
  textDirection: 'ltr' | 'rtl'
  /** DSKP fields of 44-F1; `null` / empty when the item was sent without them. */
  chapterId: number | null
  spIds: number[]
  tp: number | null
  cognitiveLevel: string | null
  /** Kali Digunakan / Jawab Betul / Ketepatan (FN-M10-7.3.3). */
  usage: { attempts: number; correct: number; accuracy: number }
}

/** #53 request (API-GUR-18 `QuestionGuruCreateRequest`, camelCase). MCQ only. */
export interface CreateQuestionRequest {
  educationLevelId: number
  subjectId: number
  questionType: 'mcq'
  /** Kesukaran, an int 1 to 5 (required). */
  difficultyLevel: number
  questionText: string
  /** The four option texts A–D. */
  options: string[]
  /** The correct option index 0–3. */
  correctAnswer: number
  explanation?: string
  /** Bab; required iff the Subjek + Tingkatan has chapters (D112). */
  chapterId?: number | null
  /** One SP (the form is a single select) sent as a one-element array; required iff DSKP nodes exist. */
  spIds?: number[]
  /** TP 1 to 6; required iff DSKP nodes exist. */
  tp?: number | null
  /** Aras Pemikiran (OPT-ARAS); required iff DSKP nodes exist. */
  cognitiveLevel?: string | null
  scriptType?: ScriptType
}

/** #55 request. */
export interface UpdateQuestionRequest {
  questionText: string
  /** Kesukaran 1 to 5; the edit form preselects the saved value. */
  difficultyLevel?: number
  /** MCQ only: `id` is the option index 0–3. */
  options?: { id: number; optionText: string }[]
  correctOptionId?: number
  explanation?: string | null
}

export interface ImportFailure {
  /** Spreadsheet row number (the header is row 1). */
  row: number
  message: string
}

/** API-GUR-19: valid rows were imported, bad rows are listed under `errors`. */
export interface ImportResult {
  imported: number
  errors: ImportFailure[]
}

// ---------------------------------------------------------------------------------------------
// #73–#74 student "Kelas Saya" (S33)
// ---------------------------------------------------------------------------------------------

export interface JoinedClass {
  id: number
  name: string
  subjectName: string | null
  teacherName: string | null
  levelLabel: string
}

export interface JoinClassResponse {
  data: { classroomId: number }
  message: string
}

// ---------------------------------------------------------------------------------------------
// #75 GET /api/set-soalan-saya (S34)
// ---------------------------------------------------------------------------------------------

/** One row of "Set Soalan Guru" (FR-M10-73). */
export interface StudentQuestionSet {
  id: number
  title: string
  teacherName: string | null
  questionCount: number
  /** `null` = no limit. */
  timeLimitMinutes: number | null
  /** `maxAttempts` minus the completed attempts (BR-M10-18); `null` = unlimited attempts. */
  attemptsLeft: number | null
}

// ---------------------------------------------------------------------------------------------
// #59, #60 gallery and question papers (S21, S22)
// ---------------------------------------------------------------------------------------------

/** #59: always empty (DV-M10-09); `images` answers a `?folder=` request. */
export interface RajahGallery {
  folders?: never[]
  images?: never[]
}

/** OPT-JENIS-HANTARAN stored slugs (the labels are in `paper-rules.ts`). */
export type PaperType =
  'umum' | 'trial' | 'dskp' | 'buku_teks' | 'buku_latihan' | 'peperiksaan' | 'lain'

/** API-GUR-17 request fields (the files travel apart). */
export interface QuestionPaperRequest {
  paperType: PaperType
  /** "Matapelajaran", free text, at most 100 characters. */
  subject: string
  /** Tingkatan 1–5, or empty. */
  levelId?: number | ''
  /** 2000–2099, or empty. */
  year?: number | ''
  /** "Disediakan Oleh", at most 150 characters. */
  preparedBy?: string
  /** "Catatan Tambahan", at most 1000 characters. */
  note?: string
  /** The teacher confirms the answer scheme is attached; must be `true`. */
  answerSchemeConfirmed: boolean
}

/** API-GUR-17 `data`: the id of the `source = guru` intake batch. */
export interface QuestionPaper {
  batchId: number | string
}
