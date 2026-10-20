import type { RateLimitSpec } from '../../../common/throttle'

/** Throttles of the Kirkpatrick and feedback routes: per user, one bucket per kind (D57). Ceilings come from the environment (.env.api.example). */
export const KIRKPATRICK_LIMITS = {
  read: { bucket: 'kirkpatrick.read', env: 'THROTTLE_KIRKPATRICK_READ_PER_MINUTE', default: 120, per: 'user' },
  write: { bucket: 'kirkpatrick.write', env: 'THROTTLE_KIRKPATRICK_WRITE_PER_MINUTE', default: 30, per: 'user' },
} as const satisfies Record<string, RateLimitSpec>
