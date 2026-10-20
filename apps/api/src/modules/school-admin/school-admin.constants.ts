import type { RateLimitSpec } from '../../common/throttle'

/** Audit actions of the school admin. `details` carry ids only, never names, e-mails or phone numbers. */
export const SCHOOL_ADMIN_AUDIT = {
  TEACHER_VERIFIED: 'school_admin.teacher.verified',
  TEACHER_CREATED: 'school_admin.teacher.created',
  TEACHER_UPDATED: 'school_admin.teacher.updated',
  TEACHER_TOGGLED: 'school_admin.teacher.toggled',
  TEACHER_PASSWORD_RESET: 'school_admin.teacher.password_reset',
  TEACHER_EXPORTED: 'school_admin.teacher.exported',
  PUPIL_CREATED: 'school_admin.pupil.created',
  PUPIL_UPDATED: 'school_admin.pupil.updated',
  PUPIL_TOGGLED: 'school_admin.pupil.toggled',
  PUPIL_PASSWORD_RESET: 'school_admin.pupil.password_reset',
  PUPIL_EXPORTED: 'school_admin.pupil.exported',
  AMARAN_EXPORTED: 'school_admin.amaran.exported',
} as const

/**
 * Limiter specs (common/throttle), per signed-in user and counted per process. Ceilings come from env, else the default.
 * `write` also covers the verify action (a school admin verifies a handful of teachers, never hundreds).
 */
export const SCHOOL_ADMIN_LIMITS = {
  read: { bucket: 'school-admin.read', env: 'THROTTLE_SCHOOL_ADMIN_READ_PER_MINUTE', default: 120, per: 'user' },
  write: { bucket: 'school-admin.write', env: 'THROTTLE_SCHOOL_ADMIN_WRITE_PER_MINUTE', default: 30, per: 'user' },
  create: { bucket: 'school-admin.create', env: 'THROTTLE_SCHOOL_ADMIN_CREATE_PER_MINUTE', default: 10, per: 'user' },
  reset: { bucket: 'school-admin.reset', env: 'THROTTLE_SCHOOL_ADMIN_RESET_PER_MINUTE', default: 10, per: 'user' },
  export: { bucket: 'school-admin.export', env: 'THROTTLE_SCHOOL_ADMIN_EXPORT_PER_MINUTE', default: 5, per: 'user' },
} as const satisfies Record<string, RateLimitSpec>

export const WRITE_TX = { maxWait: 10_000, timeout: 15_000 } as const

/** The dashboard shows at most this many Perutusan posts (mock `PERUTUSAN_LIMIT`). */
export const DASHBOARD_PERUTUSAN_LIMIT = 3

/**
 * k-cohort (BE-19 OQ-7): a group of fewer than this many pupils is never shown, whoever asks.
 * TODO(BE-19 merge): import `MIN_COHORT` from `reports/performance/domain/constants` instead of repeating the number.
 */
export const K_COHORT = 5
