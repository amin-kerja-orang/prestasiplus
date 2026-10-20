import { questionQualityBandOf, type QuestionQualityBand } from '@pp/contract'

import type { QualityQuestion } from '../ports'

/**
 * Score of one question: a faithful copy of the mock `scoreQuestion` (SRS 6.12, BR-M04-21).
 * 100 minus 15 (no explanation), 10 (no curriculum SP tag), 10 (source type unknown), 15 (quarantined
 * or rejected), 10 (text shorter than 20 characters), clamped to 0..100.
 */
export function scoreQuestion(q: Pick<QualityQuestion, 'explanation' | 'untagged' | 'sourceType' | 'quarantinedOrRejected' | 'stemText'>): number {
  let s = 100
  if (q.explanation === null || q.explanation.trim() === '') s -= 15
  if (q.untagged) s -= 10
  if (q.sourceType === null) s -= 10
  if (q.quarantinedOrRejected) s -= 15
  if (q.stemText.length < 20) s -= 10
  return Math.min(100, Math.max(0, s))
}

/** The stored bucket of a score (BR-M04-21). */
export const bucketOfScore = (score: number): QuestionQualityBand => questionQualityBandOf(score)
