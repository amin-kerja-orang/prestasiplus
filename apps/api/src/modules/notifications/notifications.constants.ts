import type { RateLimitSpec } from '../../common/throttle'

/** Hard cap of a bulk id list (contract: non-empty; the cap is an implementation limit, see deviations). */
export const NOTIFICATION_BULK_MAX = 500

/** Length limits of what other modules hand to `NotificationsService.push`. */
export const NOTIFICATION_LIMITS = { type: 64, title: 200, body: 2000 } as const

export const NOTIFICATION_BULK_TOO_MANY = `The ids field must not have more than ${String(NOTIFICATION_BULK_MAX)} items.`

/** Limiter specs (common/throttle), per signed-in user. Ceilings come from env, else the default. */
export const NOTIFICATION_LIMITS_RATE = {
  read: { bucket: 'notifications.read', env: 'THROTTLE_NOTIFICATION_READ_PER_MINUTE', default: 240, per: 'user' },
  write: { bucket: 'notifications.write', env: 'THROTTLE_NOTIFICATION_WRITE_PER_MINUTE', default: 60, per: 'user' },
} as const satisfies Record<string, RateLimitSpec>
