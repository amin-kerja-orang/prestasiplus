import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { QuestionPartSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runSeeds } from '../../prisma/seed'
import { identitySeed } from '../../prisma/seed/core/identity'
import { curriculumSeed } from '../../prisma/seed/curriculum'
import { questionsSeed } from '../../prisma/seed/questions'
import { SEED_QUESTIONS } from '../../prisma/seed/questions/content'
import { createTestDatabase, type TestDatabase } from '../support/db'
import { count, dropDatabase } from '../curriculum/helpers'

describe('question bank seed', () => {
  let db: TestDatabase
  beforeAll(async () => {
    db = await createTestDatabase()
    await runSeeds([identitySeed, curriculumSeed, questionsSeed], { prisma: db.prisma })
  })
  afterAll(async () => {
    await dropDatabase(db)
  })

  const tables = ['questions', 'question_versions', 'question_parts', 'part_options', 'answer_keys', 'question_tags', 'stimuli', 'stimulus_groups', 'stimulus_group_stimuli', 'stimulus_group_options', 'question_version_stimuli', 'question_version_sp_nodes']
  const snapshot = async () => Object.fromEntries(await Promise.all(tables.map(async (t) => [t, await count(db, `select count(*) n from ${t}`)])))

  it('is a demo seed placed after the curriculum seed', () => {
    expect(questionsSeed.name).toBe('questions')
    expect(questionsSeed.kind).toBe('demo')
  })

  it('loads the documented rows per status', async () => {
    expect(await count(db, `select count(*) n from questions`)).toBe(SEED_QUESTIONS.length)
    const byStatus = await db.query<{ status: string; n: string }>(`select status, count(*) n from question_versions group by 1 order by 1`)
    expect(Object.fromEntries(byStatus.map((r) => [r.status, Number(r.n)]))).toEqual({ archived: 1, draft: 1, published: 16, review: 1 })
    expect(await count(db, `select count(*) n from question_versions where status = 'published' and type = 'mcq' and subject_id is not null and number_label like 'SEED-MCQ-%'`)).toBe(6)
    expect(await count(db, `select count(*) n from question_versions where type = 'structured'`)).toBe(3)
  })

  it('every published row passes the publish gate: subject, level, unit, 1 to 3 SP, TP; live version set', async () => {
    const bad = await db.query(
      `select v.id from question_versions v join questions q on q.id = v.question_id
        where v.status = 'published' and (
          v.subject_id is null or v.education_level_id is null or v.unit_node_id is null or v.difficulty_tp is null
          or q.live_version_no is distinct from v.version_no or v.published_at is null
          or (select count(*) from question_version_sp_nodes s where s.question_version_id = v.id) not between 1 and 3)`,
    )
    expect(bad).toEqual([])
    // The unit is a unit node and the SP an sp node of the same subject and level.
    const wrongKind = await db.query(
      `select v.id from question_versions v
        where v.unit_node_id is not null and (
          not exists (select 1 from curriculum_nodes n where n.id = v.unit_node_id and n.kind = 'unit' and n.subject_id = v.subject_id and n.education_level_id = v.education_level_id)
          or exists (select 1 from question_version_sp_nodes s join curriculum_nodes n on n.id = s.node_id
                      where s.question_version_id = v.id and (n.kind <> 'sp' or n.subject_id <> v.subject_id or n.education_level_id <> v.education_level_id)))`,
    )
    expect(wrongKind).toEqual([])
    expect(await count(db, `select count(*) n from questions where live_version_no is not null`)).toBe(16)
  })

  it('covers 3 subjects x 2 forms with published MCQ', async () => {
    const rows = await db.query<{ code: string; level: string }>(
      `select s.code, l.code as level from question_versions v join subjects s on s.id = v.subject_id join education_levels l on l.id = v.education_level_id
        where v.number_label like 'SEED-MCQ-%' and v.status = 'published' order by 1, 2`,
    )
    expect(rows.map((r) => `${r.code}-${r.level}`)).toEqual(['BM-T4', 'BM-T5', 'MATH-T4', 'MATH-T5', 'SCI-T4', 'SCI-T5'])
  })

  it('stores a 3-level tree, ECF, "any N of M" groups and alternative paths as keys', async () => {
    const depth = await db.query<{ max: number }>(
      `select max(p.depth) max from question_parts p join question_versions v on v.id = p.question_version_id where v.number_label = 'SEED-STR-TREE'`,
    )
    expect(depth[0]?.max).toBe(3)
    expect(await count(db, `select count(*) n from answer_keys where content ? 'groups'`)).toBe(1)
    expect(await count(db, `select count(*) n from answer_keys where content ? 'paths'`)).toBe(1)
    expect(await count(db, `select count(*) n from answer_keys where content::text like '%"ecf"%'`)).toBe(1)
    // Marks only on leaves; every leaf has exactly one key.
    expect(await count(db, `select count(*) n from question_parts p where p.mode is not null and not exists (select 1 from answer_keys k where k.part_id = p.id)`)).toBe(0)
    expect(await count(db, `select count(*) n from question_parts p where p.mode is null and exists (select 1 from answer_keys k where k.part_id = p.id)`)).toBe(0)
  })

  it('has a group of 3 ordered members around one stimulus and a group with a lettered option bank of 4', async () => {
    const members = await db.query<{ label: string; group_position: number }>(
      `select v.number_label as label, q.group_position from questions q join stimulus_groups g on g.id = q.group_id
         join question_versions v on v.question_id = q.id where g.label = 'SEED-GRP-PASAR' order by q.group_position`,
    )
    expect(members.map((m) => m.group_position)).toEqual([1, 2, 3])
    expect(await count(db, `select count(*) n from stimulus_group_stimuli s join stimulus_groups g on g.id = s.group_id where g.label = 'SEED-GRP-PASAR'`)).toBe(1)
    const bank = await db.query<{ label: string }>(
      `select o.label from stimulus_group_options o join stimulus_groups g on g.id = o.group_id where g.label = 'SEED-GRP-AYAT' order by o.position`,
    )
    expect(bank.map((b) => b.label)).toEqual(['A', 'B', 'C', 'D'])
    expect(await count(db, `select count(*) n from questions q join stimulus_groups g on g.id = q.group_id where g.label = 'SEED-GRP-AYAT'`)).toBe(4)
    expect(await count(db, `select count(*) n from answer_keys k join question_parts p on p.id = k.part_id where p.mode = 'match_letter'`)).toBe(4)
  })

  it('the Guru-visible rows belong to the seeded teacher, resolved by role', async () => {
    const owners = await db.query<{ email: string; ref: string; status: string }>(
      `select u.email, v.number_label as ref, v.status from questions q join users u on u.id = q.created_by_id
         join question_versions v on v.question_id = q.id join user_roles r on r.user_id = u.id and r.role = 'teacher'`,
    )
    expect(owners).toHaveLength(1)
    expect(owners[0]).toMatchObject({ ref: 'SEED-REVIEW-SCI-T5', status: 'review' })
    expect(await count(db, `select count(*) n from questions where created_by_id is null`)).toBe(0)
  })

  it('every stored part tree is valid for the contract and no key is an empty object', async () => {
    for (const q of SEED_QUESTIONS) for (const p of q.parts) expect(QuestionPartSchema.safeParse(p).success, q.ref).toBe(true)
    expect(await count(db, `select count(*) n from answer_keys where content = '{}'::jsonb or content->>'kind' is distinct from kind`)).toBe(0)
  })

  it('a second run inserts nothing', async () => {
    const before = await snapshot()
    await runSeeds([questionsSeed], { prisma: db.prisma })
    expect(await snapshot()).toEqual(before)
  })

  it('uses no legacy_* values, no randomness and no wall clock', () => {
    expect(
      readdirSync(fileURLToPath(new URL('../../prisma/seed/questions/', import.meta.url))).filter((f) => f.endsWith('.ts')).length,
    ).toBeGreaterThan(0)
    for (const f of ['index.ts', 'content.ts']) {
      const src = readFileSync(fileURLToPath(new URL(`../../prisma/seed/questions/${f}`, import.meta.url)), 'utf8')
      expect(src).not.toMatch(/Math\.random|Date\.now|new Date\(/)
      expect(src).not.toMatch(/legacy_|legacySource|legacyId/)
    }
  })
})
