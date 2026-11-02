import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { QuestionsRepository } from '../../src/modules/questions'
import { ServabilityReadsService } from '../../src/modules/questions/serving'
import { bootQuestionsApp, type QuestionsTestApp } from './helpers'

/**
 * REQ-B-022(a): the overview's independent counts (bank, SPM draw, Databank total, Bijak SPM card, Bab, Kuiz, papers, Jana) run
 * together, so the overview waits for the slowest, not the sum. Measured by wrapping every count with a tracker of how many are in
 * flight at once; the answer must not change.
 */
describe('overview counts run concurrently (REQ-B-022a)', () => {
  let t: QuestionsTestApp
  let reads: ServabilityReadsService
  let repo: QuestionsRepository

  beforeAll(async () => {
    t = await bootQuestionsApp()
    reads = t.app.get(ServabilityReadsService)
    repo = t.app.get(QuestionsRepository)
  })
  afterAll(async () => {
    vi.restoreAllMocks()
    await t.close()
  })

  it('at least four counts are in flight at once, and the answer equals the sequential one', async () => {
    const baseline = await reads.overview()
    let inflight = 0
    let peak = 0
    const track =
      <A extends unknown[], R>(fn: (...a: A) => Promise<R>) =>
      async (...a: A): Promise<R> => {
        inflight += 1
        peak = Math.max(peak, inflight)
        try {
          await new Promise((r) => setTimeout(r, 40)) // long enough for the others to start
          return await fn(...a)
        } finally {
          inflight -= 1
        }
      }
    const count = repo.count.bind(repo)
    const groupCount = repo.groupCount.bind(repo)
    vi.spyOn(repo, 'count').mockImplementation(track(count))
    vi.spyOn(repo, 'groupCount').mockImplementation(track(groupCount))
    const priv = reads as unknown as Record<string, (...a: unknown[]) => Promise<unknown>>
    for (const name of ['spmDraw', 'databankLaneTotal', 'paperLaneCard', 'questionsOnPublishedPapers', 'janaEligible', 'subjectsListed']) {
      const original = priv[name]!.bind(reads)
      priv[name] = track(original)
    }
    const again = await reads.overview()
    expect(peak, 'counts in flight at once').toBeGreaterThanOrEqual(4)
    expect(again).toEqual(baseline)
  })
})
