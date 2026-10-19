import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { upsertByLegacy } from '../../../src/migration/kit'
import { createKitDb, type KitDb } from './helpers'
import { MODEL_FIXTURES, type FixtureQuery } from './model-fixtures'

/**
 * Plan 14.9 item 6, generic: for every table in `migratable-models.json`, insert one generated row
 * through `upsertByLegacy` twice and assert a single row and zero updates the second time.
 * The row is generated from the table's NOT NULL columns without a default; a table whose
 * required columns cannot be generated (foreign keys, checks) needs an entry in `model-fixtures.ts`.
 */
const PRISMA = fileURLToPath(new URL('../../../prisma/', import.meta.url))
const listed: string[] = JSON.parse(readFileSync(join(PRISMA, 'migratable-models.json'), 'utf8'))
const schemaText = readdirSync(join(PRISMA, 'schema'))
  .filter((f) => f.endsWith('.prisma'))
  .map((f) => readFileSync(join(PRISMA, 'schema', f), 'utf8'))
  .join('\n')

/** The list holds TABLE names; the schema must have a model mapped to each (the lint enforces it too). */
const assertMapped = (table: string): void => {
  if (!new RegExp(`@@map\\("${table}"\\)`).test(schemaText)) throw new Error(`${table}: no model with @@map in the schema`)
}

const SAMPLE: Record<string, unknown> = {
  text: 'x', 'character varying': 'x', character: 'x', integer: 1, bigint: 1, smallint: 1, numeric: 1,
  'double precision': 1, real: 1, boolean: false, uuid: '00000000-0000-4000-8000-000000000001',
  date: '2026-01-01', 'timestamp with time zone': '2026-01-01T00:00:00Z', 'timestamp without time zone': '2026-01-01T00:00:00',
  jsonb: {}, json: {},
}

let kit: KitDb
beforeAll(async () => {
  kit = await createKitDb()
})
afterAll(async () => {
  await kit.close()
})

describe('double upsert for every migratable model (BE-MIG-03)', () => {
  it('has a list to walk (an empty list is fine until a table card adds its table)', () => {
    expect(Array.isArray(listed)).toBe(true)
  })

  it.each(listed)('%s: two upserts of the same row give one row and no update', async (table) => {
    assertMapped(table)
    const cols = await kit.db.query<{ column_name: string; data_type: string; is_nullable: string; column_default: string | null; is_identity: string; is_generated: string }>(
      `select column_name, data_type, is_nullable, column_default, is_identity, is_generated
       from information_schema.columns where table_schema = 'public' and table_name = $1`,
      [table],
    )
    const entry = MODEL_FIXTURES[table]
    const fixture = typeof entry === 'function' ? await entry(kit.db.query as FixtureQuery) : (entry ?? {})
    const values: Record<string, unknown> = { ...fixture }
    for (const c of cols) {
      if (c.column_name in values || c.column_name.startsWith('legacy_')) continue
      if (c.is_identity === 'YES' || c.is_generated !== 'NEVER') continue
      if (c.is_nullable === 'YES' || c.column_default !== null) continue
      if (!(c.data_type in SAMPLE)) throw new Error(`${table}.${c.column_name} (${c.data_type}): add a fixture in model-fixtures.ts`)
      values[c.column_name] = SAMPLE[c.data_type]
    }
    const spec = { table, source: 'cloud' as const, columns: Object.keys(values), rows: [{ legacyId: 'g1', values }], idColumn: null }
    const run = async () => {
      const c = await kit.pool.connect()
      try {
        await c.query('BEGIN')
        const r = await upsertByLegacy(c, spec)
        await c.query('COMMIT')
        return r
      } catch (e) {
        await c.query('ROLLBACK')
        throw e
      } finally {
        c.release()
      }
    }
    expect(await run()).toMatchObject({ inserted: 1, updated: 0, unchanged: 0 })
    expect(await run()).toMatchObject({ inserted: 0, updated: 0, unchanged: 1 })
    const n = await kit.db.query<{ n: string }>(`select count(*) n from "${table}" where legacy_source = 'cloud' and legacy_id = 'g1'`)
    expect(Number(n[0]?.n)).toBe(1)
  })
})
