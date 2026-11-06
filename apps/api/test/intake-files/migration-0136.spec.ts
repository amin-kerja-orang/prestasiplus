import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createTestDatabase, type TestDatabase } from '../support/db'

/** S1-T04, migration 0136 (DM-71): the batch status selesai_dengan_ralat and intake_files.retry_count. */
describe('migration 0136 intake retry status', () => {
  let db: TestDatabase
  let batchId: string
  let n = 0
  beforeAll(async () => {
    db = await createTestDatabase()
    batchId = (
      await db.query<{ id: string }>(
        `insert into intake_batches (paper_type, subject, kertas, year, source_text, rights_status) values ('trial', 'MAT', 1, 2025, 'x', 'own') returning id::text`,
      )
    )[0]!.id
  })
  afterAll(async () => {
    await db.drop()
  })

  const setStatus = (status: string) => db.query(`update intake_batches set status = $1 where id = $2::bigint`, [status, batchId])
  const addFile = async (): Promise<string> => {
    n += 1
    const file = (
      await db.query<{ id: string }>(
        `insert into files (public_id, purpose, mime, size_bytes, sha256, storage_key) values ($1, 'intake_original', 'application/pdf', 1, repeat('a', 64), $1) returning id::text`,
        [`${'r'.repeat(21)}${String(n)}`],
      )
    )[0]!.id
    return (
      await db.query<{ id: string }>(
        `insert into intake_files (batch_id, file_id, original_name, sha256, size_bytes) values ($1::bigint, $2::bigint, 'k.pdf', repeat('b', 64), 1) returning id::text`,
        [batchId, file],
      )
    )[0]!.id
  }

  it('accepts all six batch statuses and refuses an unknown one', async () => {
    for (const s of ['submitted', 'processing', 'ready_for_review', 'selesai_dengan_ralat', 'failed', 'cancelled']) await setStatus(s)
    await expect(setStatus('queued')).rejects.toThrow(/ck_intake_batches_status/)
    await expect(setStatus('done')).rejects.toThrow(/ck_intake_batches_status/)
  })

  it('retry_count starts at 0 on every file and holds 0..3 only', async () => {
    const id = await addFile()
    expect((await db.query<{ retry_count: number }>(`select retry_count from intake_files where id = $1::bigint`, [id]))[0]?.retry_count).toBe(0)
    for (const v of [1, 2, 3]) await db.query(`update intake_files set retry_count = $1 where id = $2::bigint`, [v, id])
    await expect(db.query(`update intake_files set retry_count = 4 where id = $1::bigint`, [id])).rejects.toThrow(/ck_intake_files_retry_count/)
    await expect(db.query(`update intake_files set retry_count = -1 where id = $1::bigint`, [id])).rejects.toThrow(/ck_intake_files_retry_count/)
  })
})
