import type { TagLookup } from './tag-rule'
import type { CurriculumTag } from './types'

/** Shown for T1-T3 content, which is outside DSKP and has no unit (same copy as the intake editor). */
export const T1_T3_TOPIC = 'Tingkatan 1-3 (di luar DSKP)'

/** Shown for a seed or migrated question that still needs a person to tag it (copy [PROPOSED]). */
export const REVIEW_TOPIC = 'Perlu semakan tag'

/**
 * Topic name to display: the T1-T3 copy for content outside DSKP, otherwise the title of the
 * catalogue unit (as printed), otherwise the "perlu semakan" copy for a flagged tag. An untagged
 * tag, or a unit the lookup does not know (its subject is not loaded), gives ''.
 */
export function topicOf(c: CurriculumTag, lookup: Pick<TagLookup, 'unit'>): string {
  if (c.formOrigin === 'T1-T3') return T1_T3_TOPIC
  // Truthy test on purpose: an old-shape tag (no `unitId` at all) must not throw in a caller that
  // holds one outside the server (the server migrates stored state in `load()`).
  if (c.unitId) {
    const unit = lookup.unit(c.unitId)
    if (unit) return unit.title
  }
  return c.review === 'perlu-semakan' ? REVIEW_TOPIC : ''
}

/**
 * Topic a student sees (question view, result weak topics): the same as `topicOf`, but a flagged
 * tag (`review` set) gives '' so the admin-only "Perlu semakan tag" copy never reaches a student.
 * An empty topic is skipped by the result page. A flagged question keeps serving (AC-07.5).
 */
export function studentTopicOf(c: CurriculumTag, lookup: Pick<TagLookup, 'unit'>): string {
  return c.review ? '' : topicOf(c, lookup)
}
