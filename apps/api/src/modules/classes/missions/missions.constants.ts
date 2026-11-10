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
  MISSION_CREATED: 'classes.mission.created',
  MISSION_DELETED: 'classes.mission.deleted',
} as const

/**
 * Wallet ledger `source` of a mission reward (S6-T07, issue #483): the once-only target reward of a teacher mission and a reached Global
 * goal. The key is `(user, mission_target, mission:<missionId>)`, so the wallet itself also refuses a second payment for one pupil and
 * mission. The description is static BM text (no name, no identifier).
 */
export const MISSION_REWARD_SOURCE = 'mission_target'
export const MISSION_REWARD_DESCRIPTION = 'Ganjaran misi'

/** ERR-GAME-17 (48 Game spec): `rewardCoins` above `mission_reward_max`, 422. The form shows the field text of the contract; this is the API answer. */
export const MISSION_REWARD_TOO_HIGH = { code: 'MISSION_REWARD_TOO_HIGH', message: 'Ganjaran misi melebihi had.' } as const
