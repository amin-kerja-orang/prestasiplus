/**
 * Two helpers that keep migrated and seeded data side by side (card AC8):
 *
 *  - `claimSeeded`: reference rows created by the seeds (legacy_source IS NULL) are ADOPTED by natural
 *    key, i.e. they receive the `.cloud` legacy pair, so the upsert updates them instead of inserting a
 *    twin. A row that is not a seed row (already migrated, or born in v2 with another key) is never touched.
 *  - `dropConflicts`: a value that must be unique in v2 (school code, join code, ...) and is already held
 *    by a DIFFERENT row rejects the incoming row (DUPLICATE_KEY) instead of failing the batch with a
 *    unique violation. The first row in source order wins; a re-run decides the same way.
 */
import { quoteIdent } from '../kit/sql'
import type { Rejects } from '../kit/rejects'
import type { LegacySource, SqlExecutor } from '../kit/types'

export interface ClaimItem {
  legacyId: string
  /** The natural key, in the same text form as the SQL `keyExpr` produces. */
  key: string
}

/**
 * @param keyExpr SQL on alias `t` (static text from loader code, never from data), e.g. `upper(t.code)`.
 * @returns the number of seed rows adopted.
 */
export async function claimSeeded(
  db: SqlExecutor,
  table: string,
  source: LegacySource,
  keyExpr: string,
  items: readonly ClaimItem[],
): Promise<number> {
  if (items.length === 0) return 0
  const t = quoteIdent(table)
  const res = await db.query(
    `WITH wanted AS (
       SELECT DISTINCT ON (w.k) w.k, w.legacy_id
       FROM unnest($2::text[], $3::text[]) WITH ORDINALITY AS w(k, legacy_id, ord)
       WHERE NOT EXISTS (SELECT 1 FROM ${t} x WHERE x.legacy_source = $1 AND x.legacy_id = w.legacy_id)
       ORDER BY w.k, w.ord
     ), cand AS (
       SELECT DISTINCT ON (w.legacy_id) t.id, w.legacy_id
       FROM wanted w JOIN ${t} t ON ${keyExpr} = w.k
       WHERE t.legacy_source IS NULL
       ORDER BY w.legacy_id, t.id
     )
     UPDATE ${t} SET legacy_source = $1, legacy_id = cand.legacy_id
     FROM cand WHERE ${t}.id = cand.id`,
    [source, items.map((i) => i.key), items.map((i) => i.legacyId)],
  )
  return res.rowCount ?? 0
}

export interface ConflictSpec<T> {
  entity: string
  table: string
  /** The column reported in the reject. */
  column: string
  /** SQL over the unaliased table columns, e.g. `lower(code)`; it must give text. */
  expr: string
  source: LegacySource
  rejects: Rejects
  legacyIdOf(item: T): string
  /** The value of the item in the same normal form as `expr` (null = nothing to check). */
  valueOf(item: T): string | null
}

/** Items that do not clash on the unique value; the others are added to `rejects` as DUPLICATE_KEY. */
export async function dropConflicts<T>(db: SqlExecutor, items: readonly T[], spec: ConflictSpec<T>): Promise<T[]> {
  const first = new Set<string>()
  const kept: T[] = []
  for (const item of items) {
    const v = spec.valueOf(item)
    if (v !== null && first.has(v)) {
      spec.rejects.add({ entity: spec.entity, legacyId: spec.legacyIdOf(item), reason: 'DUPLICATE_KEY', column: spec.column })
      continue
    }
    if (v !== null) first.add(v)
    kept.push(item)
  }
  if (first.size === 0) return kept
  const holders = await heldValues(db, spec, [...first])
  return kept.filter((item) => {
    const v = spec.valueOf(item)
    if (v === null) return true
    const others = (holders.get(v) ?? []).some((h) => !(h.source === spec.source && h.legacyId === spec.legacyIdOf(item)))
    if (others) {
      spec.rejects.add({ entity: spec.entity, legacyId: spec.legacyIdOf(item), reason: 'DUPLICATE_KEY', column: spec.column })
    }
    return !others
  })
}

/** Who already holds each value: `value -> [{source, legacyId}]` (a seed or v2-born row has a null source). */
export async function heldValues(
  db: SqlExecutor,
  spec: Pick<ConflictSpec<unknown>, 'table' | 'expr'>,
  values: readonly string[],
): Promise<Map<string, { source: string | null; legacyId: string | null }[]>> {
  const out = new Map<string, { source: string | null; legacyId: string | null }[]>()
  if (values.length === 0) return out
  const res = await db.query<{ v: string; legacy_source: string | null; legacy_id: string | null }>(
    `SELECT ${spec.expr} AS v, legacy_source, legacy_id FROM ${quoteIdent(spec.table)} WHERE ${spec.expr} = ANY($1::text[])`,
    [values],
  )
  for (const r of res.rows) {
    const list = out.get(r.v) ?? []
    list.push({ source: r.legacy_source, legacyId: r.legacy_id })
    out.set(r.v, list)
  }
  return out
}
