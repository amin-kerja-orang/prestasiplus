import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createTestDatabase, type TestDatabase } from '../support/db'

/** S1-T10 / S3, migration 0163 (DM-45): papers.source_batch_id, its set-null FK and the partial unique (source_batch_id, paper_code). */
describe('migration 0163 papers.source_batch_id', () => {
  let db: TestDatabase
  let subjectId: string
  beforeAll(async () => {
    db = await createTestDatabase()
    subjectId = (await db.query<{ id: string }>(`insert into subjects (code, name, name_en, color, is_active, sort_order) values ('T0163', 'T', 'T', '#112233', true, 0) returning id::text id`))[0]!.id
  })
  afterAll(async () => {
    await db.drop()
  })

  const batch = async (): Promise<string> =>
    (await db.query<{ id: string }>(`insert into intake_batches (paper_type, subject, kertas, year, source_text, rights_status) values ('trial', 'MAT', 1, 2025, 'x', 'own') returning id::text id`))[0]!.id
  const paper = async (batchId: string | null, code: string | null): Promise<string> =>
    (
      await db.query<{ id: string }>(
        `insert into papers (kind, title, subject_id, kertas, printed_duration_min, paper_code, source_batch_id) values ('pilihan', 'p', $1, 1, 60, $2, $3) returning id::text id`,
        [subjectId, code, batchId],
      )
    )[0]!.id

  it('adds a nullable bigint column that defaults to null', async () => {
    const cols = await db.query<{ data_type: string; is_nullable: string }>(
      `select data_type, is_nullable from information_schema.columns where table_name = 'papers' and column_name = 'source_batch_id'`,
    )
    expect(cols).toEqual([{ data_type: 'bigint', is_nullable: 'YES' }])
    const id = await paper(null, null)
    expect((await db.query<{ s: string | null }>(`select source_batch_id::text s from papers where id = $1`, [id]))[0]!.s).toBeNull()
  })

  it('refuses a batch id that does not exist', async () => {
    await expect(paper('999999999', 'K1')).rejects.toThrow(/fk_papers_source_batch_id/)
  })

  it('sets the column to null (keeps the paper) when the batch is deleted', async () => {
    const b = await batch()
    const p = await paper(b, 'K1')
    await db.query(`delete from intake_batches where id = $1`, [b])
    const rows = await db.query<{ s: string | null }>(`select source_batch_id::text s from papers where id = $1`, [p])
    expect(rows).toEqual([{ s: null }])
  })

  it('refuses a second paper with the same (batch, paper_code)', async () => {
    const b = await batch()
    await paper(b, 'K1')
    await expect(paper(b, 'K1')).rejects.toThrow(/uq_papers_source_batch_id_paper_code/)
  })

  it('allows the same paper_code for another batch, another code in one batch, and any number of null batches', async () => {
    const b1 = await batch()
    const b2 = await batch()
    await paper(b1, 'K2')
    await paper(b2, 'K2')
    await paper(b1, 'K1')
    await paper(null, 'K2')
    await paper(null, 'K2')
    await paper(null, null)
  })
})
