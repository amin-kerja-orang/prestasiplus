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
