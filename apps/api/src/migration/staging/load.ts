/**
 * `staging:load` core (BE-27). Drops and recreates `staging_cloud` and `archive_cloud` from
 * `ddl/staging_cloud.sql` and copies every table from a `TableReader` (a dump directory or a
 * read-only PostgreSQL source) in ONE transaction: a failed load leaves the previous staging
 * schemas untouched, and a second run leaves the same row counts (AC7).
 *
 * Strictness (no guessing, plan 14.1 item 3):
 *   - a row column that is not in the DDL fails the load (listing column names) unless
 *     `allowExtraColumns`, because `jsonb_populate_recordset` would otherwise drop it silently;
 *   - rows read must equal the manifest count, and the final `count(*)` must equal rows read;
 *   - a spec column that no row carried is warned about (names only): it is NULL on every row.
 * Messages carry table names, column names, counts and SQLSTATE codes only: never a row value
 * (a driver message such as `invalid input syntax for type bigint: "..."` is not forwarded).
 */
import { readFileSync } from 'node:fs'

import type pg from 'pg'

import { DDL_FILE } from '../ddl/generate'
import { renderDdl } from '../ddl/render'
import { columnNames, schemaOf, TABLES, type TableSpec } from '../ddl/spec'
import { hashRow, quoteIdent, toJson } from '../kit/sql'
import type { LegacySource } from '../kit/types'
import { assertStagingResetAllowed, StagingResetRefusedError } from './guard'
import { silentLogger, type Logger } from './log'
import type { TableReader } from './readers'

export class LoaderError extends Error {}
export class SourceNotImplementedError extends LoaderError {}
/** BE-35: an anonymised or synthetic dump (known dummy passwords) must never be loaded in production. */
export class SyntheticDumpRefusedError extends StagingResetRefusedError {}

export type SourceName = LegacySource

/** Per-source settings. `my` is the OD-13 extension point: named, not implemented. */
export const SOURCES: Record<SourceName, { implemented: boolean; stagingSchema: string; ddlFile: string | null }> = {
  cloud: { implemented: true, stagingSchema: 'staging_cloud', ddlFile: DDL_FILE },
  my: { implemented: false, stagingSchema: 'staging_my', ddlFile: null },
}

export interface LoadOptions {
  source?: SourceName
  allowExtraColumns?: boolean
  batchSize?: number
  log?: Logger
  /** Environment for the reset guard (default `process.env`). */
  env?: Readonly<Record<string, string | undefined>>
  /**
   * TEST AID: replaces BOTH schemas with only these tables (the other tables are dropped, not kept).
   * Not exposed on the CLI. Default: every table, with `ddl/staging_cloud.sql`.
   */
  tables?: readonly TableSpec[]
}

export interface TableLoad {
  table: string
  schema: string
  rowsRead: number
  rowsLoaded: number
  /** Count promised by the dump manifest, or null. */
  expected: number | null
  /** The input had no such table; it was created empty. */
  absent: boolean
  /** Columns in the dump that are not in the DDL (only when `allowExtraColumns`). */
  extraColumns: string[]
  /** Spec columns that no row carried. */
  missingColumns: string[]
}

export interface LoadResult {
  source: SourceName
  inputKind: TableReader['kind']
  inputHash: string | null
  tables: TableLoad[]
  totalRows: number
}

/** Column names that are plain identifiers are printed; anything else is only counted (it could be a value). */
function describeNames(names: string[]): string {
  const ok = names.filter((n) => /^[a-z0-9_]{1,63}$/.test(n)).sort()
  const other = names.length - ok.length
  return [ok.join(', '), other > 0 ? `${other} with unprintable names` : ''].filter(Boolean).join('; ')
}

function sqlState(e: unknown): string {
  const code = (e as { code?: unknown })?.code
  return typeof code === 'string' ? code : 'unknown'
}

const OWN_COLUMNS = new Set(['_loaded_at', '_row_hash'])

