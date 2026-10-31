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

const whereOf = (sql: string): string => sql.slice(sql.indexOf('WHERE')).replace(/ORDER BY .*$/s, '').trim()

describe('questions list/count filter consistency (no Darjah rows, same filter before pagination)', () => {
  it('listIds: page, total and per-status counts all hide primary-level questions', async () => {
    const { repo, queries } = fakeRepo()
    await repo.listIds({ page: 1, pageSize: 20, status: 'published' })
    expect(queries).toHaveLength(3)
    for (const q of queries) expect(q).toContain(PRIMARY)
    expect(whereOf(queries[0]!)).toBe(whereOf(queries[1]!))
  })

  it('count / groupCount / structured / totals / owner counts hide primary-level questions', async () => {
    const { repo, queries } = fakeRepo()
    await repo.count({ status: 'published' })
    await repo.groupCount('level', { status: 'published' })
    await repo.structuredIds({ page: 1, pageSize: 20 })
    await repo.structuredStats()
    await repo.subjectTotals()
    await repo.ownerStatusCounts('1')
    expect(queries.length).toBeGreaterThanOrEqual(7)
    for (const q of queries) expect(q).toContain(PRIMARY)
  })

  it('qualityBatch (quality audit scan) hides primary-level questions', async () => {
    const { repo, queries } = fakeRepo()
    await repo.qualityBatch(undefined, 50)
    await repo.qualityBatch('10', 50)
    expect(queries).toHaveLength(2)
    for (const q of queries) expect(q).toContain(PRIMARY)
  })

  it('listOwn: rows and total use one filter', async () => {
    const { repo, queries } = fakeRepo()
    const page = await repo.listOwn({ ownerId: '5', page: 1, pageSize: 20 })
    expect(page.total).toBe(0)
    const [a, b] = queries // the page query and the count query (any later query is the hydrate step)
    expect(a).toBeDefined()
    expect(b).toBeDefined()
    expect(a).toContain(PRIMARY)
    expect(b).toContain(PRIMARY)
    expect(whereOf(a!)).toBe(whereOf(b!))
  })
})
