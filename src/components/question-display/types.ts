/**
 * Display-only prop types for the shared question display library (FE-P5).
 * RECONCILE with FE-P1: the M04 `servable()` data and question types are being built in parallel.
 * These are minimal local shapes; when FE-P1 lands, map its types onto them in the page adapters
 * (FE-P12 / FE-P13), do not edit the components.
 */

export type StimulusKind = 'passage' | 'image' | 'diagram' | 'table' | 'map' | 'infographic' | 'graph'

export interface StimulusTable {
  head: string[]
  /** The first cell of each row is the row header. */
  rows: string[][]
  caption?: string
}

export interface StimulusData {
  id: string
  kind: StimulusKind
  /** Shared-group label, e.g. "Rajah 1". Also the chip text "Lihat {label}". */
  label?: string
  /** Optional bold title (passage, image). */
  title?: string
  /** Body text under the picture, or the passage body. */
  text?: string
  /** Source line of a passage. */
  source?: string
  caption?: string
  /** Alt text of the picture; falls back to the caption, then the kind fallback caption. */
  alt?: string
  /** Picture URL. */
  src?: string
  /** Natural size, used to reserve the box (no layout shift, NFR-03). */
  width?: number
  height?: number
  table?: StimulusTable
}

export interface McqOptionData {
  id: string
  /** "A", "B", ... (re-lettered by the caller where the activity shuffles). */
  letter: string
  text: string
  imageSrc?: string
  imageAlt?: string
  imageWidth?: number
  imageHeight?: number
}

export type AnswerMode = 'mcq' | 'short_text' | 'numeric' | 'extended_essay' | 'essay_choice'

export interface EssayTopic {
  id: string
  label: string
}

/** The value each answer mode edits. */
export interface EssayChoiceValue {
  topic?: string
  text: string
}

export type McqVerdict = 'correct' | 'wrong'

/** The seven activity families of "Dilihat murid di" (AC-04.1). */
export type ActivityFamily =
  | 'latih-tubi'
  | 'databank-mock'
  | 'tracking-a'
  | 'struktur-subjektif'
  | 'simulasi-kuiz'
  | 'permainan-battle'
  | 'pksk'

export interface VisibilityRowData {
  family: ActivityFamily
  /** Display name, e.g. "Latih Tubi, Bab, Aku Salah". */
  name: string
  visible: boolean
  /** Cause and fix sentence; shown for `visible: false` only. */
  reason?: string
  /** Optional action beside the reason, e.g. "Buka Tracking A". */
  actionLabel?: string
}

/** A deduction rule line of a part (D115): "{label} {n} x {amount} (max {cap})". */
export interface PaperDeduction {
  label: string
  n: number
  amount: number
  cap?: number
}

export interface PaperPart {
  id: string
  label?: string
  prompt: string
  marks: number
  /** Group cap (FR-QA-48), shown as "Maks {N}" when the scheme is revealed. */
  maxCap?: number
  deductions?: PaperDeduction[]
  children?: PaperPart[]
}

export interface PaperQuestion {
  id: string
  number: number
  marks: number
  stem: string
  options?: McqOptionData[]
  parts?: PaperPart[]
  stimuli?: readonly StimulusData[]
  /** Consecutive questions with the same group id share one stimulus panel. */
  groupId?: string
}

export interface PaperSection {
  id: string
  label: string
  instruction?: string
  marks?: number
  compulsory?: boolean
  rule?: string
  questions: PaperQuestion[]
}
