import type { RateLimitSpec } from '../../../common/throttle'

/**
 * D57: the two dashboard reads are limited per signed-in user (counted per process). The ceiling comes from env, else the
 * default. They are aggregate queries, so the ceiling is lower than a plain list read.
 */
export const INTAKE_DASHBOARD_LIMITS = {
  read: { bucket: 'intake-dashboard.read', env: 'THROTTLE_INTAKE_DASHBOARD_READ_PER_MINUTE', default: 60, per: 'user' },
} as const satisfies Record<string, RateLimitSpec>

/**
 * BE-36's monthly cap variable (integer sen). BE-36 owns it (its env schema entry lands with that card); the dashboard
 * only reads it as the fallback when `ai_settings` has no row. A value that is not a non-negative integer is ignored.
 */
export const INTAKE_BUDGET_ENV = 'AI_MONTHLY_BUDGET_SEN'
