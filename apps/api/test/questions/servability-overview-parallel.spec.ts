import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { QuestionsRepository } from '../../src/modules/questions'
import { ServabilityReadsService } from '../../src/modules/questions/serving'
import { OVERVIEW_PARALLEL } from '../../src/modules/questions/serving/servability-reads.service'
import { bootQuestionsApp, type QuestionsTestApp } from './helpers'

/**
 * B2 cycle 20 Minor on the A4 chain tip (status/B2.md:617, "only 4 reads limited in servability-reads.service.ts:121-133"), read by A4 as: the comment
 * promises "four at a time", but `subjectsListed()` and the paper-lane card ran outside the limiter, so up to six reads could hold pool connections at once.
 * Every read the overview starts now goes through the limiter. The reads are made slow here (each waits before it runs) so that concurrency really builds
 * up; the peak number of reads in flight must be exactly OVERVIEW_PARALLEL (the limiter is full, never exceeded), and the figures must not change.
 */
describe('servability overview: never more than OVERVIEW_PARALLEL reads at once', () => {
  let t: QuestionsTestApp
  let reads: ServabilityReadsService
  let questions: QuestionsRepository

  beforeAll(async () => {
    t = await bootQuestionsApp()
    reads = t.app.get(ServabilityReadsService)
    questions = t.app.get(QuestionsRepository)
  })
  afterAll(async () => {
    vi.restoreAllMocks()
    await t.close()
  })

  const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

  /** Wraps one method: counts it as "in flight" from the call until it settles, and holds it for `holdMs` first so the others overlap with it. */
  function track(probe: { inFlight: number; peak: number; seen: Set<string> }, target: object, name: string, holdMs: number): void {
    const original = (target as Record<string, (...args: unknown[]) => Promise<unknown>>)[name]!.bind(target)
    const spyOn = vi.spyOn as unknown as (object: object, method: string) => { mockImplementation(fn: (...args: unknown[]) => Promise<unknown>): void }
    spyOn(target, name).mockImplementation(async (...args: unknown[]) => {
      probe.inFlight++
      probe.peak = Math.max(probe.peak, probe.inFlight)
      probe.seen.add(name)
      try {
        await sleep(holdMs)
        return await original(...args)
      } finally {
        probe.inFlight--
      }
    })
  }

  it('the peak number of overview reads in flight is OVERVIEW_PARALLEL, and the figures are the same as without the instrumentation', async () => {
    const baseline = await reads.overview()

    const probe = { inFlight: 0, peak: 0, seen: new Set<string>() }
    // The paper evaluation is short (so the paper-lane card starts while the other reads are still running); every other read is long.
    const internal = reads as unknown as Record<string, unknown>
    track(probe, internal, 'evaluatePublishedPaperQuestions', 5)
    for (const name of ['spmDraw', 'janaEligible', 'databankLaneTotal', 'subjectsListed', 'paperLaneCard']) track(probe, internal, name, 60)
    track(probe, questions, 'groupCount', 60)
    track(probe, questions, 'count', 60)

    const instrumented = await reads.overview()

    // all nine reads of the overview ran through the probe (so none escaped the count)
    expect([...probe.seen].sort()).toEqual(['count', 'databankLaneTotal', 'evaluatePublishedPaperQuestions', 'groupCount', 'janaEligible', 'paperLaneCard', 'spmDraw', 'subjectsListed'])
    expect(probe.inFlight).toBe(0)
    expect(probe.peak).toBe(OVERVIEW_PARALLEL)
    expect(instrumented).toEqual(baseline)
  })
})
