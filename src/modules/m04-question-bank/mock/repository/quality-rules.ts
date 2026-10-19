/**
 * M04 quality rules (SRS §6.12 `score(q)`, BR-M04-21, BR-M04-22; M04-T2). Pure functions, no store.
 *
 * `score(q)` = 100 − 15·[no explanation] − 10·[untagged] − 10·[sourceType null]
 * − 15·[complianceStatus ∈ quarantined, rejected] − 10·[questionText < 20 chars], clamped 0–100.
 * Buckets (BR-M04-21): cemerlang 76–100, baik 51–75, lemah 26–50, kritikal 0–25; the store keeps the
 * three facet buckets `cemerlang` / `baik` / `le50` (lemah and kritikal are both `le50`).
 */

import type { QualityBucket, Question } from './types'

/** A question's score by the §6.12 fixture function. */
export function scoreQuestion(
  q: Pick<
    Question,
    'explanation' | 'dskpSpId' | 'sourceType' | 'complianceStatus' | 'questionText'
  >,
): number {
  let s = 100
  if (q.explanation === null || q.explanation.trim() === '') s -= 15
  if (q.dskpSpId === null) s -= 10
  if (q.sourceType === null) s -= 10
  if (q.complianceStatus === 'quarantined' || q.complianceStatus === 'rejected') s -= 15
  if (q.questionText.length < 20) s -= 10
  return Math.min(100, Math.max(0, s))
}

/** The stored bucket of a scored question. */
export function bucketOfScore(score: number): Exclude<QualityBucket, 'unscored'> {
  return score >= 76 ? 'cemerlang' : score >= 51 ? 'baik' : 'le50'
}

/** The display bucket of the "Taburan Kualiti" bar. */
export function distributionBucket(score: number): 'cemerlang' | 'baik' | 'lemah' | 'kritikal' {
  return score >= 76 ? 'cemerlang' : score >= 51 ? 'baik' : score >= 26 ? 'lemah' : 'kritikal'
}

/** Ids of rows created at runtime (S2, S5, teacher writes) start here (XL-37). */
export const RUNTIME_ID_FLOOR = 9_000_001
