/**
 * The only connection to .cloud data (BE-27, BE-MIG-05, plan 9 and 14.1 item 4).
 *
 * `CLOUD_SOURCE_URL` is a PostgreSQL URL of the lead's restore of the anonymised dump (the
 * production MySQL is never reachable from here; a MySQL driver is out of scope, see the runbook).
 * Before ANY table is read the connection checks that its role, and every role it is a MEMBER of
 * (also without INHERIT), cannot write:
 *
 *   - not a superuser, no CREATEDB / CREATEROLE, not a member of pg_write_server_files,
 *     pg_read_server_files, pg_execute_server_program or pg_write_all_data;
 *   - no CREATE privilege on the database or on any non-system schema (DDL);
 *   - no INSERT, UPDATE (also on a column), DELETE or TRUNCATE on any relation outside the system schemas;
 *   - no USAGE or UPDATE on any sequence (nextval changes state);
 *   - no EXECUTE on a SECURITY DEFINER function in a non-system schema (it runs with its owner's rights).
 *
 * TEMP on the database is only REPORTED (`warnings`), not refused: PostgreSQL grants it to PUBLIC by
 * default, it only creates session-local objects that cannot touch source tables, and the reads run
 * in a read-only transaction anyway. Refusing it would reject every default role for no gain.
 *
 * Otherwise `CloudSource.open` throws `ReadOnlyViolationError` and the connection is closed without
 * a single table having been read. Reads run inside `BEGIN READ ONLY` as a second barrier.
 * A non-loopback host needs sslmode=require or verify-full. The source and the target are compared
 * through server queries (database name plus system identifier, or address and port), not URL text.
 * Error messages carry privilege names and object names only: never the URL, user or password.
 */
import pg from 'pg'

import { quoteIdent } from './kit/sql'
import { sameServerDatabase, serverIdentity, type ServerIdentity } from './staging/guard'
import { scrub, secretsFromUrl } from './staging/log'

export class CloudSourceConfigError extends Error {}
export class CloudSourceConnectError extends Error {}

export class ReadOnlyViolationError extends Error {
  constructor(readonly violations: readonly string[]) {
    super(
      `The cloud source role is not read-only, so nothing was read. Use a role with SELECT only. Violations: ${violations
        .slice(0, 20)
        .join('; ')}${violations.length > 20 ? `; ... (${violations.length} in total)` : ''}.`,
    )
  }
}

export type SourceRow = Record<string, unknown>

export interface OpenCloudSourceOptions {
  /** Value of `CLOUD_SOURCE_URL`. */
  url: string | undefined
  /** Schema that holds the source tables (default `public`). */
  schema?: string
  /** Identity of the target database (from `serverIdentity`): the source must never be that database. */
  target?: ServerIdentity
}

const SYSTEM_SCHEMAS = `n.nspname not like 'pg\\_%' and n.nspname <> 'information_schema'`
const DANGEROUS_ROLES = ['pg_write_server_files', 'pg_read_server_files', 'pg_execute_server_program', 'pg_write_all_data']

interface RoleRow {
  oid: string
  rolname: string
  rolsuper: boolean
  rolcreatedb: boolean
  rolcreaterole: boolean
}

