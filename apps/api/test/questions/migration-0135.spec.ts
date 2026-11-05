import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createTestDatabase, type TestDatabase } from '../support/db'

/** S1-T02, DM-56 and DM-58, migration 0135: `textbook_ref` jsonb and `rejection_reason` text (5..500 characters) on `question_versions`. */
describe('migration 0135 textbook_ref and rejection_reason', () => {
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
  const insert = (ref: unknown, reason: string | null) =>
    db.query(`insert into question_versions (question_id, version_no, status, type, stem_ms, textbook_ref, rejection_reason) values ($1::bigint, $2, 'draft', 'mcq', 'x', $3::jsonb, $4)`, [questionId, ++n, ref === null ? null : JSON.stringify(ref), reason])

  it('adds both columns as nullable', async () => {
    const rows = await db.query<{ column_name: string; data_type: string; is_nullable: string }>(
      `select column_name, data_type, is_nullable from information_schema.columns where table_name = 'question_versions' and column_name in ('textbook_ref', 'rejection_reason') order by column_name`,
    )
    expect(rows).toEqual([
      { column_name: 'rejection_reason', data_type: 'text', is_nullable: 'YES' },
      { column_name: 'textbook_ref', data_type: 'jsonb', is_nullable: 'YES' },
    ])
  })

  it('stores a textbook reference and a reason of 5..500 characters, refuses shorter and longer', async () => {
    await insert(null, null)
    await insert({ bab: 3, tingkatan: 4, mukaSurat: 52, hingga: 54 }, 'Soalan tidak jelas')
    await insert(null, 'abcde')
    await insert(null, 'a'.repeat(500))
    await expect(insert(null, 'abcd')).rejects.toMatchObject({ code: '23514' })
    await expect(insert(null, '   ab   ')).rejects.toMatchObject({ code: '23514' })
    await expect(insert(null, 'a'.repeat(501))).rejects.toMatchObject({ code: '23514' })
    const rows = await db.query<{ textbook_ref: unknown }>(`select textbook_ref from question_versions where question_id = $1::bigint and version_no = 2`, [questionId])
    expect(rows[0]!.textbook_ref).toEqual({ bab: 3, tingkatan: 4, mukaSurat: 52, hingga: 54 })
  })
})
