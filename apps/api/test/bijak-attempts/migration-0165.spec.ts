import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createTestDatabase, type TestDatabase } from '../support/db'

/** S3-T06, migration 0165 (DM-83): `exam_attempts.paper_kind` widened; `duration_min >= 0` (PO decision 2026-11-05, item 17). */
const MIGRATION = fileURLToPath(new URL('../../prisma/migrations/0165_s3_exam_attempt_paper_kind/migration.sql', import.meta.url))

describe('migration 0165 exam attempt paper kind (DM-83)', () => {
  let db: TestDatabase
  let user: string

  const insert = (paperKind: string, durationMin = 60, paperId: string | null = '1'): Promise<{ id: string }[]> =>
    db.query<{ id: string }>(
      `insert into exam_attempts (user_id, paper_id, paper_kind, title, subject, subject_name, kertas, paper_code, mode, started_at, duration_min)
       values ($1::bigint, $2::bigint, $3, 'Kertas ujian', 'BM', 'Bahasa Melayu', 2, '1103/2', 'latihan', now(), $4) returning id::text`,
      [user, paperId, paperKind, durationMin],
    )

  beforeAll(async () => {
    db = await createTestDatabase()
    user = (
      await db.query<{ id: string }>(
        `insert into users (name, email, is_active, created_at, updated_at) values ('Murid Ujian', 'murid.uji165@example.test', true, now(), now()) returning id::text`,
      )
    )[0]!.id
  })
  afterAll(async () => {
    await db.drop()
  })

  it('accepts the four kinds pilihan, jana, subjektif, structured', async () => {
    for (const k of ['pilihan', 'jana', 'subjektif']) await expect(insert(k)).resolves.toHaveLength(1)
    await expect(insert('structured', 0, null)).resolves.toHaveLength(1)
  })

  it('refuses any other kind', async () => {
    await expect(insert('dokumen')).rejects.toThrow(/ck_exam_attempts_paper_kind/)
  })

  it('stores an untimed sitting (duration_min 0) and refuses a negative one', async () => {
    await expect(insert('subjektif', 0)).resolves.toHaveLength(1)
    await expect(insert('subjektif', -1)).rejects.toThrow(/ck_exam_attempts_duration_min/)
  })

  it('re-running the file keeps every row', async () => {
    const before = await db.query(`select id, paper_kind from exam_attempts order by id`)
    await db.query(readFileSync(MIGRATION, 'utf8'))
    expect(await db.query(`select id, paper_kind from exam_attempts order by id`)).toEqual(before)
  })
})
