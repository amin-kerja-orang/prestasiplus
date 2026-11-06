import type { QueryResultRow } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { CurriculumSpMapAdapter } from '../../src/modules/curriculum/sp-map.adapter'
import { QuestionsService } from '../../src/modules/questions'
import { PerformancePorts } from '../../src/modules/reports/performance'
import type { SpMapPort } from '../../src/modules/reports/performance/ports'
import { bootIntegrationApp, type IntegrationApp } from '../bijak-integration/helpers'

/**
 * #924: the real `SpMapPort` (S10-T04 part 3, Analitik Adaptif) on a migrated, seeded database. It covers the
 * semantics that `test/reports/performance/fakes/in-memory-sp-map.ts` gives the S10 unit tests: a level with no SP
 * nodes or a null level has no subject; nodes come in DSKP order with their strand heading; a question with no SP tag
 * (a Bab-only question) or with no approved version has no tag row.
 */
let t: IntegrationApp
let port: SpMapPort
let t5: string
let t1: string
let math: string

const one = async <T extends QueryResultRow>(sql: string, params: unknown[] = []): Promise<T> => (await t.db.query<T>(sql, params))[0] as T

beforeAll(async () => {
  t = await bootIntegrationApp()
  port = t.app.get(PerformancePorts).spMap
  t5 = (await one<{ id: string }>(`select id::text id from education_levels where code = 'T5'`)).id
  t1 = (await one<{ id: string }>(`select id::text id from education_levels where code = 'T1'`)).id
  math = (await one<{ id: string }>(`select id::text id from subjects where code = 'MATH'`)).id
}, 120_000)

afterAll(async () => {
  await t.close()
})

describe('binding', () => {
  it('PerformancePorts serves the curriculum adapter, not the empty default', () => {
    expect(port).toBeInstanceOf(CurriculumSpMapAdapter)
  })
})

describe('spTree', () => {
  it('a null level and a level with no SP nodes (T1: Bab-level units only, D115) give no subject', async () => {
    expect(await port.spTree({ levelId: null })).toEqual([])
    expect(await port.spTree({ levelId: t1 })).toEqual([])
    expect(await port.spTree({ levelId: 'x' })).toEqual([])
  })

  it('T5: every active subject with SP nodes, in the curriculum order, each with all of its SP nodes', async () => {
    const tree = await port.spTree({ levelId: t5 })
    const expected = await t.db.query<{ id: string; code: string; name: string; n: number }>(
      `select s.id::text id, s.code, s.name, count(*)::int n
         from curriculum_nodes c join subjects s on s.id = c.subject_id
        where c.kind = 'sp' and c.education_level_id = $1::bigint and s.is_active
        group by s.id order by s.sort_order, s.id`,
      [t5],
    )
    expect(expected.length).toBeGreaterThan(0)
    expect(tree.map((s) => [s.subjectId, s.subjectCode, s.subjectName, s.nodes.length])).toEqual(expected.map((e) => [e.id, e.code, e.name, e.n]))
  })

  it('nodes are SP nodes in DSKP order (1..n per subject), with the Tajuk DSKP (unit) title as the strand', async () => {
    const tree = await port.spTree({ levelId: t5 })
    const mt = tree.find((s) => s.subjectId === math)
    expect(mt, 'MATH has an SP map at T5').toBeDefined()
    expect(mt!.nodes.map((n) => n.sortOrder)).toEqual(mt!.nodes.map((_, i) => i + 1))
    const kinds = await t.db.query<{ kind: string }>(`select distinct kind from curriculum_nodes where id = any($1::bigint[])`, [mt!.nodes.map((n) => n.spNodeId)])
    expect(kinds.map((k) => k.kind)).toEqual(['sp'])
    // The first unit of Matematik T5 (DSKP order) heads the first tiles: "Ubahan" (PRD 10 section R1-MUR-5).
    const firstUnit = await one<{ title: string }>(
      `select title from curriculum_nodes where kind = 'unit' and subject_id = $1::bigint and education_level_id = $2::bigint order by sort_order, id limit 1`,
      [math, t5],
    )
    expect(mt!.nodes[0]?.strand).toBe(firstUnit.title)
    expect(firstUnit.title).toMatch(/Ubahan/)
    // Every SP of MATH T5 sits under a unit, so no strand is null; codes are printed SP codes.
    for (const n of mt!.nodes) {
      expect(n.strand).not.toBeNull()
      expect(n.code).toMatch(/^\d+\.\d+\.\d+/)
    }
    // DSKP order follows the tree: the strand changes only between runs (tiles of one unit are contiguous).
    const runs = mt!.nodes.map((n) => n.strand).filter((s, i, a) => i === 0 || s !== a[i - 1])
    expect(new Set(runs).size).toBe(runs.length)
  })
})

