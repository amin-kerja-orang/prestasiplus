/**
 * Destructive-operation guard and server identity (BE-27 hardening M1, L1).
 *
 * `staging:load` drops and recreates `staging_cloud` and `archive_cloud`. It refuses unless ALL hold:
 *   (a) the target `current_database()` ends in `_staging`, or is listed in `PP_STAGING_DB_ALLOWLIST`
 *       (comma separated database names);
 *   (b) `PP_ALLOW_STAGING_RESET=1`;
 *   (c) `NODE_ENV` is not `production`.
 * The refusal happens before any DDL.
 */
import type pg from 'pg'

export class StagingResetRefusedError extends Error {}

type Env = Readonly<Record<string, string | undefined>>

/** The reasons a reset is refused (empty when allowed). Pure, so it is easy to test. */
export function stagingResetRefusals(database: string, env: Env): string[] {
  const reasons: string[] = []
  const allow = (env.PP_STAGING_DB_ALLOWLIST ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  if (!/_staging$/.test(database) && !allow.includes(database)) {
    reasons.push(`the target database "${database}" is not a staging database (its name must end in "_staging" or be listed in PP_STAGING_DB_ALLOWLIST)`)
  }
  if (env.PP_ALLOW_STAGING_RESET !== '1') reasons.push('PP_ALLOW_STAGING_RESET=1 is not set')
  if (env.NODE_ENV === 'production') reasons.push('NODE_ENV is production')
  return reasons
}

export async function assertStagingResetAllowed(db: pg.Pool | pg.ClientBase, env: Env): Promise<void> {
  const res = await db.query<{ db: string }>('select current_database() as db')
  const reasons = stagingResetRefusals(res.rows[0]?.db ?? '', env)
  if (reasons.length > 0) {
    throw new StagingResetRefusedError(
      `Refusing to drop and recreate staging_cloud and archive_cloud: ${reasons.join('; ')}. Nothing was changed.`,
    )
  }
}

export interface ServerIdentity {
  database: string
  address: string | null
  port: number | null
  /** `pg_control_system().system_identifier`, or null when the role may not read it. */
  systemId: string | null
}

/** Who the connection really talks to, from the server itself (not from the URL text). */
export async function serverIdentity(db: pg.Pool | pg.ClientBase): Promise<ServerIdentity> {
  const base = await db.query<{ database: string; address: string | null; port: number | null }>(
    `select current_database() as database, inet_server_addr()::text as address, inet_server_port() as port`,
  )
  let systemId: string | null = null
  try {
    const sys = await db.query<{ id: string }>('select system_identifier::text as id from pg_control_system()')
    systemId = sys.rows[0]?.id ?? null
  } catch {
    // not readable for this role: fall back to address and port
  }
  const row = base.rows[0] as { database: string; address: string | null; port: number | null }
  return { database: row.database, address: row.address, port: row.port, systemId }
}

/** Same database on the same server. Without a system id, address and port must also match. */
export function sameServerDatabase(a: ServerIdentity, b: ServerIdentity): boolean {
  if (a.database !== b.database) return false
  if (a.systemId && b.systemId) return a.systemId === b.systemId
  return a.address === b.address && a.port === b.port
}
