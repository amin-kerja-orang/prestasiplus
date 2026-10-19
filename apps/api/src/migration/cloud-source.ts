/**
 * The only connection to .cloud data (BE-27, BE-MIG-05, plan 9 and 14.1 item 4).
 *
 * `CLOUD_SOURCE_URL` is a PostgreSQL URL of the lead's restore of the anonymised dump (the
 * production MySQL is never reachable from here; a MySQL driver is out of scope, see the runbook).
 * Before ANY table is read the connection checks that its role cannot write:
 *
 *   - not a superuser, and no CREATEDB / CREATEROLE attribute;
 *   - no CREATE privilege on the database or on any non-system schema (DDL);
 *   - no INSERT, UPDATE, DELETE or TRUNCATE privilege (table level or any column) on any relation
 *     outside the system schemas.
 *
 * Otherwise `openCloudSource` throws `ReadOnlyViolationError` and the connection is closed without
 * a single table having been read. Reads run inside `BEGIN READ ONLY` as a second barrier.
 * Error messages carry privilege names and object names only: never the URL, user or password.
 */
import pg from 'pg'

import { quoteIdent } from './kit/sql'
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
  /** The target database URL: the source must never be the database the loader writes to. */
  targetUrl?: string
}

const SYSTEM_SCHEMAS = `n.nspname not like 'pg\\_%' and n.nspname <> 'information_schema'`

/** Returns the list of violations (empty when the connected role is read-only). */
export async function findWritePrivileges(client: pg.ClientBase): Promise<string[]> {
  const violations: string[] = []

  const role = await client.query<{ rolsuper: boolean; rolcreatedb: boolean; rolcreaterole: boolean }>(
    'select rolsuper, rolcreatedb, rolcreaterole from pg_roles where rolname = current_user',
  )
  const attrs = role.rows[0]
  if (attrs?.rolsuper) violations.push('role is SUPERUSER')
  if (attrs?.rolcreatedb) violations.push('role has CREATEDB')
  if (attrs?.rolcreaterole) violations.push('role has CREATEROLE')

  const db = await client.query<{ can_create: boolean }>(
    `select has_database_privilege(current_database(), 'CREATE') as can_create`,
  )
  if (db.rows[0]?.can_create) violations.push('CREATE on the database')

  const schemas = await client.query<{ nspname: string }>(
    `select n.nspname from pg_namespace n
      where ${SYSTEM_SCHEMAS} and has_schema_privilege(n.oid, 'CREATE') order by 1`,
  )
  for (const row of schemas.rows) violations.push(`CREATE on schema ${row.nspname}`)

  const tables = await client.query<{ nspname: string; relname: string; privs: string[] }>(
    `select n.nspname, c.relname,
            array_remove(array[
              case when has_table_privilege(c.oid, 'INSERT') or has_any_column_privilege(c.oid, 'INSERT') then 'INSERT' end,
              case when has_table_privilege(c.oid, 'UPDATE') or has_any_column_privilege(c.oid, 'UPDATE') then 'UPDATE' end,
              case when has_table_privilege(c.oid, 'DELETE') then 'DELETE' end,
              case when has_table_privilege(c.oid, 'TRUNCATE') then 'TRUNCATE' end
            ], null) as privs
       from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where c.relkind in ('r', 'p', 'v', 'm', 'f') and ${SYSTEM_SCHEMAS}
      order by 1, 2`,
  )
  for (const row of tables.rows) {
    if (row.privs.length > 0) violations.push(`${row.privs.join('+')} on ${row.nspname}.${row.relname}`)
  }
  return violations
}

export class CloudSource {
  /** Statements sent after the guard (for tests: proves no table was read before the abort). */
  readonly statements: string[] = []
  private cursorSeq = 0

  private constructor(
    private readonly client: pg.Client,
    private readonly schema: string,
  ) {}

  static async open(options: OpenCloudSourceOptions): Promise<CloudSource> {
    const { url } = options
    if (!url) throw new CloudSourceConfigError('CLOUD_SOURCE_URL is not set.')
    if (options.targetUrl && sameDatabase(url, options.targetUrl)) {
      throw new CloudSourceConfigError('CLOUD_SOURCE_URL points at the target database. Refusing to continue.')
    }
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

    let violations: string[]
    try {
      violations = await findWritePrivileges(client)
    } catch (e) {
      await client.end().catch(() => undefined)
      throw new CloudSourceConnectError(scrub(`The read-only check failed (${(e as { code?: string }).code ?? 'error'}).`, secrets))
    }
    if (violations.length > 0) {
      await client.end().catch(() => undefined)
      throw new ReadOnlyViolationError(violations)
    }

    const source = new CloudSource(client, schema)
    await source.run('begin read only isolation level repeatable read')
    return source
  }

  private async run<R extends pg.QueryResultRow = pg.QueryResultRow>(sql: string, values?: unknown[]) {
    this.statements.push(sql)
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

export const openCloudSource = CloudSource.open

function sameDatabase(a: string, b: string): boolean {
  try {
    const x = new URL(a)
    const y = new URL(b)
    return x.hostname === y.hostname && (x.port || '5432') === (y.port || '5432') && x.pathname === y.pathname
  } catch {
    return false
  }
}
