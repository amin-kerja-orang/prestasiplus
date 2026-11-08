/**
 * M16 client constants (SRS M16 v1.6 §7.1 polling contract, DC-M16-01).
 */

/** Battle search poll interval (§7.1): 3 s; the search stops after 120 s or 5 consecutive failures. */
export const BATTLE_POLL_MS = 3000
export const BATTLE_SEARCH_TIMEOUT_MS = 120_000
export const BATTLE_MAX_FAILURES = 5

/** The "Bilangan Soalan" chips (48 GAME-01) and the default chip (`battle_questions_default`, 10). */
export const BATTLE_QUESTION_COUNTS = [5, 10, 15, 20] as const
export const BATTLE_QUESTION_COUNT_DEFAULT = 10

/** The robot overlay stays 2 s before the arena (48 GAME-01). */
export const BATTLE_ROBOT_OVERLAY_MS = 2000

/**
 * DC-M16-01 (DV-M16-32): the S3 subtitle "Ranking {n} sekolah seluruh Malaysia" shows 10,218 although
 * the M02 register holds 10,220 schools; documented display constant, shown in that subtitle only.
 */
export const S3_SCHOOL_COUNT = 10_218
