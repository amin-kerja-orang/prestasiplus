import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runSeeds } from '../../prisma/seed'
import { curriculumSeed } from '../../prisma/seed/curriculum'
import { createTestDatabase, type TestDatabase } from '../support/db'
import { count, dropDatabase } from '../curriculum/helpers'

const TABLES = [
  'answer_keys', 'part_options', 'question_parts', 'question_tags', 'question_version_sp_nodes',
  'question_version_stimuli', 'question_versions', 'questions', 'stimuli', 'stimulus_group_options',
  'stimulus_group_stimuli', 'stimulus_groups',
]

/** The raw SQL of migration 0011 against the generated client: checks, keys and cascades (AC 12 SQL half). */
describe('question bank schema (migration 0011_question_bank)', () => {
  let db: TestDatabase
  beforeAll(async () => {
    db = await createTestDatabase()
    await runSeeds([curriculumSeed], { prisma: db.prisma })
  })
  afterAll(async () => {
    await dropDatabase(db)
  })

  const rejects = async (sql: string, params: unknown[] = []) => {
    await expect(db.query(sql, params)).rejects.toThrow()
  }
  const one = async (sql: string, params: unknown[] = []): Promise<string> => {
    const row = (await db.query<{ id: string }>(sql, params))[0]
    if (!row) throw new Error('no row returned')
    return row.id
  }
  const newQuestion = () => one(`insert into questions (source_type) values ('manual') returning id::text`)
  const newVersion = (questionId: string, versionNo = 1, status = 'draft') =>
    one(`insert into question_versions (question_id, version_no, status, type, stem_ms) values ($1, $2, $3, 'mcq', 'Soalan ujian') returning id::text`, [questionId, versionNo, status])
  const newPart = (versionId: string, position: number, parentId: string | null, depth: number, leaf = true) =>
    one(
      `insert into question_parts (question_version_id, parent_part_id, position, depth, label, prompt_ms, marks, mode)
       values ($1, $2, $3, $4, 'a', 'Teks', ${leaf ? '1' : 'null'}, ${leaf ? `'mcq'` : 'null'}) returning id::text`,
      [versionId, parentId, position, depth],
    )
  const newStimulus = () => one(`insert into stimuli (kind, label) values ('passage', 'S') returning id::text`)

  it('creates the 12 tables with GENERATED ALWAYS identity keys', async () => {
    const ident = await db.query<{ table_name: string; identity_generation: string }>(
      `select table_name, identity_generation from information_schema.columns
        where table_schema = 'public' and column_name = 'id' and is_identity = 'YES' and table_name = any($1) order by 1`,
      [TABLES],
    )
    expect(ident.map((r) => r.table_name)).toEqual(TABLES)
    expect(new Set(ident.map((r) => r.identity_generation))).toEqual(new Set(['ALWAYS']))
    await rejects(`insert into stimuli (id, kind) values (999, 'passage')`)
  })

  it('enums are text plus check (no Postgres enum types); only questions has legacy columns (QLOAD, 0043)', async () => {
    expect(await count(db, `select count(*) n from pg_type where typtype = 'e'`)).toBe(0)
    const legacy = await db.query<{ table_name: string; column_name: string }>(
      `select table_name, column_name from information_schema.columns where table_schema = 'public' and table_name = any($1) and column_name like 'legacy_%' order by 1, 2`,
      [TABLES],
    )
    expect(legacy.map((r) => `${r.table_name}.${r.column_name}`)).toEqual(['questions.legacy_id', 'questions.legacy_source'])
    await rejects(`insert into stimuli (kind) values ('video')`)
    await rejects(`insert into stimulus_groups (scope) values ('exam')`)
    const q = await newQuestion()
    await rejects(`insert into questions (source_type) values ('scan')`)
    await rejects(`insert into question_versions (question_id, version_no, status, type, stem_ms) values ($1, 2, 'pending_review', 'mcq', 'x')`, [q])
    await rejects(`insert into question_versions (question_id, version_no, type, stem_ms) values ($1, 2, 'cloze', 'x')`, [q])
    await rejects(`insert into question_versions (question_id, version_no, type, stem_ms, language) values ($1, 2, 'mcq', 'x', 'fr')`, [q])
    await rejects(`insert into question_versions (question_id, version_no, type, stem_ms, difficulty_tp) values ($1, 2, 'mcq', 'x', 7)`, [q])
    await rejects(`insert into question_versions (question_id, version_no, type, stem_ms, form_origin) values ($1, 2, 'mcq', 'x', 't9')`, [q])
    await rejects(`insert into question_tags (question_id, kind, code) values ($1, 'other', 'x')`, [q])
  })

  it('a version needs a stem in at least one language, and archive_reason only on archived', async () => {
    const q = await newQuestion()
    await rejects(`insert into question_versions (question_id, version_no, type) values ($1, 1, 'mcq')`, [q])
    await db.query(`insert into question_versions (question_id, version_no, type, stem_en) values ($1, 1, 'mcq', 'English only')`, [q])
    await rejects(`insert into question_versions (question_id, version_no, type, stem_ms, archive_reason, status) values ($1, 2, 'mcq', 'x', 'superseded', 'draft')`, [q])
    await db.query(`insert into question_versions (question_id, version_no, type, stem_ms, archive_reason, status) values ($1, 2, 'mcq', 'x', 'superseded', 'archived')`, [q])
    await rejects(`insert into question_versions (question_id, version_no, type, stem_ms, archive_reason, status) values ($1, 3, 'mcq', 'x', 'lost', 'archived')`, [q])
  })

  it('(question, version_no) is unique and at most one version is published', async () => {
    const q = await newQuestion()
    await newVersion(q, 1, 'published')
    await rejects(`insert into question_versions (question_id, version_no, type, stem_ms) values ($1, 1, 'mcq', 'x')`, [q])
    await rejects(`insert into question_versions (question_id, version_no, status, type, stem_ms) values ($1, 2, 'published', 'mcq', 'x')`, [q])
    await newVersion(q, 2, 'draft')
    await newVersion(q, 3, 'archived')
  })

  it('curriculum tags are foreign keys to the curriculum tables, restricted on delete', async () => {
    const q = await newQuestion()
    await rejects(`insert into question_versions (question_id, version_no, type, stem_ms, subject_id) values ($1, 1, 'mcq', 'x', 999999)`, [q])
    await rejects(`insert into question_versions (question_id, version_no, type, stem_ms, education_level_id) values ($1, 1, 'mcq', 'x', 999999)`, [q])
    await rejects(`insert into question_versions (question_id, version_no, type, stem_ms, unit_node_id) values ($1, 1, 'mcq', 'x', 999999)`, [q])
    await rejects(`insert into questions (created_by_id) values (999999)`)
    const subject = await one(`select id::text from subjects where code = 'MATH'`)
    await db.query(`insert into question_versions (question_id, version_no, type, stem_ms, subject_id) values ($1, 1, 'mcq', 'x', $2)`, [q, subject])
    await rejects(`delete from subjects where id = $1`, [subject])
  })

  it('parts: leaf has marks and mode, branch has neither; depth 1 to 3; sibling position is unique', async () => {
    const v = await newVersion(await newQuestion())
    await rejects(`insert into question_parts (question_version_id, position, depth, label, prompt_ms, marks) values ($1, 1, 1, 'a', 'x', 2)`, [v])
    await rejects(`insert into question_parts (question_version_id, position, depth, label, prompt_ms, mode) values ($1, 1, 1, 'a', 'x', 'mcq')`, [v])
    await rejects(`insert into question_parts (question_version_id, position, depth, label, prompt_ms, marks, mode) values ($1, 1, 1, 'a', 'x', -1, 'mcq')`, [v])
    await rejects(`insert into question_parts (question_version_id, position, depth, label, prompt_ms, marks, mode) values ($1, 1, 1, 'a', 'x', 1, 'poem')`, [v])
    await rejects(`insert into question_parts (question_version_id, position, depth, label, prompt_ms) values ($1, 1, 4, 'a', 'x')`, [v])
    const root = await newPart(v, 1, null, 1, false)
    await rejects(`insert into question_parts (question_version_id, position, depth, label, prompt_ms) values ($1, 1, 1, 'b', 'x')`, [v]) // root position 1 taken
    const child = await newPart(v, 1, root, 2, false)
    await newPart(v, 2, root, 2)
    await rejects(`insert into question_parts (question_version_id, parent_part_id, position, depth, label, prompt_ms) values ($1, $2, 2, 2, 'c', 'x')`, [v, root])
    await newPart(v, 1, child, 3) // same position under another parent is fine
    // A child must have a parent and depth above 1; a root must have depth 1.
    await rejects(`insert into question_parts (question_version_id, parent_part_id, position, depth, label, prompt_ms) values ($1, $2, 9, 1, 'x', 'x')`, [v, root])
    await rejects(`insert into question_parts (question_version_id, position, depth, label, prompt_ms) values ($1, 9, 2, 'x', 'x')`, [v])
  })

  it('part options: label A to H, unique per part, and one answer key per part', async () => {
    const v = await newVersion(await newQuestion())
    const part = await newPart(v, 1, null, 1)
    await db.query(`insert into part_options (part_id, label, body_ms, position) values ($1, 'A', 'x', 1)`, [part])
    await rejects(`insert into part_options (part_id, label, body_ms, position) values ($1, 'A', 'x', 2)`, [part])
    await rejects(`insert into part_options (part_id, label, body_ms, position) values ($1, 'B', 'x', 1)`, [part])
    await rejects(`insert into part_options (part_id, label, body_ms, position) values ($1, 'I', 'x', 3)`, [part])
    await rejects(`insert into part_options (part_id, label, body_ms, position) values ($1, 'a', 'x', 3)`, [part])
    await db.query(`insert into answer_keys (part_id, kind, content) values ($1, 'option', '{"kind":"option","correct":"A"}')`, [part])
    await rejects(`insert into answer_keys (part_id, kind, content) values ($1, 'option', '{}')`, [part])
    await rejects(`insert into answer_keys (part_id, kind) values ($1, 'accepted')`, [part])
    const part2 = await newPart(v, 2, null, 1)
    await rejects(`insert into answer_keys (part_id, kind, content) values ($1, 'cloze', '{}')`, [part2])
  })

  it('AC12: a group holds at most 3 stimuli, ordered, and a lettered option bank', async () => {
    const g = await one(`insert into stimulus_groups (label) values ('Kumpulan') returning id::text`)
    const s = [await newStimulus(), await newStimulus(), await newStimulus(), await newStimulus()]
    for (const [i, id] of s.slice(0, 3).entries()) {
      await db.query(`insert into stimulus_group_stimuli (group_id, stimulus_id, position) values ($1, $2, $3)`, [g, id, i + 1])
    }
    await rejects(`insert into stimulus_group_stimuli (group_id, stimulus_id, position) values ($1, $2, 4)`, [g, s[3]])
    await rejects(`insert into stimulus_group_stimuli (group_id, stimulus_id, position) values ($1, $2, 3)`, [g, s[3]])
    await rejects(`insert into stimulus_group_stimuli (group_id, stimulus_id, position) values ($1, $2, 1)`, [g, s[0]])
    for (const [i, label] of ['A', 'B', 'C', 'D'].entries()) {
      await db.query(`insert into stimulus_group_options (group_id, label, body_ms, position) values ($1, $2, 'x', $3)`, [g, label, i + 1])
    }
    await rejects(`insert into stimulus_group_options (group_id, label, position) values ($1, 'A', 9)`, [g])
    await rejects(`insert into stimulus_group_options (group_id, label, position) values ($1, 'Z', 9)`, [g])
    const ordered = await db.query<{ label: string }>(`select label from stimulus_group_options where group_id = $1 order by position`, [g])
    expect(ordered.map((r) => r.label)).toEqual(['A', 'B', 'C', 'D'])
    // A stimulus in use cannot be deleted; deleting the group cascades to both child tables.
    await rejects(`delete from stimuli where id = $1`, [s[0]])
    await db.query(`delete from stimulus_groups where id = $1`, [g])
    expect(await count(db, `select count(*) n from stimulus_group_stimuli where group_id = $1`, [g])).toBe(0)
    expect(await count(db, `select count(*) n from stimulus_group_options where group_id = $1`, [g])).toBe(0)
    expect(await count(db, `select count(*) n from stimuli where id = $1`, [s[0]])).toBe(1)
  })

  it('questions keep a group position together: both or neither, one question per slot', async () => {
    const g = await one(`insert into stimulus_groups default values returning id::text`)
    await rejects(`insert into questions (group_id) values ($1)`, [g])
    await rejects(`insert into questions (group_position) values (1)`)
    await db.query(`insert into questions (group_id, group_position) values ($1, 1)`, [g])
    await rejects(`insert into questions (group_id, group_position) values ($1, 1)`, [g])
    await db.query(`insert into questions (group_id, group_position) values ($1, 2)`, [g])
    // SET NULL on group_id would break the both-or-neither check, so a group with members cannot be deleted.
    await rejects(`delete from stimulus_groups where id = $1`, [g])
  })

  it('AC12: a version with 1 to 3 SP nodes and an ordered stimulus list reads back; deleting cascades', async () => {
    const q = await newQuestion()
    const v = await newVersion(q)
    const nodes = await db.query<{ id: string }>(`select id::text from curriculum_nodes where kind = 'sp' order by id limit 3`)
    expect(nodes).toHaveLength(3)
    for (const n of nodes) await db.query(`insert into question_version_sp_nodes (question_version_id, node_id) values ($1, $2)`, [v, n.id])
    await rejects(`insert into question_version_sp_nodes (question_version_id, node_id) values ($1, $2)`, [v, nodes[0]?.id])
    await rejects(`insert into question_version_sp_nodes (question_version_id, node_id) values ($1, 999999)`, [v])
    const s1 = await newStimulus()
    const s2 = await newStimulus()
    await db.query(`insert into question_version_stimuli (question_version_id, stimulus_id, position) values ($1, $2, 2), ($1, $3, 1)`, [v, s1, s2])
    await rejects(`insert into question_version_stimuli (question_version_id, stimulus_id, position) values ($1, $2, 3)`, [v, s1])
    await rejects(`insert into question_version_stimuli (question_version_id, stimulus_id, position) values ($1, $2, 2)`, [v, await newStimulus()])
    const order = await db.query<{ stimulus_id: string }>(`select stimulus_id::text from question_version_stimuli where question_version_id = $1 order by position`, [v])
    expect(order.map((r) => r.stimulus_id)).toEqual([s2, s1])

    const part = await newPart(v, 1, null, 1)
    await db.query(`insert into part_options (part_id, label, position) values ($1, 'A', 1)`, [part])
    await db.query(`insert into answer_keys (part_id, kind, content) values ($1, 'option', '{"kind":"option","correct":"A"}')`, [part])
    await db.query(`insert into question_tags (question_id, kind, code) values ($1, 'pool', 'spm')`, [q])
    await rejects(`insert into question_tags (question_id, kind, code) values ($1, 'pool', 'spm')`, [q])

    await db.query(`delete from questions where id = $1`, [q])
    for (const [table, col, id] of [
      ['question_versions', 'question_id', q], ['question_version_sp_nodes', 'question_version_id', v],
      ['question_version_stimuli', 'question_version_id', v], ['question_parts', 'question_version_id', v],
      ['part_options', 'part_id', part], ['answer_keys', 'part_id', part], ['question_tags', 'question_id', q],
    ] as const) {
      expect(await count(db, `select count(*) n from ${table} where ${col} = $1`, [id]), table).toBe(0)
    }
    expect(await count(db, `select count(*) n from stimuli where id = any($1)`, [[s1, s2]])).toBe(2)
  })

  it('family_id is a deferrable self reference', async () => {
    const row = (
      await db.query<{ condeferrable: boolean; condeferred: boolean }>(
        `select condeferrable, condeferred from pg_constraint where conname = 'fk_questions_family_id'`,
      )
    )[0]
    expect(row).toEqual({ condeferrable: true, condeferred: true })
    await rejects(`insert into questions (family_id, family_relation) values (999999, 'variant')`)
    await rejects(`insert into questions (family_relation) values ('twin')`)
  })

  it('the migration file creates no pg enum type and no legacy columns', () => {
    const sql = readFileSync(fileURLToPath(new URL('../../prisma/migrations/0011_question_bank/migration.sql', import.meta.url)), 'utf8')
    expect(sql).not.toMatch(/CREATE TYPE/i)
    expect(sql).not.toMatch(/"legacy_(source|id)"/)
  })
})
