import type { RateLimitSpec } from '../../common/throttle'

/**
 * The free-trial question limit (mock M05 BR-07, a provisional M19 rule, open question 2 of BE-25).
 * The ONE place the number lives: `SubscriptionService.trial` reads it and nothing else repeats it.
 */
export const TRIAL_LIMIT = 50

/** Audit actions of this module. `details` carry ids, counts and field names only. */
export const SUBSCRIPTION_AUDIT = {
  CREATED: 'subscriptions.created',
  QUOTA_CHANGED: 'subscriptions.quota_changed',
  EXTENDED: 'subscriptions.extended',
  UPGRADED: 'subscriptions.upgraded',
  CANCELLED: 'subscriptions.cancelled',
  PACKAGE_ASSIGNED: 'subscriptions.user_package_assigned',
  STUDENTS_IMPORTED: 'students.imported',
  COMP_REGISTERED: 'comp_students.registered',
  COMP_COINS_TOGGLED: 'comp_students.coins_toggled',
  COMP_ACTIVE_TOGGLED: 'comp_students.active_toggled',
  COMP_BULK_ACTION: 'comp_students.bulk_action',
} as const

/** Months of a new subscription by tier (mock `TERM_MONTHS`, BR-31). */
export const TERM_MONTHS = { basic: 1, full: 12 } as const
/** Question limit of a `basic` (Pemantauan) subscription (mock BR-22 / DV-M02-08). */
export const BASIC_QUESTION_LIMIT = 500
/** The renewal invoice covers this many months after the current end (mock BR-30). */
export const RENEWAL_MONTHS = 12
/** Largest page number honoured (keeps `skip` inside a 32-bit integer). */
export const PAGE_NUMBER_MAX = 10_000_000

/** Write transaction limits (the import hashes first, so it only inserts). */
export const WRITE_TX = { maxWait: 10_000, timeout: 15_000 } as const
export const IMPORT_TX = { maxWait: 20_000, timeout: 60_000 } as const

/** Limiter specs (common/throttle). Env names are shared with the BE-05 admin routes; buckets are this module's own. */
export const SUBSCRIPTION_LIMITS = {
  read: { bucket: 'subscriptions.admin.read', env: 'THROTTLE_ADMIN_READ_PER_MINUTE', default: 300, per: 'user' },
  write: { bucket: 'subscriptions.admin.write', env: 'THROTTLE_ADMIN_WRITE_PER_MINUTE', default: 30, per: 'user' },
  // Bulk account creation: same per-hour ceiling variable as the user import, separate counter.
  import: { bucket: 'subscriptions.student-import', env: 'THROTTLE_IMPORT_PER_HOUR', default: 10, per: 'user', windowSeconds: 3600 },
} as const satisfies Record<string, RateLimitSpec>
