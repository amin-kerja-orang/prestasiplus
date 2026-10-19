/**
 * `staging:load` core (BE-27). Drops and recreates `staging_cloud` and `archive_cloud` from
 * `ddl/staging_cloud.sql` and copies every table from a `TableReader` (a dump directory or a
 * read-only PostgreSQL source) in ONE transaction: a failed load leaves the previous staging
 * schemas untouched, and a second run leaves the same row counts (AC7).
 *
 * Strictness (no guessing, plan 14.1 item 3):
 *   - a row column that is not in the DDL fails the load (listing column names) unless
 *     `allowExtraColumns`, because `jsonb_populate_recordset` would otherwise drop it silently;
 *   - rows read must equal the manifest count, and the final `count(*)` must equal rows read.
 * Messages carry table names, column names, counts and SQLSTATE codes only: never a row value
 * (a driver message such as `invalid input syntax for type bigint: "..."` is not forwarded).
 */
import { readFileSync } from 'node:fs'

import type pg from 'pg'

import { DDL_FILE } from '../ddl/generate'
import { columnNames, schemaOf, TABLES, type TableSpec } from '../ddl/spec'
import { hashRow, quoteIdent, toJson } from '../kit/sql'
import { silentLogger, type Logger } from './log'
import type { TableReader } from './readers'

export class LoaderError extends Error {}
export class SourceNotImplementedError extends LoaderError {}

export type SourceName = 'cloud' | 'my'

/** Per-source settings. `my` is the OD-13 extension point: named, not implemented. */
export const SOURCES: Record<SourceName, { implemented: boolean; stagingSchema: string; ddlFile: string | null }> = {
  cloud: { implemented: true, stagingSchema: 'staging_cloud', ddlFile: DDL_FILE },
  my: { implemented: false, stagingSchema: 'staging_my', ddlFile: null },
}

export function assertSourceName(value: string): asserts value is SourceName {
  if (!(value in SOURCES)) throw new LoaderError(`Unknown source "${value}". Allowed: cloud, my.`)
}

export interface LoadOptions {
  source?: SourceName
  allowExtraColumns?: boolean
  batchSize?: number
  log?: Logger
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
          clean[key] = value
          seen.add(key)
        } else if (!OWN_COLUMNS.has(key)) extras.add(key)
      }
      payload.push({ ...clean, _row_hash: hashRow(clean) })
    }
    if (extras.size > 0 && !opts.allowExtraColumns) {
      throw new LoaderError(
        `Table ${spec.name}: the input has columns that ${schema} does not define (${[...extras].sort().join(', ')}). ` +
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
    opts.log.warn(`Table ${spec.name}: dropped input columns ${result.extraColumns.join(', ')}.`)
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

  const client = await pool.connect()
  const tables: TableLoad[] = []
  try {
    await client.query('begin')
    try {
      await client.query(readFileSync(cfg.ddlFile, 'utf8'))
    } catch (e) {
      throw new LoaderError(`Creating the staging schemas failed (SQLSTATE ${sqlState(e)}).`)
    }
    for (const spec of TABLES) {
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
