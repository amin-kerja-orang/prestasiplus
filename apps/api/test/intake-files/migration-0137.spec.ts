import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createTestDatabase, type TestDatabase } from '../support/db'

/** S1-T08, migration 0137 (DM-72): intake_batches.source, nullable kertas/year, the subject and paper_type checks. */
describe('migration 0137 intake guru source', () => {
  let db: TestDatabase
  beforeAll(async () => {
    db = await createTestDatabase()
  })
  afterAll(async () => {
    await db.drop()
  })

  const insert = (v: { source?: string; paper: string; subject: string; kertas: number | null; year?: number | null }) =>
    db.query(
      `insert into intake_batches (source, paper_type, subject, kertas, year, source_text, rights_status) values ($1, $2, $3, $4, $5, 'x', 'own')`,
      [v.source ?? 'admin', v.paper, v.subject, v.kertas, v.year === undefined ? 2025 : v.year],
    )

  it('defaults source to admin', async () => {
    await db.query(`insert into intake_batches (paper_type, subject, kertas, year, source_text, rights_status) values ('trial', 'MAT', 1, 2025, 'x', 'own')`)
    const rows = await db.query<{ source: string }>(`select source from intake_batches where subject = 'MAT'`)
    expect(rows[0]?.source).toBe('admin')
  })

  it('accepts a guru row with null kertas, free text subject and a guru slug', async () => {
    await insert({ source: 'guru', paper: 'buku_teks', subject: 'Matematik Tambahan', kertas: null })
    await insert({ source: 'guru', paper: 'lain', subject: 'x'.repeat(100), kertas: null, year: null })
  })

  it('refuses a guru subject over 100 characters', async () => {
    await expect(insert({ source: 'guru', paper: 'umum', subject: 'x'.repeat(101), kertas: null })).rejects.toThrow(/ck_intake_batches_subject/)
  })

  it('refuses an admin row with null kertas', async () => {
    await expect(insert({ paper: 'trial', subject: 'MAT', kertas: null })).rejects.toThrow(/ck_intake_batches_kertas_required/)
  })

  it('still enforces the admin subject code regex and kertas value', async () => {
    await expect(insert({ paper: 'trial', subject: 'Matematik Tambahan', kertas: 1 })).rejects.toThrow(/ck_intake_batches_subject/)
    await expect(insert({ paper: 'trial', subject: 'MAT', kertas: 3 })).rejects.toThrow(/ck_intake_batches_kertas/)
  })

  it('keeps the five old paper_type codes and refuses an unknown one', async () => {
    for (const p of ['trial', 'general', 'exam', 'exercise_book', 'other']) await insert({ paper: p, subject: 'BM', kertas: 2 })
    await expect(insert({ paper: 'bogus', subject: 'BM', kertas: 2 })).rejects.toThrow(/ck_intake_batches_paper_type/)
  })

  it('widens files.mime additively for DOCX and XLSX', async () => {
    let n = 0
    const put = (mime: string) => {
      n += 1
      return db.query(`insert into files (public_id, purpose, mime, size_bytes, sha256, storage_key) values ($1, 'intake_original', $2, 1, repeat('a', 64), $1)`, [`${'p'.repeat(21)}${String(n)}`, mime])
    }
    await put('application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    await put('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    await put('application/pdf')
    await expect(put('application/msword')).rejects.toThrow(/ck_files_mime/)
  })

  it('refuses a bad source', async () => {
    await expect(insert({ source: 'cikgu', paper: 'trial', subject: 'MAT', kertas: 1 })).rejects.toThrow(/ck_intake_batches_source/)
  })
})
