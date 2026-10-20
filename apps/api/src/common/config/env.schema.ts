import { isAbsolute } from 'node:path'

import { z } from 'zod'

/**
 * Environment of the API (plan section 11). Every key here must also be in `.env.api.example`
 * (and vice versa); a test enforces it. Later cards add their keys here in their own block.
 */
export const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const

export const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z.enum(LOG_LEVELS).default('info'),
  // PC-1 block (BE-02). The message must not echo the value (it holds a password).
  DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\//, 'must be a postgresql:// URL'),
  // BE-03 (auth). Optional here; the auth module applies the defaults and, in production, refuses to start
  // without a strong SESSION_SECRET.
  SESSION_COOKIE_NAME: z.string().min(1).optional(),
  // Required in production (see loadEnv); a fixed development default is applied outside production.
  SESSION_SECRET: z.string().optional(),
  COOKIE_DOMAIN: z.string().optional(),
  COOKIE_SECURE: z.enum(['true', 'false']).optional(),
  THROTTLE_LOGIN_PER_MINUTE: z.coerce.number().int().min(1).optional(),
  // BE-05 (schools): requests per minute, counted per process. Public routes per client address, admin routes per user.
  THROTTLE_PUBLIC_PER_MINUTE: z.coerce.number().int().min(1).default(60),
  // BE-06: self-registration attempts per minute per client address (own bucket, tolerant of a school behind one NAT).
  THROTTLE_REGISTER_PER_MINUTE: z.coerce.number().int().min(1).default(30),
  THROTTLE_PUBLIC_SEARCH_PER_MINUTE: z.coerce.number().int().min(1).default(300),
  THROTTLE_ADMIN_READ_PER_MINUTE: z.coerce.number().int().min(1).default(300),
  THROTTLE_ADMIN_WRITE_PER_MINUTE: z.coerce.number().int().min(1).default(30),
  // BE-05 (users): bulk imports per hour per user.
  THROTTLE_IMPORT_PER_HOUR: z.coerce.number().int().min(1).default(10),
  // BE-25 (parents): invite throttles, counted per process. Preview per client address; the others per user.
  THROTTLE_PARENT_INVITE_PREVIEW_PER_MINUTE: z.coerce.number().int().min(1).default(30),
  THROTTLE_PARENT_INVITE_READ_PER_MINUTE: z.coerce.number().int().min(1).default(120),
  THROTTLE_PARENT_INVITE_ISSUE_PER_HOUR: z.coerce.number().int().min(1).default(10),
  THROTTLE_PARENT_INVITE_ACCEPT_PER_HOUR: z.coerce.number().int().min(1).default(30),
  THROTTLE_PARENT_LINK_WRITE_PER_MINUTE: z.coerce.number().int().min(1).default(30),
  // BE-06 (notifications): inbox throttles per user, counted per process.
  THROTTLE_NOTIFICATION_READ_PER_MINUTE: z.coerce.number().int().min(1).default(240),
  THROTTLE_NOTIFICATION_WRITE_PER_MINUTE: z.coerce.number().int().min(1).default(60),
  // BE-24 part C (support, audio KBAT): throttles per user (the support contact per client address), counted per process.
  THROTTLE_SUPPORT_TICKET_CREATE_PER_HOUR: z.coerce.number().int().min(1).default(10),
  THROTTLE_SUPPORT_READ_PER_MINUTE: z.coerce.number().int().min(1).default(120),
  THROTTLE_SUPPORT_CONFIG_PER_MINUTE: z.coerce.number().int().min(1).default(60),
  THROTTLE_AUDIO_KBAT_READ_PER_MINUTE: z.coerce.number().int().min(1).default(120),
  THROTTLE_AUDIO_KBAT_FILE_PER_MINUTE: z.coerce.number().int().min(1).default(60),
  THROTTLE_AUDIO_KBAT_ATTEMPT_PER_MINUTE: z.coerce.number().int().min(1).default(30),
  THROTTLE_AUDIO_KBAT_ADMIN_WRITE_PER_HOUR: z.coerce.number().int().min(1).default(20),
  // BE-05 (users): HMAC key of the IC number hash. Unset: SESSION_SECRET is used (required in production). Rotating it breaks IC lookups until every ic_hash is recomputed.
  IC_HASH_KEY: z.preprocess((v) => (v === '' ? undefined : v), z.string().min(16).optional()),
  /** BE-24: extra origins (comma separated, e.g. https://app.example) whose /api/files/<token> URLs an article or banner image may use, besides the API's own origin. */
  PUBLIC_ORIGINS: z.string().optional(),
  /** Reverse-proxy hops to trust for the client address (0 = none). */
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(0),
  /** Lifetime of a "remember me" session in days (LEAD decision: 30). */
  SESSION_REMEMBER_DAYS: z.coerce.number().int().min(1).default(30),
  /** Remember lifetime in days for admin and school_admin; 0 turns remember off for them. */
  SESSION_REMEMBER_DAYS_STAFF: z.coerce.number().int().min(0).default(1),
  /** Allow seeding the demo accounts (never in production). */
  ALLOW_DEMO_SEED: z
    .enum(['true', 'false', '1', '0'])
    .default('false')
    .transform((v) => v === 'true' || v === '1'),
  /** Cost (4..13) of the throw-away bcrypt hash that evens out login timing for unknown accounts. */
  LEGACY_BCRYPT_DUMMY_COST: z.coerce.number().int().min(4).max(13).default(12),
  /** A failed login (wrong password, unknown identifier) never answers sooner than this many ms (timing oracle floor). */
  LOGIN_FAILURE_FLOOR_MS: z.coerce.number().int().min(0).max(10_000).default(1500),
  /** Failed logins per 15 minutes for one identifier across all addresses, before 429. */
  LOGIN_IDENTIFIER_FAIL_LIMIT: z.coerce.number().int().min(5).default(100),
  // BE-04 (files). Optional here; FilesConfig applies the defaults (10, 20, 30, 120). FILE_STORAGE_DIR is required in production and must be an absolute path (see loadEnv).
  FILE_STORAGE_DIR: z.string().trim().min(1).optional(),
  /** Global ceiling of one upload in MB; each purpose has its own, lower limit. */
  MAX_UPLOAD_MB: z.coerce.number().int().min(1).max(100).optional(),
  /** Ceiling of a derived intake file (page image, figure crop, original) in MB. */
  INTAKE_MAX_FILE_MB: z.coerce.number().int().min(1).max(200).optional(),
  /** Uploads and file deletes per user per minute before 429. */
  UPLOAD_RATE_PER_MINUTE: z.coerce.number().int().min(1).max(1000).optional(),
  /** Downloads per user per minute (anonymous cms_image reads: per address) before 429. */
  FILE_READS_PER_MINUTE: z.coerce.number().int().min(1).max(10000).optional(),
  // BE-06 (account). Optional: the code applies 30 writes per minute per user when unset.
  THROTTLE_ACCOUNT_WRITE_PER_MINUTE: z.coerce.number().int().min(1).optional(),
  // BE-06: development only. true lets the logging MailPort print the password reset link (a secret) to the log. Ignored outside NODE_ENV=development; refused at start in production.
  MAIL_LOG_RESET_LINKS: z.enum(['true', 'false']).optional(),
})
export type Env = z.infer<typeof EnvSchema>

