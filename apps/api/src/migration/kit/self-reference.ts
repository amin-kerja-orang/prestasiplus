import type { IdMap } from './id-map'
import type { Rejects } from './rejects'
import { quoteIdent } from './sql'
import { assertLegacySource, type LegacySource, type SqlExecutor } from './types'

export interface SelfReferenceSpec {
  table: string
  /** The entity name used in `etl_id_map` for this table's rows. */
  entity: string
  source: LegacySource
  /** The self-referencing column (for example `parent_id`, `referred_by`). */
  column: string
  /** Primary key column of the table. Default `id`. */
  idColumn?: string
  /** Rows of pass 1 that have a parent: `legacyId` of the row and `parentLegacyId` of its parent. */
  refs: readonly { legacyId: string; parentLegacyId: string }[]
}

/**
 * Pass 2 of the two-pass load for self-references and cycles (plan 14.5 item 2). Pass 1 inserted
 * the rows with the reference `NULL` (through `upsertByLegacy`); this resolves each parent through
 * the `IdMap` (register pass-1 ids first, `ids` of the upsert result) and sets the column. A parent
 * that cannot be resolved leaves the column `NULL` and is recorded as `ORPHAN_PARENT`; nothing is
 * defaulted. The FK should be `DEFERRABLE INITIALLY DEFERRED` so the constraint is checked at
 * commit, after both passes. Returns the number of rows updated.
 */
export async function resolveSelfReferences(
  db: SqlExecutor,
  idMap: IdMap,
  rejects: Rejects,
  spec: SelfReferenceSpec,
): Promise<number> {
  assertLegacySource(spec.source)
  const table = quoteIdent(spec.table)
  const column = quoteIdent(spec.column)
  if (spec.refs.length === 0) return 0

  const parents = await idMap.resolveMany(spec.entity, spec.refs.map((r) => r.parentLegacyId))
  const ids: string[] = []
  const parentIds: string[] = []
  for (const ref of spec.refs) {
    const parent = parents.get(ref.parentLegacyId)
    if (parent === undefined) {
      rejects.add({ entity: spec.entity, legacyId: ref.legacyId, reason: 'ORPHAN_PARENT', column: spec.column })
      continue
    }
    ids.push(ref.legacyId)
    parentIds.push(parent)
  }
  if (ids.length === 0) return 0

  // The column type (bigint or uuid) decides the cast; ids travel as text in the map.
  const type = await db.query<{ t: string }>(
    `SELECT format_type(atttypid, atttypmod) AS t FROM pg_attribute
     WHERE attrelid = $1::regclass AND attname = $2 AND NOT attisdropped`,
    [spec.table, spec.column],
  )
  const colType = type.rows[0]?.t
  if (!colType) throw new Error(`Column ${spec.table}.${spec.column} does not exist.`)
  if (!/^[a-z0-9 ,()]+$/.test(colType)) throw new Error(`Unsupported column type "${colType}".`)

  const res = await db.query(
    `UPDATE ${table} AS t SET ${column} = v.parent_id::${colType}
     FROM unnest($2::text[], $3::text[]) AS v(legacy_id, parent_id)
     WHERE t.legacy_source = $1 AND t.legacy_id = v.legacy_id
       AND t.${column} IS DISTINCT FROM v.parent_id::${colType}`,
    [spec.source, ids, parentIds],
  )
  return res.rowCount ?? 0
}
