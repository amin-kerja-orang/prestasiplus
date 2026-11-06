import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createTestDatabase, type TestDatabase } from '../support/db'

/** S1-T03 (kertas range), migration 0124 (DM-08): ck_intake_batches_kertas widens to 1..4 and the kertas index follows. */
describe('migration 0124 kertas range', () => {
  let db: TestDatabase
  beforeAll(async () => {
    db = await createTestDatabase()
  })
  afterAll(async () => {
    await db.drop()
  })

  const insert = (kertas: number | null, source = 'admin') =>
    db.query(
      `insert into intake_batches (source, paper_type, subject, kertas, year, source_text, rights_status) values ($1, 'trial', 'MAT', $2, 2025, 'x', 'own')`,
      [source, kertas],
    )

  it('accepts kertas 1, 2, 3 and 4', async () => {
    for (const k of [1, 2, 3, 4]) await insert(k)
    const rows = await db.query<{ kertas: number }>(`select kertas from intake_batches order by kertas`)
    expect(rows.map((r) => r.kertas)).toEqual([1, 2, 3, 4])
  })

  it('refuses kertas 0 and 5', async () => {
    await expect(insert(0)).rejects.toThrow(/ck_intake_batches_kertas/)
    await expect(insert(5)).rejects.toThrow(/ck_intake_batches_kertas/)
  })

  it('still lets a guru batch carry no kertas', async () => {
    await insert(null, 'guru')
  })

  it('rebuilds the paper-code kertas index with the 1..4 expression', async () => {
    const rows = await db.query<{ indexdef: string }>(`select indexdef from pg_indexes where indexname = 'ix_question_versions_paper_kertas'`)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.indexdef).toContain('[1-4]')
  })
})
