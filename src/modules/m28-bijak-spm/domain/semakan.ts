/**
 * Semakan (R1-B12/B13/B15): the self-mark, keyword suggestion and past-sitting shapes the result page
 * reads, plus the small pure helpers behind the stepper and the band picker. The shared exam-core
 * `PartResult` does not carry the R1 fields yet, so the module widens it here (the HTTP wire already
 * has them; see packages/contract/src/bijak/attempts/schema.ts).
 */
import type { AttemptResult, PartResult, PartStatus } from './types'

export interface KeywordSuggestion {
  suggestedMark: number
  matched: number
  total: number
  points: { id: string; label: string; marks: number; matched: boolean }[]
}

/** A leaf part of a result with the R1 self-mark fields. */
export type ReviewPart = PartResult & {
  selfMarkable?: true
  selfMarked?: true
  autoSuggested?: true
  band?: string
  suggestion?: KeywordSuggestion
}

export interface SelfMarkOutcome {
  partId: string
  awarded: number
  max: number
  band?: string
  status: PartStatus
  attemptScore: number
  attemptMax: number
  provisional: boolean
  pendingReview: number
  result: AttemptResult
}

export interface PastSitting {
  attemptId: string
  mode: 'exam' | 'latihan'
  status: 'submitted' | 'auto_submitted'
  startedAt: number
  submittedAt: number
  score: number
  max: number
  provisional: boolean
}

export interface PastSittings {
  lastSubmittedAttemptId: string | null
  sittings: PastSitting[]
}

export interface BandOption {
  name: string
  from: number
  to: number
  descriptor: string
}

/** Whole marks inside 0..max; anything that is not a number becomes 0. */
export function clampMark(value: number, max: number, min = 0): number {
  const n = Number.isFinite(value) ? Math.round(value) : 0
  return Math.min(Math.max(n, min), Math.max(min, max))
}

/** The bands of a rubric part, clamped to the part marks (V2 `BandRubricMarker::bounds`). */
export function bandOptions(part: PartResult): BandOption[] {
  const bands = part.scheme.rubric?.bands ?? []
  return bands.map((b) => {
    const from = clampMark(Math.min(b.range[0], b.range[1]), part.marks)
    const to = clampMark(Math.max(b.range[0], b.range[1]), part.marks)
    return { name: b.name, from, to, descriptor: b.descriptor }
  })
}

/** V2 `midpointFor`: floor of the middle of the band range. */
export function bandMidpoint(b: BandOption): number {
  return Math.floor((b.from + b.to) / 2)
}

/** The band that holds `mark` (the first one), used to pre-select the picker. */
export function bandOfMark(bands: BandOption[], mark: number): string | undefined {
  return bands.find((b) => mark >= b.from && mark <= b.to)?.name
}
