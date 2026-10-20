import type pg from 'pg'

/** `--apply` was not explicitly allowed for this environment or database. */
export class ApplyGuardError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ApplyGuardError'
  }
}

const PRODUCTION = /^\s*prod(uction)?\s*$/i

/** Host name of a connection URL (never user, password or query); `unknown host` when it cannot be read. */
function hostOf(url: string | undefined): string {
  if (!url) return 'unknown host'
  try {
    return new URL(url).hostname || 'unknown host'
  } catch {
    return 'unknown host'
  }
}

/**
 * Guards `--apply` against running on the wrong database (security M3). Needs
 * `PP_ALLOW_MIGRATE_APPLY=1`; in production (`production` or `prod`, any case) also
 * `PP_MIGRATE_TARGET_DB` equal to the `current_database()` of `pool`. Returns the line to print
 * (host and database name only, no credentials).
 *
 * One implementation for both layers: the CLI calls it early, and `Runner.run({ mode: 'apply' })`
 * calls it again before it takes a lock or starts a batch, so no caller can bypass the rule.
 */
export async function assertApplyAllowed(
  pool: Pick<pg.Pool, 'query'>,
  env: Readonly<Record<string, string | undefined>>,
): Promise<string> {
  if (env.PP_ALLOW_MIGRATE_APPLY !== '1') {
    throw new ApplyGuardError('Refusing --apply: set PP_ALLOW_MIGRATE_APPLY=1 to allow writes by the migration kit.')
  }
  const res = await pool.query<{ db: string }>('SELECT current_database() AS db')
  const db = res.rows[0]?.db ?? ''
  if (PRODUCTION.test(env.NODE_ENV ?? '') && env.PP_MIGRATE_TARGET_DB !== db) {
    throw new ApplyGuardError(
      `Refusing --apply in production: PP_MIGRATE_TARGET_DB must equal the connected database name ("${db}") on ${hostOf(env.DATABASE_URL)}.`,
    )
  }
  return `--apply target: database "${db}" on ${hostOf(env.DATABASE_URL)}`
}
