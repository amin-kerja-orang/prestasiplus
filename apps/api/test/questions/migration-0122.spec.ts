import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createTestDatabase, type TestDatabase } from '../support/db'

/** S1-T01 part 2, migration 0122 (DM-06): archive_reason gains 'regrouped'. Widening only; proven here by a migration test. */
const MIGRATION = fileURLToPath(new URL('../../prisma/migrations/0122_s1_archive_reason_regrouped/migration.sql', import.meta.url))
const OLD_CHECK = `CHECK ("archive_reason" IS NULL OR "archive_reason" IN ('superseded', 'withdrawn', 'source_takedown'))`

describe('migration 0122 archive_reason regrouped', () => {
  let db: TestDatabase
  let q: string
  let next = 1

  const archived = async (reason: string): Promise<void> => {
    await db.query(`insert into question_versions (question_id, version_no, type, stem_ms, archive_reason, status) values ($1::bigint, $2, 'mcq', 'x', $3, 'archived')`, [q, next++, reason])
  }
  const checks = async (): Promise<{ conname: string; convalidated: boolean; def: string }[]> =>
    db.query(`select conname, convalidated, pg_get_constraintdef(oid) def from pg_constraint where conrelid = 'question_versions'::regclass and conname like 'ck_question_versions_archive_reason%' order by conname`)

  beforeAll(async () => {
    db = await createTestDatabase()
    q = (await db.query<{ id: string }>(`insert into questions (source_type, latest_version_no) values ('manual', 1) returning id::text`))[0]!.id
  })
  afterAll(async () => {
    await db.drop()
  })

  it('accepts regrouped and the three old values, still rejects others, and the check is validated with no temp left', async () => {
    for (const r of ['superseded', 'withdrawn', 'source_takedown', 'regrouped']) await archived(r)
    await expect(archived('lost')).rejects.toThrow(/ck_question_versions_archive_reason/)
    await expect(
      db.query(`insert into question_versions (question_id, version_no, type, stem_ms, archive_reason, status) values ($1::bigint, 99, 'mcq', 'x', 'regrouped', 'draft')`, [q]),
    ).rejects.toThrow(/ck_question_versions_archive_reason_status/)
    const c = await checks()
    expect(c.map((r) => r.conname)).toEqual(['ck_question_versions_archive_reason', 'ck_question_versions_archive_reason_status'])
    expect(c.every((r) => r.convalidated)).toBe(true)
    expect(c[0]!.def).toContain('regrouped')
  })

  it('re-running the file against the pre-migration shape widens it and keeps existing rows', async () => {
    await db.query(`delete from question_versions where question_id = $1::bigint and archive_reason = 'regrouped'`, [q])
    await db.query(`ALTER TABLE question_versions DROP CONSTRAINT ck_question_versions_archive_reason; ALTER TABLE question_versions ADD CONSTRAINT ck_question_versions_archive_reason ${OLD_CHECK}`)
    await expect(archived('regrouped')).rejects.toThrow(/ck_question_versions_archive_reason/)
    const before = Number((await db.query<{ n: string }>(`select count(*) n from question_versions`))[0]!.n)

    await db.query(readFileSync(MIGRATION, 'utf8'))

    expect(Number((await db.query<{ n: string }>(`select count(*) n from question_versions`))[0]!.n)).toBe(before)
    await archived('regrouped')
    await expect(archived('lost')).rejects.toThrow(/ck_question_versions_archive_reason/)
    const c = await checks()
    expect(c.map((r) => r.conname)).toEqual(['ck_question_versions_archive_reason', 'ck_question_versions_archive_reason_status'])
    expect(c.every((r) => r.convalidated)).toBe(true)
  })
})
