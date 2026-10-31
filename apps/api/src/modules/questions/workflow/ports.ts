/**
 * Ports of the question workflow (BE-10). BE-10 owns the lifecycle rules, reports, imports, quality
 * audit and the like, but not the question tables: `questions`, `question_versions`, parts and tags
 * belong to BE-09 (`QuestionsService`, `QuestionsRepository`). The workflow therefore talks to the
 * question bank only through `QuestionBankPort`, and never imports from `modules/questions/*` outside
 * `workflow/`.
 *
 * Until BE-09 is merged and wired, the default is an EMPTY question bank: every id is unknown (the
 * service answers 404) and every list is empty, so the API boots and the routes answer sensibly.
 * BE-09 (or the app wiring that merges both) replaces it once:
 *
 * ```ts
 * @Module({ imports: [QuestionWorkflowModule], providers: [QuestionBankAdapter] })
 * export class QuestionsWiringModule implements OnModuleInit {
 *   constructor(private readonly ports: QuestionWorkflowPorts, private readonly bank: QuestionBankAdapter) {}
 *   onModuleInit() { this.ports.provideQuestionBank(this.bank) }
 * }
 * ```
 *
 * The services read `ports.questionBank` on every call, so the swap needs no restart order.
 * Registering twice is a wiring error and throws.
 *
 * Contract of the port (applies to every method):
 *  - ids are decimal strings (the wire id); an unknown id is `null` / `false` / absent from a map,
 *    never an exception: the service decides the 404.
 *  - BE-10 decides whether a transition is allowed (table, role, reason, gates) BEFORE it calls
 *    `setStatus`; the adapter may check again and throw (`ApiError` 409), BE-10 lets it propagate.
 *  - The adapter runs inside the transaction BE-10 opened (the Prisma transaction is ambient), so a
 *    status change, its `question_status_events` row and a report update commit or roll back together.
 */
import { Injectable } from '@nestjs/common'
import type { QuestionPart, QuestionWorkflowActor, QuestionWorkflowStatus } from '@pp/contract'

/** What `getStatus` returns (mirrors BE-09 `QuestionStatusInfo`). */
export interface QuestionStatusInfo {
  id: string
  /** Status of the LATEST version (what the admin sees). */
  status: QuestionWorkflowStatus
  latestVersionNo: number
  /** The version served to learners; null when none is live. */
  liveVersionNo: number | null
  /** Eligibility = live version published AND is_active (BE-09 decision Q-2). */
  isActive: boolean
  /** Owner (Guru ownership); null when the owner account was deleted. */
  createdById: string | null
}

/**
 * Everything the three gates of v2-question-bank 4.8 read, for the LATEST version of a question.
 * A field the bank cannot know yet (for example the duplicate flag before BE-38) is `null` /
 * `false` / `[]`; a gate treats `null` as "not satisfied" only where its rule says so.
 */
export interface QuestionGateData {
  id: string
  /** Parts tree (contract `QuestionPart`): the key checks of `checkKeysGate` run on it. */
  parts: QuestionPart[]
  /** `marks` of the question: must equal the sum of the part marks (approve gate). */
  marks: number | null
  subjectId: string | null
  educationLevelId: string | null
  chapterId: string | null
  /** The unit node of the curriculum tree (D53h: tags are curriculum nodes only). */
  unitId: string | null
  /** SP nodes (1 to 3). */
  spIds: string[]
  /** `difficulty_tp`, 1 to 6. */
  tp: number | null
  /** E-rights_status, or null when no declaration was made. */
  rightsStatus: string | null
  /** True when a source declaration (source paper, contributor or kind) is present. */
  hasSourceDeclaration: boolean
  /** Fields still flagged low-confidence and not yet confirmed by a person (BE-38 intake). */
  unconfirmedLowConfidenceFields: string[]
  /** An open duplicate flag that is not marked "Bukan pendua". */
  hasOpenDuplicateFlag: boolean
  /** True when every stimulus / figure reference resolves to an uploaded file. */
  mediaResolved: boolean
  /** Required fields of the question type that are empty (field names); empty = complete. */
  missingRequiredFields: string[]
  /** True when the last editor is the AI service (the approve gate refuses an AI reviewer). */
  lastEditedByAi: boolean
}