/** Parse and validate raw env; the error message names every offending key. */
export function loadEnv(raw: Record<string, unknown> = process.env): Env {
  const parsed = EnvSchema.safeParse(raw)
  if (parsed.success) return withSessionSecret(parsed.data)
  const problems = parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
  throw new Error(`Invalid environment configuration. ${problems.join('; ')}`)
}

export const DEV_SESSION_SECRET = 'dev-only-session-secret-not-for-production'
const MIN_SECRET_LENGTH = 16
const MIN_IC_KEY_LENGTH = 32

/** SESSION_SECRET and IC_HASH_KEY: strong values are mandatory in production (boot fails; no fallback between them); other environments get a dev default. */
function withSessionSecret(env: Env): Env {
  if (env.NODE_ENV !== 'production') return { ...env, SESSION_SECRET: env.SESSION_SECRET || DEV_SESSION_SECRET }
  const secret = env.SESSION_SECRET
  if (!secret || secret.length < MIN_SECRET_LENGTH || secret === 'change-me') {
    throw new Error(
      `Invalid environment configuration. SESSION_SECRET: required in production, at least ${MIN_SECRET_LENGTH} characters and not the placeholder`,
    )
  }
  const icKey = env.IC_HASH_KEY
  if (!icKey || icKey.length < MIN_IC_KEY_LENGTH || icKey === secret) {
    throw new Error(
      `Invalid environment configuration. IC_HASH_KEY: required in production, at least ${MIN_IC_KEY_LENGTH} characters and different from SESSION_SECRET`,
    )
  }
  if (env.MAIL_LOG_RESET_LINKS === 'true') {
    throw new Error('Invalid environment configuration. MAIL_LOG_RESET_LINKS: must not be true in production (it would write reset links to the log)')
  }
  const dir = env.FILE_STORAGE_DIR
  if (!dir || !isAbsolute(dir)) {
    throw new Error('Invalid environment configuration. FILE_STORAGE_DIR: required in production and must be an absolute path')
  }
  return env
}
