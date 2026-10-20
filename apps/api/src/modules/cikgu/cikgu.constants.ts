import type { RateLimitSpec } from '../../common/throttle'

/**
 * Throttles of the Cikgu Alesa routes (D57a/b), per user, one bucket per kind. Ceilings come from the environment
 * (documented in .env.api.example). `send` is the per-minute guard against hammering the AI; the DAILY turn quota is a
 * separate rule (BR-M13-06) and does not depend on these.
 */
export const CIKGU_LIMITS = {
  send: { bucket: 'cikgu.send', env: 'THROTTLE_CIKGU_SEND_PER_MINUTE', default: 20, per: 'user' },
  read: { bucket: 'cikgu.read', env: 'THROTTLE_CIKGU_READ_PER_MINUTE', default: 120, per: 'user' },
  write: { bucket: 'cikgu.write', env: 'THROTTLE_CIKGU_WRITE_PER_MINUTE', default: 30, per: 'user' },
  // The CSV is a bulk read of pupils' names: its own, tighter bucket.
  export: { bucket: 'cikgu.export', env: 'THROTTLE_CIKGU_EXPORT_PER_MINUTE', default: 10, per: 'user' },
} as const satisfies Record<string, RateLimitSpec>

/** Transaction limits of a turn: serialised by the per-user lock, so a burst of turns of one user waits here. */
export const WRITE_TX = { maxWait: 10_000, timeout: 15_000 } as const

/** Seconds a client is told to wait when the database is overloaded (a retryable 429, never a 500). */
export const OVERLOAD_RETRY_AFTER = 5
