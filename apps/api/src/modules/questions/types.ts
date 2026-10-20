/**
 * Question bank (M04, BE-09): the frozen public types of `QuestionsRepository` and `QuestionsService`.
 * Part C (controllers), BE-10 (workflow), BE-12/15/18/41 (practice, Bijak) and BE-17 code against this
 * file. Ids are decimal strings everywhere (contract `IdSchema`); the repository converts to bigint.
 * Nothing here carries a `legacy_*` value.
 */
import type {
  QuestionBulkRequestSchema,
  QuestionCreateRequestSchema,
  QuestionCurriculumTagSchema,
  QuestionGuruCreateRequestSchema,
  QuestionGuruUpdateRequestSchema,
  QuestionPart,
  QuestionPublicSchema,
  QuestionStatus,
  QuestionUpdateRequestSchema,
} from '@pp/contract'
import type { z } from 'zod'

export type { QuestionPart, QuestionStatus }

/** The parsed bodies the controllers hand to the service (contract schemas, already validated). */
export type QuestionCreateInput = z.output<typeof QuestionCreateRequestSchema>
export type QuestionUpdateInput = z.output<typeof QuestionUpdateRequestSchema>
export type QuestionGuruCreateInput = z.output<typeof QuestionGuruCreateRequestSchema>
export type QuestionGuruUpdateInput = z.output<typeof QuestionGuruUpdateRequestSchema>
export type QuestionBulkAction = z.output<typeof QuestionBulkRequestSchema>['action']
export type QuestionTag = z.output<typeof QuestionCurriculumTagSchema>
/** What a learner may see (`QuestionPublicSchema`): never a key, explanation, model answer or source. */
export type PublicQuestion = z.output<typeof QuestionPublicSchema>

/** `questions.source_type` (v2 store). The wire `sourceType` is mapped from it by the projection. */
export const STORE_SOURCE_TYPES = ['pdf', 'excel', 'manual', 'ai_variant'] as const
export type StoreSourceType = (typeof STORE_SOURCE_TYPES)[number]

/** `question_versions.type`. */
export const STORE_QUESTION_TYPES = ['mcq', 'match', 'short', 'structured', 'working', 'essay', 'drawing', 'table'] as const
export type StoreQuestionType = (typeof STORE_QUESTION_TYPES)[number]

export type ViewMode = 'live' | 'latest'

/** Who performs a write. `role` is the ACTIVE role of the session. */
export interface QuestionActor {
  userId: string
  role: 'admin' | 'teacher'
}

export interface NamedRef {
  id: string
  name: string
}

export interface StimulusRecord {
  id: string
  kind: 'diagram' | 'passage' | 'table'
  label: string
  bodyMs: string | null
  bodyEn: string | null
  assetFileId: string | null
  alt: string | null
}

export interface StimulusGroupRecord {
  id: string
  /** At most 3, ordered by `position`. */
  stimuli: StimulusRecord[]
  optionBank: { label: string; bodyMs: string | null; bodyEn: string | null }[]
  /** Member question ids in `group_position` order. */
  questionIds: string[]
}

/** One row of `question_versions` with its children, ordered. */
export interface QuestionVersionRecord {
  id: string
  versionNo: number
  status: QuestionStatus
  archiveReason: 'superseded' | 'withdrawn' | 'source_takedown' | null
  publishedAt: Date | null
  type: StoreQuestionType
  stemMs: string | null
  stemEn: string | null
  numberLabel: string | null
  language: 'ms' | 'en' | 'ms_en' | 'ar' | 'jawi'
  explanationMs: string | null
  explanationEn: string | null
  subjectId: string | null
  educationLevelId: string | null
  unitId: string | null
  chapterId: string | null
  topicId: string | null
  formOrigin: 't1_t3' | 't4' | 't5'
  cognitiveLevel: number | null
  /** 1..6 (the flat wire clamps 6 to 5). */
  difficultyTp: number | null
  sourcePage: number | null
  setLabel: string | null
  sourceFile: string | null
  /** 1..3 `question_version_sp_nodes`, in insertion order. */
  spIds: string[]
  /** `question_version_stimuli`, ordered by `position`. */
  stimulusIds: string[]
  /** The part tree (keys included): admin/owner only; never hand it to a learner. */
  parts: QuestionPart[]
  createdAt: Date
  updatedAt: Date
}

