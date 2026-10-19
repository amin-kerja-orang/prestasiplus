/**
 * Row types of the M04 stores (SRS v1.10 §6.1–§6.3). Owner: M04 (D12). Other modules receive these
 * shapes from the `questions`, `structured` and `reports` repositories and never define their own.
 *
 * Timestamps are ISO-8601 strings with the fixed `+08:00` offset (`toIsoMyt`), so they sort as text.
 * Question rows also carry `createdAtMs` (epoch ms, the dataset's fast "newest first" key).
 */

export type QuestionStatus =
  | 'draft'
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'archived'
  /** PKSK rows only (M07 BR-M07-02). */
  | 'pending'

export type QuestionType = 'mcq' | 'true_false' | 'short_answer' | 'fill_blank' | 'essay'
export type ComplianceStatus = 'verified' | 'pending_mapping' | 'quarantined' | 'rejected' | 'draft'
export type SourceType = 'textbook' | 'dskp' | 'trial' | 'marking_scheme' | 'ai_generated'
export type QualityBucket = 'unscored' | 'cemerlang' | 'baik' | 'le50'
export type ScriptType = 'rumi' | 'arab' | 'jawi' | 'mixed'
export type TextDirection = 'ltr' | 'rtl'
export type PkskTargetLevel = 'T1' | 'T4'
export type Language = 'bm' | 'en'

export interface PkskOption {
  text: string
  isCorrect: boolean
}

export interface AiExplanation {
  markdown: string
  generatedAt: string
}

export interface QuestionUsage {
  attempts: number
  correct: number
}

/** The count-relevant fields of a question (the dataset facets, SRS §6.13.1). */
export type QuestionFacets = {
  subjectId: number | null
  educationLevelId: number | null
  pkskDomainId: number | null
  pkskTargetLevel: PkskTargetLevel | null
  status: QuestionStatus
  isActive: boolean
  questionType: QuestionType
  /** SPM scope attribute (BR-M04-32). */
  spmPool: boolean
  difficultyLevel: number
  complianceStatus: ComplianceStatus
  aiVerified: boolean
  sourceType: SourceType | null
  /** `sourceFile ≠ null` (`missing_source` filter). */
  hasSourceFile: boolean
  /** `dskpSpId ≠ null` (`dskp_filter`). */
  dskpTagged: boolean
  /** Named SPs with observed availability, the pair's generic SP, or null (untagged). */
  dskpSpId: number | null
  needsDiagram: boolean
  qualityBucket: QualityBucket
  legacyGeneric: boolean
  curriculumChapterId: number | null
  createdBy: number
  teacherDatabank: boolean
  /** Outside the M17 S10 coverage matrix (Q-M17-COV; BR-M04-38, XL3-11). */
  coverageExcluded: boolean
  /**
   * School of the active teacher a generated contribution is credited to (Q-TEACHER-CONTRIB,
   * BR-M04-38 c): 8087, 8107, 8880, 8090 (`createdBy` = the M02 anchors 4501–4504), or the
   * sentinel **0** = "the other active teachers" (7,565 rows; no school or teacher id is published
   * for them, so `createdBy` stays the placeholder 5801 and 0 is not a school id); `null` = not a
   * teacher contribution.
   */
  contribSchoolId: number | null
}

export type QuestionFacetKey = keyof QuestionFacets

/** Cheap derived fields: pure functions of `(key, facets)`, filterable, sortable and searchable. */
export interface QuestionCheapFields {
  questionText: string
  sourceFile: string | null
  hasExplanation: boolean
  qualityScore: number | null
  createdAt: string
  createdAtMs: number
  chapterLabel: string | null
  curriculumTopicId: number | null
  usageAttempts: number
}

/** DATA-M04-01 Question (objective bank, SPM pool rows and PKSK rows). */
export interface Question extends QuestionFacets, QuestionCheapFields {
  id: number
  scriptType: ScriptType
  textDirection: TextDirection
  pkskOptions: PkskOption[] | null
  questionImage: string | null
  /** MCQ: 4 strings ("" allowed for C/D from import); null for other types and PKSK rows. */
  options: string[] | null
  optionImages: (string | null)[]
  correctAnswer: number | null
  tfAnswer: boolean | null
  correctAnswerText: string | null
  altAnswers: string[]
  modelAnswer: string | null
  explanation: string | null
  aiExplanation: AiExplanation | null
  language: Language
  pointsValue: number
  sourcePage: number | null
  sourceSet: string | null
  updatedAt: string
  usage: QuestionUsage
}

