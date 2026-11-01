import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { QuestionsService } from '../../src/modules/questions'
import { ServabilityReadsService, ServabilityService, evaluate } from '../../src/modules/questions/serving'
import { OverviewCache } from '../../src/modules/questions/serving/overview-cache'
import { OverviewWarmer } from '../../src/modules/questions/serving/overview-warmer'
import { adminActor, mcqInput, tagBody, tagOf, type Tag } from './fixtures'
import { bootQuestionsApp, type QuestionsTestApp } from './helpers'

/**
 * REQ-B-022(a): the overview's cold path. The questions on published papers are evaluated ONCE (the Bijak SPM card and the Simulasi
 * (kertas) row share it), and the numbers are the same as the two separate passes gave.
 */
describe('servability overview: one pass over the questions on published papers (REQ-B-022a)', () => {
  let t: QuestionsTestApp
  let reads: ServabilityReadsService
  let tag: Tag
  const ids: string[] = []
  const q = (sql: string, params: unknown[] = []) => t.db.query<{ id: string }>(sql, params)

  beforeAll(async () => {
    t = await bootQuestionsApp()
    reads = t.app.get(ServabilityReadsService)
    tag = await tagOf(t.db, 'SEED-MCQ-MATH-T4')
    const svc = t.app.get(QuestionsService)
    for (const text of ['Soalan satu kertas terbit.', 'Soalan dua kertas terbit.', 'Soalan tiga kertas terbit.']) {
      const created = await svc.create(mcqInput(tag, { questionText: text, tag: tagBody(tag, 4) }), await adminActor(t.db))
      await q(`update question_versions set status = 'approved', published_at = now() where question_id = $1`, [created.id])
      await q(`update questions set live_version_no = 1 where id = $1`, [created.id])
      ids.push(created.id)
    }
    // Two published papers that share question 1, a draft paper that is not counted, and a withdrawn one.
    const paper = async (title: string, status: string, questionIds: string[]) => {
      const [p] = await q(`insert into papers (kind, title, subject_id, kertas, printed_duration_min, status) values ('pilihan', $1, $2, 2, 90, $3) returning id::text id`, [title, tag.subjectId, status])
      const [s] = await q(`insert into paper_sections (paper_id, position, label, question_count, mark_budget) values ($1, 1, 'A', $2, $2) returning id::text id`, [p!.id, questionIds.length])
      for (const [i, id] of questionIds.entries()) await q(`insert into paper_placements (paper_section_id, question_id, pinned_version_no, position) values ($1, $2, 1, $3)`, [s!.id, id, i + 1])
    }
    await paper('Terbit satu', 'published', [ids[0]!, ids[1]!])
    await paper('Terbit dua', 'published', [ids[0]!, ids[2]!])
    await paper('Draf', 'draft', [ids[2]!])
  })
  afterAll(async () => {
    await t.close()
  })

  it('every question on a published paper is loaded and evaluated exactly once for the whole overview', async () => {
    const spy = vi.spyOn(ServabilityService.prototype, 'factsOf')
    try {
      const overview = await reads.overview()
      const asked = spy.mock.calls.flatMap((c) => [...c[0]])
      // the three distinct questions on the two published papers: once each (before this change: twice, card and activity row)
      expect(asked.filter((id) => ids.includes(id)).sort()).toEqual([...ids].sort())
      const paper = overview.activities.find((a) => a.activity === 'simulasi_paper')!
      expect(paper).toMatchObject({ basis: 'evaluated', total: 3 })
      // the card counts the published papers' rows and the draft: attention only for the published ones
      const card = overview.cards.find((c) => c.lane === 'bijak-spm')!
      expect(card.total).toBe(3)
      expect(card.attention).toBeLessThanOrEqual(2)
    } finally {
      spy.mockRestore()
    }
  })

  it('the shared pass gives the figures the lane and the batch read give (served = no reason)', async () => {
    const overview = await reads.overview()
    const reports = await t.app.get(ServabilityService).reports(ids)
    const served = [...reports.values()].filter((r) => r.activities.find((a) => a.activity === 'simulasi_paper')?.served).length
    expect(overview.activities.find((a) => a.activity === 'simulasi_paper')?.served).toBe(served)
  })

  it('factsOf without the Jana pool facts gives the same Simulasi (kertas) verdict; only the Jana verdict needs them', async () => {
    const svc = t.app.get(ServabilityService)
    const full = await svc.factsOf(ids)
    const lean = await svc.factsOf(ids, { jana: false })
    expect([...lean.keys()].sort()).toEqual([...full.keys()].sort())
    for (const [id, f] of lean) {
      expect(f.janaFacts, id).toBeNull()
      expect(evaluate({ ...f, onPublishedPaper: true }, 'simulasi_paper')).toEqual(evaluate({ ...full.get(id)!, onPublishedPaper: true }, 'simulasi_paper'))
    }
    expect([...full.values()].some((f) => f.janaFacts !== null)).toBe(true)
  })

  it('the cache warmer fills the cache when enabled, stays off by default in tests, and a failure only logs', async () => {
    const compute = vi.fn(async () => 'computed')
    const get = vi.fn((fn: () => Promise<unknown>) => fn().then((value) => ({ value, computedAt: new Date() })))
    const config = (flag: string | undefined, env = 'test') => ({ get: (k: string) => (k === 'SERVABILITY_OVERVIEW_WARM' ? flag : k === 'NODE_ENV' ? env : undefined) })
    const make = (flag: string | undefined, env?: string) =>
      new OverviewWarmer(config(flag, env) as never, { get } as unknown as OverviewCache, { overview: compute } as unknown as ServabilityReadsService)

    make(undefined).onApplicationBootstrap()
    expect(get).not.toHaveBeenCalled()
    make('false', 'production').onApplicationBootstrap()
    expect(get).not.toHaveBeenCalled()
    make('true').onApplicationBootstrap()
    make(undefined, 'production').onApplicationBootstrap()
    await new Promise((r) => setTimeout(r, 10))
    expect(get).toHaveBeenCalledTimes(2)
    expect(compute).toHaveBeenCalledTimes(2)

    const failing = vi.fn(() => Promise.reject(new Error('db down')))
    expect(() => new OverviewWarmer(config('true') as never, { get: failing } as unknown as OverviewCache, {} as ServabilityReadsService).onApplicationBootstrap()).not.toThrow()
    await new Promise((r) => setTimeout(r, 10))
    expect(failing).toHaveBeenCalled()
  })
})
