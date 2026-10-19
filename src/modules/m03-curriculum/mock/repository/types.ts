/**
 * Row types of the M03 curriculum stores (SRS v1.8 §6.1–6.7). Owner: M03 (D12). Other modules
 * receive these shapes from the `curriculum*` repositories; they never define their own copy.
 *
 * Timestamps are ISO-8601 strings. Seeded rows carry `SEED_TIMESTAMP` (live creation times were not
 * captured, and no M03 screen shows them).
 */

/** DATA-M03-01 `stage`. */
export type Stage = 'primary' | 'lower_secondary' | 'upper_secondary'

/** DATA-M03-06 `gradeLevel` (BR-13). */
export type GradeCode =
  | 'DARJAH_1'
  | 'DARJAH_2'
  | 'DARJAH_3'
  | 'DARJAH_4'
  | 'DARJAH_5'
  | 'DARJAH_6'
  | 'TINGKATAN_1'
  | 'TINGKATAN_2'
  | 'TINGKATAN_3'
  | 'TINGKATAN_4'
  | 'TINGKATAN_5'

/** DATA-M03-06 `subject` (BR-13, 8 codes). */
export type LegacySubjectCode =
  | 'MATEMATIK'
  | 'BAHASA_MELAYU'
  | 'BAHASA_INGGERIS'
  | 'SAINS'
  | 'PENDIDIKAN_ISLAM'
  | 'PENDIDIKAN_MORAL'
  | 'SEJARAH'
  | 'GEOGRAFI'

/** DATA-M03-01 EducationLevel. */
export interface EducationLevelRow {
  id: number
  code: string
  name: string
  nameEn: string
  stage: Stage
  curriculum: string
  order: number
  isActive: boolean
  /** M01 `grade` link (BR-17): 1–11 for the seeded levels, `null` for levels created later. */
  grade: number | null
  createdAt: string
  updatedAt: string
}

/** DATA-M03-02 Subject, without its level links (they live in the `subjectLevels` pivot). */
export interface SubjectRow {
  id: number
  code: string
  name: string
  nameEn: string
  /** Free text: Lucide name, Font Awesome class or emoji (BR-05); `null` when empty. */
  icon: string | null
  color: string
  isCore: boolean
  order: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

/** DATA-M03-02 Subject as the repository returns it: the row plus its linked level ids. */
export interface Subject extends SubjectRow {
  /** Linked levels in BR-08 level order. */
  educationLevelIds: number[]
}

/** Pivot `SubjectLevel {subjectId, educationLevelId}`; `id` = `"{subjectId}:{educationLevelId}"`. */
export interface SubjectLevelRow {
  id: string
  subjectId: number
  educationLevelId: number
}

/**
 * DATA-M03-03 CurriculumChapter. `inTree = false` marks the 60 out-of-tree chapters (SRS v1.10
 * §6.9, XL3-24): only they may have a `null` level and name; no tree read returns them.
 */
export interface ChapterRow {
  id: number
  subjectId: number
  educationLevelId: number | null
  name: string | null
  nameEn: string | null
  chapterNumber: number | null
  description: string | null
  inTree: boolean
  isActive: boolean
  /** Creation order (seed = dataset order), the BR-08 tie-break. */
  createdSeq: number
  createdAt: string
  updatedAt: string
}

/** DATA-M03-04 CurriculumTopic. */
export interface TopicRow {
  id: number
  chapterId: number
  name: string
  nameEn: string | null
  topicNumber: string | null
  description: string | null
  learningStandard: string | null
  isActive: boolean
  createdSeq: number
  createdAt: string
  updatedAt: string
}

/** DATA-M03-05 CurriculumSubtopic. */
export interface SubtopicRow {
  id: number
  topicId: number
  name: string
  nameEn: string | null
  learningObjective: string | null
  createdSeq: number
  createdAt: string
  updatedAt: string
}

/** DATA-M03-06 LegacyTopic (student catalogue). */
export interface LegacyTopicRow {
  id: number
  gradeLevel: GradeCode
  subject: LegacySubjectCode
  name: string
  description: string | null
  /** Peta Belajar emoji; seeded only where observed (discovery Appendix B.6). */
  icon: string | null
  sequence: number
}

/** DATA-M03-06 LegacySubtopic. */
export interface LegacySubtopicRow {
  id: number
  legacyTopicId: number
  name: string
  description: string | null
  order: number
}

/** DATA-M03-07 LearnerTopicProgress (derived on read, BR-19; never stored). */
export interface LearnerTopicProgress {
  legacyTopicId: number
  sessions: number
  questionsAnswered: number
  correct: number
  /** 0–100. */
  progress: number
}

/**
 * The seed fixture `mock/data/curriculum.json`, written by
 * `scripts/fixtures/build-m03-curriculum.ts` (ids, DV-M03-09 and legacy-topic rules applied there).
 * `isActive` and timestamps are added by the seed.
 */
export interface CurriculumFixture {
  source: string
  generatedBy: string
  levels: Omit<EducationLevelRow, 'createdAt' | 'updatedAt'>[]
  subjects: Omit<SubjectRow, 'createdAt' | 'updatedAt'>[]
  /** `[subjectId, educationLevelId]`. */
  subjectLevels: [number, number][]
  chapters: Omit<ChapterRow, 'isActive' | 'createdAt' | 'updatedAt'>[]
  topics: Omit<TopicRow, 'isActive' | 'createdAt' | 'updatedAt'>[]
  subtopics: Omit<SubtopicRow, 'createdAt' | 'updatedAt'>[]
  legacyTopics: LegacyTopicRow[]
  legacySubtopics: LegacySubtopicRow[]
}

/** SRS §7 #13 `ChapterNode`. */
export interface ChapterNode extends ChapterRow {
  topics: (TopicRow & { subtopics: SubtopicRow[] })[]
}

/** SRS §7 #13 tree `stats` (BR-06: active and inactive records). */
export interface TreeStats {
  chapters: number
  topics: number
  subtopics: number
}
