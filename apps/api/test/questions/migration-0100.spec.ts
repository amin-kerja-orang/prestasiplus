import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createTestDatabase, type TestDatabase } from '../support/db'

/**
 * R1-B01, migration 0100. The test database already ran it (on empty tables), so this spec puts the pre-0100 shape back
 * (five-value CHECK, `published` indexes), seeds rows in every old status and executes the file again.
 */
const MIGRATION = fileURLToPath(new URL('../../prisma/migrations/0100_question_lifecycle_approved/migration.sql', import.meta.url))

describe('migration 0100 question lifecycle (approved = servable)', () => {
  let db: TestDatabase
  const ids: Record<string, string> = {}

  beforeAll(async () => {
    db = await createTestDatabase()
    // Back to the pre-0100 shape.
    await db.query(`
      DROP INDEX IF EXISTS uq_question_versions_one_approved;
      DROP INDEX IF EXISTS ix_question_versions_approved_subject_level;
      DROP INDEX IF EXISTS ix_qv_pub_subject_level_tp;
      DROP INDEX IF EXISTS ix_qv_pub_chapter;
      DROP INDEX IF EXISTS ix_qv_pub_level_tp;
      ALTER TABLE question_versions DROP CONSTRAINT ck_question_versions_status;
      ALTER TABLE question_versions ADD CONSTRAINT ck_question_versions_status CHECK (status IN ('draft','review','approved','published','archived'));
      CREATE UNIQUE INDEX uq_question_versions_one_published ON question_versions (question_id) WHERE status = 'published';
      CREATE INDEX ix_question_versions_published_subject_level ON question_versions (subject_id, education_level_id) WHERE status = 'published';
    `)
    const make = async (name: string, status: string): Promise<void> => {
      const q = (await db.query<{ id: string }>(`insert into questions (source_type, latest_version_no, live_version_no) values ('manual', 1, ${status === 'published' ? 1 : 'null'}) returning id::text`))[0]!.id
      await db.query(`insert into question_versions (question_id, version_no, status, type, stem_ms) values ($1::bigint, 1, $2, 'mcq', 'x')`, [q, status])
      ids[name] = q
    }
    for (const s of ['draft', 'review', 'approved', 'published', 'archived']) await make(s, s)
    // A published v1 with an approved (never published) v2 on the same question.
    await make('both', 'published')
    await db.query(`update questions set latest_version_no = 2 where id = $1::bigint`, [ids.both])
    await db.query(`insert into question_versions (question_id, version_no, status, type, stem_ms) values ($1::bigint, 2, 'approved', 'mcq', 'y')`, [ids.both])
  })
  afterAll(async () => {
    await db.drop()
  })

  const statusOf = async (name: string, v = 1): Promise<string> =>
    (await db.query<{ status: string }>(`select status from question_versions where question_id = $1::bigint and version_no = $2`, [ids[name], v]))[0]!.status

  it('maps published to approved, approved to review, and leaves draft, review and archived', async () => {
    await db.query(readFileSync(MIGRATION, 'utf8'))
    expect(await statusOf('draft')).toBe('draft')
    expect(await statusOf('review')).toBe('review')
    expect(await statusOf('approved')).toBe('review') // approved but never published stays invisible
    expect(await statusOf('published')).toBe('approved') // served before, served after
    expect(await statusOf('archived')).toBe('archived')
    expect(await statusOf('both', 1)).toBe('approved')
    expect(await statusOf('both', 2)).toBe('review')
  })

  it('the live pointer of every served question is on an approved version', async () => {
    const bad = await db.query(`select q.id from questions q join question_versions v on v.question_id = q.id and v.version_no = q.live_version_no where v.status <> 'approved'`)
    expect(bad).toEqual([])
  })

  it('replaces the CHECK, and the partial indexes use the approved predicate', async () => {
    await expect(db.query(`update question_versions set status = 'published' where question_id = $1::bigint`, [ids.draft])).rejects.toThrow()
    const rows = await db.query<{ indexname: string; indexdef: string }>(`select indexname, indexdef from pg_indexes where tablename = 'question_versions' and indexdef like '%WHERE%'`)
    expect(rows.length).toBeGreaterThanOrEqual(5)
    for (const r of rows) {
      expect(r.indexdef).toContain("'approved'")
      expect(r.indexdef).not.toContain("'published'")
    }
    expect(rows.map((r) => r.indexname)).toContain('uq_question_versions_one_approved')
  })
})
