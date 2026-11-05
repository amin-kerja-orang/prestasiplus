import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runSeeds } from '../../prisma/seed'
import { identitySeed } from '../../prisma/seed/core/identity'
import { curriculumSeed } from '../../prisma/seed/curriculum'
import { createTestDatabase, type TestDatabase } from '../support/db'

/**
 * AC-R1-12.6 (backend side): "UAT after loading: `curriculum_nodes` is greater than 0 for each in-scope subject (evidence in the QA table)".
 * The UAT run after `dskp:load` is ops evidence and stays with ops. What a spec can pin is the data side: the packaged DSKP, loaded the way the
 * specs load it (identity and curriculum seeds), leaves every in-scope subject with nodes, the second SELECT of `docs/ops/r1-runbook.md`
 * section 4 ("R1-12.6 read-only check", text copied from it) returns no row, and only Tingkatan 4 and 5 carry nodes. The runbook SELECTs are
 * run as written, so a drift of the SQL or of the packaged data goes red here.
 */
const IN_SCOPE = ['BM', 'BI', 'MATH', 'ADDMATH', 'PHY', 'SCI', 'SEJ', 'PI', 'TI', 'PM', 'PSV', 'LNR', 'KNP']
const VALUES = IN_SCOPE.map((c) => `('${c}')`).join(',')

const NODES_PER_SUBJECT = `
SELECT in_scope.code AS subject, count(n.id) AS nodes
  FROM (VALUES ${VALUES}) AS in_scope(code)
  LEFT JOIN subjects s ON s.code = in_scope.code
  LEFT JOIN curriculum_nodes n ON n.subject_id = s.id
 GROUP BY in_scope.code ORDER BY in_scope.code`
const WITHOUT_NODES = `
SELECT in_scope.code AS subject_without_nodes
  FROM (VALUES ${VALUES}) AS in_scope(code)
  LEFT JOIN subjects s ON s.code = in_scope.code
 WHERE NOT EXISTS (SELECT 1 FROM curriculum_nodes n WHERE n.subject_id = s.id)
 ORDER BY in_scope.code`
const TOTAL = `SELECT count(*) AS nodes FROM curriculum_nodes`
const LEVELS = `SELECT DISTINCT l.code FROM curriculum_nodes n JOIN education_levels l ON l.id = n.education_level_id ORDER BY 1`

describe('R1-12.6: curriculum nodes per in-scope subject (runbook section 4 SELECTs)', () => {
  let db: TestDatabase
  beforeAll(async () => {
    db = await createTestDatabase()
    await runSeeds([identitySeed, curriculumSeed], { prisma: db.prisma })
  }, 180_000)
  afterAll(async () => {
    await db?.drop()
  })

  it('every one of the 13 in-scope subjects has curriculum nodes after the load', async () => {
    const rows = await db.query<{ subject: string; nodes: string }>(NODES_PER_SUBJECT)
    expect(rows.map((r) => r.subject)).toEqual([...IN_SCOPE].sort())
    for (const r of rows) expect(Number(r.nodes), r.subject).toBeGreaterThan(0)
  })

  it('the total is 3,652 (2,844 at Tingkatan 4-5 + 808 Bab-level nodes at Tingkatan 1-3), the number the runbook (section 4) expects from the loader report', async () => {
    const [row] = await db.query<{ nodes: string }>(TOTAL)
    expect(Number(row!.nodes)).toBe(3652)
  })

  it('the runbook "subject without a node" SELECT returns no row', async () => {
    expect(await db.query(WITHOUT_NODES)).toEqual([])
  })

  it('Tingkatan 1 to 5 carry nodes (T1-T3 Bab-level only)', async () => {
    expect((await db.query<{ code: string }>(LEVELS)).map((r) => r.code)).toEqual(['T1', 'T2', 'T3', 'T4', 'T5'])
  })

  it('the "without a node" SELECT does report a subject that has none (a code the load never creates)', async () => {
    const rows = await db.query<{ subject_without_nodes: string }>(WITHOUT_NODES.replace("('KNP')", "('NOPE')"))
    expect(rows.map((r) => r.subject_without_nodes)).toEqual(['NOPE'])
  })
})
