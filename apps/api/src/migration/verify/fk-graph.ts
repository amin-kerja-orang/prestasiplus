/**
 * Foreign-key graph of the migratable tables, read from `pg_catalog` (never hand-written, so a table a later card adds
 * is covered without touching this file). Used by the orphan scan of `migrate:verify` and by the rollback, which
 * needs a delete order (children before parents).
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import type { SqlExecutor } from '../kit/types'

/** `confdeltype` of pg_constraint: a no action, r restrict, c cascade, n set null, d set default. */
export type DeleteRule = 'a' | 'r' | 'c' | 'n' | 'd'

export interface ForeignKey {
  name: string
  child: string
  parent: string
  /** Column names in constraint order; `childCols[i]` references `parentCols[i]`. */
  childCols: string[]
  parentCols: string[]
  onDelete: DeleteRule
  deferrable: boolean
}

const LIST_FILE = fileURLToPath(new URL('../../../prisma/migratable-models.json', import.meta.url))

/** The table names in `prisma/migratable-models.json` (every v2 table that carries `legacy_source` / `legacy_id`). */
export function readMigratableList(file: string = LIST_FILE): string[] {
  const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'))
  if (!Array.isArray(parsed) || parsed.some((n) => typeof n !== 'string')) {
    throw new RangeError('migratable-models.json must be an array of table names.')
  }
  return [...(parsed as string[])].sort()
}

/** Of `names`, the tables that exist in the current schema AND carry both `legacy_source` and `legacy_id`. */
export async function existingLegacyTables(db: SqlExecutor, names: readonly string[]): Promise<string[]> {
  const res = await db.query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.columns
     WHERE table_schema = current_schema() AND table_name = ANY($1::text[]) AND column_name IN ('legacy_source', 'legacy_id')
     GROUP BY table_name HAVING count(*) = 2 ORDER BY table_name`,
    [[...names]],
  )
  return res.rows.map((r) => r.table_name)
}

/** Every foreign key between two tables of the current schema. */
export async function loadForeignKeys(db: SqlExecutor): Promise<ForeignKey[]> {
  const res = await db.query<{
    name: string
    child: string
    parent: string
    child_cols: string[]
    parent_cols: string[]
    on_delete: DeleteRule
    deferrable: boolean
  }>(
    `SELECT c.conname::text AS name, cl.relname::text AS child, pl.relname::text AS parent,
            ARRAY(SELECT a.attname::text FROM unnest(c.conkey) WITH ORDINALITY k(n, o)
                  JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.n ORDER BY k.o) AS child_cols,
            ARRAY(SELECT a.attname::text FROM unnest(c.confkey) WITH ORDINALITY k(n, o)
                  JOIN pg_attribute a ON a.attrelid = c.confrelid AND a.attnum = k.n ORDER BY k.o) AS parent_cols,
            c.confdeltype::text AS on_delete, c.condeferrable AS deferrable
     FROM pg_constraint c
     JOIN pg_class cl ON cl.oid = c.conrelid
     JOIN pg_namespace cn ON cn.oid = cl.relnamespace
     JOIN pg_class pl ON pl.oid = c.confrelid
     JOIN pg_namespace pn ON pn.oid = pl.relnamespace
     WHERE c.contype = 'f' AND cn.nspname = current_schema() AND pn.nspname = current_schema()
     ORDER BY 2, 3, 1`,
  )
  return res.rows.map((r) => ({
    name: r.name,
    child: r.child,
    parent: r.parent,
    childCols: r.child_cols,
    parentCols: r.parent_cols,
    onDelete: r.on_delete,
    deferrable: r.deferrable,
  }))
}

/** Columns of `table` that reject NULL (to know whether a cyclic reference can be cleared before the delete). */
export async function notNullColumns(db: SqlExecutor, table: string): Promise<Set<string>> {
  const res = await db.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = current_schema() AND table_name = $1 AND is_nullable = 'NO'`,
    [table],
  )
  return new Set(res.rows.map((r) => r.column_name))
}

export interface DeleteOrder {
  /** Every input table once; for each foreign key between two DIFFERENT strongly connected groups the child comes first. */
  order: string[]
  /** Foreign keys inside a cycle (including a table that references itself): clear them before the delete. */
  cyclic: ForeignKey[]
}

/**
 * Delete order for `tables`: children before parents, computed from the foreign keys between those tables only.
 * A cycle (a self-reference such as `users.created_by_id`, or a loop between tables) cannot be ordered, so its tables
 * are grouped (Tarjan's strongly connected components), listed together in name order, and the foreign keys inside
 * the group are returned in `cyclic` for the caller to clear first. Deterministic: ties break by table name.
 */
export function deleteOrder(tables: readonly string[], fks: readonly ForeignKey[]): DeleteOrder {
  const nodes = [...new Set(tables)].sort()
  const inSet = new Set(nodes)
  const edges = fks.filter((f) => inSet.has(f.child) && inSet.has(f.parent))

  // child -> parents (a child must be deleted before each of its parents)
  const out = new Map<string, Set<string>>(nodes.map((n) => [n, new Set<string>()]))
  for (const f of edges) out.get(f.child)?.add(f.parent)

  // Tarjan, iterative enough for a few hundred tables (recursion depth = longest FK chain).
  let counter = 0
  const index = new Map<string, number>()
  const low = new Map<string, number>()
  const onStack = new Set<string>()
  const stack: string[] = []
  const component = new Map<string, number>()
  const groups: string[][] = []
  const visit = (v: string): void => {
    index.set(v, counter)
    low.set(v, counter)
    counter++
    stack.push(v)
    onStack.add(v)
    for (const w of [...(out.get(v) ?? [])].sort()) {
      if (!index.has(w)) {
        visit(w)
        low.set(v, Math.min(low.get(v) as number, low.get(w) as number))
      } else if (onStack.has(w)) {
        low.set(v, Math.min(low.get(v) as number, index.get(w) as number))
      }
    }
    if (low.get(v) === index.get(v)) {
      const group: string[] = []
      for (;;) {
        const w = stack.pop() as string
        onStack.delete(w)
        component.set(w, groups.length)
        group.push(w)
        if (w === v) break
      }
      groups.push(group.sort())
    }
  }
  for (const n of nodes) if (!index.has(n)) visit(n)

  // Kahn over the condensation; an edge child-group -> parent-group means "child group first".
  const waits = new Map<number, Set<number>>() // group -> groups that must come before it
  groups.forEach((_, i) => waits.set(i, new Set()))
  for (const f of edges) {
    const c = component.get(f.child) as number
    const p = component.get(f.parent) as number
    if (c !== p) waits.get(p)?.add(c)
  }
  const done = new Set<number>()
  const order: string[] = []
  while (done.size < groups.length) {
    const ready = groups
      .map((g, i) => ({ g, i }))
      .filter(({ i }) => !done.has(i) && [...(waits.get(i) ?? [])].every((d) => done.has(d)))
      .sort((a, b) => ((a.g[0] as string) < (b.g[0] as string) ? -1 : 1))
    if (ready.length === 0) throw new Error('deleteOrder: internal error, the condensation has a cycle.')
    for (const { g, i } of ready) {
      order.push(...g)
      done.add(i)
    }
  }

  const cyclic = edges.filter((f) => component.get(f.child) === component.get(f.parent))
  return { order, cyclic }
}
