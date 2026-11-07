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
/** Analitik Adaptif class view (R1-GUR-5): last 7 days against the 7 before; strict change in points. Prestasi keeps the 30-day rule above. */
export const ANALYTICS_TREND_DAYS = 7
export const ANALYTICS_TREND_DELTA = 3
/** Analitik Adaptif risk bands on the whole-number accuracy (OPT-RISIKO): below 40 Kritikal, below 55 Tinggi, below 70 Sederhana, else Rendah. */
export const RISK_CRITICAL_BELOW = 40
export const RISK_HIGH_BELOW = 55
export const RISK_MEDIUM_BELOW = 70
/** Analitik Adaptif SP bands of the pupil (FR-MUR-5-3) on the whole-number accuracy: 75 and above Mahir, 50 to 74 Sederhana, below 50 Lemah. */
export const SP_MAHIR_FROM = 75
export const SP_SEDERHANA_FROM = 50
/** The weakest SPs of the "Topik Perlu Perhatian Utama" block. */
export const TOP_WEAK_SP_LIMIT = 4
/** Projection range: grade(accuracy - band) to grade(accuracy + band). */
export const PROJECTION_BAND = 10
export const HEATMAP_DAYS = 90
export const ACTIVE_DAYS = 7
/** Class attention list: members below this accuracy. */
export const ATTENTION_BELOW = 50

/** Murid Terbaik / Pelajar Terbaik: fewest answers a pupil needs to be listed (R1-AS-4, R1-GUR-4). */
export const TOP_STUDENT_MIN_ANSWERS = 5
export const TOP_STUDENT_LIMIT = 10
export const SCHOOL_QUESTION_CAP = 50
/** R1 decision D113 (FR-GUR-6-9): fewest pupils with an answer to a question for its discrimination index. */
export const DISCRIMINATION_MIN_MEMBERS = 10
/** Share of members in the upper and the lower group. */
export const DISCRIMINATION_GROUP_SHARE = 0.27

/** Tingkatan 1 to 5, lower case (the route `/prestasi/tingkatan/t1..t5` and the reader's `levelCode`). */
export const LEVEL_CODES = ['t1', 't2', 't3', 't4', 't5'] as const

/** Tingkatan chips of the item analysis (R1-AS-6, D101): T1 to T5. */
export const ITEM_TINGKATAN_CODES = ['t1', 't2', 't3', 't4', 't5'] as const
export type LevelCode = (typeof LEVEL_CODES)[number]
export const LEVEL_NAMES: Readonly<Record<LevelCode, string>> = {
  t1: 'Tingkatan 1',
  t2: 'Tingkatan 2',
  t3: 'Tingkatan 3',
  t4: 'Tingkatan 4',
  t5: 'Tingkatan 5',
}

/** Murid Berisiko (R1-AS-4): whole-number accuracy below this, or no answer in the last ACTIVE_DAYS days. */
export const AT_RISK_BELOW = 50
export const AT_RISK_LIMIT = 10
/** Class trend (R1-GUR-4, "Trend Aktiviti Kelas (30 Hari)"): the last 30 Malaysian days including today, zero-filled. */
export const CLASS_TREND_DAYS = 30

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
