import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createTestDatabase, type TestDatabase } from '../support/db'

/**
 * AZ-22 (#61 m4): 0018 named its partial index with 66 characters, Postgres truncated it to 63, and 0041 renames it
 * to a name under the limit. Also a guard for every migration from 0040 on (half AZ range and later): no quoted
 * identifier may exceed 63 bytes, so the name in the SQL is always the stored one.
 */
const MIGRATIONS = fileURLToPath(new URL('../../prisma/migrations/', import.meta.url))
const MIGRATION_0041 = `${MIGRATIONS}0041_aggregate_school_index_name/migration.sql`
const NEW_NAME = 'ix_practice_attempt_aggregates_school_subject_submitted'
const TRUNCATED = 'ix_practice_attempt_aggregates_school_id_subject_code_submitted'
const MAX_IDENTIFIER = 63

describe('AZ-22: the 0018 aggregate index has a name under the identifier limit', () => {
  let db: TestDatabase

  beforeAll(async () => {
    db = await createTestDatabase()
  })
  afterAll(async () => {
    await db.drop()
  })

  const indexesOf = () =>
    db.query<{ indexname: string; indexdef: string }>(
      `select indexname, indexdef from pg_indexes where tablename = 'practice_attempt_aggregates' and indexdef like '%school_id%'`,
    )

  it('after every migration the index carries the new name and the unchanged 0018 definition', async () => {
    const rows = await indexesOf()
    expect(rows.map((r) => r.indexname)).toEqual([NEW_NAME])
    expect(rows[0]!.indexdef).toMatch(/\(school_id, subject_code, submitted_at DESC\) WHERE \(NOT is_test\)/)
    expect(NEW_NAME.length).toBeLessThanOrEqual(MAX_IDENTIFIER)
    // No index on the table keeps the truncated name.
    expect((await db.query(`select 1 from pg_indexes where indexname = $1`, [TRUNCATED])).length).toBe(0)
  })

  it('0041 is a no-op when run again (IF EXISTS) and its documented reverse restores the stored 0018 name', async () => {
    await db.query(readFileSync(MIGRATION_0041, 'utf8'))
    expect((await indexesOf()).map((r) => r.indexname)).toEqual([NEW_NAME])
    await db.query(`ALTER INDEX "${NEW_NAME}" RENAME TO "${TRUNCATED}"`)
    expect((await indexesOf()).map((r) => r.indexname)).toEqual([TRUNCATED])
    await db.query(readFileSync(MIGRATION_0041, 'utf8'))
    expect((await indexesOf()).map((r) => r.indexname)).toEqual([NEW_NAME])
  })

  it('no migration from 0040 on uses a quoted identifier longer than 63 bytes', () => {
    const offenders: string[] = []
    for (const dir of readdirSync(MIGRATIONS).filter((d) => /^\d{4}_/.test(d) && Number(d.slice(0, 4)) >= 40).sort()) {
      const sql = readFileSync(`${MIGRATIONS}${dir}/migration.sql`, 'utf8').replace(/--[^\n]*/g, '')
      for (const m of sql.matchAll(/"([^"]+)"/g)) {
        if (Buffer.byteLength(m[1]!, 'utf8') > MAX_IDENTIFIER) offenders.push(`${dir}: ${m[1]!}`)
      }
    }
    expect(offenders).toEqual([])
  })
})
