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

/**
 * Where a question came from, handed to `QuestionsService.createFromIntake` (BE-38 accept-to-Draf; US-16). Ids are decimal
 * strings. `sourceType` goes on the question; the others on its first version.
 */
export interface QuestionProvenance {
  sourceType: StoreSourceType
  numberLabel: string | null
  sourcePage: number | null
  /** `{ page, x, y, w, h }` of the question on the source page. */
  sourceRegion: unknown
  sourcePaperId: string | null
  intakeItemId: string | null
  sourceFileId: string | null
  aiRunId: string | null
  aiModel: string | null
  /**
   * Paper code of the source paper when it ends in `/<digit>` (`1449/2`): stored verbatim as `paper_code`, which is where the
   * paper builder reads the kertas. Optional; when absent the flat `kertas` of the input (if any) decides.
   */
  paperCode?: string | null
}

/** Who performs a write. `role` is the ACTIVE role of the session. */
export interface QuestionActor {
  userId: string
  role: 'admin' | 'teacher'
}

export interface NamedRef {
  id: string
  name: string
}

/** The seven stimulus kinds served from the store (`audio` is stored but never served as a stimulus). */
export const STIMULUS_KINDS = ['passage', 'image', 'diagram', 'table', 'map', 'infographic', 'graph'] as const
export type StimulusKind = (typeof STIMULUS_KINDS)[number]

export interface StimulusRecord {
  id: string
  kind: StimulusKind
  label: string
  bodyMs: string | null
  bodyEn: string | null
  assetFileId: string | null
  alt: string | null
  /** R1-T07: figure caption. */
  caption?: string | null
  /** R1-T07: source line of a passage or picture. */
  sourceCitation?: string | null
  /** R1-T07: table grid as stored (`{ head, rows }` for a `table`); unvalidated JSON, read defensively by the consumers. */
  tableData?: unknown
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
  /** DSKP KBAT of the question (null = Bukan KBAT); leaf parts may override. */
  kbat: 'mengaplikasi' | 'menganalisis' | 'menilai' | 'mencipta' | null
  tagReview: boolean
  catalogueVersion: string | null
  /** 1..6 (the flat wire clamps 6 to 5). */
  difficultyTp: number | null
  sourcePage: number | null
  setLabel: string | null
  sourceFile: string | null
  /** 1..3 `question_version_sp_nodes`, in insertion order. */
  spIds: string[]
  /** `question_version_stimuli`, ordered by `position`. */
  stimulusIds: string[]
  /** File id of the first image stimulus linked to this version: the flat stem image (null when none). */
  stemImageId?: string | null
  /** `question_versions.paper_code`; the paper builder reads the kertas from its trailing digit. */
  paperCode?: string | null
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
  /** Legacy `pool` tag present (kept for compatibility; no serving path reads it since R1-B06, see `QuestionFilter.spmPool`). */
  spmPool: boolean
  /** BE-42: the PKSK tags (`pksk_domain` code, `pksk_level`) when the question is a PKSK question, else null. */
  pksk?: { domainCode: string; level: 'T1' | 'T4' } | null
  createdAt: Date
  updatedAt: Date
  version: QuestionVersionRecord
}

/** A record with the curriculum names resolved by the service (CurriculumRepository). */
export interface QuestionView extends QuestionRecord {
  subject: NamedRef | null
  level: NamedRef | null
  /** Internal file id to public token for the images of this question (stem and options). */
  imageTokens?: Record<string, string>
  /** Name of the curriculum chapter of the version (the admin "Bab" label), or null. */
  chapterName?: string | null
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
  tagReview?: boolean
  missing?: 'unit' | 'tp' | 'marks' | 'key'
  /** V2 Studio filters (R1-21.5, D79): year, state or examining body, kertas and exam type of the source paper. */
  tahun?: string
  negeri?: string
  kertas?: '1' | '2' | '3'
  jenis?: 'sebenar' | 'percubaan' | 'modul' | 'topikal' | 'latihan'
  complianceFilter?: string
  sourceFilter?: string
  search?: string
  /** Keyset paging for `listIds`: only ids below this one (then `page` is ignored and no offset is used). */
  idBelow?: string
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
  /** Any of these levels (ANDed with `educationLevelId` when both are set); `[]` matches nothing. */
  educationLevelIds?: readonly string[]
  unitId?: string
  /** Curriculum chapter of the version (`question_versions.chapter_id`). */
  chapterId?: string
  spId?: string
  tp?: number
  difficultyTp?: number
  /** Any of these TPs (ANDed with `tp` / `difficultyTp` when both are set); `[]` matches nothing. */
  difficultyTps?: readonly number[]
  /** Status of the LIVE version when set; counts of `published` use the live version. */
  status?: QuestionStatus
  /** `true` keeps only questions with `is_active`; `eligibleIds` / `sample` always force it. */
  active?: boolean
  excludeIds?: readonly string[]
  type?: StoreQuestionType
  /** R1-B06: `true` = SPM-servable (shared `SPM_SERVABLE_SQL`: offered level T4/T5, linked active subject), NOT the legacy `pool` tag; `false` = the complement. */
  spmPool?: boolean
  /**
   * `true`: only questions outside any stimulus group (`questions.group_id IS NULL`), the practice, games and battle servable
   * shape. A single-leaf MCQ that sits inside a stimulus group is therefore no longer served by the SPM pool, battle or games.
   */
  ungrouped?: boolean
  /**
   * Only questions whose live version has the plain servable MCQ shape: exactly one part, an `mcq` leaf, no stimulus on the
   * version or the part, between `minOptions` and `maxOptions` options, no option image, and a key naming one of the options.
   * `maxOptions: 4` is the battle / games shape (key index always 0..3). In `sampleIds` it is checked only on a window of
   * hash-ordered candidates (never on the whole subject).
   */
  mcqShape?: { minOptions: number; maxOptions: number }
  /** Only versions with exactly one part and that part an `mcq` leaf (what the SPM pool's `mcqItemOf` accepts; no stimulus or image rule). */
  singleMcqLeaf?: boolean
  /** Any of these chapters (ANDed with `chapterId` when both are set); `[]` matches nothing. */
  chapterIds?: readonly string[]
  /** Only ids in this list (`q.id = ANY(...)`): "which of these are still eligible". `[]` matches nothing. */
  idIn?: readonly string[]
  /** Keyset: only ids strictly above this one (use with `eligibleIdsPage`, ascending id). */
  idAfter?: string
}
export type SampleFilter = QuestionFilter
export type GroupCountBy = 'subject' | 'level' | 'status' | 'difficultyTp' | 'unit' | 'chapter'

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
  /** Set by paths that bypass the BE-10 lifecycle (bulk-action): `setStatus` then writes the status event itself. */
  event?: { actorUserId: string; actorRole: string; requestId: string | null }
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
