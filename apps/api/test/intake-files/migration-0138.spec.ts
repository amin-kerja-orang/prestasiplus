import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createTestDatabase, type TestDatabase } from '../support/db'

/** S1-T03, migration 0138 (DM-85): intake_batches.exam_board. */
describe('migration 0138 intake exam board', () => {
  let db: TestDatabase
  beforeAll(async () => {
    db = await createTestDatabase()
  })
  afterAll(async () => {
    await db.drop()
  })

  const insert = (board: string | null) =>
    db.query<{ b: string | null }>(
      `insert into intake_batches (paper_type, subject, kertas, year, source_text, rights_status, exam_board) values ('exam', 'MAT', 1, 2024, 'x', 'own', $1) returning exam_board b`,
      [board],
    )

  it('is nullable and stores a board of 1..100 characters', async () => {
    expect((await insert(null))[0]?.b).toBeNull()
    expect((await insert('SPM (LP)'))[0]?.b).toBe('SPM (LP)')
    await insert('x'.repeat(100))
  })

  it('refuses an empty or over-long board', async () => {
    await expect(insert('')).rejects.toThrow(/ck_intake_batches_exam_board/)
    await expect(insert('x'.repeat(101))).rejects.toThrow(/ck_intake_batches_exam_board/)
  })
})
