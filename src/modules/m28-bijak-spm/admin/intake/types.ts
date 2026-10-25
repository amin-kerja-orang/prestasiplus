/**
 * Admin SPM question intake (v2-question-bank 4.2-4.8, exam schema D47). The extracted output reuses
 * the m28 domain types (SchemeDef, PartDef modes, StimulusDef, CurriculumTag) so an approved batch
 * becomes plain m28 questions and stimuli. Fictitious data only.
 */
import type {
  CurriculumTag,
  LeafKind,
  McqOption,
  SchemeDef,
  StimulusDef,
  SubjectCode,
} from '../../domain/types'
import type { TagSuggestion } from '../../domain/admin-types'

/* ---------------------------------------------------------------------------------- OCR input */

export interface PageText {
  page: number
  text: string
  /** `text-layer` = digital-born PDF, `ocr` = scanned page read by Tesseract. */
  source: 'text-layer' | 'ocr'
  /** Mean OCR confidence 0-100 (OCR pages only). */
  confidence?: number
}

export interface PageImage {
  page: number
  dataUrl: string
  width: number
  height: number
}

/* ------------------------------------------------------------------------- extracted content */

export type IntakeQType = 'mcq' | 'structured' | 'short' | 'essay'

export interface IntakePart {
  id: string
  /** "(a)", "(a)(i)". */
  label: string
  prompt: string
  marks: number
  mode: LeafKind
  scheme?: SchemeDef
  /** Unit shown after a numeric answer (kept when a bank question is edited). */
  unit?: string
  wordRange?: { min: number; max: number }
  /**
   * Ancestors of a nested part (a bank question keeps its tree): the part is "(a)(i)" under the
   * texts of "(a)". The editor shows one flat list; the nesting is rebuilt on save.
   */
  lead?: { id: string; label: string; prompt: string }[]
}

export interface IntakeQuestion {
  id: string
  /** Number label as printed on the paper ("12"). */
  label: string
  type: IntakeQType
  stem: string
  /** MCQ options. */
  options: McqOption[]
  /** Question marks; for a structured question it is the sum of the part marks. */
  marks: number
  /** Leaf mode of a question without parts. */
  mode: LeafKind
  /** Unit and word range of a question without parts (carried through a full edit). */
  unit?: string
  wordRange?: { min: number; max: number }
  parts: IntakePart[]
  /** Answer key of a question without parts (MCQ key, short answer, essay points). */
  scheme?: SchemeDef
  tag: CurriculumTag
  /** What the AI suggested for the tag (DSKP v2); the tag itself is pre-filled with it. */
  tagSuggestion?: TagSuggestion
  /** Stimulus group (the figure is stored once on the batch). */
  stimulusId?: string
  /** Source page (1-based). */
  page: number
  /** Fields the extractor was unsure of; a person must confirm each (gate 4.8). */
  lowFields: string[]
  confirmed: string[]
  /** Extractor could not parse it: "Perlu semak manual". */
  needsManual?: boolean
}

export interface IntakeStimulus extends StimulusDef {
  /** Source page the figure was cropped from. */
  page?: number
}

export interface ExtractedPaper {
  provider: string
  model: string
  questions: IntakeQuestion[]
  stimuli: IntakeStimulus[]
  /** Scheme entries whose question number was not found (AC-04.2). */
  unmatched: string[]
  warnings: string[]
}

export interface ExtractInput {
  pages: PageText[]
  images?: PageImage[]
  subject: SubjectCode
  kertas: 1 | 2
  /** Narrows the DSKP unit/SP suggestion when the batch declares a tingkatan (none does yet). */
  tingkatan?: 'T4' | 'T5'
}

/** Provider-agnostic extraction (ADR 0019). Real providers run server-side. */
export interface QuestionExtractor {
  readonly id: string
  readonly label: string
  extract(input: ExtractInput): Promise<ExtractedPaper>
}

/* ------------------------------------------------------------------------------------ batches */

export type IntakeStatus = 'draf' | 'semakan'

export const PAPER_TYPES = [
  'Percubaan SPM',
  'Soalan Umum',
  'Peperiksaan Sebenar',
  'Buku Latihan',
  'Lain-lain',
] as const

export const COPYRIGHT_OPTIONS = [
  { value: 'sendiri', label: 'Milik sendiri / sekolah' },
  { value: 'rasmi', label: 'Kertas rasmi KPM / LPM' },
  { value: 'pihak-ketiga', label: 'Pihak ketiga / komersial' },
] as const

export interface IntakeMeta {
  subject: SubjectCode
  kertas: 1 | 2
  year: number
  paperType: string
  source: string
  copyright: string
  notes: string
  fileName: string
  fileHash: string
  pageCount: number
}

/** Where the questions of a batch came from: an uploaded paper or typed by hand (no file). */
export type IntakeSourceKind = 'pdf' | 'manual'

/** Declaration of a manual batch: the same metadata as an upload, without the file. */
export type ManualMeta = Omit<IntakeMeta, 'fileName' | 'fileHash' | 'pageCount'> & {
  /** Paper builder paper the admin came from (to return there after submitting). */
  forPaperId?: string
}

export interface IntakeBatch extends IntakeMeta {
  id: string
  /** Absent on batches saved before manual entry existed (= `pdf`). */
  sourceKind?: IntakeSourceKind
  forPaperId?: string
  userId: number
  status: IntakeStatus
  createdAt: number
  updatedAt: number
  submittedAt?: number
  provider: string
  model: string
  questions: IntakeQuestion[]
  stimuli: IntakeStimulus[]
  unmatched: string[]
  pages: PageText[]
}

export interface IntakeSummary {
  id: string
  title: string
  subject: SubjectCode
  subjectName: string
  kertas: number
  year: number
  status: IntakeStatus
  sourceKind: IntakeSourceKind
  fileName: string
  questionCount: number
  groupCount: number
  lowCount: number
  marks: number
  updatedAt: number
}

export interface IntakeIssue {
  /** Question id, or undefined for a batch-level issue. */
  questionId?: string
  /** Display label of the question ("Soalan 3(b)"). */
  where: string
  message: string
}

export interface SaveExtractedPayload {
  questions: IntakeQuestion[]
  stimuli: IntakeStimulus[]
}
