import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { ServabilityService } from '../../src/modules/questions/serving'
import { bulkMcqs } from '../helpers/bulk-bank'
import { tagOf, type Tag } from './fixtures'
import { bootQuestionsApp, loginAs, type Client, type QuestionsTestApp } from './helpers'

/**
 * R1-T30 scale check (D92): the servability reads on a generated bank of 5,000 approved questions in ONE subject (the worst case
 * of the subject-wide Jana pool read). Timings are printed to stderr; the budgets are generous so the spec only fails on a
 * real regression (a read that scales with the bank per question).
 */
describe('servability reads on a 5,000-question subject (R1-T30)', () => {
  const N = 5000
  let t: QuestionsTestApp
  let admin: Client
  let servability: ServabilityService
  let tag: Tag
  let ids: string[]
  const timings: string[] = []

  async function timed<T>(label: string, fn: () => Promise<T>): Promise<{ value: T; ms: number }> {
    const t0 = performance.now()
    const value = await fn()
    const ms = performance.now() - t0
    timings.push(`${label}: ${ms.toFixed(0)} ms`)
    return { value, ms }
  }

  beforeAll(async () => {
    t = await bootQuestionsApp()
    admin = await loginAs(t, 'admin')
    servability = t.app.get(ServabilityService)
    tag = await tagOf(t.db, 'SEED-MCQ-MATH-T4')
    await t.db.query(`insert into spm_subject_configs (subject_id, grp, display_order, databank_order) values ($1, 'teras', 1, 3) on conflict do nothing`, [tag.subjectId])
    ids = await bulkMcqs(t.db, { count: N, subjectId: tag.subjectId, levelId: tag.levelId, label: 'PERF-SERV', poolEvery: 2 })
    // A bulk insert leaves the planner statistics empty (it then drives a per-id read from the 5,000 versions); autovacuum does this in production.
    await t.db.query('ANALYZE questions, question_versions, question_parts, part_options, answer_keys, question_tags')
  }, 300_000)
  afterAll(async () => {
    process.stderr.write(`[servability perf] bank of ${String(N)} in one subject\n  ${timings.join('\n  ')}\n`)
    await t.close()
  })

  it('has the generated bank', () => {
    expect(ids.length).toBe(N)
  })

  it('one question', async () => {
    const { value, ms } = await timed('single report (service)', () => servability.report(ids[2500] as string))
    expect(value?.activities).toHaveLength(6)
    expect(ms).toBeLessThan(15_000)
    const http = await timed('single report (HTTP)', () => admin.get(`/api/admin/servability/questions/${ids[10]}`))
    expect(http.value.status).toBe(200)
    expect(http.ms).toBeLessThan(15_000)
  })

  it('a batch of 100', async () => {
    const { value, ms } = await timed('batch of 100 (HTTP)', () => admin.post('/api/admin/servability/questions/batch', { ids: ids.slice(0, 100) }))
    expect(value.status).toBe(200)
    expect(value.body.data.reports).toHaveLength(100)
    expect(ms).toBeLessThan(20_000)
  })

  it('overview and the databank lane page', async () => {
    const o = await timed('overview (HTTP)', () => admin.get('/api/admin/servability/overview'))
    expect(o.value.status).toBe(200)
    expect(o.value.body.data.bank).toBeGreaterThanOrEqual(N)
    expect(o.ms).toBeLessThan(30_000)
    const lane = await timed('databank lane, page of 25 (HTTP)', () => admin.get('/api/admin/servability/lanes/databank?pageSize=25'))
    expect(lane.value.status).toBe(200)
    expect(lane.value.body.data).toHaveLength(25)
    expect(lane.value.body.meta.totalItems).toBeGreaterThanOrEqual(N)
    expect(lane.ms).toBeLessThan(30_000)
  })

  it('the SQL scope stays an index read: counting the Latih Tubi scope does not read per question', async () => {
    const { ms } = await timed('SQL count of the latih_tubi_spm scope', () =>
      t.db.query(`select count(*) from questions q join question_versions v on v.question_id = q.id and v.version_no = q.live_version_no where q.is_active and v.status = 'approved' and v.subject_id = $1`, [tag.subjectId]),
    )
    expect(ms).toBeLessThan(5_000)
  })
})
