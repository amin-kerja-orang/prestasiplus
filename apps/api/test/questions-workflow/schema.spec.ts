import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createTestDatabase, type TestDatabase } from '../support/db'
import { count, dropDatabase } from './helpers'

const TABLES = [
  'diagram_audit_resolutions',
  'master_notes',
  'quality_audits',
  'question_imports',
  'question_quality_scores',
  'question_reports',
  'question_status_events',
  'source_papers',
]

/** The raw SQL of migration 0017 against the migrated test database: checks, keys, legacy unique. */
describe('question workflow schema (migration 0017_question_workflow)', () => {
  let db: TestDatabase
  let userId: string
  beforeAll(async () => {
    db = await createTestDatabase()
    userId = (await db.query<{ id: string }>(`insert into users (name, email) values ('Penguji', 'penguji-qw@demo.test') returning id::text`))[0]!.id
  })
  afterAll(async () => {
    await dropDatabase(db)
  })

  const rejects = async (sql: string, params: unknown[] = []) => {
    await expect(db.query(sql, params)).rejects.toThrow()
  }

  it('lists question_reports as the only migratable table of this card (sorted)', () => {
    const list = JSON.parse(readFileSync(fileURLToPath(new URL('../../prisma/migratable-models.json', import.meta.url)), 'utf8')) as string[]
    expect(list).toContain('question_reports')
    for (const t of TABLES.filter((x) => x !== 'question_reports')) expect(list).not.toContain(t)
    expect([...list]).toEqual([...list].sort())
  })

  it('creates every table with a GENERATED ALWAYS bigint identity key and no Postgres enum types', async () => {
    const rows = await db.query<{ table_name: string; identity_generation: string; data_type: string }>(
      `select table_name, identity_generation, data_type from information_schema.columns
        where table_schema = 'public' and column_name = 'id' and is_identity = 'YES' and table_name = any($1) order by 1`,
      [TABLES],
    )
    expect(rows.map((r) => r.table_name)).toEqual(TABLES)
    expect(new Set(rows.map((r) => r.identity_generation))).toEqual(new Set(['ALWAYS']))
    expect(new Set(rows.map((r) => r.data_type))).toEqual(new Set(['bigint']))
    expect(await count(db, `select count(*) n from pg_type where typtype = 'e'`)).toBe(0)
  })

  it('question_id columns are plain bigint without a foreign key (questions belongs to BE-09)', async () => {
    const fks = await db.query<{ conname: string }>(
      `select conname from pg_constraint c join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
        where c.contype = 'f' and a.attname = 'question_id' and c.conrelid::regclass::text = any($1)`,
      [TABLES],
    )
    expect(fks).toEqual([])
    const cols = await db.query<{ table_name: string }>(
      `select table_name from information_schema.columns where table_schema = 'public' and column_name = 'question_id' and data_type = 'bigint' and table_name = any($1) order by 1`,
      [TABLES],
    )
    expect(cols.map((c) => c.table_name)).toEqual(['diagram_audit_resolutions', 'master_notes', 'question_quality_scores', 'question_reports', 'question_status_events'])
  })

  it('question_status_events: status codes are the v2 lifecycle, creation has a null from_status', async () => {
    await db.query(`insert into question_status_events (question_id, version_no, from_status, to_status, actor_role) values (1, 1, null, 'draft', 'teacher')`)
    await db.query(`insert into question_status_events (question_id, version_no, from_status, to_status, actor_user_id, actor_role, reason) values (1, 1, 'draft', 'review', $1, 'teacher', null)`, [userId])
    await rejects(`insert into question_status_events (question_id, version_no, from_status, to_status) values (1, 1, 'draft', 'pending_review')`)
    await rejects(`insert into question_status_events (question_id, version_no, from_status, to_status) values (1, 1, 'rejected', 'draft')`)
    await rejects(`insert into question_status_events (question_id, version_no, to_status) values (1, 0, 'draft')`)
    // The actor FK is on delete set null: an event outlives its actor.
    await db.query(`delete from users where id = $1`, [userId])
    expect(await count(db, `select count(*) n from question_status_events where question_id = 1 and actor_user_id is null`)).toBe(2)
  })

  it('question_reports: reasons, source, status, comment and notes limits', async () => {
    await db.query(`insert into question_reports (question_id, question_version_no, reasons, source) values (1, 1, array['typo'], 'latihan')`)
    await rejects(`insert into question_reports (question_id, question_version_no, reasons, source) values (2, 1, '{}', 'latihan')`)
    await rejects(`insert into question_reports (question_id, question_version_no, reasons, source) values (2, 1, array['bogus'], 'latihan')`)
    await rejects(`insert into question_reports (question_id, question_version_no, reasons, source) values (2, 1, array['typo'], 'nope')`)
    await rejects(`insert into question_reports (question_id, question_version_no, reasons, source, status) values (2, 1, array['typo'], 'latihan', 'rejected')`)
    await rejects(`insert into question_reports (question_id, question_version_no, reasons, source, comment) values (2, 1, array['typo'], 'latihan', repeat('x', 501))`)
    await db.query(`insert into question_reports (question_id, question_version_no, reasons, source, comment, admin_notes) values (2, 1, array['typo', 'other'], 'latihan', repeat('x', 500), repeat('x', 1000))`)
    await rejects(`insert into question_reports (question_id, question_version_no, reasons, source, admin_notes) values (3, 1, array['typo'], 'latihan', repeat('x', 1001))`)
    const def = await db.query<{ status: string; is_test: boolean }>(`select status, is_test from question_reports where question_id = 1`)
    expect(def[0]).toEqual({ status: 'pending', is_test: false })
  })

  it('question_reports: one report per reporter, question and version', async () => {
    const reporter = (await db.query<{ id: string }>(`insert into users (name, email) values ('Pelapor', 'pelapor-qw@demo.test') returning id::text`))[0]!.id
    const ins = `insert into question_reports (question_id, question_version_no, reporter_id, reasons, source) values ($1, $2, $3, array['typo'], 'latihan')`
    await db.query(ins, [10, 1, reporter])
    await rejects(ins, [10, 1, reporter])
    await db.query(ins, [10, 2, reporter]) // a new version may be reported again
    await db.query(ins, [11, 1, reporter])
  })

  it('legacy_source is cloud or my, and (legacy_source, legacy_id) is unique on question_reports', async () => {
    const ins = `insert into question_reports (question_id, question_version_no, reasons, source, legacy_source, legacy_id) values ($1, 1, array['typo'], 'spm', $2, $3)`
    await rejects(ins, [20, 'other', '1'])
    await db.query(ins, [20, 'cloud', '77'])
    await rejects(ins, [21, 'cloud', '77'])
    await db.query(ins, [21, 'my', '77'])
    // Rows without a legacy key never clash.
    await db.query(`insert into question_reports (question_id, question_version_no, reasons, source) values (22, 1, array['typo'], 'spm'), (23, 1, array['typo'], 'spm')`)
    // The other tables of this card carry no legacy columns (data model: no LEG).
    expect(await count(db, `select count(*) n from information_schema.columns where table_schema = 'public' and column_name like 'legacy_%' and table_name = any($1)`, [TABLES.filter((t) => t !== 'question_reports')])).toBe(0)
  })

  it('source_papers: natural_key is unique when present, rights default to unclear, enums are checked', async () => {
    await db.query(`insert into source_papers (natural_key, content_hash, file_hash) values ('matematik|2023|lpm|k2|sebenar', 'c1', 'f1')`)
    await rejects(`insert into source_papers (natural_key) values ('matematik|2023|lpm|k2|sebenar')`)
    await db.query(`insert into source_papers (natural_key) values (null), (null)`)
    const row = (await db.query<{ rights_status: string }>(`select rights_status from source_papers where natural_key = 'matematik|2023|lpm|k2|sebenar'`))[0]!
    expect(row.rights_status).toBe('unclear')
    await rejects(`insert into source_papers (rights_status) values ('belum_jelas')`)
    await rejects(`insert into source_papers (exam_type) values ('final')`)
    await rejects(`insert into source_papers (source_kind) values ('blog')`)
    await rejects(`insert into source_papers (year) values (1800)`)
    await db.query(`insert into source_papers (rights_status, exam_type, source_kind, year) values ('third_party', 'percubaan', 'publisher', 2024)`)
  })

  it('question_imports: difficulty 1 to 5, counts non-negative, failures is a json array', async () => {
    await db.query(`insert into question_imports (file_name) values ('a.csv')`)
    const d = (await db.query<{ failures: unknown; imported_count: number }>(`select failures, imported_count from question_imports`))[0]!
    expect(d.failures).toEqual([])
    expect(d.imported_count).toBe(0)
    await rejects(`insert into question_imports (file_name, default_difficulty) values ('a.csv', 6)`)
    await rejects(`insert into question_imports (file_name, default_difficulty) values ('a.csv', 0)`)
    await rejects(`insert into question_imports (file_name, failed_count) values ('a.csv', -1)`)
    await rejects(`insert into question_imports (file_name, failures) values ('a.csv', '{}'::jsonb)`)
    await db.query(`insert into question_imports (file_name, failures, default_difficulty) values ('b.csv', '[{"row":2,"message":"Baris tidak lengkap."}]'::jsonb, 5)`)
  })

  it('quality_audits and scores: score bands and one score per question', async () => {
    const audit = (await db.query<{ id: string }>(`insert into quality_audits (finished_at, finding_count, scored_count, average_score) values (now(), 2, 3, 61.5) returning id::text`))[0]!.id
    await rejects(`insert into quality_audits (average_score) values (101)`)
    await rejects(`insert into quality_audits (finding_count) values (-1)`)
    const ins = `insert into question_quality_scores (question_id, score, bucket, audit_id) values ($1, $2, $3, $4)`
    await db.query(ins, [1, 100, 'cemerlang', audit])
    await rejects(ins, [1, 50, 'lemah', audit])
    await rejects(ins, [2, 101, 'cemerlang', audit])
    await rejects(ins, [2, 40, 'le50', audit])
    await db.query(`delete from quality_audits where id = $1`, [audit])
    expect(await count(db, `select count(*) n from question_quality_scores where question_id = 1 and audit_id is null`)).toBe(1)
  })

  it('diagram_audit_resolutions and master_notes: kind, resolution, one row per kind and question', async () => {
    const ins = `insert into diagram_audit_resolutions (kind, question_id, resolution) values ($1, $2, $3)`
    await db.query(ins, ['mcq', 1, 'dismissed'])
    await rejects(ins, ['mcq', 1, 'image'])
    await db.query(ins, ['structured', 1, 'image'])
    await rejects(ins, ['essay', 2, 'image'])
    await rejects(ins, ['mcq', 2, 'ignored'])
    await db.query(`insert into master_notes (question_id, model, note_text) values (1, 'stub', 'nota')`)
    const n = (await db.query<{ flagged: boolean; teacher_approved: boolean; trap_text: string }>(`select flagged, teacher_approved, trap_text from master_notes`))[0]!
    expect(n).toEqual({ flagged: false, teacher_approved: false, trap_text: '' })
    await rejects(`insert into master_notes (question_id, model, note_text, tokens) values (1, 'stub', 'x', -1)`)
  })
})
