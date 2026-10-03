/**
 * Fixed lists of the M16 battle lobby (SRS M16 v1.6 §6.1, discovery Appendix A). The 15 PKSK domains are
 * M07's: since M16-T2 the lobby and the battle checks read them through `pkskDomains` (active rows).
 */

/** SPM Kertas 1 question counts by subject code (URS FN-M16-8.2.4; SOURCE). */
export const SPM_COUNTS: Readonly<Record<string, number>> = {
  BM: 25,
  BI: 40,
  MATH: 40,
  SCI: 40,
  SEJ: 40,
  PI: 40,
  PM: 40,
  ADDMATH: 20,
  PHY: 40,
  CHEM: 40,
  BIO: 40,
  GEO: 40,
  EKON: 40,
  PSV: 40,
  TI: 40,
}

/** Subjects of the S1 "Biasa" panel: ids 1-31 (M03). */
export const BATTLE_SUBJECT_IDS = Array.from({ length: 31 }, (_, i) => i + 1)

/** Simulation parameters (BR-M16-04, BR-M16-05; PROPOSED). */
export const QUEUE_EXPIRES_MS = 120_000
export const QUEUE_ABANDONED_MS = 10_000
export const MATCH_ON_POLL = 3
export const INCOMING_ON_POLL = 2
export const INVITATION_EXPIRES_MS = 24 * 3_600_000