/** A question with the version selected by the `ViewMode` it was read with. */
export interface QuestionRecord {
  id: string
  isActive: boolean
  sourceType: StoreSourceType | null
  createdById: string | null
  latestVersionNo: number
  liveVersionNo: number | null
  groupId: string | null
  groupPosition: number | null
  /** `question_tags` kind `pool` present (flat `spmPool`). */
  spmPool: boolean
  createdAt: Date
  updatedAt: Date
  version: QuestionVersionRecord
}

/** A record with the curriculum names resolved by the service (CurriculumRepository). */
export interface QuestionView extends QuestionRecord {
  subject: NamedRef | null
  level: NamedRef | null
}

/** Admin detail: DSKP chain (unit/sk/sp) and creator name resolved through the owners' repositories. */
export interface QuestionDetailView extends QuestionView {
  dskp: {
    bidang: { id: string; code: string | null; name: string }
    sk: { id: string; code: string; description: string }
    sp: { id: string; code: string; description: string }
  } | null
  createdByName: string | null
  stimulusGroup: StimulusGroupRecord | null
}

export interface Page<T> {
  rows: T[]
  page: number
  pageSize: number
  total: number
}

export interface AdminListFilter {
  page: number
  pageSize: number
  subjectId?: string
  educationLevelId?: string
  difficultyLevel?: string
  status?: QuestionStatus
  dskpFilter?: string
  complianceFilter?: string
  sourceFilter?: string
  search?: string
}

/** Admin list page plus `meta.counts` (rows per status over the whole filter, status keys of the contract). */
export interface AdminListResult extends Page<QuestionView> {
  counts: Record<QuestionStatus, number>
}

export interface QuestionSummaryView {
  total: number
  subjects: { id: string; name: string; icon: string | null; group: 'teras' | 'elektif'; total: number; approved: number }[]
}

/** Filter shared by `count`, `groupCount`, `eligibleIds` and `sample` (other modules: BE-12, 15, 18, 41). */
export interface QuestionFilter {
  subjectId?: string
  educationLevelId?: string
  unitId?: string
  spId?: string
  tp?: number
  difficultyTp?: number
  /** Status of the LIVE version when set; counts of `published` use the live version. */
  status?: QuestionStatus
  /** `true` keeps only questions with `is_active`; `eligibleIds` / `sample` always force it. */
  active?: boolean
  excludeIds?: readonly string[]
  type?: StoreQuestionType
}
export type SampleFilter = QuestionFilter
export type GroupCountBy = 'subject' | 'level' | 'status' | 'difficultyTp' | 'unit'

export interface GuruListFilter {
  ownerId: string
  page: number
  pageSize: number
}

export interface StructuredListFilter {
  subjectId?: string
  educationLevelId?: string
  kbatLevel?: string
  page: number
  pageSize: number
}

export interface StructuredStats {
  total: number
  published: number
  bySubject: { name: string; count: number }[]
}

export interface StructuredListResult extends Page<QuestionView> {
  stats: StructuredStats
}

/** What `getStatus` returns to BE-10. */
export interface QuestionStatusInfo {
  id: string
  /** Status of the LATEST version (what the admin sees). */
  status: QuestionStatus
  latestVersionNo: number
  liveVersionNo: number | null
  isActive: boolean
  createdById: string | null
}

/** Options of `setStatus` beyond the three frozen positional arguments (all optional). */
export interface SetStatusOptions {
  /** Default `admin`. `owner_teacher` is for BE-10 when a Guru moves their own question. */
  actor?: 'admin' | 'owner_teacher'
  /** Stored by BE-10 in `question_status_events`; BE-09 ignores it. */
  reason?: string | null
}

/** One answer of a learner, addressed by the part path (labels joined with `.`, e.g. `a.i`). */
export type PartAnswerValue =
  | { kind: 'option'; label: string }
  | { kind: 'text'; text: string }
  | { kind: 'number'; value: number; unit?: string }
  | { kind: 'mapping'; map: Readonly<Record<string, string>> }
  | { kind: 'cells'; cells: Readonly<Record<string, string>> }
export interface PartAnswer {
  /** Omit for a question with a single leaf. */
  path?: string
  value: PartAnswerValue
}

/** `needs_review`: a subjective or unchecked mode; BE-14 (`@pp/exam-core`) marks it, never a score here. */
export type GradeResult =
  | { kind: 'graded'; correct: boolean; marks: number; maxMarks: number }
  | { kind: 'needs_review'; maxMarks: number }

export interface QuestionGrade {
  questionId: string
  parts: { path: string; result: GradeResult }[]
  marks: number
  maxMarks: number
  needsReview: boolean
}

export interface ContributionCounts {
  total: number
  byStatus: Record<QuestionStatus, number>
}
