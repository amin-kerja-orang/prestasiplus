import type { RateLimitSpec } from '../../common/throttle'

/**
 * Throttle of the Mohon Keluarga Angkat write (D57a), per signed-in user. The 422 for an unknown e-mail tells a caller
 * whether an address belongs to a student (OQ-API-B4-20), so the ceiling is deliberately low: a family applies once,
 * a retry after a validation error stays well inside it. Overridable with the environment variable (.env.api.example).
 */
export const SPONSORSHIP_LIMITS = {
  apply: { bucket: 'sponsorship.apply', env: 'THROTTLE_FOSTER_APPLICATION_PER_MINUTE', default: 5, per: 'user' },
} as const satisfies Record<string, RateLimitSpec>
