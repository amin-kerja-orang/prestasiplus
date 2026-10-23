/**
 * Question bank admin (v2-question-bank): review queue, bank browser and paper builder types.
 * Statuses follow docs/requirements/v2-question-bank.md 4.1; the prototype folds Lulus and Terbit
 * into one action ("Lulus & Terbit") and keeps the reviewer's rejections as `ditolak`.
 */
import type { IntakeQuestion, IntakeStimulus } from '../admin/intake/types'
import type {
  CurriculumTag,
  GroupDef,
  McqOption,
  PartDef,
  PaperDef,
  QuestionDef,
  SchemeDef,
  SectionDef,
  StimulusDef,
  SubjectCode,
} from './types'

export type QuestionStatus = 'semakan' | 'terbit' | 'draf' | 'ditolak'
export type QuestionKind = 'objektif' | 'berstruktur' | 'esei'
export type Confidence = 'tinggi' | 'sederhana' | 'rendah'

export interface HistoryEntry {
  at: number
  by: string
  version: number
  action: string
  note?: string
}

/** Review state of one question (a published seed question without a record is Terbit, version 1). */
export interface ReviewRec {
  status: QuestionStatus
  version: number
  /** Highest version number ever issued, so a rejected revision's number is not reused. */
  lastVersion?: number
  submittedAt: number
  reason?: string
  history: HistoryEntry[]
  /** "Sunting" on a Terbit question: version n+1 waits for review while the live one keeps serving. */
  revision?: { version: number; stem: string; note: string; at: number; content?: RevisionContent }
  /** Stem of the live version after an approved revision (replaces the seed stem). */
  liveStem?: string
  /** Whole content of the live version after an approved full edit (replaces the seed content). */
  live?: RevisionContent
}

/** A fully edited question: the bank question, its schemes and (for a group) the shared stimulus. */
export interface RevisionContent {
  question: QuestionDef
  schemes: Record<string, SchemeDef>
  stimulus?: StimulusDef
}

/** A question (or group) offered for review. The content is static; its state lives in `ReviewRec`. */
export interface ReviewSeed {
  /** Group id when the unit is a group, else the question id. */
  key: string
  subject: SubjectCode
  kertas: 1 | 2
  source: string
  uploader: string
  confidence: Confidence
  ageDays: number
  /** `terbit` seeds are live from the start (the "few published questions"). */
  status: 'semakan' | 'terbit'
  /** Intake batch this unit was made from (units built at submit time, stored in the state). */
  batchId?: string
  questions: QuestionDef[]
  schemes: Record<string, SchemeDef>
  group?: { def: GroupDef; stimulus: StimulusDef }
}

export interface QueueFilter {
  subject?: string
  kertas?: number
  kind?: QuestionKind
  status?: QuestionStatus | 'semua'
}

export interface QueueItem {
  key: string
  isRevision: boolean
  questionIds: string[]
  groupId?: string
  subject: SubjectCode
  subjectName: string
  kertas: number
  kind: QuestionKind
  topic: string
  /** Stem preview (first question of the unit); may hold `$latex$`. */
  preview: string
  /** The preview as plain text (card titles). */
  previewPlain: string
  marks: number
  version: number
  source: string
  uploader: string
  ageDays: number
  confidence: Confidence
  status: QuestionStatus
}

export interface SchemeLine {
  tag?: string
  text: string
  marks?: number
}

export interface ReviewQuestion {
  id: string
  stem: string
  marks: number
  curriculum: CurriculumTag
  mcq?: { options: McqOption[]; correct?: string }
  parts?: PartDef[]
  /** Mark scheme per leaf id (the question id for MCQ). */
  scheme: Record<string, { marks: number; lines: SchemeLine[] } | null>
}

export interface ReviewDetail {
  item: QueueItem
  questions: ReviewQuestion[]
  stimulus?: StimulusDef
  optionBank?: McqOption[]
  history: HistoryEntry[]
  reason?: string
  /** Why the publish gate fails (empty = can publish). */
  gate: string[]
  /** For a revision: the stem that is live now. */
  liveStem?: string
  revisionNote?: string
  /** The revision changes more than the stem (options, scheme, tag): the preview is the new version. */
  fullEdit?: boolean
  /** A revision that changes a shared stimulus: who else sees the change. */
  sharers?: StimulusSharers
}

