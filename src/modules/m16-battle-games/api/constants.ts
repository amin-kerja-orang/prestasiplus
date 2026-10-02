/**
 * M16 client constants (SRS M16 v1.6 §7.1 polling contract, DC-M16-01).
 */

/** Battle search poll interval (§7.1): 3 s; the search stops after 120 s or 5 consecutive failures. */
export const BATTLE_POLL_MS = 3000
export const BATTLE_SEARCH_TIMEOUT_MS = 120_000
export const BATTLE_MAX_FAILURES = 5

/**
 * DC-M16-01 (DV-M16-32): the S3 subtitle "Ranking {n} sekolah seluruh Malaysia" shows 10,218 although
 * the M02 register holds 10,220 schools; documented display constant, shown in that subtitle only.
 */
export const S3_SCHOOL_COUNT = 10_218
