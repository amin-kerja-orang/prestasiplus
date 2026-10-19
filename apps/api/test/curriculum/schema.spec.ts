import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runSeeds } from '../../prisma/seed'
import { curriculumSeed } from '../../prisma/seed/curriculum'
import { createTestDatabase, type TestDatabase } from '../support/db'
import { count, dropDatabase } from './helpers'

/** The raw SQL of migration 0003 against the generated client: checks, keys and cascades. */
describe('curriculum schema (migration 0005_curriculum)', () => {
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

  it('lists the migratable models of this card (plan 14.9 item 1)', () => {
    const list = JSON.parse(readFileSync(fileURLToPath(new URL('../../prisma/migratable-models.json', import.meta.url)), 'utf8')) as string[]
    for (const t of ['chapters', 'education_levels', 'subject_levels', 'subjects', 'topics']) expect(list).toContain(t)
    expect([...list]).toEqual([...list].sort())
  })

  it('enums are text plus check, with English codes (no Postgres enum types)', async () => {
    expect(await count(db, `select count(*) n from pg_type where typtype = 'e'`)).toBe(0)
    await rejects(`insert into education_levels (code, name, name_en, stage, curriculum) values ('X1', 'x', 'x', 'nope', 'KSSM')`)
    await rejects(`insert into education_levels (code, name, name_en, stage, curriculum, grade) values ('X2', 'x', 'x', 'primary', 'KSSR', 12)`)
    await rejects(`insert into curriculum_nodes (subject_id, education_level_id, kind, code, title, edition)
      select s.id, l.id, 'chapter', 'x', 'x', 'e' from subjects s, education_levels l limit 1`)
    await rejects(`insert into legacy_topics (grade_level, subject, name, sequence) values ('DARJAH_9', 'SAINS', 'x', 1)`)
    await rejects(`insert into legacy_topics (grade_level, subject, name, sequence) values ('DARJAH_1', 'SENI', 'x', 1)`)
  })

  it('uses GENERATED ALWAYS identity keys on every curriculum table', async () => {
    await rejects(`insert into subjects (id, code, name, name_en, color) values (999, 'IDENT', 'x', 'x', '#000000')`)
    const ident = await db.query<{ table_name: string; identity_generation: string }>(
      `select table_name, identity_generation from information_schema.columns
        where table_schema = 'public' and column_name = 'id' and is_identity = 'YES'
          and table_name in ('education_levels', 'subjects', 'subject_levels', 'chapters', 'topics', 'subtopics',
                             'curriculum_nodes', 'curriculum_tp_descriptors', 'legacy_topics', 'legacy_subtopics')
        order by 1`,
    )
    expect(ident.map((r) => r.table_name)).toEqual([
      'chapters', 'curriculum_nodes', 'curriculum_tp_descriptors', 'education_levels', 'legacy_subtopics',
      'legacy_topics', 'subject_levels', 'subjects', 'subtopics', 'topics',
    ])
    expect(new Set(ident.map((r) => r.identity_generation))).toEqual(new Set(['ALWAYS']))
  })

  it('codes are stored upper-case and unique', async () => {
    await rejects(`insert into subjects (code, name, name_en, color) values ('lower', 'x', 'x', '#000000')`)
    await rejects(`insert into subjects (code, name, name_en, color) values ('MATH', 'x', 'x', '#000000')`)
    await rejects(`insert into education_levels (code, name, name_en, stage, curriculum) values ('d1', 'x', 'x', 'primary', 'KSSR')`)
    await rejects(`insert into education_levels (code, name, name_en, stage, curriculum) values ('D1', 'x', 'x', 'primary', 'KSSR')`)
  })

  it('only out-of-tree chapters may lack a level or a name', async () => {
    await rejects(`insert into chapters (subject_id, name) select id, 'x' from subjects limit 1`)
    await rejects(`insert into chapters (subject_id, education_level_id) select s.id, l.id from subjects s, education_levels l limit 1`)
    await db.query(`insert into chapters (subject_id, in_tree) select id, false from subjects limit 1`)
    await db.query(`delete from chapters where not in_tree and id = (select max(id) from chapters)`)
  })

  it('legacy_source is cloud or my, and (legacy_source, legacy_id) is unique per migratable table', async () => {
    await rejects(`insert into subjects (code, name, name_en, color, legacy_source, legacy_id) values ('LEG1', 'x', 'x', '#000000', 'other', '1')`)
    await db.query(`insert into subjects (code, name, name_en, color, legacy_source, legacy_id) values ('LEG2', 'x', 'x', '#000000', 'cloud', '77')`)
    await rejects(`insert into subjects (code, name, name_en, color, legacy_source, legacy_id) values ('LEG3', 'x', 'x', '#000000', 'cloud', '77')`)
    // Two rows without a legacy key do not clash.
    await db.query(`insert into subjects (code, name, name_en, color) values ('NOLEG1', 'x', 'x', '#000000'), ('NOLEG2', 'x', 'x', '#000000')`)
  })

  it('AC10: a descriptor needs a subject, tp is 1 to 6, and one row per subject, node and tp', async () => {
    await rejects(`insert into curriculum_tp_descriptors (subject_id, node_id, tp, descriptor, scope) values (999999999, null, 1, 'x', null)`)
    await rejects(`insert into curriculum_tp_descriptors (subject_id, tp, descriptor) select id, 0, 'x' from subjects where code = 'PN'`)
    await rejects(`insert into curriculum_tp_descriptors (subject_id, tp, descriptor) select id, 7, 'x' from subjects where code = 'PN'`)
    await rejects(`insert into curriculum_tp_descriptors (subject_id, tp, descriptor, scope) select id, 1, 'x', 'subject' from subjects where code = 'PN'`)
    // A general level (no node) must not carry a scope, a node level must.
    await rejects(`insert into curriculum_tp_descriptors (subject_id, tp, descriptor, scope) select id, 1, 'x', 'unit' from subjects where code = 'PN'`)
    await db.query(`insert into curriculum_tp_descriptors (subject_id, tp, descriptor) select id, 1, 'x' from subjects where code = 'PN'`)
    await rejects(`insert into curriculum_tp_descriptors (subject_id, tp, descriptor) select id, 1, 'y' from subjects where code = 'PN'`)
  })

  it('AC4 (database): deleting a subject removes its links, chapters, topics, subtopics, nodes and descriptors', async () => {
    const subject = (await db.query<{ id: string }>(`select id::text from subjects where code = 'MATH'`))[0]!.id
    const before = {
      links: await count(db, 'select count(*) n from subject_levels where subject_id = $1', [subject]),
      chapters: await count(db, 'select count(*) n from chapters where subject_id = $1', [subject]),
      topics: await count(db, 'select count(*) n from topics t join chapters c on c.id = t.chapter_id where c.subject_id = $1', [subject]),
      subtopics: await count(db, 'select count(*) n from subtopics s join topics t on t.id = s.topic_id join chapters c on c.id = t.chapter_id where c.subject_id = $1', [subject]),
      nodes: await count(db, 'select count(*) n from curriculum_nodes where subject_id = $1', [subject]),
      tps: await count(db, 'select count(*) n from curriculum_tp_descriptors where subject_id = $1', [subject]),
    }
    expect(before.chapters).toBeGreaterThan(0)
    expect(before.nodes).toBeGreaterThan(0)
    expect(before.tps).toBeGreaterThan(0)
    const totals = {
      chapters: await count(db, 'select count(*) n from chapters'),
      topics: await count(db, 'select count(*) n from topics'),
      subtopics: await count(db, 'select count(*) n from subtopics'),
    }
    await db.query('delete from subjects where id = $1', [subject])
    for (const t of ['subject_levels', 'chapters', 'curriculum_nodes', 'curriculum_tp_descriptors']) {
      expect(await count(db, `select count(*) n from ${t} where subject_id = $1`, [subject]), t).toBe(0)
    }
    expect(await count(db, 'select count(*) n from chapters')).toBe(totals.chapters - before.chapters)
    expect(await count(db, 'select count(*) n from topics')).toBe(totals.topics - before.topics)
    expect(await count(db, 'select count(*) n from subtopics')).toBe(totals.subtopics - before.subtopics)
    expect(await count(db, 'select count(*) n from topics t where not exists (select 1 from chapters c where c.id = t.chapter_id)')).toBe(0)
  })
})