export type DecisionAction = 'terbit' | 'tolak' | 'betulkan'

export interface DecisionResult {
  ok: boolean
  errors: string[]
}

export interface BankFilter {
  q?: string
  subject?: string
  kertas?: number
  kind?: QuestionKind
  status?: QuestionStatus | 'semua'
}

/** The questions that share one stimulus (figure / passage), in group order. */
export interface StimulusSharers {
  /** Label of the shared stimulus, e.g. "Rajah 1". */
  stimulusLabel: string
  /** Number of questions that share it (not the members of a review unit). */
  count: number
  /** In group order: the bank id and 1-based position of each; `current` marks the question in view. */
  questions: { id: string; position: number; current?: boolean }[]
}

export interface BankRow {
  id: string
  groupId?: string
  /** Number of questions in the stimulus group (set when the group resolves). */
  groupSize?: number
  subject: SubjectCode
  subjectName: string
  kertas: number
  kind: QuestionKind
  topic: string
  marks: number
  preview: string
  previewPlain: string
  version: number
  status: QuestionStatus
  usedIn: number
}

export interface BankStats {
  /** Terbit questions: equals the sum of `bySubject[].terbit`. */
  total: number
  /** Questions of every subject waiting for review (not part of `total`). */
  semakan: number
  bySubject: {
    code: SubjectCode
    name: string
    terbit: number
    semakan: number
    draf: number
    ditolak: number
  }[]
}

/** A bank question opened in the full editor (the intake editor shape). */
export interface BankEditable {
  row: BankRow
  question: IntakeQuestion
  stimulus?: IntakeStimulus
  /** The live version is read-only while a newer one waits for review. */
  pendingRevision: boolean
  /** Whether the live question carries no SP (legacy seed): the SP check is waived on save. */
  legacyTag: boolean
  /** The questions that share the stimulus being edited. */
  sharers?: StimulusSharers
}

export interface BankDetail {
  row: BankRow
  question: ReviewQuestion
  stimulus?: StimulusDef
  optionBank?: McqOption[]
  history: HistoryEntry[]
  usedInPapers: { id: string; title: string }[]
  pendingRevision: boolean
  /** The questions that share the stimulus (set whenever the question is in a group). */
  sharers?: StimulusSharers
}

/* ------------------------------------------------------------------------------- papers */

export type AdminPaperStatus = 'draf' | 'terbit'

export interface AdminPaper extends Omit<PaperDef, 'sections'> {
  status: AdminPaperStatus
  createdAt: number
  updatedAt: number
  publishedAt?: number
  sections: SectionDef[]
}

export interface BlueprintView {
  subject: SubjectCode
  subjectName: string
  kertas: 1 | 2
  source: string
  code: string
  durationMin: number
  instructions: string[]
  totalMarks: number
  sections: {
    label: string
    markBudget: number
    questionCount: number
    compulsory: boolean
    instruction: string
    rule: SectionDef['rule']
    /** Pool the section draws from in Jana Kertas (the builder uses it to suggest questions). */
    pool: string
  }[]
}

export interface AdminPaperSummary {
  id: string
  title: string
  subject: SubjectCode
  subjectName: string
  kertas: number
  code: string
  status: AdminPaperStatus
  questionCount: number
  marks: number
  budget: number
  ok: boolean
  updatedAt: number
}

/** A question as the builder shows it (picker and section lists). */
export interface BuilderQuestion {
  id: string
  groupId?: string
  stimulusLabel?: string
  preview: string
  marks: number
  kind: QuestionKind
  topic: string
  status: QuestionStatus
  kertas: number
  subject: SubjectCode
}

export interface BuilderGroup {
  id: string
  stimulus: StimulusDef
  questionIds: string[]
}

export interface PaperEditorData {
  paper: AdminPaper
  blueprint: BlueprintView | null
  /** Every question the paper references, plus the picker candidates. */
  questions: BuilderQuestion[]
  groups: BuilderGroup[]
}

export interface PaperPatch {
  title?: string
  year?: number
  durationMin?: number
  sections?: { id: string; questionIds: string[] }[]
}

export interface PublishPaperResult {
  ok: boolean
  errors: string[]
}
