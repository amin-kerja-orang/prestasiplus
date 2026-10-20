import type { RateLimitSpec } from '../../../common/throttle'

/** Throttle of the M11 read routes: per user, one bucket. The ceiling comes from the environment (.env.api.example). */
export const ANALYTICS_LIMITS = {
  read: { bucket: 'analytics.read', env: 'THROTTLE_ANALYTICS_READ_PER_MINUTE', default: 120, per: 'user' },
} as const satisfies Record<string, RateLimitSpec>

/** Monday of week M1 of the monitoring programme (BR-M11-15), 00:00 Asia/Kuala_Lumpur. */
export const MONITORING_START_DATE = '2026-02-16'
