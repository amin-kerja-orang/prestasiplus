import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createTestDatabase, type TestDatabase } from '../support/db'

/**
 * R1-H-A18, migration 0105 (question_versions.last_editor and declared_marks). The test database already ran it on empty tables, so this
 * spec puts the pre-0105 shape back (drops both columns), seeds rows of every kind and executes the file again.
 */
const MIGRATION = fileURLToPath(new URL('../../prisma/migrations/0105_gate_facts/migration.sql', import.meta.url))

describe('migration 0105 gate facts: backfill with before and after counts', () => {
  let db: TestDatabase
  const ids: Record<string, string> = {}

  beforeAll(async () => {
    db = await createTestDatabase()
    await db.query(`
      ALTER TABLE question_versions DROP CONSTRAINT IF EXISTS ck_question_versions_declared_marks, DROP CONSTRAINT IF EXISTS ck_question_versions_last_editor;
      ALTER TABLE question_versions DROP COLUMN last_editor, DROP COLUMN declared_marks;
    `)
    const person = (await db.query<{ id: string }>(`insert into users (name) values ('Penyemak Contoh') returning id::text`))[0]!.id
    const batch = (await db.query<{ id: string }>(`insert into intake_batches (paper_type, subject, kertas, year, source_text, rights_status) values ('trial', 'MAT', 1, 2025, 'x', 'own') returning id::text`))[0]!.id
    const item = async (marks: unknown, parts?: unknown[]): Promise<string> =>
      (await db.query<{ id: string }>(`insert into intake_items (batch_id, position, item_type, payload) values ($1::bigint, 1, 'mcq', $2::jsonb) returning id::text`, [batch, JSON.stringify({ marks, ...(parts === undefined ? {} : { parts }) })]))[0]!.id
    const make = async (name: string, source: string, status: string, intakeItemId: string | null = null): Promise<void> => {
      const q = (await db.query<{ id: string }>(`insert into questions (source_type, latest_version_no) values ($1, 1) returning id::text`, [source]))[0]!.id
      await db.query(`insert into question_versions (question_id, version_no, status, type, stem_ms, intake_item_id) values ($1::bigint, 1, $2, 'mcq', 'x', $3::bigint)`, [q, status, intakeItemId])
      ids[name] = q
    }
    await make('ai-draft', 'ai_variant', 'draft')
    await make('ai-review', 'ai_variant', 'review')
    await make('ai-draft-person-moved', 'ai_variant', 'draft')
    await db.query(`insert into question_status_events (question_id, version_no, from_status, to_status, actor_user_id, actor_role) values ($1::bigint, 1, 'draft', 'review', $2::bigint, 'admin')`, [ids['ai-draft-person-moved'], person])
    await make('ai-draft-created-event-only', 'ai_variant', 'draft')
    await db.query(`insert into question_status_events (question_id, version_no, from_status, to_status, actor_user_id, actor_role) values ($1::bigint, 1, null, 'draft', $2::bigint, 'admin')`, [ids['ai-draft-created-event-only'], person])
    await make('ai-approved', 'ai_variant', 'approved')
    await make('ai-archived', 'ai_variant', 'archived')
    await make('manual-draft', 'manual', 'draft')
    await make('manual-approved', 'manual', 'approved')
    await make('marks-5', 'pdf', 'review', await item(5))
    await make('marks-text', 'pdf', 'review', await item('lima'))
    await make('marks-1234', 'pdf', 'review', await item(1234))
    await make('marks-7.5', 'pdf', 'review', await item(7.5))
    await make('marks-none', 'pdf', 'review', await item(null))
    await make('marks-approved', 'pdf', 'approved', await item(3))
    await make('marks-zero', 'pdf', 'review', await item(0))
    await make('parted-zero', 'pdf', 'review', await item(0, [{ label: 'a', marks: 2 }, { label: 'b', marks: 3 }]))
    await make('parted-total', 'pdf', 'review', await item(5, [{ label: 'a', marks: 2 }, { label: 'b', marks: 3 }]))
    await make('empty-parts', 'pdf', 'review', await item(4, []))
  })
  afterAll(async () => {
    await db.drop()
  })

  const states = async (): Promise<Record<string, { last_editor: string; declared_marks: number | null }>> => {
    const rows = await db.query<{ q: string; last_editor: string; declared_marks: number | null }>(`select question_id::text q, last_editor, declared_marks from question_versions`)
    return Object.fromEntries(Object.entries(ids).map(([name, id]) => [name, rows.find((r) => r.q === id)!]))
  }

  it('before: the columns are gone; after: the file adds them and fills only what it should', async () => {
    const totalBefore = Number((await db.query<{ n: string }>(`select count(*) n from question_versions`))[0]!.n)
    expect((await db.query(`select 1 from information_schema.columns where table_name = 'question_versions' and column_name in ('last_editor', 'declared_marks')`)).length).toBe(0)

    await db.query(readFileSync(MIGRATION, 'utf8'))

    expect(Number((await db.query<{ n: string }>(`select count(*) n from question_versions`))[0]!.n)).toBe(totalBefore) // no row added or removed
    const s = await states()
    // ai_variant, draft or review, no status transition by a person: the AI's
    for (const name of ['ai-draft', 'ai-review', 'ai-draft-created-event-only']) expect(s[name]!.last_editor, name).toBe('ai')
    // a person moved it, or it is already approved or archived (never re-checked, D80 DEC-2), or it is not an AI variant: a person's
    for (const name of ['ai-draft-person-moved', 'ai-approved', 'ai-archived', 'manual-draft', 'manual-approved', 'marks-5', 'marks-approved']) expect(s[name]!.last_editor, name).toBe('person')
    expect((await db.query<{ n: string }>(`select count(*) n from question_versions where last_editor = 'ai'`))[0]!.n).toBe('3')
    expect((await db.query<{ n: string }>(`select count(*) n from question_versions where last_editor = 'person'`))[0]!.n).toBe(String(totalBefore - 3))
    // declared marks: a whole number 0..999 from the intake payload; text, 4 digits, a fraction and null stay null; no intake item stays null
    expect(s['marks-5']!.declared_marks).toBe(5)
    expect(s['marks-approved']!.declared_marks).toBe(3) // approved rows get the value too; the gate never re-checks them
    for (const name of ['marks-text', 'marks-1234', 'marks-7.5', 'marks-none', 'ai-draft', 'manual-draft']) expect(s[name]!.declared_marks, name).toBeNull()
    // a zero total and every parted item declare nothing (a parted question's total is the sum of its parts); an empty parts list is no parts
    for (const name of ['marks-zero', 'parted-zero', 'parted-total']) expect(s[name]!.declared_marks, name).toBeNull()
    expect(s['empty-parts']!.declared_marks).toBe(4)
    expect((await db.query<{ n: string }>(`select count(*) n from question_versions where declared_marks = 0`))[0]!.n).toBe('0')
    expect((await db.query<{ n: string }>(`select count(*) n from question_versions where declared_marks is not null`))[0]!.n).toBe('3')
  })

  it('the new rows are constrained and default to person', async () => {
    await expect(db.query(`update question_versions set last_editor = 'robot' where question_id = $1::bigint`, [ids['manual-draft']])).rejects.toThrow(/ck_question_versions_last_editor/)
    await expect(db.query(`update question_versions set declared_marks = -1 where question_id = $1::bigint`, [ids['manual-draft']])).rejects.toThrow(/ck_question_versions_declared_marks/)
    await db.query(`insert into question_versions (question_id, version_no, status, type, stem_ms) values ($1::bigint, 2, 'draft', 'mcq', 'y')`, [ids['manual-draft']])
    expect((await db.query<{ last_editor: string }>(`select last_editor from question_versions where question_id = $1::bigint and version_no = 2`, [ids['manual-draft']]))[0]!.last_editor).toBe('person')
  })
})
