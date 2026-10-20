import type { RateLimitSpec } from '../../common/throttle'

/** Audit actions of the support tickets. `details` carry ids only, never the subject or the body. */
export const SUPPORT_AUDIT = {
  TICKET_CREATED: 'support.ticket.created',
} as const

/**
 * Limiter specs (common/throttle). Ticket creation is limited per user and per hour (spam guard);
 * the support contact is public, so it is counted per client address. Ceilings come from env, else the default.
 */
export const SUPPORT_LIMITS = {
  create: { bucket: 'support.ticket.create', env: 'THROTTLE_SUPPORT_TICKET_CREATE_PER_HOUR', default: 10, per: 'user', windowSeconds: 3600 },
  read: { bucket: 'support.ticket.read', env: 'THROTTLE_SUPPORT_READ_PER_MINUTE', default: 120, per: 'user' },
  config: { bucket: 'support.config', env: 'THROTTLE_SUPPORT_CONFIG_PER_MINUTE', default: 60, per: 'ip' },
} as const satisfies Record<string, RateLimitSpec>

export const WRITE_TX = { maxWait: 10_000, timeout: 15_000 } as const

/** Notices go out in batches of this size, so a long admin list never opens many connections at once. */
export const NOTIFY_BATCH = 10

/** The singleton row of `support_config`. */
export const SUPPORT_CONFIG_ID = 1n

export const SUPPORT_CONFIG_MISSING = 'Konfigurasi sokongan tidak dijumpai.'
