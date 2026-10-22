import type { RateLimitSpec } from '../../common/throttle'

/** Dev default of MARKETPLACE_PLATFORM_WHATSAPP: fictitious (BE-46 open question 3). */
export const DEFAULT_PLATFORM_WHATSAPP = '60000000000'

/**
 * Limiter specs (common/throttle), per signed-in user. `view` guards the product page, which bumps a
 * counter (D57a); `write` guards the WhatsApp hand-off. The other reads move nothing and are not
 * limited (the contract lists no 429 for them). Ceilings come from env, else the default.
 */
export const MARKETPLACE_RATE = {
  view: { bucket: 'marketplace.view', env: 'THROTTLE_MARKETPLACE_VIEW_PER_MINUTE', default: 120, per: 'user' },
  write: { bucket: 'marketplace.write', env: 'THROTTLE_MARKETPLACE_WRITE_PER_MINUTE', default: 60, per: 'user' },
} as const satisfies Record<string, RateLimitSpec>
