import pg from 'pg'

import {
  upsertByLegacy,
  type BatchContext,
  type BatchResult,
  type EntityStep,
  type LegacySource,
} from '../../../src/migration/kit'
import { createTestDatabase, type TestDatabase } from '../../support/db'

export interface KitDb {
  db: TestDatabase
  pool: pg.Pool
  close(): Promise<void>
}

/** A private migrated database plus a `pg` pool on it (the kit works on `pg`, not on Prisma). */
export async function createKitDb(): Promise<KitDb> {
  const db = await createTestDatabase()
  const pool = new pg.Pool({ connectionString: db.url, max: 6 })
  return {
    db,
    pool,
    async close() {
      await pool.end()
      await db.drop()
    },
  }
}

/** The tiny demo entity: lives only in tests. Self-reference `parent_id` is DEFERRABLE INITIALLY DEFERRED. */
export const DEMO_DDL = `
  create table demo_items (
    id bigint generated always as identity primary key,
    code text not null,
    name text,
    qty int,
    tags text[],
    born_at timestamptz,
    parent_id bigint,
    legacy_source text,
    legacy_id text,
    legacy_hash text,
    constraint ck_demo_items_legacy_source check (legacy_source is null or legacy_source in ('cloud', 'my')),
    constraint uq_demo_items_legacy unique (legacy_source, legacy_id),
    constraint fk_demo_items_parent foreign key (parent_id) references demo_items (id) deferrable initially deferred
  )`

export interface DemoSource {
  id: number
  code: string
  name: string | null
  qty: number
  status: string
  parent?: number | null
}

export const DEMO_STATUSES = ['a', 'b']

/** Source rows 1..n with deterministic content. */
export function demoRows(n: number): DemoSource[] {
  return Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    code: `C${String(i + 1).padStart(4, '0')}`,
    name: `Item ${i + 1}`,
    qty: (i + 1) * 2,
    status: 'a',
  }))
}

/**
 * Demo step: rows with an unknown status are rejected (UNKNOWN_ENUM), the rest are upserted.
 * `hooks.beforeBatch` lets a test simulate a crash.
 */
export function demoStep(
  rows: DemoSource[],
  hooks: {
    beforeBatch?: (batch: number) => void
    afterExtract?: (afterKey: string | null) => void
    source?: LegacySource
  } = {},
): EntityStep<DemoSource> {
  return {
    entity: 'demo_items',
    source: hooks.source ?? 'cloud',
    extract(afterKey) {
      hooks.afterExtract?.(afterKey)
      const after = afterKey === null ? 0 : Number(afterKey)
      return rows.filter((r) => r.id > after)
    },
    keyOf: (row) => String(row.id),
    async load(batch: DemoSource[], ctx: BatchContext): Promise<BatchResult> {
      hooks.beforeBatch?.(ctx.batch)
      const good: DemoSource[] = []
      for (const row of batch) {
        if (!DEMO_STATUSES.includes(row.status)) {
          ctx.rejects.add({
            entity: 'demo_items',
            legacyId: String(row.id),
            reason: 'UNKNOWN_ENUM',
            column: 'status',
            enumValue: row.status,
          })
        } else good.push(row)
      }
      const res = await upsertByLegacy(ctx.db, {
        table: 'demo_items',
        source: ctx.source,
        columns: ['code', 'name', 'qty'],
        rows: good.map((r) => ({ legacyId: String(r.id), values: { code: r.code, name: r.name, qty: r.qty } })),
      })
      await ctx.idMap.registerMany('demo_items', res.ids)
      return res
    },
  }
}