async function roleViolations(client: pg.ClientBase, role: RoleRow, prefix: string): Promise<string[]> {
  const v: string[] = []
  if (role.rolsuper) v.push(`${prefix}SUPERUSER`)
  if (role.rolcreatedb) v.push(`${prefix}CREATEDB`)
  if (role.rolcreaterole) v.push(`${prefix}CREATEROLE`)
  const id = role.oid

  const db = await client.query<{ can: boolean }>(
    `select has_database_privilege($1::oid, current_database(), 'CREATE') as can`,
    [id],
  )
  if (db.rows[0]?.can) v.push(`${prefix}CREATE on the database`)

  const schemas = await client.query<{ nspname: string }>(
    `select n.nspname from pg_namespace n
      where ${SYSTEM_SCHEMAS} and has_schema_privilege($1::oid, n.oid, 'CREATE') order by 1`,
    [id],
  )
  for (const row of schemas.rows) v.push(`${prefix}CREATE on schema ${row.nspname}`)

  const tables = await client.query<{ nspname: string; relname: string; privs: string[] }>(
    `select n.nspname, c.relname,
            array_remove(array[
              case when has_table_privilege($1::oid, c.oid, 'INSERT') or has_any_column_privilege($1::oid, c.oid, 'INSERT') then 'INSERT' end,
              case when has_table_privilege($1::oid, c.oid, 'UPDATE') or has_any_column_privilege($1::oid, c.oid, 'UPDATE') then 'UPDATE' end,
              case when has_table_privilege($1::oid, c.oid, 'DELETE') then 'DELETE' end,
              case when has_table_privilege($1::oid, c.oid, 'TRUNCATE') then 'TRUNCATE' end
            ], null) as privs
       from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where c.relkind in ('r', 'p', 'v', 'm', 'f') and ${SYSTEM_SCHEMAS}
      order by 1, 2`,
    [id],
  )
  for (const row of tables.rows) {
    if (row.privs.length > 0) v.push(`${prefix}${row.privs.join('+')} on ${row.nspname}.${row.relname}`)
  }

  const sequences = await client.query<{ nspname: string; relname: string }>(
    `select n.nspname, c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where c.relkind = 'S' and ${SYSTEM_SCHEMAS}
        and (has_sequence_privilege($1::oid, c.oid, 'USAGE') or has_sequence_privilege($1::oid, c.oid, 'UPDATE'))
      order by 1, 2`,
    [id],
  )
  for (const row of sequences.rows) v.push(`${prefix}USAGE or UPDATE on sequence ${row.nspname}.${row.relname}`)

  const functions = await client.query<{ nspname: string; proname: string }>(
    `select n.nspname, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where p.prosecdef and ${SYSTEM_SCHEMAS} and has_function_privilege($1::oid, p.oid, 'EXECUTE')
      order by 1, 2`,
    [id],
  )
  for (const row of functions.rows) v.push(`${prefix}EXECUTE on SECURITY DEFINER function ${row.nspname}.${row.proname}`)
  return v
}

export interface WriteCheck {
  violations: string[]
  warnings: string[]
}

/** Checks the connected role and every role it is a member of. Empty `violations` means read-only. */
export async function findWritePrivileges(client: pg.ClientBase): Promise<WriteCheck> {
  const meRes = await client.query<RoleRow>(
    'select oid::text as oid, rolname, rolsuper, rolcreatedb, rolcreaterole from pg_roles where rolname = current_user',
  )
  const me = meRes.rows[0]
  if (!me) return { violations: ['the connected role is unknown'], warnings: [] }
  // pg_has_role() is true for every role when the caller is a superuser: no point listing them.
  if (me.rolsuper) return { violations: ['role is SUPERUSER'], warnings: [] }

  const violations = await roleViolations(client, me, 'role: ')
  const members = await client.query<RoleRow>(
    `select oid::text as oid, rolname, rolsuper, rolcreatedb, rolcreaterole from pg_roles
      where pg_has_role($1::oid, oid, 'MEMBER') and oid <> $1::oid order by rolname`,
    [me.oid],
  )
  for (const m of members.rows) {
    if (DANGEROUS_ROLES.includes(m.rolname)) violations.push(`role is a member of ${m.rolname}`)
    else if (!m.rolname.startsWith('pg_')) {
      violations.push(...(await roleViolations(client, m, `member role ${m.rolname}: `)))
    }
  }

  const warnings: string[] = []
  const temp = await client.query<{ can: boolean }>(
    `select has_database_privilege($1::oid, current_database(), 'TEMP') as can`,
    [me.oid],
  )
  if (temp.rows[0]?.can) warnings.push('role has TEMP on the database (session-local objects only; not refused)')
  return { violations, warnings }
}

const LOOPBACK = /^(localhost|127(\.\d{1,3}){3}|\[?::1\]?)$/i

