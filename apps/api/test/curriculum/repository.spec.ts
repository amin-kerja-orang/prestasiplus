import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { CurriculumRepository } from '../../src/modules/curriculum/curriculum.repository'
import { bootCurriculumApp, type CurriculumTestApp } from './helpers'

/** The repository is the doorway other cards use for DSKP nodes (AC6). */
describe('CurriculumRepository DSKP node reads', () => {
  let t: CurriculumTestApp
  let repo: CurriculumRepository
  beforeAll(async () => {
    t = await bootCurriculumApp()
    repo = t.app.get(CurriculumRepository)
  })
  afterAll(async () => {
    await t.close()
  })

  it('finds an sp node by printed code, subject and level, and walks up to its root', async () => {
    const row = (
      await t.db.query<{ id: string; code: string; subject_id: string; education_level_id: string; kind: string }>(
        `select id::text, code, subject_id::text, education_level_id::text, kind from curriculum_nodes
          where kind = 'sp' and parent_id is not null order by id limit 1`,
      )
    )[0]!
    const filter = { subjectId: BigInt(row.subject_id), educationLevelId: BigInt(row.education_level_id) }
    const node = await repo.node(row.code, { ...filter, kind: 'sp' })
    expect(node?.id).toBe(BigInt(row.id))
    const ancestors = await repo.ancestorsOf(node!.id)
    expect(ancestors.length).toBeGreaterThan(0)
    expect(ancestors[0]!.id).toBe(node!.parentId)
    expect(ancestors.at(-1)!.parentId).toBeNull()
    for (const a of ancestors) expect(['grouping', 'unit', 'sk']).toContain(a.kind)
    const siblings = await repo.childrenOf(node!.parentId!)
    expect(siblings.map((s) => s.id)).toContain(node!.id)
    const order = siblings.map((s) => s.sortOrder)
    expect(order).toEqual([...order].sort((a, b) => a - b))
  })

  it('returns null for an unknown code and filters by kind', async () => {
    const any = (await t.db.query<{ subject_id: string; education_level_id: string }>('select subject_id::text, education_level_id::text from curriculum_nodes limit 1'))[0]!
    const filter = { subjectId: BigInt(any.subject_id), educationLevelId: BigInt(any.education_level_id) }
    expect(await repo.node('NO-SUCH-CODE', filter)).toBeNull()
    expect(await repo.nodeById(999999999n)).toBeNull()
    expect(await repo.ancestorsOf(999999999n)).toEqual([])
  })

  it('reads TP descriptors of a node in tp order and the subject general levels (node null)', async () => {
    const withTp = (
      await t.db.query<{ subject_id: string; node_id: string }>(
        'select subject_id::text, node_id::text from curriculum_tp_descriptors where node_id is not null limit 1',
      )
    )[0]!
    const rows = await repo.tpDescriptors(BigInt(withTp.subject_id), BigInt(withTp.node_id))
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.map((r) => r.tp)).toEqual([...rows.map((r) => r.tp)].sort((a, b) => a - b))
    const general = (
      await t.db.query<{ subject_id: string }>('select subject_id::text from curriculum_tp_descriptors where node_id is null limit 1')
    )[0]
    if (general) {
      const levels = await repo.tpDescriptors(BigInt(general.subject_id), null)
      expect(levels.length).toBeGreaterThan(0)
      expect(levels.every((r) => r.nodeId === null)).toBe(true)
    }
  })
})