export interface SetStatusOptions {
  /** Default `admin`. `owner_teacher` when a Guru moves their own question. */
  actor?: QuestionWorkflowActor
  /** Mandatory for return to Draf, withdraw and restore; BE-10 validates it. */
  reason?: string | null
  /** Optional hint for BE-09 when it archives: stored as `question_versions.archive_reason`. */
  archiveReason?: 'withdrawn' | 'source_takedown'
  /**
   * Lost-update guard (BE-10): the status of the targeted version that BE-10 read inside its transaction. The adapter updates
   * conditionally (or row-locks) and, when the version's status is no longer this, throws
   * `ApiError` CONFLICT (409) without changing anything. Omitted = no guard.
   */
  expectedFrom?: QuestionWorkflowStatus
  /**
   * Which version to move. `latest` (default) is the newest version. `live` is the version served
   * to learners (`liveVersionNo`), used to archive/withdraw it while a newer draft exists; the
   * latest version is left alone unless it is the live one. No-op when nothing is live.
   */
  target?: 'latest' | 'live'
}

/** One question to create from an Excel/CSV row (BE-10 imports, an MCQ). */
export interface ImportedQuestionInput {
  stemMs: string
  /** Options in order; labels are A, B, C, D (the mock template). */
  options: { label: string; text: string }[]
  correctLabel: string
  subjectId: string | null
  educationLevelId: string | null
  /** The legacy 1 to 5 scale of the mock; the adapter maps it to `difficulty_tp` (OQ-DM-20). */
  difficultyLevel: number | null
  explanation: string | null
  /** Always `excel` for BE-10 (the pdf and AI sources are BE-38). */
  sourceType: 'excel'
  /** The importing user; becomes the owner (`created_by_id`). */
  createdById: string
  /** Admin import: `draft` (or `review` when the admin chose to submit). Guru import: `draft`. */
  status: 'draft' | 'review'
  /** Free-text source label of the row (mock `sourceSet`), if the file had one. */
  sourceSet: string | null
  /** `marks` column of the row (mock `pointsValue`, default 1); optional so older callers compile. */
  marks?: number
  /** Optional `kertas` column (1 to 3); stored so the paper builder can find the question. */
  kertas?: '1' | '2' | '3'
}

/** Display facts about a question for lists (reports, master notes). */
export interface QuestionBrief {
  id: string
  /** Plain-text stem (the adapter strips markup). */
  stemText: string
  type: string
  status: QuestionWorkflowStatus
  subjectId: string | null
  subjectName: string | null
  educationLevelId: string | null
  levelName: string | null
  chapterName: string | null
}

/** One question as the quality score function (SRS 6.12 `score(q)`) reads it. */
export interface QualityQuestion {
  id: string
  stemText: string
  /** Explanation text; null or blank counts as "no explanation". */
  explanation: string | null
  /** True when the question has no curriculum SP tag. */
  untagged: boolean
  /** Null when the source type is unknown. */
  sourceType: string | null
  /** True for a quarantined or rejected question (compliance). */
  quarantinedOrRejected: boolean
  /** True for a row migrated from .cloud (shown in the "legacy" bucket, not in the action list). */
  isLegacy: boolean
  subjectId: string | null
  subjectName: string | null
  educationLevelId: string | null
  levelName: string | null
  sourceSet: string | null
}

/** A question flagged as needing a diagram (diagram audit). */
export interface DiagramCandidate {
  id: string
  /** `mcq` or `structured`: the list it shows in. */
  kind: 'mcq' | 'structured'
  /** MCQ: the stem; structured: the stimulus excerpt. */
  text: string
  subjectId: string | null
  subjectName: string | null
  /** Used by the `schoolId` filter (creators of that school); null for an unknown creator. */
  createdBy: { id: string; name: string | null; schoolId: string | null }
  sourceFile: string | null
  sourcePage: number | null
}

/** The facts the canned AI explanation (OD-7 stub) is built from. */
export interface ExplanationSource {
  id: string
  type: string
  stemText: string
  options: { label: string; text: string; isCorrect: boolean }[] | null
  /** Short answer / true-false / model answer as text; null when none. */
  answerText: string | null
  /** The stored explanation; null when none. */
  explanation: string | null
  /** Optional (BE-10 AI stub, non-MCQ table): legacy 1 to 5 difficulty and points; shown as "-" when absent. */
  difficultyLevel?: number | null
  pointsValue?: number | null
}

