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
})
export type Env = z.infer<typeof EnvSchema>

/** Parse and validate raw env; the error message names every offending key. */
export function loadEnv(raw: Record<string, unknown> = process.env): Env {
  const parsed = EnvSchema.safeParse(raw)
  if (parsed.success) return parsed.data
  const problems = parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
  throw new Error(`Invalid environment configuration. ${problems.join('; ')}`)
}
