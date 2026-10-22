/**
 * Read side of the core ETL: keyset-paged reads of `staging_cloud` (the raw mirror loaded by BE-27).
 * Every column is cast to text, so a transform sees the same strings whatever the staging type, and a
 * date or timestamp is handed to PostgreSQL unchanged (no JavaScript time zone in between).
 * The staging schema is read through the pool, never through the batch transaction.
 */
import type pg from 'pg'

import { findTable, STAGING_SCHEMA, columnNames } from '../ddl/spec'
import { quoteIdent } from '../kit/sql'
import type { Staged } from '../transform/common'

export type StagedRow = Record<string, string | null>

const PAGE = 1000

function selectList(table: string, alias?: string): string {
  const spec = findTable(table)
  if (!spec || spec.group !== 'staging') throw new RangeError(`Table "${table}" is not a staging table.`)
  const prefix = alias ? `${alias}.` : ''
  return columnNames(spec)
    .map((c) => `${prefix}${quoteIdent(c)}::text AS ${quoteIdent(c)}`)
    .join(', ')
}

/** Rows of a table with a single `id` key, in ascending id order, strictly after `afterKey`. */
export async function* readById(pool: pg.Pool, table: string, afterKey: string | null, pageSize = PAGE): AsyncGenerator<StagedRow> {
  const from = `${quoteIdent(STAGING_SCHEMA)}.${quoteIdent(table)}`
  let after = afterKey
  for (;;) {
    const res = await pool.query<StagedRow>(
      `SELECT ${selectList(table)} FROM ${from} WHERE ($1::bigint IS NULL OR "id" > $1::bigint) ORDER BY "id" LIMIT $2`,
      [after, pageSize],
    )
    for (const row of res.rows) yield row
    if (res.rows.length < pageSize) return
    after = res.rows[res.rows.length - 1]?.id ?? null
  }
}

/** The numeric half of a pair key (`x` stands for a null column and sorts first as -1). */
function half(text: string | undefined): string {
  return text === undefined || text === 'x' ? '-1' : text
}

/** Splits the checkpoint key of a pair table (`a:b`) into the two sort values that precede the first row. */
function afterPair(afterKey: string | null): [string, string] {
  if (afterKey === null) return ['-2', '-2']
  const [a, b] = afterKey.split(':')
  return [half(a), half(b)]
}

/**
 * Rows of a pivot table (no primary key) ordered by the two foreign key columns. A null column sorts as
 * -1 (before every real id). All rows of one key are returned together, so a repeated pair stays visible
 * to the loader (it rejects the repeat as DUPLICATE_KEY).
 */
export async function* readPairTable(
  pool: pg.Pool,
  table: string,
  a: string,
  b: string,
  afterKey: string | null,
  pageSize = PAGE,
): AsyncGenerator<StagedRow> {
  const from = `${quoteIdent(STAGING_SCHEMA)}.${quoteIdent(table)}`
  const ca = quoteIdent(a)
  const cb = quoteIdent(b)
  let [afterA, afterB] = afterPair(afterKey)
  for (;;) {
    const res = await pool.query<StagedRow & { ka: string; kb: string }>(
      `WITH k AS (
         SELECT DISTINCT coalesce(${ca}, -1) AS ka, coalesce(${cb}, -1) AS kb FROM ${from}
         WHERE (coalesce(${ca}, -1), coalesce(${cb}, -1)) > ($1::bigint, $2::bigint)
         ORDER BY 1, 2 LIMIT $3)
       SELECT ${selectList(table, 't')}, k.ka::text AS ka, k.kb::text AS kb
       FROM ${from} t JOIN k ON coalesce(t.${ca}, -1) = k.ka AND coalesce(t.${cb}, -1) = k.kb
       ORDER BY k.ka, k.kb`,
      [afterA, afterB, pageSize],
    )
    for (const row of res.rows) yield row
    const last = res.rows[res.rows.length - 1]
    if (!last) return
    // A page ends on a whole key; fewer distinct keys than the page size means the table is exhausted.
    const keys = new Set(res.rows.map((r) => `${r.ka}:${r.kb}`))
    if (keys.size < pageSize) return
    afterA = last.ka
    afterB = last.kb
  }
}

/** Distinct (a, b) pairs of `table` where both columns are set, ascending, strictly after `afterKey`. */
export async function* readDistinctPairs(
  pool: pg.Pool,
  table: string,
  a: string,
  b: string,
  afterKey: string | null,
  pageSize = PAGE,
): AsyncGenerator<StagedRow> {
  const from = `${quoteIdent(STAGING_SCHEMA)}.${quoteIdent(table)}`
  const ca = quoteIdent(a)
  const cb = quoteIdent(b)
  let [afterA, afterB] = afterPair(afterKey)
  for (;;) {
    const res = await pool.query<StagedRow>(
      `SELECT DISTINCT ${ca}::text AS ${ca}, ${cb}::text AS ${cb}, ${ca} AS ka, ${cb} AS kb FROM ${from}
       WHERE ${ca} IS NOT NULL AND ${cb} IS NOT NULL AND (${ca}, ${cb}) > ($1::bigint, $2::bigint)
       ORDER BY ka, kb LIMIT $3`,
      [afterA, afterB, pageSize],
    )
    for (const row of res.rows) yield { [a]: row[a] ?? null, [b]: row[b] ?? null }
    if (res.rows.length < pageSize) return
    const last = res.rows[res.rows.length - 1] as StagedRow
    afterA = last[a] as string
    afterB = last[b] as string
  }
}

/** Looks a parent id up in a resolved map: null = the column is empty, undefined = set but not loaded. */
export function resolveFk(raw: string | null | undefined, map: ReadonlyMap<string, string>): string | null | undefined {
  if (raw === null || raw === undefined || raw.trim() === '') return null
  return map.get(raw.trim())
}

/** The distinct non-empty values of a column over a batch of rows. */
export function distinctValues(rows: readonly Staged[], column: string): string[] {
  const out = new Set<string>()
  for (const r of rows) {
    const v = r[column]
    if (v !== null && v !== undefined && v.trim() !== '') out.add(v.trim())
  }
  return [...out]
}
