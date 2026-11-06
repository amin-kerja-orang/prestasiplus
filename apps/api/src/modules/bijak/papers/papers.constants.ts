import type { RateLimitSpec } from '../../../common/throttle'

/** Rate limits of the Bijak papers routes (per signed-in user; environment variables are documented in .env.api.example). */
export const BIJAK_PAPERS_LIMITS = {
  read: { bucket: 'bijak.papers.read', env: 'THROTTLE_BIJAK_PAPERS_READ_PER_MINUTE', default: 240, per: 'user' },
} as const satisfies Record<string, RateLimitSpec>
