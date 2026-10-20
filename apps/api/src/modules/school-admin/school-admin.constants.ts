import type { RateLimitSpec } from '../../common/throttle'

/** Audit actions of the school admin. `details` carry ids only, never names, e-mails or phone numbers. */
export const SCHOOL_ADMIN_AUDIT = {
  TEACHER_VERIFIED: 'school_admin.teacher.verified',
} as const

/**
 * Limiter specs (common/throttle), per signed-in user and counted per process. Ceilings come from env, else the default.
 * `write` also covers the verify action (a school admin verifies a handful of teachers, never hundreds).
 */
export const SCHOOL_ADMIN_LIMITS = {
  read: { bucket: 'school-admin.read', env: 'THROTTLE_SCHOOL_ADMIN_READ_PER_MINUTE', default: 120, per: 'user' },
  write: { bucket: 'school-admin.write', env: 'THROTTLE_SCHOOL_ADMIN_WRITE_PER_MINUTE', default: 30, per: 'user' },
} as const satisfies Record<string, RateLimitSpec>

export const WRITE_TX = { maxWait: 10_000, timeout: 15_000 } as const

/** The dashboard shows at most this many Perutusan posts (mock `PERUTUSAN_LIMIT`). */
export const DASHBOARD_PERUTUSAN_LIMIT = 3

/**
 * k-cohort (BE-19 OQ-7): a group of fewer than this many pupils is never shown, whoever asks.
 * TODO(BE-19 merge): import `MIN_COHORT` from `reports/performance/domain/constants` instead of repeating the number.
 */
export const K_COHORT = 5
