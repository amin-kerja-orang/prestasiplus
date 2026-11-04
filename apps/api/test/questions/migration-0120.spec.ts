import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createTestDatabase, type TestDatabase } from '../support/db'

/**
 * S1-T01 part 1, DM-02, migration 0120: `fk_questions_group_id` is ON DELETE RESTRICT. The test database already ran the migration, so this
 * spec reads the catalogue and proves the behaviour on real rows.
 */
describe('migration 0120 group FK restrict', () => {
  let db: TestDatabase
  let groupId: string
  let questionId: string

  beforeAll(async () => {
    db = await createTestDatabase()
    groupId = (await db.query<{ id: string }>(`insert into stimulus_groups (label) values ('Kumpulan ujian') returning id::text`))[0]!.id
    questionId = (await db.query<{ id: string }>(`insert into questions (source_type, latest_version_no, group_id, group_position) values ('manual', 1, $1::bigint, 1) returning id::text`, [groupId]))[0]!.id
  })
  afterAll(async () => {
    await db.drop()
  })

  it('the constraint keeps its name, restricts delete, cascades update and is validated', async () => {
    const rows = await db.query<{ confdeltype: string; confupdtype: string; convalidated: boolean }>(
      `select confdeltype::text, confupdtype::text, convalidated from pg_constraint where conname = 'fk_questions_group_id' and conrelid = 'questions'::regclass`,
    )
    expect(rows).toEqual([{ confdeltype: 'r', confupdtype: 'c', convalidated: true }])
    expect(await db.query(`select 1 from pg_constraint where conname = 'fk_questions_group_id_restrict'`)).toHaveLength(0)
  })

  it('deleting a group that still has a member fails with a foreign key violation; after releasing the member it succeeds', async () => {
    await expect(db.query(`delete from stimulus_groups where id = $1::bigint`, [groupId])).rejects.toMatchObject({ code: '23503' })
    expect(await db.query(`select 1 from stimulus_groups where id = $1::bigint`, [groupId])).toHaveLength(1)
    expect(await db.query(`select 1 from questions where id = $1::bigint and group_id = $2::bigint`, [questionId, groupId])).toHaveLength(1)

    await db.query(`update questions set group_id = null, group_position = null where id = $1::bigint`, [questionId])
    await db.query(`delete from stimulus_groups where id = $1::bigint`, [groupId])
    expect(await db.query(`select 1 from stimulus_groups where id = $1::bigint`, [groupId])).toHaveLength(0)
  })
})