export interface QuestionBankPort {
  /** Status facts of a question, or null when the id is unknown. */
  getStatus(id: string): Promise<QuestionStatusInfo | null>

  /** Gate inputs of the LATEST version, or null when the id is unknown. */
  getForGates(id: string): Promise<QuestionGateData | null>

  /**
   * Move the latest version to `to` and return the new facts (null when unknown). Publishing a
   * version supersedes the live one and archives it in the SAME transaction (BE-FR-35); taking the
   * live version down clears `liveVersionNo`.
   */
  setStatus(id: string, to: QuestionWorkflowStatus, actorId: string, options?: SetStatusOptions): Promise<QuestionStatusInfo | null>

  /** Make the question ineligible for practice at once (`is_active = false`). False when unknown. */
  deactivate(id: string): Promise<boolean>

  /** Undo `deactivate`. False when unknown. */
  reactivate(id: string): Promise<boolean>

  /** Create one question (imports). Returns its id. */
  create(input: ImportedQuestionInput): Promise<string>

  /** Ids of every question whose latest version came from the source paper (takedown, D40c). */
  listIdsBySourcePaper(sourcePaperId: string): Promise<string[]>

  /** Display facts for lists; unknown ids are absent from the map. */
  describe(ids: readonly string[]): Promise<ReadonlyMap<string, QuestionBrief>>

  /**
   * Every question, for the quality audit and dashboard, in batches of at most `size` (ascending id, keyset, bounded memory):
   * `visit` is called once per batch, in order. Never load the whole bank into one array.
   */
  forEachQualityBatch(visit: (batch: QualityQuestion[]) => Promise<void>, size?: number): Promise<void>

  /** Every question in one array. Small banks and tests only: production code uses `forEachQualityBatch`. */
  listForQuality(): Promise<QualityQuestion[]>

  /** Questions flagged as needing a diagram, newest id first, before dismissals are applied. */
  listDiagramCandidates(kind: 'mcq' | 'structured'): Promise<DiagramCandidate[]>

  /** Attach an uploaded image (`files.id`) to the question's figure. False when unknown. */
  attachDiagram(id: string, fileId: string): Promise<boolean>

  /** Facts for the canned AI explanation, or null when unknown. */
  getExplanationSource(id: string): Promise<ExplanationSource | null>

  /** Store the explanation text (replaces any existing). False when unknown. */
  setExplanation(id: string, text: string): Promise<boolean>
}

/** The default until BE-09 is wired: the question bank is empty. */
export class EmptyQuestionBank implements QuestionBankPort {
  async getStatus(): Promise<QuestionStatusInfo | null> {
    return null
  }
  async getForGates(): Promise<QuestionGateData | null> {
    return null
  }
  async setStatus(): Promise<QuestionStatusInfo | null> {
    return null
  }
  async deactivate(): Promise<boolean> {
    return false
  }
  async reactivate(): Promise<boolean> {
    return false
  }
  async create(): Promise<string> {
    // Imports are validated before any row is created; with no bank wired there is nothing to
    // write to, which is a deployment error, not a client error.
    throw new Error('QuestionWorkflowPorts: no question bank is wired (BE-09 not merged)')
  }
  async listIdsBySourcePaper(): Promise<string[]> {
    return []
  }
  async describe(): Promise<ReadonlyMap<string, QuestionBrief>> {
    return new Map()
  }
  async forEachQualityBatch(): Promise<void> {
    return
  }
  async listForQuality(): Promise<QualityQuestion[]> {
    return []
  }
  async listDiagramCandidates(): Promise<DiagramCandidate[]> {
    return []
  }
  async attachDiagram(): Promise<boolean> {
    return false
  }
  async getExplanationSource(): Promise<ExplanationSource | null> {
    return null
  }
  async setExplanation(): Promise<boolean> {
    return false
  }
}

/** The ports as one injectable holder (same pattern as `CurriculumPorts`). */
@Injectable()
export class QuestionWorkflowPorts {
  private bank: QuestionBankPort = new EmptyQuestionBank()
  private bankSet = false

  get questionBank(): QuestionBankPort {
    return this.bank
  }

  /** BE-09 wiring: replace the "empty question bank" default. Throws when called twice. */
  provideQuestionBank(port: QuestionBankPort): void {
    if (this.bankSet) throw new Error('QuestionWorkflowPorts: the question bank port is already set')
    this.bank = port
    this.bankSet = true
  }
}
