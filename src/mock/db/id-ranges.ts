/**
 * Documented id ranges shared across modules (TRACKER "canonical seed" notes; M02 v1.4 §6.15;
 * M04 v1.5 §6.13 / XL-37; overview §6.5). Owners pass these to their id strategies so that every
 * module and test reads one source. Store-specific reserved anchor ranges (e.g. the M04 question
 * ranges) stay in the owner's dataset spec.
 */
export const ID_RANGES = {
  /** Canonical accounts seeded by the mock core (TRACKER canonical seed). */
  canonicalUsers: { min: 1, max: 11 },
  /** Generated live-range user ids of the users dataset (M02 v1.4 §6.15). */
  usersGenerated: { min: 1, max: 6_000 },
  /** Runtime-created users: `floor` from 9,000,001 (M02 v1.4 X-9; never 1000+). */
  usersRuntimeFloor: 9_000_001,
  /** Fictitious schools reserved for anchors (M02 v1.3): 900001 SMK DEMO, 900002 SK Demo, … */
  schoolsReserved: { min: 900_001, max: 900_099 },
  /** Runtime-created schools: `floor` from 10,301 (M02 v1.4 §6.15). */
  schoolsRuntimeFloor: 10_301,
  /** Runtime-created questions: `floor` from 9,000,001 (M04 v1.5 §6.13, XL-37). */
  questionsRuntimeFloor: 9_000_001,
  /** Documented runtime start of `sequence` tables such as parent links and subscriptions. */
  sequenceRuntimeStart: 1_000,
} as const
