import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createTestDatabase, type TestDatabase } from '../support/db'

/** S1-T02, DM-47, migration 0128: `question_versions.difficulty_level` is a nullable smallint checked to 1..5, apart from `difficulty_tp` (1..6). */
describe('migration 0128 difficulty_level', () => {
  let db: TestDatabase
  let questionId: string
  let n = 0

  beforeAll(async () => {
    db = await createTestDatabase()
    questionId = (await db.query<{ id: string }>(`insert into questions (source_type, latest_version_no) values ('manual', 1) returning id::text`))[0]!.id
  })
  afterAll(async () => {
    await db.drop()
  })
  const insert = (level: number | null, tp: number | null) =>
    db.query(`insert into question_versions (question_id, version_no, status, type, stem_ms, difficulty_level, difficulty_tp) values ($1::bigint, $2, 'draft', 'mcq', 'x', $3, $4)`, [questionId, ++n, level, tp])

  it('is a nullable smallint', async () => {
    const rows = await db.query<{ data_type: string; is_nullable: string }>(`select data_type, is_nullable from information_schema.columns where table_name = 'question_versions' and column_name = 'difficulty_level'`)
    expect(rows).toEqual([{ data_type: 'smallint', is_nullable: 'YES' }])
  })

  it('accepts NULL and 1..5, refuses 0 and 6, and keeps TP 6 in its own column', async () => {
    await insert(null, null)
    await insert(1, 6)
    await insert(5, 1)
    await expect(insert(0, 1)).rejects.toMatchObject({ code: '23514' })
    await expect(insert(6, 1)).rejects.toMatchObject({ code: '23514' })
    const rows = await db.query<{ difficulty_level: number | null; difficulty_tp: number | null }>(`select difficulty_level, difficulty_tp from question_versions where question_id = $1::bigint order by version_no`, [questionId])
    expect(rows).toEqual([{ difficulty_level: null, difficulty_tp: null }, { difficulty_level: 1, difficulty_tp: 6 }, { difficulty_level: 5, difficulty_tp: 1 }])
  })
})
