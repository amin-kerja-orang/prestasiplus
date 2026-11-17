import { afterEach, describe, expect, it } from 'vitest'

import { QuestionsRepository } from '../../src/modules/questions'
import { OverviewRepository } from '../../src/modules/practice/reads/overview/overview.repository'

/**
 * The bank-wide statements share one per-process gate (`BANK_SCAN_CONCURRENCY`, default 3), so a burst of them cannot take
 * every pooled connection and starve the short transactions. A fake database counts how many such statements are in flight.
 */
function slowDb() {
  const state = { inflight: 0, peak: 0, total: 0 }
  const db = {
    $queryRaw() {
      state.inflight++
      state.total++
      state.peak = Math.max(state.peak, state.inflight)
      return new Promise<unknown[]>((resolve) =>
        setTimeout(() => {
          state.inflight--
          resolve([])
        }, 5),
      )
    },
  }
  return { state, prisma: { client: db } as never }
}

const saved = process.env.BANK_SCAN_CONCURRENCY
afterEach(() => {
  if (saved === undefined) delete process.env.BANK_SCAN_CONCURRENCY
  else process.env.BANK_SCAN_CONCURRENCY = saved
})

/** Twelve parallel calls of each bank-wide read. */
const burst = (q: QuestionsRepository, o: OverviewRepository): Promise<unknown>[] => {
  const scope = q.scopeSql({ status: 'approved', active: true }, true)
  return Array.from({ length: 12 }, (_, i) => [
    q.sampleIds({ subjectId: '7' }, 5, i), // phase 1 scan (an empty window ends the draw: no verification statement)
    q.eligibleIdsPage({ subjectId: '7' }, undefined, 50),
    q.unitCountsByLevelTp({ subjectId: '7', status: 'approved', active: true }),
    o.bankMatrix(),
    o.newestIdsOf(scope, 60),
  ]).flat()
}

describe('bank scan gate', () => {
  it('lets at most 3 bank-wide statements run at once by default', async () => {
    delete process.env.BANK_SCAN_CONCURRENCY
    const { state, prisma } = slowDb()
    await Promise.all(burst(new QuestionsRepository(prisma), new OverviewRepository(prisma)))
    expect(state.peak).toBe(3)
    expect(state.total).toBeGreaterThan(60)
  })

  it('BANK_SCAN_CONCURRENCY sets the number of slots', async () => {
    process.env.BANK_SCAN_CONCURRENCY = '1'
    const one = slowDb()
    await Promise.all(burst(new QuestionsRepository(one.prisma), new OverviewRepository(one.prisma)))
    expect(one.state.peak).toBe(1)
    process.env.BANK_SCAN_CONCURRENCY = '5'
    const five = slowDb()
    await Promise.all(burst(new QuestionsRepository(five.prisma), new OverviewRepository(five.prisma)))
    expect(five.state.peak).toBe(5)
  })

  it('statements that are not bank-wide (by-id checks) are not gated', async () => {
    process.env.BANK_SCAN_CONCURRENCY = '1'
    const { state, prisma } = slowDb()
    const q = new QuestionsRepository(prisma)
    await Promise.all(Array.from({ length: 6 }, () => q.eligibleAmong(['1', '2'], { subjectId: '7' })))
    expect(state.peak).toBe(6)
  })
})
