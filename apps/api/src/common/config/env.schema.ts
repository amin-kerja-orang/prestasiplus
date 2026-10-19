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
  /** Reverse-proxy hops to trust for the client address (0 = none). */
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(0),
  /** Lifetime of a "remember me" session in days (LEAD decision: 30). */
  SESSION_REMEMBER_DAYS: z.coerce.number().int().min(1).default(30),
  /** Remember lifetime in days for admin and school_admin; 0 turns remember off for them. */
  SESSION_REMEMBER_DAYS_STAFF: z.coerce.number().int().min(0).default(1),
  /** Allow seeding the demo accounts (never in production). */
  ALLOW_DEMO_SEED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
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

/** SESSION_SECRET: a strong value is mandatory in production (boot fails); other environments get a dev default. */
function withSessionSecret(env: Env): Env {
  if (env.NODE_ENV !== 'production') return { ...env, SESSION_SECRET: env.SESSION_SECRET || DEV_SESSION_SECRET }
  const secret = env.SESSION_SECRET
  if (!secret || secret.length < MIN_SECRET_LENGTH || secret === 'change-me') {
    throw new Error(
      `Invalid environment configuration. SESSION_SECRET: required in production, at least ${MIN_SECRET_LENGTH} characters and not the placeholder`,
    )
  }
  return env
}
