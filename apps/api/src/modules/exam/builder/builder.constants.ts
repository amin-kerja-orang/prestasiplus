import type { RateLimitSpec } from '../../../common/throttle'

/**
 * Rate limits of the paper builder and blueprint admin routes (BE-39), per signed-in Admin Pusat
 * user. The environment variables are documented in `.env.api.example`. The preview is a POST that
 * reads, so it shares the write bucket (it is a write in the contract, D57a).
 */
export const BIJAK_BUILDER_LIMITS = {
  read: { bucket: 'bijak.builder.read', env: 'THROTTLE_BIJAK_BUILDER_READ_PER_MINUTE', default: 240, per: 'user' },
  write: { bucket: 'bijak.builder.write', env: 'THROTTLE_BIJAK_BUILDER_WRITE_PER_MINUTE', default: 60, per: 'user' },
} as const satisfies Record<string, RateLimitSpec>

/** Default page size of `GET /admin/papers` and `GET /admin/blueprints` (contract max 100). */
export const BIJAK_BUILDER_PAGE_SIZE = 20

/** The editor picker shows at most this many candidates (BE-39, security review M3). */
export const MAX_EDITOR_CANDIDATES = 1000
/** Extra candidates the source returns, because the editor drops those already on the paper before it caps. */
export const CANDIDATE_SLACK = 500
