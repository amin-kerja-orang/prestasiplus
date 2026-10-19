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
  THROTTLE_PUBLIC_SEARCH_PER_MINUTE: z.coerce.number().int().min(1).default(300),
  THROTTLE_ADMIN_READ_PER_MINUTE: z.coerce.number().int().min(1).default(300),
  THROTTLE_ADMIN_WRITE_PER_MINUTE: z.coerce.number().int().min(1).default(30),
  // BE-05 (users): bulk imports per hour per user.
  THROTTLE_IMPORT_PER_HOUR: z.coerce.number().int().min(1).default(10),
  // BE-05 (users): HMAC key of the IC number hash. Unset: SESSION_SECRET is used (required in production). Rotating it breaks IC lookups until every ic_hash is recomputed.
  IC_HASH_KEY: z.preprocess((v) => (v === '' ? undefined : v), z.string().min(16).optional()),
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
  return env
}