async function loadTable(
  client: pg.PoolClient,
  reader: TableReader,
  spec: TableSpec,
  opts: Required<Pick<LoadOptions, 'allowExtraColumns' | 'batchSize'>> & { log: Logger },
): Promise<TableLoad> {
  const schema = schemaOf(spec)
  const names = columnNames(spec)
  const known = new Set(names)
  const redacted = new Set(spec.columns.filter((c) => c.redact).map((c) => c.name))
  const target = `${quoteIdent(schema)}.${quoteIdent(spec.name)}`
  const colList = [...names.map(quoteIdent), '"_row_hash"'].join(', ')
  const insert = `insert into ${target} (${colList}) select ${colList} from jsonb_populate_recordset(null::${target}, $1::jsonb)`

  const result: TableLoad = {
    table: spec.name,
    schema,
    rowsRead: 0,
    rowsLoaded: 0,
    expected: reader.expectedRows(spec.name),
    absent: false,
    extraColumns: [],
    missingColumns: [],
  }
  if (!(await reader.has(spec.name))) {
    result.absent = true
    opts.log.warn(`Table ${spec.name} is absent from the input; ${target} stays empty.`)
    return result
  }

  const seen = new Set<string>()
  const extras = new Set<string>()
  for await (const batch of reader.read(spec.name, opts.batchSize)) {
    const payload: Record<string, unknown>[] = []
    for (const row of batch) {
      const clean: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(row)) {
        if (known.has(key)) {
          clean[key] = redacted.has(key) ? null : value
          seen.add(key)
        } else if (!OWN_COLUMNS.has(key)) extras.add(key)
      }
      payload.push({ ...clean, _row_hash: hashRow(clean) })
    }
    if (extras.size > 0 && !opts.allowExtraColumns) {
      throw new LoaderError(
        `Table ${spec.name}: the input has columns that ${schema} does not define (${describeNames([...extras])}). ` +
          'Add them to ddl/spec.ts and run staging:ddl, or pass --allow-extra-columns to drop them.',
      )
    }
    try {
      await client.query(insert, [toJson(payload)])
    } catch (e) {
      throw new LoaderError(`Table ${spec.name}: the database rejected a batch (SQLSTATE ${sqlState(e)}).`)
    }
    result.rowsRead += batch.length
  }

  result.extraColumns = [...extras].sort()
  if (result.rowsRead > 0) result.missingColumns = names.filter((n) => !seen.has(n))
  if (result.expected !== null && result.expected !== result.rowsRead) {
    throw new LoaderError(`Table ${spec.name}: the manifest promises ${result.expected} rows but ${result.rowsRead} were read.`)
  }
  const counted = await client.query<{ n: number }>(`select count(*)::int as n from ${target}`)
  result.rowsLoaded = counted.rows[0]?.n ?? 0
  if (result.rowsLoaded !== result.rowsRead) {
    throw new LoaderError(`Table ${spec.name}: read ${result.rowsRead} rows but staging holds ${result.rowsLoaded}.`)
  }
  if (result.extraColumns.length > 0) {
    opts.log.warn(`Table ${spec.name}: dropped input columns ${describeNames(result.extraColumns)}.`)
  }
  // A spec column that no row carried is NULL on every row, and the DDL still has it, so a reader's column check passes.
  // Say so (names only): the dump omitted it (`spec_columns_missing_in_source`, or not granted), it is not a source value.
  if (result.missingColumns.length > 0) {
    opts.log.warn(`Table ${spec.name}: the input carries no column ${describeNames(result.missingColumns)}; ${target} holds NULL there on every row.`)
  }
  return result
}

export async function loadStaging(pool: pg.Pool, reader: TableReader, options: LoadOptions = {}): Promise<LoadResult> {
  const source = options.source ?? 'cloud'
  const cfg = SOURCES[source]
  if (!cfg?.implemented || !cfg.ddlFile) {
    throw new SourceNotImplementedError(`Source "${source}" is not implemented (${cfg?.stagingSchema ?? source} is an extension point, OD-13).`)
  }
  const log = options.log ?? silentLogger
  const opts = { allowExtraColumns: options.allowExtraColumns ?? false, batchSize: options.batchSize ?? 2000, log }

  // BE-35: a dump marked anonymised or synthetic holds a known dummy password; never in production (prod, any case).
  if (['production', 'prod'].includes(((options.env ?? process.env).NODE_ENV ?? '').trim().toLowerCase()) && reader.syntheticMarker?.()) {
    throw new SyntheticDumpRefusedError('Refusing to load a dump marked anonymised or synthetic: NODE_ENV is production. Nothing was changed.')
  }

  // M1: nothing is dropped unless the target is a staging database and the operator opted in.
  await assertStagingResetAllowed(pool, options.env ?? process.env)

  const client = await pool.connect()
  const tables: TableLoad[] = []
  try {
    await client.query('begin')
    try {
      await client.query(options.tables ? renderDdl(options.tables) : readFileSync(cfg.ddlFile, 'utf8'))
    } catch (e) {
      throw new LoaderError(`Creating the staging schemas failed (SQLSTATE ${sqlState(e)}).`)
    }
    for (const spec of options.tables ?? TABLES) {
      const loaded = await loadTable(client, reader, spec, opts)
      tables.push(loaded)
      if (loaded.rowsRead > 0) log.info(`Loaded ${loaded.schema}.${loaded.table}: ${loaded.rowsRead} rows.`)
    }
    await client.query('commit')
  } catch (e) {
    await client.query('rollback').catch(() => undefined)
    throw e
  } finally {
    client.release()
  }
  const totalRows = tables.reduce((sum, t) => sum + t.rowsLoaded, 0)
  log.info(`Staging load finished: ${tables.length} tables, ${totalRows} rows.`)
  return { source, inputKind: reader.kind, inputHash: reader.inputHash(), tables, totalRows }
}
