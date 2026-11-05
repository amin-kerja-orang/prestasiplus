import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createTestDatabase, type TestDatabase } from '../support/db'

/** S3-T06, migration 0161 (DM-23): `papers.surface`, `exam_board`, `duration_minutes`, `total_marks`; `ck_papers_duration` relaxed for subjektif. */
const MIGRATION = fileURLToPath(new URL('../../prisma/migrations/0161_s3_paper_surface/migration.sql', import.meta.url))

describe('migration 0161 paper surface (DM-23)', () => {
  let db: TestDatabase
  let subject: string

  const insert = (cols: Record<string, string | number | null>): Promise<{ id: string }[]> => {
    const all: Record<string, string | number | null> = { kind: 'pilihan', title: 'Kertas ujian', subject_id: subject, kertas: 2, printed_duration_min: 60, ...cols }
    const keys = Object.keys(all)
    const params = keys.map((_, i) => '$' + String(i + 1)).join(', ')
    return db.query<{ id: string }>(`insert into papers (${keys.join(', ')}) values (${params}) returning id::text`, keys.map((k) => all[k]))
  }
  const read = (id: string): Promise<unknown[]> =>
    db.query(`select surface, exam_board, duration_minutes, total_marks from papers where id = $1::bigint`, [id])

  beforeAll(async () => {
    db = await createTestDatabase()
    subject = (await db.query<{ id: string }>(`insert into subjects (code, name, name_en, color) values ('UJI161', 'Subjek ujian', 'Test subject', '#4f46e5') returning id::text`))[0]!.id
  })
  afterAll(async () => {
    await db.drop()
  })

  it('an existing-style insert defaults to surface simulasi with the new columns null', async () => {
    const [p] = await insert({})
    expect(await read(p!.id)).toEqual([{ surface: 'simulasi', exam_board: null, duration_minutes: null, total_marks: null }])
  })

  it('stores a subjektif paper with negeri, tempoh and jumlah markah', async () => {
    const [p] = await insert({ surface: 'subjektif', exam_board: 'selangor', duration_minutes: 150, printed_duration_min: 150, total_marks: 100, year: 2025 })
    expect(await read(p!.id)).toEqual([{ surface: 'subjektif', exam_board: 'selangor', duration_minutes: 150, total_marks: 100 }])
  })

  it('refuses an unknown surface', async () => {
    await expect(insert({ surface: 'dokumen' })).rejects.toThrow(/ck_papers_surface/)
  })

  it('allows printed_duration_min 0 only for a subjektif paper (PO item 17); Simulasi keeps its minimum', async () => {
    await expect(insert({ surface: 'subjektif', printed_duration_min: 0, duration_minutes: null })).resolves.toHaveLength(1)
    await expect(insert({ surface: 'simulasi', printed_duration_min: 0 })).rejects.toThrow(/ck_papers_duration/)
    await expect(insert({ surface: 'subjektif', printed_duration_min: -1 })).rejects.toThrow(/ck_papers_duration/)
  })

  it('keeps duration_minutes within 0..300 and total_marks at least 1', async () => {
    await expect(insert({ surface: 'subjektif', duration_minutes: 0, printed_duration_min: 0 })).resolves.toHaveLength(1)
    await expect(insert({ surface: 'subjektif', duration_minutes: 301, printed_duration_min: 301 })).rejects.toThrow(/ck_papers_duration_minutes/)
    await expect(insert({ surface: 'subjektif', total_marks: 0 })).rejects.toThrow(/ck_papers_total_marks/)
  })

  it('re-running the file is a no-op that keeps every row', async () => {
    const before = await db.query(`select id, surface from papers order by id`)
    await db.query(readFileSync(MIGRATION, 'utf8'))
    expect(await db.query(`select id, surface from papers order by id`)).toEqual(before)
  })
})
