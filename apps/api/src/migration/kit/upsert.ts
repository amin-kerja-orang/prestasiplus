import type pg from 'pg'

import { sanitizeDbError } from './errors'
import { hashRow, quoteIdent, toJson } from './sql'
import { assertLegacySource, type LegacySource, type LoadStats } from './types'

/** One source row, already transformed to v2 column values. */
export interface LegacyRow {
  /** Source primary key as text (composite keys joined with `:` in a fixed order, plan 14.2). */
  legacyId: string
  /** v2 column name (snake_case) to value. Must not contain `legacy_*` or the id column. */
  values: Record<string, unknown>
  /** Hash of the normalised source row. Computed from `values` when omitted. */
  legacyHash?: string
}

export interface UpsertSpec {
  /** Target table (snake_case, from loader code). It must carry the `(legacy_source, legacy_id)` unique. */
  table: string
  source: LegacySource
  /** The v2 columns to write, in `values`. Every row must supply the same keys (missing = null). */
  columns: readonly string[]
  rows: readonly LegacyRow[]
  /** Primary key column. Used to return the new ids; `null` skips that query. Default `id`. */
  idColumn?: string | null
}

export interface UpsertResult extends LoadStats {
  /** `legacyId` -> primary key (text) for every distinct row of the batch; empty when `idColumn` is null. */
  ids: Map<string, string>
  /** Later repeats of a `legacyId` inside the batch; they are skipped, the caller rejects them (DUPLICATE_KEY). */
  duplicates: string[]
}

const RESERVED = new Set(['legacy_source', 'legacy_id', 'legacy_hash'])
let counter = 0

/**
 * Idempotent bulk upsert keyed by `(legacy_source, legacy_id)` (plan 14.5 item 1). The batch is
 * sent as one JSON parameter, expanded into a temporary table typed from the target
 * (`jsonb_populate_recordset`), then `INSERT ... ON CONFLICT (legacy_source, legacy_id) DO UPDATE
 * ... WHERE target.legacy_hash IS DISTINCT FROM EXCLUDED.legacy_hash` (on a table without
 * `legacy_hash`, which is every table but the big activity ones, the WHERE compares the written
 * columns instead). So:
 *  - a re-run with identical rows inserts and updates nothing (`unchanged`);
 *  - a changed hash updates only that row;
 *  - rows with `legacy_source IS NULL` (born in v2) never match the conflict target, so they are
 *    never touched (Postgres treats NULL as distinct), and the insert always carries a non-null source.
 * The caller owns the transaction (one batch = one transaction, BE-NFR-17); the temp table is
 * dropped before returning, so it takes a transaction client (`pg.PoolClient`), never the pool.
 * Postgres errors are rethrown as `MigrationDbError` (SQLSTATE, table, column and constraint only):
 * the server message can quote the offending value.
 *
 * A repeated `legacyId` inside one batch cannot be applied twice in a single statement, so the
 * first occurrence wins and the later ones are returned in `duplicates`.
 */
export async function upsertByLegacy(db: pg.PoolClient, spec: UpsertSpec): Promise<UpsertResult> {
  try {
    return await upsert(db, spec)
  } catch (err) {
    throw sanitizeDbError(err, spec.table)
  }
}

async function upsert(db: pg.PoolClient, spec: UpsertSpec): Promise<UpsertResult> {
  assertLegacySource(spec.source)
  const table = quoteIdent(spec.table)
  const columns = [...spec.columns]
  if (columns.length === 0) throw new RangeError('upsertByLegacy needs at least one data column.')
  if (new Set(columns).size !== columns.length) throw new RangeError('Duplicate column in upsert spec.')
  const idColumn = spec.idColumn === undefined ? 'id' : spec.idColumn
  for (const c of columns) {
    quoteIdent(c)
    if (RESERVED.has(c) || c === idColumn) throw new RangeError(`Column "${c}" is managed by the kit; remove it from the spec.`)
  }

  // Plan 14.2: only the big activity tables carry `legacy_hash`. Without it, a row is unchanged when
  // every written column is equal (checked in SQL), so the same upsert works on every migratable table.
  const hasHash =
    (
      await db.query(
        `SELECT 1 FROM information_schema.columns
         WHERE table_schema = current_schema() AND table_name = $1 AND column_name = 'legacy_hash'`,
        [spec.table],
      )
    ).rowCount === 1

  const seen = new Set<string>()
  const duplicates: string[] = []
  const payload: Record<string, unknown>[] = []
  for (const row of spec.rows) {
    if (seen.has(row.legacyId)) {
      duplicates.push(row.legacyId)
      continue
    }
    seen.add(row.legacyId)
    const record: Record<string, unknown> = {}
    for (const c of columns) record[c] = row.values[c] === undefined ? null : row.values[c]
    record.legacy_id = row.legacyId
    if (hasHash) record.legacy_hash = row.legacyHash ?? hashRow(row.values)
    payload.push(record)
  }

  const result: UpsertResult = { inserted: 0, updated: 0, unchanged: 0, ids: new Map(), duplicates }
  if (payload.length === 0) return result

  const cols = columns.map(quoteIdent).join(', ')
  const tmp = quoteIdent(`pp_kit_tmp_${++counter}`)
  await db.query(
    `CREATE TEMP TABLE ${tmp} AS SELECT ${cols}, legacy_id${hasHash ? ', legacy_hash' : ''} FROM ${table} WITH NO DATA`,
  )
  await db.query(`INSERT INTO ${tmp} SELECT * FROM jsonb_populate_recordset(NULL::${tmp}, $1::jsonb)`, [
    toJson(payload),
  ])
  const setList = [
    ...columns.map((c) => `${quoteIdent(c)} = EXCLUDED.${quoteIdent(c)}`),
    ...(hasHash ? ['legacy_hash = EXCLUDED.legacy_hash'] : []),
  ].join(', ')
  const changed = hasHash
    ? `${table}.legacy_hash IS DISTINCT FROM EXCLUDED.legacy_hash`
    : `ROW(${columns.map((c) => `${table}.${quoteIdent(c)}`).join(', ')}) IS DISTINCT FROM ROW(${columns.map((c) => `EXCLUDED.${quoteIdent(c)}`).join(', ')})`
  const res = await db.query<{ inserted: boolean }>(
    `INSERT INTO ${table} (${cols}, legacy_source, legacy_id${hasHash ? ', legacy_hash' : ''})
     SELECT ${cols}, $1::text, legacy_id${hasHash ? ', legacy_hash' : ''} FROM ${tmp}
     ON CONFLICT (legacy_source, legacy_id) DO UPDATE SET ${setList}
       WHERE ${changed}
     RETURNING (xmax = 0) AS inserted`,
    [spec.source],
  )
  for (const r of res.rows) {
    if (r.inserted) result.inserted++
    else result.updated++
  }
  result.unchanged = payload.length - res.rows.length

  if (idColumn !== null) {
    const idCol = quoteIdent(idColumn)
    const ids = await db.query<{ legacy_id: string; id: string }>(
      `SELECT legacy_id, ${idCol}::text AS id FROM ${table} WHERE legacy_source = $1 AND legacy_id = ANY($2::text[])`,
      [spec.source, payload.map((p) => p.legacy_id)],
    )
    for (const r of ids.rows) result.ids.set(r.legacy_id, r.id)
  }
  await db.query(`DROP TABLE ${tmp}`)
  return result
}
