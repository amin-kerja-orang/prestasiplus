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

/**
 * Subject sentinel of a MIGRATED Bijak attempt (`subject: 'legacy'`, name "Tidak diketahui"; see `src/migration/transform/exam.ts`).
 * It has no curriculum subject. Such sittings count in every overall figure but never make a per-subject row, tab or option (SW13-08).
 */
export const LEGACY_SUBJECT_CODE = 'legacy'

/** True for a sitting (or a subject-grouped total) that carries the migrated-attempt subject sentinel. */
export function isLegacySubject(s: { subjectId?: string; subjectCode?: string }): boolean {
  return s.subjectCode === LEGACY_SUBJECT_CODE || s.subjectId === LEGACY_SUBJECT_CODE
}

/**
 * The 19 stored `practice_answers.mode` values (OPT-MODE-SESI, 40; `past_year`, `ramalan` and `random` are legacy
 * read-only). Prestasi 360 counts every one of them as answered (FR-X4-5).
 */
export const ANSWER_MODES = [
  'latih_tubi',
  'random',
  'chapter',
  'revision',
  'remedial',
  'mission',
  'question_set',
  'pksk',
  'databank',
  'kuiz',
  'simulasi',
  'tracking_a',
  'subjektif',
  'structured',
  'battle',
  'audio_kbat',
  'game',
  'past_year',
  'ramalan',
] as const
/** Game modes: they add answers but never a session ("Sesi Kuiz": games add none, AC-CHAIN-10). */
export const GAME_MODES = ['battle', 'game'] as const
/** The modes whose sessions are counted. */
export const SESSION_MODES: readonly string[] = ANSWER_MODES.filter((m) => !(GAME_MODES as readonly string[]).includes(m))

/** Prestasi 360 `trend`: the last 12 ISO weeks (Monday start, Malaysian time). */
export const STUDENT_TREND_WEEKS = 12
/** Weak topics (FR-MUR-4-8): all time, at least this many attempts and an accuracy below `WEAK_TOPIC_BELOW`. */
export const WEAK_TOPIC_MIN_ATTEMPTS = 2
export const WEAK_TOPIC_BELOW = 60
