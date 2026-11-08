/**
 * S10-T05 part 3: the three SP reads of `CurriculumRepository` (no database, same fake-client pattern as
 * `test/questions/secondary-only-counts.spec.ts`): the SQL carries the approved-question, Tingkatan 1 to 5 and SP-kind filters and the
 * rows map to the heatmap shape. Their behaviour over real rows runs in the heatmap integration suite in CI.
 */
import { describe, expect, it } from 'vitest'

import { Prisma } from '../../src/db/generated/client'
import { CurriculumRepository } from '../../src/modules/curriculum/curriculum.repository'

function repoReturning(rows: unknown[], queries: string[]): CurriculumRepository {
  const client = {
    $queryRaw: (strings: TemplateStringsArray, ...values: unknown[]) => {
      queries.push(Prisma.sql(strings, ...values).sql)
      return Promise.resolve(rows)
    },
  }
  return new CurriculumRepository({ client } as never)
}

const spRow = { id: 5n, subject_id: 2n, code: '1.1.1', title: 'Mengenal', sort_order: 3, level_code: 'T4', level_order: 4 }

describe('CurriculumRepository SP reads (S10-T05 part 3)', () => {
  it('subjectLevelsWithBab: approved active live versions linked to an active in-tree chapter, T1-T5 only', async () => {
    const queries: string[] = []
    const out = await repoReturning([{ subject_id: 2n, code: 'T4' }], queries).subjectLevelsWithBab([2n, 2n])
    expect(out).toEqual([{ subjectId: 2n, levelCode: 'T4' }])
    expect(queries[0]).toContain("v.status = 'approved'")
    expect(queries[0]).toContain('q.is_active')
    expect(queries[0]).toContain('c.in_tree AND c.is_active')
    expect(queries[0]).toContain("^T[1-5]$")
    expect(await repoReturning([], []).subjectLevelsWithBab([])).toEqual([])
  })

  it('spNodesOfApprovedQuestions: SP nodes tagged on approved active live versions, mapped to the heatmap shape', async () => {
    const queries: string[] = []
    const out = await repoReturning([spRow], queries).spNodesOfApprovedQuestions([2n])
    expect(out).toEqual([{ id: 5n, subjectId: 2n, code: '1.1.1', title: 'Mengenal', sortOrder: 3, levelCode: 'T4', levelOrder: 4 }])
    expect(queries[0]).toContain('question_version_sp_nodes')
    expect(queries[0]).toContain("n.kind = 'sp'")
    expect(queries[0]).toContain("v.status = 'approved'")
    expect(await repoReturning([], []).spNodesOfApprovedQuestions([])).toEqual([])
  })

  it('spNodesOfQuestions: groups the live-version SP nodes per question id, any version status', async () => {
    const queries: string[] = []
    const rows = [
      { ...spRow, question_id: 100n },
      { ...spRow, id: 6n, question_id: 100n },
      { ...spRow, id: 7n, question_id: 101n },
    ]
    const out = await repoReturning(rows, queries).spNodesOfQuestions([100n, 101n])
    expect([...out.keys()]).toEqual([100n, 101n])
    expect(out.get(100n)?.map((n) => n.id)).toEqual([5n, 6n])
    expect(queries[0]).toContain('q.live_version_no')
    expect(queries[0]).not.toContain("v.status = 'approved'")
    expect((await repoReturning([], []).spNodesOfQuestions([])).size).toBe(0)
  })
})
