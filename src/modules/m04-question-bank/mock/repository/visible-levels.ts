/**
 * Secondary-only (D72, 2026-10-29): the admin reads of the question store skip the questions of a hidden
 * primary level (Darjah 1-6, stage `primary`), like the HTTP backend's `NOT_PRIMARY_LEVEL_SQL`. The rows
 * stay stored (hide, never delete). The set is an id list, so the dataset filters on the level facet
 * (cells), never per row.
 */

import { curriculum } from '@/modules/m03-curriculum/mock'

/**
 * The switch behind the hiding (default ON). Tests of the observed whole-bank figures (465,278 questions,
 * the quality KPIs) turn it off with `showPrimaryLevels()`; nothing in the app does.
 */
const primaryLevels = { hidden: true }
export const showPrimaryLevels = (on = true): void => {
  primaryLevels.hidden = !on
}

/** Ids of the levels the admin screens may show (every non-primary level, active or not). */
export function visibleLevelIds(): number[] {
  return curriculum
    .levels()
    .flatMap((l) => (primaryLevels.hidden && l.stage === 'primary' ? [] : [l.id]))
}

/**
 * The `educationLevelId` condition of an admin read: the visible levels, or `requested` when it is one of
 * them (a hidden `requested` level matches nothing).
 */
export function levelScope(requested?: number): (number | null)[] {
  const visible = visibleLevelIds()
  // A question with no level stays visible (the backend's NOT_PRIMARY_LEVEL_SQL keeps it).
  if (requested === undefined) return [...visible, null]
  return visible.includes(requested) ? [requested] : []
}
