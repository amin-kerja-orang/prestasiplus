import type { RateLimitSpec } from '../../common/throttle'

/**
 * Rate limits of the curriculum admin routes (D57a, BE-08 follow-up, LEAD 2026-10-20). Same pattern
 * as the other admin modules (users, schools, subscriptions): every admin WRITE (create, update,
 * active toggle, delete) is limited per signed-in user, 30 per minute by default, ceiling from
 * `THROTTLE_ADMIN_WRITE_PER_MINUTE` (already in `.env.api.example`; no new variable). The curriculum
 * has its own counter (`bucket`), so curriculum edits do not eat the budget of user or school edits.
 * Reads are not limited here: the learner reads are public-ish lookups, and admin reads are cheap.
 */
export const CURRICULUM_LIMITS = {
  write: { bucket: 'curriculum.admin.write', env: 'THROTTLE_ADMIN_WRITE_PER_MINUTE', default: 30, per: 'user' },
} as const satisfies Record<string, RateLimitSpec>
