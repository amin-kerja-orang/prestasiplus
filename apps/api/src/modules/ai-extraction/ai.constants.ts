import type { AiProviderId } from '@pp/contract'

import type { RateLimitSpec } from '../../common/throttle'

/** DI tokens. Tests override them; production binds the defaults in `AiExtractionModule`. */
export const AI_PROVIDER = Symbol('AI_PROVIDER')
/** fetch-shaped transport (see `AiFetch`). The default pins the connection to the validated address. */
export const AI_FETCH = Symbol('AI_FETCH')
/** `(hostname) => addresses` used by the SSRF check. */
export const AI_RESOLVER = Symbol('AI_RESOLVER')
/** `(ms, signal?) => Promise<void>` used for the retry backoff. */
export const AI_SLEEP = Symbol('AI_SLEEP')

/** Wire provider code to database code (`openai-compatible` has a hyphen on the wire, an underscore in the database). */
export const toDbProvider = (id: AiProviderId): string => id.replace('-', '_')
export const fromDbProvider = (db: string): AiProviderId => db.replace('_', '-') as AiProviderId

/** Notification `type` codes (open-ended, lower-case) written through `NotificationsService`. */
export const AI_NOTIFICATION_TYPES = {
  budgetWarning: 'ai_budget_warning',
  budgetCapped: 'ai_budget_capped',
} as const

/** Per-user rate limits of the four admin routes (counted per process). The ceiling comes from env, else the default. */
export const AI_LIMITS = {
  read: { bucket: 'ai-read', env: 'THROTTLE_AI_READ_PER_MINUTE', default: 120, per: 'user' },
  write: { bucket: 'ai-write', env: 'THROTTLE_AI_WRITE_PER_MINUTE', default: 20, per: 'user' },
} as const satisfies Record<string, RateLimitSpec>

/** Defaults of the service limits (all overridable by env, documented in `.env.api.example`). */
export const AI_DEFAULTS = {
  timeoutMs: 60_000,
  maxConcurrency: 2,
  ratePerMin: 30,
  ratePerUserPerMin: 10,
  ratePerSchoolPerMin: 20,
  maxRetries: 3,
  retryBaseMs: 1000,
  retryMaxMs: 30_000,
  maxOutputTokens: 8192,
  warnPercent: 80,
} as const

/** Audit actions of this module (written to `audit_events.action`; no content, only the old and new settings). */
export const AI_AUDIT_ACTIONS = {
  SETTINGS_UPDATED: 'ai.settings.updated',
} as const