describe('spOf', () => {
  let tagged: string
  let babOnly: string
  let draft: string
  let sp1: string
  let sp2: string

  beforeAll(async () => {
    const svc = t.app.get(QuestionsService, { strict: false })
    const admin = { userId: (await one<{ id: string }>(`select id::text id from users where email = 'admin@demo.test'`)).id, role: 'admin' as const }
    const sps = await t.db.query<{ id: string }>(`select id::text id from curriculum_nodes where kind = 'sp' and subject_id = $1::bigint and education_level_id = $2::bigint order by sort_order, id limit 2`, [math, t5])
    sp1 = sps[0]!.id
    sp2 = sps[1]!.id
    const chapter = (await one<{ id: string }>(`select id::text id from chapters where subject_id = $1::bigint and education_level_id = $2::bigint and is_active and in_tree order by id limit 1`, [math, t5])).id
    const make = async (tag: { unitId: null; spIds: string[]; tp: number } | undefined, approve: boolean): Promise<string> => {
      const q = await svc.create(
        {
          subjectId: math,
          educationLevelId: t5,
          difficultyLevel: 3,
          questionText: 'Soalan peta SP: yang manakah jawapan yang betul?',
          questionType: 'mcq',
          options: ['Satu', 'Dua', 'Tiga', 'Empat'],
          correctAnswer: 1,
          explanation: 'Penjelasan ujian.',
          cognitiveLevel: 'mengaplikasi',
          curriculumChapterId: chapter,
          ...(tag ? { tag } : {}),
        } as never,
        admin,
      )
      if (approve) for (const status of ['review', 'approved'] as const) await svc.bulkAction(status, [q.id], admin)
      return q.id
    }
    tagged = await make({ unitId: null, spIds: [sp1, sp2], tp: 3 }, true)
    draft = await make({ unitId: null, spIds: [sp1], tp: 3 }, false)
    // A Bab-only question (no SP tag) is stored with no SP row; it stays a draft because T5 needs an SP to publish.
    babOnly = await make(undefined, false)
    const live = await one<{ status: string }>(`select v.status from question_versions v join questions x on x.id = v.question_id and x.live_version_no = v.version_no where x.id = $1::bigint`, [tagged])
    expect(live.status).toBe('approved')
  }, 60_000)

  it('returns the SP tags of the approved version, one row per tag', async () => {
    expect(await port.spOf([tagged])).toEqual([
      { questionId: tagged, spNodeId: sp1 },
      { questionId: tagged, spNodeId: sp2 },
    ].sort((a, b) => Number(a.spNodeId) - Number(b.spNodeId)))
  })

  it('a Bab-only question, a question with no approved version and unknown or malformed ids have no row', async () => {
    expect(await port.spOf([babOnly, draft, '999999999', 'abc'])).toEqual([])
    expect(await port.spOf([])).toEqual([])
  })

  it('one read for many questions: only the tagged one answers', async () => {
    const rows = await port.spOf([babOnly, tagged, draft, tagged])
    expect(new Set(rows.map((r) => r.questionId))).toEqual(new Set([tagged]))
    expect(rows).toHaveLength(2)
  })
})
