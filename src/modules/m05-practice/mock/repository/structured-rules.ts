/**
 * Fixed values and fixture functions of the structured answer and SPM target endpoints (SRS M05
 * v1.17 §4 BR-23, BR-26, BR-27, §6.6, §6.10, §6.13, FR-M05-91/134).
 */

import type { SpmGrade } from '../datasets/types'

/** Structured list page size (BR-23). */
export const STRUCTURED_PAGE_SIZE = 20

/** §6.10 "KBAT levels (S10)": a valid `kbatLevel` is 1–6; anything else matches nothing (§5). */
export const KBAT_LEVELS = [1, 2, 3, 4, 5, 6] as const

/**
 * FR-M05-134: the "Subjek" list of the Subjektif SPM variant, in that order (M03 ids; names are
 * read from M03).
 */
export const SUBJEKTIF_SUBJECT_IDS: readonly number[] = [
  1, 2, 3, 4, 5, 11, 22, 9, 12, 10, 8, 23, 21, 17, 25,
]

/** FR-M05-134: the Tracking A Bahasa list, BM before BI (FR-M05-135). */
export const BAHASA_SUBJECT_IDS: readonly number[] = [1, 2]

/** BR-22 / §6.10: the 20 SPM subjects of S15 in display order (M03 ids). */
export const SPM_TARGET_SUBJECT_IDS: readonly number[] = [
  18, 2, 1, 11, 22, 9, 12, 10, 3, 8, 24, 6, 7, 13, 27, 23, 21, 4, 5, 25,
]

/** §5 / BR-26: the nine accepted target grades. */
export const SPM_GRADES: readonly SpmGrade[] = ['A+', 'A', 'A-', 'B+', 'B', 'C+', 'C', 'D', 'E']

export const isSpmGrade = (v: unknown): v is SpmGrade =>
  typeof v === 'string' && (SPM_GRADES as readonly string[]).includes(v)

/** BR-27 (INFERRED scale): predicted grade by accuracy percentage; below 40 is "G". */
const GRADE_FLOORS: readonly (readonly [number, string])[] = [
  [90, 'A+'],
  [80, 'A'],
  [70, 'A-'],
  [65, 'B+'],
  [60, 'B'],
  [55, 'C+'],
  [50, 'C'],
  [45, 'D'],
  [40, 'E'],
]

export function predictedGrade(accuracyPct: number): string {
  for (const [floor, grade] of GRADE_FLOORS) if (accuracyPct >= floor) return grade
  return 'G'
}

/** BR-27: bar colour band, green ≥ 70, amber 50–69, red < 50 (the S15 legend). */
export function band(accuracyPct: number): 'green' | 'amber' | 'red' {
  return accuracyPct >= 70 ? 'green' : accuracyPct >= 50 ? 'amber' : 'red'
}

/** §6.13 `markStructured` (LS-7 placeholder): full marks when the answer has ≥ 20 characters. */
export const MARK_MIN_CHARS = 20

export function markStructured(
  subs: readonly { id: number; marks: number }[],
  answers: ReadonlyMap<number, string>,
): { subQuestionId: number; awarded: number; max: number }[] {
  return subs.map((s) => ({
    subQuestionId: s.id,
    awarded: (answers.get(s.id) ?? '').trim().length >= MARK_MIN_CHARS ? s.marks : 0,
    max: s.marks,
  }))
}

/** Upper bound of one answer text (INFERRED; the live form has none that was observed). */
export const MAX_ANSWER_CHARS = 5000
