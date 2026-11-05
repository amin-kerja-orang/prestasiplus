import { describe, expect, it } from 'vitest'

import { Prisma } from '../../src/db/generated/client'
import { QuestionsRepository } from '../../src/modules/questions'

/**
 * Secondary-only (D72, OQ-06): every list and its count/total must apply the same Darjah filter BEFORE pagination.
 * No database: a fake client renders each raw query so the WHERE of the page query and of the count query can be compared.
 */
const PRIMARY = `el.stage = 'primary'`

function fakeRepo(): { repo: QuestionsRepository; queries: string[] } {
  const queries: string[] = []
  const client = {
    question: { findMany: () => Promise.resolve([]) },
    $queryRaw: (strings: TemplateStringsArray, ...values: unknown[]) => {
      queries.push(Prisma.sql(strings, ...values).sql)
      return Promise.resolve([])
    },
  }
  return { repo: new QuestionsRepository({ client } as never), queries }
}

const whereOf = (sql: string): string => sql.slice(sql.indexOf('WHERE')).replace(/(ORDER BY|GROUP BY) .*$/s, '').trim()

describe('questions list/count filter consistency (no Darjah rows, same filter before pagination)', () => {
  it('listIds: page, total and per-status counts all hide primary-level questions', async () => {
    const { repo, queries } = fakeRepo()
    await repo.listIds({ page: 1, pageSize: 20, status: 'approved' })
    // The page and ONE aggregate (the per-status counts also give the total, R1 perf): same filter, the page adds the chosen status.
    expect(queries).toHaveLength(2)
    for (const q of queries) expect(q).toContain(PRIMARY)
    expect(whereOf(queries[0]!).replace(/ AND v\.status = (\$\d+|\?)$/, '')).toBe(whereOf(queries[1]!))
    expect(whereOf(queries[0]!)).toMatch(/ AND v\.status = (\$\d+|\?)$/)
    expect(whereOf(queries[1]!)).not.toContain('v.status =')
  })

  it('listIds: a status the counts do not know gives total 0, never undefined (as before the one-aggregate change)', async () => {
    const { repo } = fakeRepo()
    expect((await repo.listIds({ page: 1, pageSize: 20, status: 'unknown' as never })).total).toBe(0)
  })

  it('count / groupCount / structured / totals hide primary-level questions', async () => {
    const { repo, queries } = fakeRepo()
    await repo.count({ status: 'approved' })
    await repo.groupCount('level', { status: 'approved' })
    await repo.structuredIds({ page: 1, pageSize: 20 })
    await repo.structuredStats()
    await repo.subjectTotals()
    expect(queries.length).toBeGreaterThanOrEqual(6)
    for (const q of queries) expect(q).toContain(PRIMARY)
  })

  it('qualityBatch (quality audit scan) hides primary-level questions', async () => {
    const { repo, queries } = fakeRepo()
    await repo.qualityBatch(undefined, 50)
    await repo.qualityBatch('10', 50)
    expect(queries).toHaveLength(2)
    for (const q of queries) expect(q).toContain(PRIMARY)
  })
})