export type QuestionCheapKey = keyof QuestionCheapFields

// ---------------------------------------------------------------------------------------------
// Structured questions (DATA-M04-02 / DATA-M04-03)
// ---------------------------------------------------------------------------------------------

export type StructuredStatus = 'published' | 'draft'

export interface StructuredRubric {
  konstruk: string
  keyword: string
  marks: number
}

export interface StructuredSubQuestion {
  id: number
  structuredQuestionId: number
  partLabel: string
  questionText: string
  marks: number
  answerType: 'text' | 'numeric'
  expectedNumeric: number | null
  numericTolerance: number | null
  rubrics: StructuredRubric[]
  modelAnswer: string
  parentSubId: number | null
  order: number
}

export type StructuredFacets = {
  subjectId: number
  educationLevelId: number
  kbatLevel: number
  status: StructuredStatus
  isActive: boolean
  needsDiagram: boolean
  /** As `QuestionFacets.contribSchoolId` (Q-TEACHER-CONTRIB structured part). */
  contribSchoolId: number | null
}

export interface StructuredCheapFields {
  createdAt: string
  createdAtMs: number
  updatedAt: string
  updatedAtMs: number
  createdBy: number
  stimulus: string
}

export interface StructuredQuestion extends StructuredFacets, StructuredCheapFields {
  id: number
  estimatedMinutes: number
  isTrial: boolean
  topic: string | null
  questionNumber: number | null
  stimulusImage: string | null
  totalMarks: number
  visibility: 'public'
  complianceStatus: ComplianceStatus
  sourceFile: string | null
  sourcePage: number | null
  sourceSet: string | null
  curriculumChapterId: number | null
  curriculumTopicId: number | null
  dskpSpId: number | null
  scriptType: ScriptType
  textDirection: TextDirection
  questionTemplate: 'eksperimen' | null
  subQuestions: StructuredSubQuestion[]
}

export type StructuredFacetKey = keyof StructuredFacets
export type StructuredCheapKey = keyof StructuredCheapFields

// ---------------------------------------------------------------------------------------------
// Reports (DATA-M04-04)
// ---------------------------------------------------------------------------------------------

export type ReportStatus = 'pending' | 'reviewed' | 'fixed' | 'dismissed'
export type ReportQuestionType = 'mcq' | 'structured'
export type ReportSource =
  | 'spm'
  | 'structured_attempt'
  | 'latihan'
  | 'revision'
  | 'teacher_databank'
  | 'quiz'
  | 'papan_bijak'

export interface QuestionReport {
  id: number
  questionType: ReportQuestionType
  questionId: number
  reporterId: number
  reasons: string[]
  comment: string | null
  source: ReportSource
  quizSessionId: string | null
  roomCode: string | null
  /** Seed-only provenance label of the live reports (e.g. `trial`); null for runtime reports. */
  sourceSet: string | null
  status: ReportStatus
  adminNotes: string | null
  createdAt: string
  updatedAt: string
}

// ---------------------------------------------------------------------------------------------
// Jutawan questions (DATA-M04-12) and import runs (DATA-M04-07, §6.13.5)
// ---------------------------------------------------------------------------------------------

export type JutawanFacets = {
  subjectId: number
  educationLevelId: number
  difficultyLevel: number
}

export interface JutawanQuestion extends JutawanFacets {
  id: number
  questionText: string
  options: string[]
  correctAnswer: number
  explanation: string | null
  isActive: true
}

/** A Jutawan row as drawn for play: no answer key (BR-M04-37). */
export type KeylessJutawanQuestion = Omit<JutawanQuestion, 'correctAnswer' | 'explanation'>

/** A question as drawn for games and battles (M16): no answer keys (SRS §7.1). */
export type KeylessQuestion = Omit<
  Question,
  | 'correctAnswer'
  | 'tfAnswer'
  | 'correctAnswerText'
  | 'altAnswers'
  | 'modelAnswer'
  | 'explanation'
  | 'aiExplanation'
  | 'pkskOptions'
> & { pkskOptions: { text: string }[] | null }

export interface ImportRun {
  id: number
  fileName: string
  importedCount: number
  failedCount: number
  failures: { row: number; message: string }[]
  defaults: {
    subjectId: number | null
    educationLevelId: number | null
    difficultyLevel: number | null
  }
  createdBy: number
  createdAt: string
  /** `YYYY-MM` of `createdAt` (Q-IMPORT-MONTH). */
  createdMonth: string
}
