import { ServabilityOverviewSchema, type ServabilityOverview } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it, vi, type MockInstance } from 'vitest'

import { OVERVIEW_SETTLE_MS, OVERVIEW_TTL_MS } from '../../src/modules/questions/serving/overview-cache'
import { QuestionsService } from '../../src/modules/questions'
import { ServabilityReadsService } from '../../src/modules/questions/serving'
import { adminActor, mcqInput, tagBody, tagOf, type Tag } from './fixtures'
import { bootQuestionsApp, loginAs, parseData, type Client, type QuestionsTestApp } from './helpers'

/**
 * H-A21: the cached servability overview over HTTP. `computedAt`; a warm hit does not compute; a question event (approve, archive,
 * Terbit, Tarik balik) and a paper publish or withdraw mark it stale so the next refresh shows the change; the TTL expires; the stale
 * value is served while it refreshes (never a blocked request); a warm read is far under the 500 ms target.
 */
describe('servability overview cache (H-A21)', () => {
  let t: QuestionsTestApp
  let svc: QuestionsService
  let admin: Client
  let spy: MockInstance
  let tag: Tag
  let actor: Awaited<ReturnType<typeof adminActor>>
  let n = 0

  const read = async (): Promise<ServabilityOverview> => {
    const res = await admin.get('/api/admin/servability/overview')
    const data = parseData(res, ServabilityOverviewSchema)
    expect(data.computedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?\+08:00$/)
    return data as ServabilityOverview
  }
  const until = async (cond: () => boolean): Promise<void> => {
    for (let i = 0; i < 400 && !cond(); i++) await new Promise((r) => setTimeout(r, 25))
    expect(cond()).toBe(true)
  }
  /** After a change: let the settle window pass, read (the stale value is served), wait for the refresh, read again. */
  async function afterChange(): Promise<ServabilityOverview> {
    t.clock.advance(OVERVIEW_SETTLE_MS + 1000)
    const before = spy.mock.calls.length
    await read() // stale served, refresh started
    await until(() => spy.mock.calls.length === before + 1)
    await new Promise((r) => setTimeout(r, 300)) // the refresh has finished computing and stored
    return read()
  }
  async function newQuestion(): Promise<string> {
    const created = await svc.create(mcqInput(tag, { questionText: `Soalan penyegar hub nombor ${String(++n)} untuk ujian cache.`, tag: tagBody(tag, 4) }), actor)
    return created.id
  }
  const bankOf = async () => (await read()).bank

  beforeAll(async () => {
    process.env.THROTTLE_SERVABILITY_OVERVIEW_PER_MINUTE = '100000'
    t = await bootQuestionsApp()
    svc = t.app.get(QuestionsService)
    admin = await loginAs(t, 'admin')
    tag = await tagOf(t.db, 'SEED-MCQ-MATH-T4')
    actor = await adminActor(t.db)
    spy = vi.spyOn(t.app.get(ServabilityReadsService), 'overview')
  })
  afterAll(async () => {
    delete process.env.THROTTLE_SERVABILITY_OVERVIEW_PER_MINUTE
    await t.close()
  })

  it('the first read computes once and says when (computedAt = the compute time, MYT)', async () => {
    const first = await read()
    expect(spy).toHaveBeenCalledTimes(1)
    expect(first.computedAt).toBe('2026-10-19T09:00:00.000+08:00')
    expect(first.activities).toHaveLength(6)
  })

  it('warm reads are served from the cache: no compute, same computedAt, p95 well under 500 ms', async () => {
    const base = spy.mock.calls.length
    const first = await read()
    const times: number[] = []
    for (let i = 0; i < 40; i++) {
      const t0 = performance.now()
      const again = await read()
      times.push(performance.now() - t0)
      expect(again.computedAt).toBe(first.computedAt)
    }
    expect(spy.mock.calls.length).toBe(base)
    times.sort((a, b) => a - b)
    const p95 = times[Math.floor(times.length * 0.95) - 1] as number
    process.stderr.write(`[overview cache] warm p95 ${p95.toFixed(1)} ms over ${String(times.length)} reads\n`)
    expect(p95).toBeLessThan(500)
  })

  it('approve (Terbit): the next refresh shows the new question', async () => {
    const before = await bankOf()
    const id = await newQuestion()
    await svc.setStatus(id, 'review', actor.userId)
    await svc.setStatus(id, 'approved', actor.userId)
    const after = await afterChange()
    expect(after.bank).toBe(before + 1)
  })

  it('archive (Tarik balik): the next refresh drops it', async () => {
    const id = await newQuestion()
    await svc.setStatus(id, 'review', actor.userId)
    await svc.setStatus(id, 'approved', actor.userId)
    const mid = await afterChange()
    await svc.setStatus(id, 'archived', actor.userId)
    const after = await afterChange()
    expect(after.bank).toBe(mid.bank - 1)
  })

  it('deactivate and reactivate follow the same way', async () => {
    const id = await newQuestion()
    await svc.setStatus(id, 'review', actor.userId)
    await svc.setStatus(id, 'approved', actor.userId)
    const mid = await afterChange()
    await svc.deactivate(id)
    expect((await afterChange()).bank).toBe(mid.bank - 1)
    await svc.reactivate(id)
    expect((await afterChange()).bank).toBe(mid.bank)
  })

  it('a paper publish and a paper withdraw (no hook in the builder) are caught by the papers fingerprint', async () => {
    const id = await newQuestion()
    await svc.setStatus(id, 'review', actor.userId)
    await svc.setStatus(id, 'approved', actor.userId)
    await afterChange()
    const paper = await t.db.prisma.paper.create({
      data: {
        kind: 'pilihan',
        title: 'Kertas hub cache',
        subjectId: BigInt(tag.subjectId),
        kertas: 2,
        printedDurationMin: 60,
        status: 'draft',
        sections: { create: [{ position: 1, label: 'A', questionCount: 1, markBudget: 1, placements: { create: [{ questionId: BigInt(id), position: 1, pinnedVersionNo: 1 }] } }] },
      },
    })
    const paperTotal = (o: ServabilityOverview) => o.activities.find((a) => a.activity === 'simulasi_paper')!.total
    const draft = await afterChange()
    await t.db.query(`update papers set status = 'published', published_at = now(), updated_at = now() where id = $1`, [paper.id.toString()])
    const published = await afterChange()
    expect(paperTotal(published)).toBe(paperTotal(draft) + 1)
    await t.db.query(`update papers set status = 'withdrawn', published_at = null, updated_at = now() where id = $1`, [paper.id.toString()])
    expect(paperTotal(await afterChange())).toBe(paperTotal(draft))
  })

  it('TTL: past five minutes the stale value is served at once and ONE refresh runs, however many readers arrive', async () => {
    const warm = await read() // a fresh entry from the previous test
    const base = spy.mock.calls.length
    t.clock.advance(OVERVIEW_TTL_MS + 1000)
    const stale = await read()
    expect(stale.computedAt).toBe(warm.computedAt) // the stale value is served at once, not a blocked request
    const out = await Promise.all(Array.from({ length: 8 }, () => read()))
    expect(out.length).toBe(8)
    await until(() => spy.mock.calls.length === base + 1)
    await new Promise((r) => setTimeout(r, 300))
    expect(spy.mock.calls.length).toBe(base + 1) // single flight: nine readers, one refresh
    const fresh = await read()
    expect(fresh.computedAt).not.toBe(warm.computedAt)
    expect(spy.mock.calls.length).toBe(base + 1) // and the new entry is warm
  })
})
