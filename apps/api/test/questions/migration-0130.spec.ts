import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runSeeds } from '../../prisma/seed'
import { identitySeed } from '../../prisma/seed/core/identity'
import { curriculumSeed } from '../../prisma/seed/curriculum'
import { createTestDatabase, type TestDatabase } from '../support/db'

/**
 * S1-T01 part 3, DM-51 + DM-52, migration 0130: the scope columns and the draft copy of `stimulus_groups`, the option-bank fields, and the
 * backfill (the common value of the members, else NULL). The test database already ran the migration, so this spec reads the catalogue,
 * proves the constraints on real rows, and re-runs the backfill statement of the migration file over fixture groups.
 * AC: FR-QA-51 (the group row holds its scope), FR-QA-04 (one open draft per group), D115 (a mixed T4/T5 group gets a NULL level).
 */
const SQL = readFileSync(join(__dirname, '../../prisma/migrations/0130_s1_group_draft_copy/migration.sql'), 'utf8')
const BACKFILL_AT = SQL.indexOf('UPDATE "stimulus_groups" g')
const BACKFILL = SQL.slice(BACKFILL_AT, SQL.indexOf('ALTER TABLE "stimulus_group_options"', BACKFILL_AT)).trim()

describe('migration 0130 group scope, draft copy and option fields', () => {
  let db: TestDatabase
  let math: string
  let sci: string
  let t4: string
  let t5: string

  const idOf = async (table: string, code: string): Promise<string> => (await db.query<{ id: string }>(`select id::text from ${table} where code = $1`, [code]))[0]!.id
  const group = async (): Promise<string> => (await db.query<{ id: string }>(`insert into stimulus_groups (label) values ('Kumpulan ujian') returning id::text`))[0]!.id
  /** A grouped question whose latest version has the given subject, level and paper code. */
  const member = async (groupId: string, pos: number, subject: string | null, level: string | null, paperCode: string | null): Promise<void> => {
    const q = (await db.query<{ id: string }>(`insert into questions (source_type, latest_version_no, group_id, group_position) values ('manual', 1, $1::bigint, $2) returning id::text`, [groupId, pos]))[0]!.id
    await db.query(`insert into question_versions (question_id, version_no, status, type, stem_ms, subject_id, education_level_id, paper_code) values ($1::bigint, 1, 'draft', 'mcq', 'Soalan', $2::bigint, $3::bigint, $4)`, [q, subject, level, paperCode])
  }
  const scope = async (groupId: string) =>
    (await db.query<{ subject_id: string | null; education_level_id: string | null; kertas: number | null }>(`select subject_id::text, education_level_id::text, kertas from stimulus_groups where id = $1::bigint`, [groupId]))[0]!

  beforeAll(async () => {
    db = await createTestDatabase()
    await runSeeds([identitySeed, curriculumSeed], { prisma: db.prisma })
    ;[math, sci, t4, t5] = [await idOf('subjects', 'MATH'), await idOf('subjects', 'SCI'), await idOf('education_levels', 'T4'), await idOf('education_levels', 'T5')]
  })
  afterAll(async () => {
    await db.drop()
  })

  it('stimulus_groups has the seven DM-51 columns and stimulus_group_options the three DM-52 columns (no source_citation is added)', async () => {
    const cols = async (table: string) =>
      (await db.query<{ column_name: string; data_type: string; is_nullable: string; column_default: string | null }>(
        `select column_name, data_type, is_nullable, column_default from information_schema.columns where table_name = $1`,
        [table],
      )).reduce<Record<string, { type: string; nullable: boolean; def: string | null }>>((o, r) => ({ ...o, [r.column_name]: { type: r.data_type, nullable: r.is_nullable === 'YES', def: r.column_default } }), {})
    const g = await cols('stimulus_groups')
    expect(g.subject_id).toMatchObject({ type: 'bigint', nullable: true })
    expect(g.education_level_id).toMatchObject({ type: 'bigint', nullable: true })
    expect(g.kertas).toMatchObject({ type: 'smallint', nullable: true })
    expect(g.draft_of_group_id).toMatchObject({ type: 'bigint', nullable: true })
    expect(g.draft_members).toMatchObject({ type: 'jsonb', nullable: true })
    expect(g.draft_created_by).toMatchObject({ type: 'bigint', nullable: true })
    expect(g.draft_created_at).toMatchObject({ type: 'timestamp with time zone', nullable: true })
    const o = await cols('stimulus_group_options')
    expect(o.body).toMatchObject({ type: 'text', nullable: true })
    expect(o.image_file_id).toMatchObject({ type: 'bigint', nullable: true })
    expect(o.is_distractor).toMatchObject({ type: 'boolean', nullable: false, def: 'false' })
    expect(o.source_citation).toBeUndefined()
  })

  it('the constraints exist with short names; the kertas check is 1..4', async () => {
    const names = (await db.query<{ conname: string }>(`select conname from pg_constraint where conrelid in ('stimulus_groups'::regclass, 'stimulus_group_options'::regclass)`)).map((r) => r.conname)
    for (const n of ['fk_stimulus_groups_subject_id', 'fk_stimulus_groups_level_id', 'fk_stimulus_groups_draft_of', 'fk_stimulus_groups_draft_created_by', 'ck_stimulus_groups_kertas', 'ck_stimulus_group_options_label', 'fk_stimulus_group_options_image_file_id']) {
      expect(names, n).toContain(n)
      expect(n.length).toBeLessThan(63)
    }
    const invalid = await db.query(`select conname from pg_constraint where conrelid in ('stimulus_groups'::regclass, 'stimulus_group_options'::regclass) and not convalidated`)
    expect(invalid).toEqual([]) // every constraint was added NOT VALID and then VALIDATEd
    const g = await group()
    for (const ok of [1, 4]) await db.query(`update stimulus_groups set kertas = $2 where id = $1::bigint`, [g, ok])
    for (const bad of [0, 5]) await expect(db.query(`update stimulus_groups set kertas = $2 where id = $1::bigint`, [g, bad])).rejects.toMatchObject({ code: '23514' })
    await expect(db.query(`update stimulus_groups set subject_id = 999999999 where id = $1::bigint`, [g])).rejects.toMatchObject({ code: '23503' })
  })

  it('one open draft copy per group: the partial unique index refuses a second copy; deleting the live group sets draft_of_group_id to NULL', async () => {
    const live = await group()
    const d1 = (await db.query<{ id: string }>(`insert into stimulus_groups (label, draft_of_group_id, draft_members) values ('Salinan', $1::bigint, '[1,2]'::jsonb) returning id::text`, [live]))[0]!.id
    await expect(db.query(`insert into stimulus_groups (label, draft_of_group_id) values ('Salinan 2', $1::bigint)`, [live])).rejects.toMatchObject({ code: '23505' })
    // groups that are not copies are not constrained (NULL is not unique)
    await group()
    await group()
    await expect(db.query(`update stimulus_groups set draft_members = '{"a":1}'::jsonb where id = $1::bigint`, [d1])).rejects.toMatchObject({ code: '23514' })
    await db.query(`delete from stimulus_groups where id = $1::bigint`, [live])
    expect((await db.query<{ d: string | null }>(`select draft_of_group_id::text d from stimulus_groups where id = $1::bigint`, [d1]))[0]!.d).toBeNull()
  })

  it('backfill: the common subject, level and kertas of the members', async () => {
    const g = await group()
    await member(g, 1, math, t4, 'MATH/2')
    await member(g, 2, math, t4, '1449/2')
    await db.query(BACKFILL)
    expect(await scope(g)).toEqual({ subject_id: math, education_level_id: t4, kertas: 2 })
  })

  it('backfill: a mixed T4/T5 group gets a NULL level and keeps the common subject (D115)', async () => {
    const g = await group()
    await member(g, 1, math, t4, null)
    await member(g, 2, math, t5, null)
    await db.query(BACKFILL)
    expect(await scope(g)).toEqual({ subject_id: math, education_level_id: null, kertas: null })
  })

  it('backfill: members of different subjects, or with different or missing kertas, give NULL for that column only', async () => {
    const mixedSubject = await group()
    await member(mixedSubject, 1, math, t4, 'X/1')
    await member(mixedSubject, 2, sci, t4, 'X/1')
    const mixedKertas = await group()
    await member(mixedKertas, 1, math, t4, 'X/1')
    await member(mixedKertas, 2, math, t4, 'X/2')
    const partlyMissing = await group()
    await member(partlyMissing, 1, math, t4, 'X/3')
    await member(partlyMissing, 2, math, t4, null)
    const noSubject = await group()
    await member(noSubject, 1, null, t4, null)
    await db.query(BACKFILL)
    expect(await scope(mixedSubject)).toEqual({ subject_id: null, education_level_id: t4, kertas: 1 })
    expect(await scope(mixedKertas)).toEqual({ subject_id: math, education_level_id: t4, kertas: null })
    expect(await scope(partlyMissing)).toEqual({ subject_id: math, education_level_id: t4, kertas: null })
    expect(await scope(noSubject)).toEqual({ subject_id: null, education_level_id: t4, kertas: null })
  })

  it('backfill: a group with no member keeps NULL scope', async () => {
    const g = await group()
    await db.query(BACKFILL)
    expect(await scope(g)).toEqual({ subject_id: null, education_level_id: null, kertas: null })
  })
})
