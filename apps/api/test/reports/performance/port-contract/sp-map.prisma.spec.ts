import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { CurriculumSpMapAdapter } from '../../../../src/modules/curriculum/sp-map.adapter'
import { PerformancePorts } from '../../../../src/modules/reports/performance'
import type { SpMapPort } from '../../../../src/modules/reports/performance/ports'
import { bootIntegrationApp, type IntegrationApp } from '../../../bijak-integration/helpers'
import { describeSpMapPort, type SpMapSeed } from './sp-map.contract'

/**
 * Runs the SpMapPort contract against the REAL adapter (`CurriculumSpMapAdapter`, bound as `SP_MAP_PORT` by
 * `CurriculumModule` and injected by `PerformancePorts`) on a migrated, seeded test database. Needs a database:
 * `npm run be:test -- test/reports/performance/port-contract/sp-map.prisma.spec.ts`.
 *
 * `translating` writes the seed as real rows (new subjects with run-unique codes, so the seeded DSKP subjects are
 * filtered out of the answers; levels L5, L1, L0 map to T5, T1, T2) and wraps the port so seed ids go in and come out.
 */
let t: IntegrationApp
let real: SpMapPort
let counter = 0
let levelOf: Record<string, string> = {}

beforeAll(async () => {
  t = await bootIntegrationApp()
  real = t.app.get(PerformancePorts).spMap
  const lv = await t.db.query<{ id: string; code: string }>(`select id::text, code from education_levels where code in ('T5','T1','T2')`)
  const byCode = Object.fromEntries(lv.map((l) => [l.code, l.id]))
  levelOf = { L5: byCode.T5!, L1: byCode.T1!, L0: byCode.T2! }
}, 120_000)
afterAll(async () => {
  await t.close()
})

describe('binding', () => {
  it('PerformancePorts serves the curriculum adapter, not the empty default', () => {
    expect(real).toBeInstanceOf(CurriculumSpMapAdapter)
  })
})

async function translating(seed: SpMapSeed): Promise<SpMapPort> {
  counter += 1
  const subjectIn = new Map<string, string>()
  for (const s of seed.subjects) {
    const [row] = await t.db.query<{ id: string }>(
      `insert into subjects (code, name, name_en, color, sort_order, is_active) values ($1, $2, $2, '#000000', $3, $4) returning id::text`,
      [`${s.code}${counter}`, `${s.name} ${counter}`, -1000 + s.sortOrder, s.isActive],
    )
    subjectIn.set(s.id, row!.id)
  }
  const nodeIn = new Map<string, string>()
  // Parents first: the seed lists each parent before its children.
  for (const n of seed.nodes) {
    const [row] = await t.db.query<{ id: string }>(
      `insert into curriculum_nodes (subject_id, education_level_id, kind, code, title, parent_id, sort_order, edition)
       values ($1::bigint, $2::bigint, $3, $4, $5, $6::bigint, $7, 'KSSM contract') returning id::text`,
      [subjectIn.get(n.subjectId)!, levelOf[n.levelId]!, n.kind, n.code, n.title, n.parentId === null ? null : nodeIn.get(n.parentId)!, n.sortOrder],
    )
    nodeIn.set(n.id, row!.id)
  }
  const questionIn = new Map<string, string>()
  for (const q of seed.questions) {
    const [row] = await t.db.query<{ id: string }>(`insert into questions default values returning id::text`)
    questionIn.set(q.id, row!.id)
    for (const [i, v] of q.versions.entries()) {
      const [ver] = await t.db.query<{ id: string }>(
        `insert into question_versions (question_id, version_no, type, stem_ms, status, archive_reason)
         values ($1::bigint, $2, 'mcq', 'Soalan kontrak peta SP', $3, $4) returning id::text`,
        [row!.id, i + 1, v.status, v.status === 'archived' ? 'superseded' : null],
      )
      for (const sp of v.spIds) await t.db.query(`insert into question_version_sp_nodes (question_version_id, node_id) values ($1::bigint, $2::bigint)`, [ver!.id, nodeIn.get(sp)!])
    }
  }
  const subjectOut = new Map([...subjectIn].map(([k, v]) => [v, k]))
  const nodeOut = new Map([...nodeIn].map(([k, v]) => [v, k]))
  const questionOut = new Map([...questionIn].map(([k, v]) => [v, k]))
  const codeOut = new Map(seed.subjects.map((s) => [`${s.code}${counter}`, s.code]))
  const nameOut = new Map(seed.subjects.map((s) => [`${s.name} ${counter}`, s.name]))
  return {
    async spTree(query) {
      const levelId = query.levelId === null ? null : (levelOf[query.levelId] ?? query.levelId)
      const tree = await real.spTree({ levelId })
      return tree
        .filter((s) => subjectOut.has(s.subjectId))
        .map((s) => ({
          subjectId: subjectOut.get(s.subjectId)!,
          subjectCode: codeOut.get(s.subjectCode) ?? s.subjectCode,
          subjectName: nameOut.get(s.subjectName) ?? s.subjectName,
          nodes: s.nodes.map((n) => ({ ...n, spNodeId: nodeOut.get(n.spNodeId) ?? n.spNodeId })),
        }))
    },
    async spOf(questionIds) {
      const rows = await real.spOf(questionIds.map((q) => questionIn.get(q) ?? q))
      return rows.map((r) => ({ questionId: questionOut.get(r.questionId) ?? r.questionId, spNodeId: nodeOut.get(r.spNodeId) ?? r.spNodeId }))
    },
  }
}

describeSpMapPort('CurriculumSpMapAdapter (Prisma)', translating)
