/**
 * Read side of the papers, blueprints and SPM-set loaders: keyset pages over `archive_cloud` tables with a single `id` key, every column
 * cast to text like `load/source.ts` (which reads `staging_cloud` only). Children of a page are read with one `= ANY` query by the
 * step that needs them (`childrenOf`).
 */
import type pg from 'pg'

import { ARCHIVE_SCHEMA, columnNames, findTable } from '../../ddl/spec'
import { quoteIdent } from '../../kit/sql'

export type ArchiveRow = Record<string, string | null>

const A = quoteIdent(ARCHIVE_SCHEMA)

export function archiveSelectList(table: string, alias: string): string {
  const spec = findTable(table)
  if (!spec || spec.group !== 'archive') throw new RangeError(`Table "${table}" is not an archive table.`)
  return columnNames(spec).map((c) => `${alias}.${quoteIdent(c)}::text AS ${quoteIdent(c)}`).join(', ')
}

/** Rows of an archive table in ascending `id` order, strictly after `afterKey`. */
export async function* readArchiveById(pool: pg.Pool, table: string, afterKey: string | null, pageSize: number): AsyncGenerator<ArchiveRow> {
  let after = afterKey
  for (;;) {
    const res = await pool.query<ArchiveRow>(
      `SELECT ${archiveSelectList(table, 't')} FROM ${A}.${quoteIdent(table)} t WHERE ($1::bigint IS NULL OR t."id" > $1::bigint) ORDER BY t."id" LIMIT $2`,
      [after, pageSize],
    )
    for (const row of res.rows) yield row
    if (res.rows.length < pageSize) return
    after = res.rows[res.rows.length - 1]?.id ?? null
  }
}

/** The rows of `table` whose `column` is one of `ids`, grouped by that column's value, in `orderBy` order. */
export async function childrenOf(pool: pg.Pool, table: string, column: string, ids: readonly string[], orderBy: string): Promise<Map<string, ArchiveRow[]>> {
  const by = new Map<string, ArchiveRow[]>()
  if (ids.length === 0) return by
  const res = await pool.query<ArchiveRow>(
    `SELECT ${archiveSelectList(table, 't')} FROM ${A}.${quoteIdent(table)} t WHERE t.${quoteIdent(column)} = ANY($1::bigint[]) ORDER BY t.${quoteIdent(column)}, ${orderBy}`,
    [ids],
  )
  for (const r of res.rows) {
    const key = r[column] as string
    by.set(key, [...(by.get(key) ?? []), r])
  }
  return by
}

/** `slug` of a lookup table by id, from either schema (`staging_cloud` keeps six lookups, `archive_cloud` three). */
export async function lookupSlugs(pool: pg.Pool, schema: 'staging_cloud' | 'archive_cloud', table: string): Promise<Map<string, string>> {
  const res = await pool.query<{ id: string; slug: string | null }>(`SELECT "id"::text AS id, "slug"::text AS slug FROM ${quoteIdent(schema)}.${quoteIdent(table)}`)
  return new Map(res.rows.filter((r) => r.slug !== null).map((r) => [r.id, (r.slug as string).trim().toLowerCase()]))
}
