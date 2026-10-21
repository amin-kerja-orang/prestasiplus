import type { BijakMode } from '../ports'

/**
 * Every tunable of the performance reports lives here (LEAD decisions, BE-19). Change a value here and
 * nowhere else.
 */

/** Which sitting modes each view counts. The mock scopes M08 to practice modes; Bijak has exam and latihan, both counted. */
export const COUNTED_MODES: Readonly<Record<'student' | 'analytics' | 'class' | 'school' | 'items', readonly BijakMode[]>> = {
  student: ['exam', 'latihan'],
  analytics: ['exam', 'latihan'],
  class: ['exam', 'latihan'],
  school: ['exam', 'latihan'],
  items: ['exam', 'latihan'],
}

/** Fewest distinct pupils behind a figure shown to a non-staff role (student, officer). */
export const MIN_COHORT = 5
/** Shown instead of a pupil's name when the viewer may not see it. */
export const REDACTED_NAME = 'Murid'
/** Shown instead of a pupil id on a redacted row. */
export const REDACTED_ID = '0'

export const DEFAULT_CLASS_COLOR = '#6366F1'
export const DEFAULT_SUBJECT_COLOR = '#6366F1'

export const TREND_WINDOW_DAYS = 30
/** Accuracy change (points) that counts as a trend. */
export const TREND_DELTA = 5
/** Projection range: grade(accuracy - band) to grade(accuracy + band). */
export const PROJECTION_BAND = 10
export const HEATMAP_DAYS = 90
export const ACTIVE_DAYS = 7
/** Class attention list: members below this accuracy. */
export const ATTENTION_BELOW = 50

export const TOP_STUDENT_MIN_SITTINGS = 3
export const TOP_STUDENT_LIMIT = 10
export const SCHOOL_QUESTION_CAP = 50
/** BR-M08-19: fewest members with a finished sitting for a discrimination table. */
export const DISCRIMINATION_MIN_MEMBERS = 4
/** Share of members in the upper and the lower group. */
export const DISCRIMINATION_GROUP_SHARE = 0.27

export const LEVEL_CODES = ['t4', 't5'] as const
export type LevelCode = (typeof LEVEL_CODES)[number]
export const LEVEL_NAMES: Readonly<Record<LevelCode, string>> = { t4: 'Tingkatan 4', t5: 'Tingkatan 5' }

/** A pupil is ranked once this many non-test practice answers exist (LEAD, BE-19). */
export const RANKING_MIN_ANSWERS = 3
/** Rows of the ranking table (the uncapped count is `total`). */
export const RANKING_ROW_CAP = 100
/** Rows of the practice leaderboard. */
export const LEADERBOARD_ROW_CAP = 50
