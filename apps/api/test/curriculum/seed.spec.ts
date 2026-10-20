import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runSeeds } from '../../prisma/seed'
import { DSKP_ONLY_SUBJECTS, loadDskp, loadSnapshot, curriculumSeed } from '../../prisma/seed/curriculum'
import { deriveSubjectLevelPairs } from '../../src/modules/curriculum/rules'
import { createTestDatabase, type TestDatabase } from '../support/db'
import { count, dropDatabase } from './helpers'

/** SRS BR-01 and v1.10: the observed figures the snapshots must reproduce. */
const SRS = { levels: 11, chaptersInTree: 1251, chaptersOutOfTree: 60 }
const LINKS_PER_LEVEL = [16, 16, 16, 17, 17, 17, 15, 15, 15, 25, 25]
const CHAPTERS_PER_LEVEL = [41, 41, 33, 34, 35, 36, 183, 329, 296, 117, 106]

describe('curriculum seed (AC2, AC5, AC6, AC10)', () => {
  let db: TestDatabase
  const snap = loadSnapshot()
  beforeAll(async () => {
    db = await createTestDatabase()
    await runSeeds([curriculumSeed], { prisma: db.prisma })
  })
  afterAll(async () => {
    await dropDatabase(db)
  })

  it('AC2: the snapshots carry the SRS figures (a drifting snapshot fails)', () => {
    expect(snap.levels).toHaveLength(SRS.levels)
    expect(snap.chapters.filter((c) => c.inTree)).toHaveLength(SRS.chaptersInTree)
    expect(snap.chapters.filter((c) => !c.inTree)).toHaveLength(SRS.chaptersOutOfTree)
  })

  it('AC2: the database holds exactly the snapshot counts', async () => {
    expect(await count(db, 'select count(*) n from education_levels')).toBe(SRS.levels)
    expect(await count(db, 'select count(*) n from chapters where in_tree')).toBe(SRS.chaptersInTree)
    expect(await count(db, 'select count(*) n from chapters where not in_tree')).toBe(SRS.chaptersOutOfTree)
    expect(await count(db, 'select count(*) n from topics')).toBe(snap.topics.length)
    expect(await count(db, 'select count(*) n from subtopics')).toBe(snap.subtopics.length)
    expect(await count(db, 'select count(*) n from legacy_topics')).toBe(snap.legacyTopics.length)
    expect(await count(db, 'select count(*) n from legacy_subtopics')).toBe(snap.legacySubtopics.length)
    expect(await count(db, 'select count(*) n from subject_levels')).toBe(snap.subjectLevels.length)
    // 31 observed subjects plus the two DSKP-only practical subjects.
    expect(snap.subjects).toHaveLength(31)
    expect(await count(db, 'select count(*) n from subjects')).toBe(31 + DSKP_ONLY_SUBJECTS.length)
  })

  it('AC2: the per-level chapter counts and per-level subject links of the observed data', async () => {
    const chapters = await db.query<{ code: string; n: string }>(
      `select l.code, count(*) n from chapters c join education_levels l on l.id = c.education_level_id where c.in_tree group by l.code, l.sort_order order by l.sort_order`,
    )
    expect(chapters.map((r) => Number(r.n))).toEqual(CHAPTERS_PER_LEVEL)
    const links = await db.query<{ n: string }>(
      `select count(*) n from subject_levels sl join education_levels l on l.id = sl.education_level_id group by l.code, l.sort_order order by l.sort_order`,
    )
    expect(links.map((r) => Number(r.n))).toEqual(LINKS_PER_LEVEL)
  })

  it('only the out-of-tree chapters lack a level and a name; every seeded subject has the observed order', async () => {
    expect(await count(db, 'select count(*) n from chapters where education_level_id is null and name is null and not in_tree')).toBe(60)
    expect(await count(db, 'select count(*) n from chapters where in_tree and (education_level_id is null or name is null)')).toBe(0)
    const codes = await db.query<{ code: string }>('select code from subjects where is_active order by sort_order, id')
    expect(codes.map((r) => r.code)).toEqual(snap.subjects.map((s) => s.code))
  })

  it('the DSKP-only subjects are inactive and have no level link', async () => {
    for (const s of DSKP_ONLY_SUBJECTS) {
      const rows = await db.query<{ is_active: boolean; links: string }>(
        `select is_active, (select count(*) from subject_levels where subject_id = s.id) links from subjects s where code = $1`,
        [s.code],
      )
      expect(rows[0]).toEqual({ is_active: false, links: '0' })
    }
  })

  it('AC5: the pivot contains every pair the chapter rule derives', async () => {
    const chapters = await db.query<{ subject_id: string; education_level_id: string | null; in_tree: boolean }>(
      'select subject_id::text, education_level_id::text, in_tree from chapters',
    )
    const derived = deriveSubjectLevelPairs(
      chapters.map((c) => ({ subjectId: BigInt(c.subject_id), educationLevelId: c.education_level_id === null ? null : BigInt(c.education_level_id), inTree: c.in_tree })),
    )
    expect(derived).toHaveLength(140)
    const links = new Set((await db.query<{ k: string }>(`select subject_id || ':' || education_level_id k from subject_levels`)).map((r) => r.k))
    for (const [s, l] of derived) expect(links.has(`${s}:${l}`), `${s}:${l}`).toBe(true)
  })

  it('AC6: every DSKP extract is in curriculum_nodes with its counts, parents and unique keys', async () => {
    const loaded = loadDskp()
    let nodes = 0
    for (const { subject, extract } of loaded) {
      const n = await count(db, `select count(*) n from curriculum_nodes where subject_id = (select id from subjects where code = $1)`, [subject])
      expect(n, subject).toBe(extract.nodes.length)
      nodes += n
    }
    expect(await count(db, 'select count(*) n from curriculum_nodes')).toBe(nodes)
    const orphans = await count(
      db,
      `select count(*) n from curriculum_nodes c where parent_id is not null and not exists (select 1 from curriculum_nodes p where p.id = c.parent_id)`,
    )
    expect(orphans).toBe(0)
    // Kinds stack correctly: sp under sk under unit; a unit has a grouping or none.
    expect(await count(db, `select count(*) n from curriculum_nodes c join curriculum_nodes p on p.id = c.parent_id where c.kind = 'sp' and p.kind <> 'sk'`)).toBe(0)
    expect(await count(db, `select count(*) n from curriculum_nodes c join curriculum_nodes p on p.id = c.parent_id where c.kind = 'sk' and p.kind <> 'unit'`)).toBe(0)
    expect(await count(db, `select count(*) n from curriculum_nodes c join curriculum_nodes p on p.id = c.parent_id where c.kind = 'unit' and p.kind <> 'grouping'`)).toBe(0)
  })

  it('AC6: Tingkatan 1 to 3 Matematik content is not invented (nodes exist for Tingkatan 4 and 5 only)', async () => {
    const levels = await db.query<{ code: string }>(
      `select distinct l.code from curriculum_nodes n join education_levels l on l.id = n.education_level_id order by 1`,
    )
    expect(levels.map((r) => r.code)).toEqual(['T4', 'T5'])
  })

  it('AC10: TP descriptors come from the extracts, tp is 1 to 6, node rows have a scope and the general levels have none', async () => {
    const loaded = loadDskp()
    const expected = loaded.reduce((n, f) => n + f.extract.tps.length, 0)
    expect(await count(db, 'select count(*) n from curriculum_tp_descriptors')).toBe(expected)
    expect(await count(db, 'select count(*) n from curriculum_tp_descriptors where tp not between 1 and 6')).toBe(0)
    expect(await count(db, `select count(*) n from curriculum_tp_descriptors where (node_id is null) <> (scope is null)`)).toBe(0)
    expect(await count(db, `select count(*) n from curriculum_tp_descriptors where node_id is null`)).toBe(
      loaded.reduce((n, f) => n + f.extract.tps.filter((t) => t.nodeKey === null).length, 0),
    )
    // A subject with general performance levels (Matematik) has tp 1 to 6.
    const general = await db.query<{ tp: number }>(
      `select tp from curriculum_tp_descriptors where node_id is null and subject_id = (select id from subjects where code = 'MATH') order by tp`,
    )
    expect(general.map((r) => r.tp)).toEqual([1, 2, 3, 4, 5, 6])
    // The unit-level descriptors of Matematik T4 unit 1.0 are the six printed ones.
    const unit = await db.query<{ tp: number }>(
      `select d.tp from curriculum_tp_descriptors d join curriculum_nodes n on n.id = d.node_id
        where n.subject_id = (select id from subjects where code = 'MATH') and n.kind = 'unit' and n.code = '1.0'
          and n.education_level_id = (select id from education_levels where code = 'T4') and d.scope = 'unit' order by d.tp`,
    )
    expect(unit.map((r) => r.tp)).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('seeds never set legacy_* and the migratable pairs are empty', async () => {
    for (const table of ['education_levels', 'subjects', 'subject_levels', 'chapters', 'topics']) {
      expect(await count(db, `select count(*) n from ${table} where legacy_source is not null or legacy_id is not null`), table).toBe(0)
    }
  })

  it('is idempotent: a second run changes no count', async () => {
    const tables = ['education_levels', 'subjects', 'subject_levels', 'chapters', 'topics', 'subtopics', 'curriculum_nodes', 'curriculum_tp_descriptors', 'legacy_topics', 'legacy_subtopics']
    const before = await Promise.all(tables.map((t) => count(db, `select count(*) n from ${t}`)))
    await runSeeds([curriculumSeed], { prisma: db.prisma })
    const after = await Promise.all(tables.map((t) => count(db, `select count(*) n from ${t}`)))
    expect(after).toEqual(before)
  })

  it('a re-run next to edited and loaded rows keeps the edit, restores nothing it did not own and adds only what is missing', async () => {
    await db.query(`update education_levels set name = 'Nama Disunting' where code = 'D1'`)
    // A row loaded from .cloud later (legacy_source set) next to the seed rows.
    await db.query(
      `insert into subjects (code, name, name_en, color, legacy_source, legacy_id) values ('CLOUDX', 'Dimuat', 'Loaded', '#112233', 'cloud', '501')`,
    )
    const subjectsBefore = await count(db, 'select count(*) n from subjects')
    await db.query(`delete from topics where id = (select min(id) from topics)`)
    await runSeeds([curriculumSeed], { prisma: db.prisma })
    expect((await db.query<{ name: string }>(`select name from education_levels where code = 'D1'`))[0]?.name).toBe('Nama Disunting')
    expect(await count(db, 'select count(*) n from subjects')).toBe(subjectsBefore)
    expect(await count(db, 'select count(*) n from topics')).toBe(snap.topics.length)
  })
})
