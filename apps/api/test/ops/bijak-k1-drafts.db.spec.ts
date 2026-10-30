import 'reflect-metadata'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runSeeds } from '../../prisma/seed'
import { identitySeed } from '../../prisma/seed/core/identity'
import { curriculumSeed } from '../../prisma/seed/curriculum'
import { examSeed } from '../../prisma/seed/exam'
import { connectGateway } from '../../src/ops/bijak-k1-drafts/gateway'
import { runK1Drafts, type RunOptions } from '../../src/ops/bijak-k1-drafts/run'
import { createTestDatabase, type TestDatabase } from '../support/db'

/**
 * The K1 draft script on a real (migrated, seeded) database: the eligible-stock query, the blueprint and paper writes through the
 * real services, the read-back, the publish check and the idempotent re-run. The migrated questions are fictitious rows written like
 * QLOAD writes them (`legacy_source = 'cloud'`, one published live version, one MCQ part, four options, one key).
 */
describe('bijak-k1-drafts on a database', () => {
  let db: TestDatabase
  let close: () => Promise<void>
  let gateway: Awaited<ReturnType<typeof connectGateway>>['gateway']
  const q = (sql: string, params: unknown[] = []) => db.query<Record<string, unknown>>(sql, params)

  const one = async (sql: string): Promise<string> => String((await q(sql))[0]!.id)

  /** Inserts `count` migrated MCQs of a subject and level. `from` keeps the legacy ids apart. */
  async function migrated(subjectCode: string, levelCode: string, formOrigin: string, count: number, from: number): Promise<void> {
    const subject = await one(`select id::text id from subjects where code = '${subjectCode}'`)
    const level = await one(`select id::text id from education_levels where code = '${levelCode}'`)
    await q(
      `WITH q AS (
         INSERT INTO questions (latest_version_no, live_version_no, is_active, legacy_source, legacy_id)
         SELECT 1, 1, true, 'cloud', ($4::int + g)::text FROM generate_series(1, $1::int) g
         RETURNING id, legacy_id
       ), v AS (
         INSERT INTO question_versions (question_id, version_no, status, published_at, type, stem_ms, language, subject_id, education_level_id, form_origin, rights_status)
         SELECT id, 1, 'published', now(), 'mcq', 'Soalan ujian ' || legacy_id, 'ms', $2::bigint, $3::bigint, $5::text, 'unclear' FROM q
         RETURNING id
       ), p AS (
         INSERT INTO question_parts (question_version_id, parent_part_id, position, depth, label, prompt_ms, marks, mode)
         SELECT id, NULL, 1, 1, '1', 'Pilih jawapan yang betul.', 1, 'mcq' FROM v
         RETURNING id
       ), o AS (
         INSERT INTO part_options (part_id, label, body_ms, position)
         SELECT p.id, chr(64 + l), 'Pilihan ' || l, l FROM p CROSS JOIN generate_series(1, 4) AS l
         RETURNING 1
       )
       INSERT INTO answer_keys (part_id, kind, content) SELECT id, 'option', '{"kind":"option","correct":"A"}'::jsonb FROM p`,
      [count, subject, level, from, formOrigin],
    )
  }

  const opts = (over: Partial<RunOptions> = {}): RunOptions => ({ apply: false, sets: 2, subjects: ['PHY'], replaceBlueprints: false, ...over })
  const run = async (o: RunOptions) => {
    const out: string[] = []
    const summary = await runK1Drafts(gateway, o, (l) => out.push(l))
    return { out, summary }
  }

  beforeAll(async () => {
    db = await createTestDatabase()
    await runSeeds([identitySeed, curriculumSeed, examSeed], { prisma: db.prisma })
    await migrated('PHY', 'T4', 't4', 60, 1000)
    await migrated('PHY', 'T5', 't5', 60, 2000)
    await migrated('PHY', 'D6', 't1_t3', 30, 3000) // primary: never SPM stock
    await migrated('MATH', 'T1', 't1_t3', 40, 5000)
    await migrated('MATH', 'T4', 't4', 30, 6000)
    await migrated('MATH', 'T5', 't5', 30, 7000)
    // Not eligible: an inactive question, a question of another source, a draft version, a question with a blank option.
    await q(`update questions set is_active = false where legacy_source = 'cloud' and legacy_id in ('1001', '1002')`)
    await q(`update questions set legacy_source = 'other' where legacy_source = 'cloud' and legacy_id = '1003'`)
    await q(`update question_versions set status = 'draft' where question_id = (select id from questions where legacy_id = '1004')`)
    await q(`update part_options set body_ms = ' ' where position = 2 and part_id = (select p.id from question_parts p join question_versions v on v.id = p.question_version_id join questions x on x.id = v.question_id where x.legacy_id = '1005')`)
    ;({ gateway, close } = await connectGateway(db.url))
  })
  afterAll(async () => {
    await close()
    await db.drop()
  })

  it('counts the eligible stock by level and leaves out the ineligible rows', async () => {
    const stock = await gateway.eligible('PHY')
    expect(stock.filter((c) => c.stratum === 't4')).toHaveLength(60 - 5)
    expect(stock.filter((c) => c.stratum === 't5')).toHaveLength(60)
    expect(stock.some((c) => c.stratum === 'd6')).toBe(false)
    expect(stock).toHaveLength(115)
  })

  it('dry-run writes nothing', async () => {
    const before = await one(`select (select count(*) from papers) + (select count(*) from blueprints) as id`)
    const { summary, out } = await run(opts())
    expect(summary.exit).toBe(0)
    expect(out.join('\n')).toContain('eligible stock: 115')
    expect(await one(`select (select count(*) from papers) + (select count(*) from blueprints) as id`)).toBe(before)
  })

  it('apply creates the Spec blueprint and two disjoint DRAFT papers of 40 that pass the publish check', async () => {
    const { summary, out } = await run(opts({ apply: true }))
    expect(summary).toMatchObject({ exit: 0, blueprintsCreated: 1, papersCreated: 2, failures: 0 })
    expect(out.join('\n')).toContain('publish check on the drafts written now: 2 of 2 pass')
    const bp = await q(`select b.code, b.source, b.status, b.duration_min from blueprints b join subjects s on s.id = b.subject_id where s.code = 'PHY' and b.kertas = 1`)
    expect(bp).toEqual([{ code: '4531/1', source: 'spec', status: 'active', duration_min: 75 }])
    const papers = await q(
      `select p.id::text id, p.status, p.kind, p.paper_code, count(pl.id)::int n from papers p
         join subjects s on s.id = p.subject_id and s.code = 'PHY'
         join paper_sections ps on ps.paper_id = p.id left join paper_placements pl on pl.paper_section_id = ps.id
        where p.title like 'Latihan SPM%' group by p.id order by p.id`,
    )
    expect(papers).toHaveLength(2)
    expect(papers.every((p) => p.status === 'draft' && p.kind === 'pilihan' && p.paper_code === '4531/1' && p.n === 40)).toBe(true)
    const distinct = await one(`select count(distinct pl.question_id) as id from paper_placements pl`)
    expect(Number(distinct)).toBeGreaterThanOrEqual(80)
    const audit = await q(`select count(*)::int n from audit_events where action like 'bijak.%'`)
    expect(Number(audit[0]!.n)).toBeGreaterThanOrEqual(3)
  })

  it('a second apply creates nothing', async () => {
    const before = await one(`select (select count(*) from papers) + (select count(*) from blueprints) + (select count(*) from paper_placements) as id`)
    const { summary } = await run(opts({ apply: true }))
    expect(summary).toMatchObject({ exit: 0, blueprintsCreated: 0, papersCreated: 0, papersExisting: 2 })
    expect(await one(`select (select count(*) from papers) + (select count(*) from blueprints) + (select count(*) from paper_placements) as id`)).toBe(before)
  })

  it('blocks a blueprint that does not fit (the seeded PoC Matematik K1 has 10 questions), then adds a version on request', async () => {
    const blocked = await run(opts({ apply: true, subjects: ['MAT'] }))
    expect(blocked.summary.exit).toBe(3)
    expect(await one(`select count(*) as id from papers where title like 'Latihan SPM Matematik%'`)).toBe('0')
    const replaced = await run(opts({ apply: true, subjects: ['MAT'], replaceBlueprints: true }))
    expect(replaced.summary).toMatchObject({ exit: 0, blueprintsCreated: 1, papersCreated: 2 })
    const active = await q(`select b.version, b.status from blueprints b join subjects s on s.id = b.subject_id where s.code = 'MATH' and b.kertas = 1 order by b.version`)
    expect(active.map((r) => r.status)).toEqual(['retired', 'active'])
    const again = await run(opts({ apply: true, subjects: ['MAT'], replaceBlueprints: true }))
    expect(again.summary).toMatchObject({ exit: 0, blueprintsCreated: 0, papersCreated: 0 })
  })

  it('never publishes: no K1 paper of the script is published', async () => {
    expect(await one(`select count(*) as id from papers where title like 'Latihan SPM%' and status <> 'draft'`)).toBe('0')
  })
})
