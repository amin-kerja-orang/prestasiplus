import type { RateLimitSpec } from '../../../common/throttle'

/** Throttles of the BE-18 missions and remedial routes (D57): per user, one bucket per kind. */
export const MISSION_LIMITS = {
  read: { bucket: 'missions.read', env: 'THROTTLE_CLASSES_READ_PER_MINUTE', default: 300, per: 'user' },
  write: { bucket: 'missions.write', env: 'THROTTLE_CLASSES_WRITE_PER_MINUTE', default: 30, per: 'user' },
} as const satisfies Record<string, RateLimitSpec>
