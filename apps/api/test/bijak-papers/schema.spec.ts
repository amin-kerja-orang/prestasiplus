import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runSeeds } from '../../prisma/seed'
import { identitySeed } from '../../prisma/seed/core/identity'
import { curriculumSeed } from '../../prisma/seed/curriculum'
import { examSeed } from '../../prisma/seed/exam'
import { createTestDatabase, type TestDatabase } from '../support/db'
import { count } from './helpers'

/** The raw SQL of migration 0012 against the generated client: identity keys, checks, keys, cascades. */
describe('exam schema (migration 0012_bijak_papers)', () => {
  let db: TestDatabase
  beforeAll(async () => {
    db = await createTestDatabase()
    await runSeeds([identitySeed, curriculumSeed, examSeed], { prisma: db.prisma })
  })
  afterAll(async () => {
    await db.drop()
  })

  const rejects = async (sql: string, params: unknown[] = []) => {
    await expect(db.query(sql, params)).rejects.toThrow()
  }
  const subjectId = async (code = 'MATH'): Promise<string> => (await db.query<{ id: string }>(`select id::text from subjects where code = $1`, [code]))[0]?.id as string
  const newPaper = async (extra = ''): Promise<string> =>
    (await db.query<{ id: string }>(
      `insert into papers (kind, title, subject_id, kertas, printed_duration_min${extra ? ', ' + extra.split('=')[0] : ''})
       values ('pilihan', 'Kertas ujian', $1, 1, 60${extra ? ', ' + extra.split('=')[1] : ''}) returning id::text`,
      [await subjectId()],
    ))[0]?.id as string

  it('the exam tables are not migratable: no legacy columns, not in migratable-models.json (data model 3.8: archived, not migrated)', async () => {
    const list = JSON.parse(readFileSync(fileURLToPath(new URL('../../prisma/migratable-models.json', import.meta.url)), 'utf8')) as string[]
    for (const t of ['blueprints', 'blueprint_sections', 'papers', 'paper_sections', 'paper_placements']) expect(list).not.toContain(t)
    expect([...list]).toEqual([...list].sort())
    const legacy = await db.query(
      `select 1 from information_schema.columns where table_schema = 'public' and column_name like 'legacy\\_%'
         and table_name in ('blueprints', 'blueprint_sections', 'papers', 'paper_sections', 'paper_placements')`,
    )
    expect(legacy).toHaveLength(0)
  })

  it('uses GENERATED ALWAYS identity keys on every exam table', async () => {
    const ident = await db.query<{ table_name: string; identity_generation: string }>(
      `select table_name, identity_generation from information_schema.columns
        where table_schema = 'public' and column_name = 'id' and is_identity = 'YES'
          and table_name in ('blueprints', 'blueprint_sections', 'papers', 'paper_sections', 'paper_placements') order by 1`,
    )
    expect(ident.map((r) => r.table_name)).toEqual(['blueprint_sections', 'blueprints', 'paper_placements', 'paper_sections', 'papers'])
    expect(new Set(ident.map((r) => r.identity_generation))).toEqual(new Set(['ALWAYS']))
    await rejects(`insert into papers (id, kind, title, subject_id, kertas, printed_duration_min) values (999, 'pilihan', 'x', ${await subjectId()}, 1, 60)`)
  })

  it('enums are text plus check with English codes (no Postgres enum types) (plan 14.9 item 3)', async () => {
    expect(await count(db, `select count(*) n from pg_type where typtype = 'e'`)).toBe(0)
    const sid = await subjectId()
    await rejects(`insert into blueprints (subject_id, kertas, code, status, duration_min) values (${sid}, 1, 'X1', 'live', 60)`)
    await rejects(`insert into blueprints (subject_id, kertas, code, source, duration_min) values (${sid}, 1, 'X2', 'Disahkan', 60)`)
    await rejects(`insert into blueprints (subject_id, kertas, code, provenance, duration_min) values (${sid}, 1, 'X3', 'guess', 60)`)
    await rejects(`insert into blueprints (subject_id, kertas, code, confidence, duration_min) values (${sid}, 1, 'X4', 'certain', 60)`)
    await rejects(`insert into blueprints (subject_id, kertas, code, duration_min) values (${sid}, 0, 'X5', 60)`)
    await rejects(`insert into blueprints (subject_id, kertas, code, duration_min) values (${sid}, 1, 'X6', 0)`)
    await rejects(`insert into papers (kind, title, subject_id, kertas, printed_duration_min) values ('other', 'x', ${sid}, 1, 60)`)
    await rejects(`insert into papers (kind, title, subject_id, kertas, printed_duration_min, status) values ('pilihan', 'x', ${sid}, 1, 60, 'terbit')`)
    await rejects(`insert into papers (kind, title, subject_id, kertas, printed_duration_min, level_scope) values ('pilihan', 'x', ${sid}, 1, 60, 'T4')`)
    await rejects(`insert into papers (kind, title, subject_id, kertas, printed_duration_min) values ('pilihan', 'x', ${sid}, 1, 0)`)
    for (const status of ['draft', 'ready', 'published', 'withdrawn']) {
      await db.query(`insert into papers (kind, title, subject_id, kertas, printed_duration_min, status) values ('pilihan', 'ok', $1, 1, 60, $2)`, [sid, status])
    }
    await db.query(`delete from papers where title = 'ok'`)
  })

  it('a paper is jana if and only if it has an owner (AC 5)', async () => {
    const sid = await subjectId()
    const user = (await db.query<{ id: string }>(`select id::text from users where email = 'pelajar@demo.test'`))[0]?.id as string
    await rejects(`insert into papers (kind, title, subject_id, kertas, printed_duration_min) values ('jana', 'x', ${sid}, 1, 60)`)
    await rejects(`insert into papers (kind, title, subject_id, kertas, printed_duration_min, generated_for_user_id) values ('pilihan', 'x', ${sid}, 1, 60, ${user})`)
    await db.query(`insert into papers (kind, title, subject_id, kertas, printed_duration_min, generated_for_user_id) values ('jana', 'owned', ${sid}, 1, 60, ${user})`)
  })

  it('the rule needs n exactly when it is "choose"', async () => {
    const paper = await newPaper()
    let position = 0
    const ins = (rule: string, n: string) =>
      `insert into paper_sections (paper_id, position, label, rule_type, rule_n, question_count, mark_budget) values (${paper}, ${(position += 1)}, 'S', '${rule}', ${n}, 1, 1)`
    await rejects(ins('choose', 'null'))
    await rejects(ins('choose', '0'))
    await rejects(ins('all', '1'))
    await rejects(ins('some', 'null'))
    await db.query(ins('choose', '1'))
    await db.query(ins('all', 'null'))
    const bp = (await db.query<{ id: string }>(`select id::text from blueprints limit 1`))[0]?.id as string
    await rejects(`insert into blueprint_sections (blueprint_id, position, label, rule_type, rule_n, question_count) values (${bp}, 90, 'S', 'choose', null, 1)`)
    await rejects(`insert into blueprint_sections (blueprint_id, position, label, question_count) values (${bp}, 91, 'S', 0)`)
  })

  it('(code, version) is unique, and only one version per subject and kertas is active', async () => {
    const sid = await subjectId()
    await rejects(`insert into blueprints (subject_id, kertas, code, version, duration_min) values (${sid}, 1, '1449/1', 1, 60)`)
    // A new version of the same code is a new row; only one may be active.
    await db.query(`insert into blueprints (subject_id, kertas, code, version, status, duration_min) values (${sid}, 1, '1449/1', 2, 'draft', 60)`)
    await rejects(`update blueprints set status = 'active' where code = '1449/1' and version = 2`)
    await db.query(`update blueprints set status = 'retired' where code = '1449/1' and version = 1`)
    await db.query(`update blueprints set status = 'active' where code = '1449/1' and version = 2`)
    await db.query(`update blueprints set status = 'retired' where code = '1449/1' and version = 2`)
    await db.query(`update blueprints set status = 'active' where code = '1449/1' and version = 1`)
  })

  it('positions are unique inside a paper, a section and a blueprint; a question is placed once per section', async () => {
    const paper = await newPaper()
    await db.query(`insert into paper_sections (paper_id, position, label, question_count, mark_budget) values (${paper}, 1, 'A', 1, 1)`)
    await rejects(`insert into paper_sections (paper_id, position, label, question_count, mark_budget) values (${paper}, 1, 'B', 1, 1)`)
    const section = (await db.query<{ id: string }>(`select id::text from paper_sections where paper_id = ${paper}`))[0]?.id as string
    await db.query(`insert into paper_placements (paper_section_id, question_id, position) values (${section}, 1, 1)`)
    await rejects(`insert into paper_placements (paper_section_id, question_id, position) values (${section}, 2, 1)`)
    await rejects(`insert into paper_placements (paper_section_id, question_id, position) values (${section}, 1, 2)`)
    await rejects(`insert into paper_placements (paper_section_id, question_id, position, pinned_version_no) values (${section}, 3, 2, 0)`)
    await rejects(`insert into paper_placements (paper_section_id, question_id, position, marks_override) values (${section}, 3, 2, -1)`)
    await db.query(`insert into paper_placements (paper_section_id, question_id, position, marks_override) values (${section}, 3, 2, 4)`)
  })

  it('deleting a paper cascades to its sections and placements; deleting the owner removes generated papers', async () => {
    const paper = await newPaper()
    await db.query(`insert into paper_sections (paper_id, position, label, question_count, mark_budget) values (${paper}, 1, 'A', 1, 1)`)
    const section = (await db.query<{ id: string }>(`select id::text from paper_sections where paper_id = ${paper}`))[0]?.id as string
    await db.query(`insert into paper_placements (paper_section_id, question_id, position) values (${section}, 10, 1)`)
    await db.query(`delete from papers where id = ${paper}`)
    expect(await count(db, `select count(*) n from paper_sections where paper_id = ${paper}`)).toBe(0)
    expect(await count(db, `select count(*) n from paper_placements where paper_section_id = ${section}`)).toBe(0)

    const u = (await db.query<{ id: string }>(`insert into users (name) values ('Pelajar sementara') returning id::text`))[0]?.id as string
    await db.query(`insert into papers (kind, title, subject_id, kertas, printed_duration_min, generated_for_user_id) values ('jana', 'privat', ${await subjectId()}, 1, 60, ${u})`)
    await db.query(`delete from users where id = ${u}`)
    expect(await count(db, `select count(*) n from papers where title = 'privat'`)).toBe(0)
    // created_by is only a pointer: deleting the creator keeps the curated paper.
    const c = (await db.query<{ id: string }>(`insert into users (name) values ('Pencipta sementara') returning id::text`))[0]?.id as string
    const kept = await newPaper(`created_by_id=${c}`)
    await db.query(`delete from users where id = ${c}`)
    expect((await db.query<{ created_by_id: string | null }>(`select created_by_id::text from papers where id = ${kept}`))[0]?.created_by_id).toBeNull()
  })

  it('a subject with papers or blueprints cannot be deleted; a blueprint with papers cannot be deleted', async () => {
    await rejects(`delete from subjects where code = 'MATH'`)
    await rejects(`delete from blueprints where code = '1449/1'`)
  })

  it('total marks are not stored on the paper (derived from the placements, Q-S6)', async () => {
    const cols = await db.query<{ column_name: string }>(`select column_name from information_schema.columns where table_name = 'papers'`)
    expect(cols.map((c) => c.column_name)).not.toContain('total_marks')
    expect(cols.map((c) => c.column_name)).toEqual(expect.arrayContaining(['status', 'version', 'printed_duration_min', 'generated_for_user_id']))
    const bp = await db.query<{ column_name: string }>(`select column_name from information_schema.columns where table_name = 'blueprints'`)
    expect(bp.map((c) => c.column_name)).toEqual(expect.arrayContaining(['version', 'status', 'source', 'provenance', 'confidence']))
  })
})
