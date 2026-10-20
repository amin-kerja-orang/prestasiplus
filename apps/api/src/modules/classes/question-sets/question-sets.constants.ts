import type { RateLimitSpec } from '../../../common/throttle'

/** Throttles of the BE-18 question set, paper, template and DSKP routes (D57): per user, one bucket per kind. */
export const QUESTION_SET_LIMITS = {
  read: { bucket: 'question-sets.read', env: 'THROTTLE_CLASSES_READ_PER_MINUTE', default: 300, per: 'user' },
  write: { bucket: 'question-sets.write', env: 'THROTTLE_CLASSES_WRITE_PER_MINUTE', default: 30, per: 'user' },
} as const satisfies Record<string, RateLimitSpec>
