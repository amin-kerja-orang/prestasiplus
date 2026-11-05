import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createTestDatabase, type TestDatabase } from '../support/db'

/** S5-T15, DM-44, migration 0187: `ck_practice_checks_selected_label` allows NULL or comma-joined labels A-H. */
describe('migration 0187 practice_checks.selected_label check', () => {
  let db: TestDatabase

  const labelOk = async (label: string | null): Promise<boolean> => {
    const rows = await db.query<{ def: string }>(
      `select pg_get_constraintdef(oid) as def from pg_constraint where conname = 'ck_practice_checks_selected_label'`,
    )
    expect(rows).toHaveLength(1)
    // Evaluate the constraint expression itself against the value, inside a scratch table.
    await db.query('drop table if exists scratch_label')
    await db.query(`create temp table scratch_label (selected_label text, constraint c ${rows[0]!.def})`)
    try {
      await db.query('insert into scratch_label values ($1)', [label])
      return true
    } catch (err) {
      if ((err as { code?: string }).code === '23514') return false
      throw err
    }
  }

  beforeAll(async () => {
    db = await createTestDatabase()
  })
  afterAll(async () => {
    await db.drop()
  })

  it.each(['A', 'A,C', 'A,B,C,D,E,F,G,H', null])('accepts %s', async (v) => {
    expect(await labelOk(v)).toBe(true)
  })
  it.each(['a', 'A,,C', 'AA', 'I', 'A,', ',A', 'A,B,C,D,E,F,G,H,A', ''])('rejects %j', async (v) => {
    expect(await labelOk(v)).toBe(false)
  })
})
