import type { RateLimitSpec } from '../../../../common/throttle'

/**
 * Rate limit of the import writes (admin and Guru): per signed-in user, own counter, ceiling from the
 * existing `THROTTLE_ADMIN_WRITE_PER_MINUTE` (no new variable). Reads are not limited.
 */
export const IMPORT_LIMITS = {
  write: { bucket: 'questions.import.write', env: 'THROTTLE_ADMIN_WRITE_PER_MINUTE', default: 30, per: 'user' },
} as const satisfies Record<string, RateLimitSpec>
