import type { RateLimitSpec } from '../../../common/throttle'

/** Throttles of the BE-18 missions and remedial routes (D57): per user, one bucket per kind. */
export const MISSION_LIMITS = {
  read: { bucket: 'missions.read', env: 'THROTTLE_CLASSES_READ_PER_MINUTE', default: 300, per: 'user' },
  write: { bucket: 'missions.write', env: 'THROTTLE_CLASSES_WRITE_PER_MINUTE', default: 30, per: 'user' },
} as const satisfies Record<string, RateLimitSpec>

/** BR-M10-11: a topic needs at least this many answers to be judged. */
export const WEAK_MIN_ANSWERS = 2
/** BR-M10-11: weak below this accuracy (percent). */
export const WEAK_BELOW = 50
/** BR-M10-12: a remedial test holds at most this many questions. */
export const REMEDIAL_MAX_QUESTIONS = 10

/** `audit_events.action` names of this half (ids only, never names or text). */
export const MISSION_AUDIT = {
  REMEDIAL_GENERATED: 'classes.remedial.generated',
  REMEDIAL_CANCELLED: 'classes.remedial.cancelled',
} as const
