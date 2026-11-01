/**
 * "Blueprint perlu semakan" (PIPE AC-06.6, D78 O-2): the flag the server computes for a blueprint whose published Kertas Pilihan
 * miss the standard tier. Informational only; it never blocks. The text is the contract's (T44), not a local string.
 */
import { BIJAK_STANDARDS_MESSAGES, type BijakReviewPaper } from '@pp/contract'

export const REVIEW_BADGE = BIJAK_STANDARDS_MESSAGES.needsReview

const GAP_LABELS: Record<BijakReviewPaper['gaps'][number], string> = {
  marks: 'Markah',
  tp: 'TP',
  quota: 'Kuota',
  kbat: 'KBAT',
  level_share: 'Nisbah Tingkatan',
}

/** "Markah, TP" for one paper's gaps. */
export const gapText = (gaps: readonly BijakReviewPaper['gaps'][number][]): string => gaps.map((g) => GAP_LABELS[g] ?? g).join(', ')