/** A non-loopback host needs TLS: sslmode=require or verify-full. */
function assertTransportSecurity(url: string): void {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    throw new CloudSourceConfigError('CLOUD_SOURCE_URL is not a valid URL.')
  }
  const socketDir = u.searchParams.get('host')
  const host = u.hostname
  if (host === '' || LOOPBACK.test(host) || socketDir?.startsWith('/')) return
  const mode = u.searchParams.get('sslmode')
  if (mode !== 'require' && mode !== 'verify-full') {
    throw new CloudSourceConfigError(
      'CLOUD_SOURCE_URL points at a remote host: add sslmode=require (or verify-full) to the URL.',
    )
  }
}

export class CloudSource {
  /** Non-fatal findings of the read-only check (TEMP). */
  readonly warnings: string[] = []
  private statementsRun = 0
  private cursorSeq = 0

  private constructor(
    private readonly client: pg.Client,
    private readonly schema: string,
  ) {}

  /** Statements sent after the guard (tests: proves nothing was read before an abort). */
  get statementCount(): number {
    return this.statementsRun
  }

  static async open(options: OpenCloudSourceOptions): Promise<CloudSource> {
    const { url } = options
    if (!url) throw new CloudSourceConfigError('CLOUD_SOURCE_URL is not set.')
    assertTransportSecurity(url)
    const schema = options.schema ?? 'public'
    quoteIdent(schema)
    const secrets = secretsFromUrl(url)

    const client = new pg.Client({ connectionString: url })
    // A pg error can echo connection details; keep an 'error' listener so none escapes unscrubbed.
    client.on('error', () => undefined)
    try {
      await client.connect()
    } catch (e) {
      await client.end().catch(() => undefined)
      const code = (e as { code?: string }).code
      throw new CloudSourceConnectError(
        scrub(`Could not connect to the cloud source${code ? ` (${code})` : ''}.`, secrets),
      )
    }

    let check: WriteCheck
    try {
      if (options.target && sameServerDatabase(await serverIdentity(client), options.target)) {
        await client.end().catch(() => undefined)
        throw new CloudSourceConfigError('CLOUD_SOURCE_URL points at the target database. Refusing to continue.')
      }
      check = await findWritePrivileges(client)
    } catch (e) {
      if (e instanceof CloudSourceConfigError) throw e
      await client.end().catch(() => undefined)
      throw new CloudSourceConnectError(scrub(`The read-only check failed (${(e as { code?: string }).code ?? 'error'}).`, secrets))
    }
    if (check.violations.length > 0) {
      await client.end().catch(() => undefined)
      throw new ReadOnlyViolationError(check.violations)
    }

    const source = new CloudSource(client, schema)
    source.warnings.push(...check.warnings)
    await source.run('begin read only isolation level repeatable read')
    return source
  }

  private async run<R extends pg.QueryResultRow = pg.QueryResultRow>(sql: string, values?: unknown[]) {
    this.statementsRun++
    return this.client.query<R>(sql, values)
  }

  async tableExists(table: string): Promise<boolean> {
    const res = await this.run<{ exists: boolean }>(`select to_regclass($1) is not null as exists`, [
      `${quoteIdent(this.schema)}.${quoteIdent(table)}`,
    ])
    return res.rows[0]?.exists === true
  }

  /** Streams a table as JSON rows (`to_jsonb`), `size` rows per batch, through a server-side cursor. */
  async *read(table: string, size: number): AsyncGenerator<SourceRow[], void, undefined> {
    const cursor = `pp_cursor_${++this.cursorSeq}`
    await this.run(
      `declare ${cursor} no scroll cursor for select to_jsonb(t) as r from ${quoteIdent(this.schema)}.${quoteIdent(table)} t`,
    )
    try {
      for (;;) {
        const res = await this.run<{ r: SourceRow }>(`fetch ${Math.trunc(size)} from ${cursor}`)
        if (res.rows.length === 0) return
        yield res.rows.map((row) => row.r)
      }
    } finally {
      await this.run(`close ${cursor}`).catch(() => undefined)
    }
  }

  async close(): Promise<void> {
    await this.client.query('rollback').catch(() => undefined)
    await this.client.end().catch(() => undefined)
  }
}
