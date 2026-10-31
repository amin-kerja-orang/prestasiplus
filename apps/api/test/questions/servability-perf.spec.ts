import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { describeQuestion } from '@pp/exam-core'

import { QuestionsBijakPoolSource } from '../../src/modules/questions/bijak-pool'
import { ServabilityReadsService, ServabilityService } from '../../src/modules/questions/serving'
import { bulkMcqs } from '../helpers/bulk-bank'
import { tagOf, type Tag } from './fixtures'
import { bootQuestionsApp, loginAs, type Client, type QuestionsTestApp } from './helpers'

/**
 * R1-T30 scale check (D92): the servability reads on a generated bank of N approved questions in ONE subject (default 5,000; set
 * `SERVABILITY_PERF_N`, for example 400000, to measure the size of the V2 bank). Half of the rows carry a DSKP unit, so the Jana
 * count has real work. Timings are printed to stderr; the budgets are generous so the spec only fails on a real regression (a read
 * that scales with the bank per question).
 */
describe('servability reads on a large single-subject bank (R1-T30)', () => {
  const N = Number(process.env.SERVABILITY_PERF_N ?? 5000)
  const BATCH = 100_000
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
    process.env.THROTTLE_SERVABILITY_OVERVIEW_PER_MINUTE = '1000'
    t = await bootQuestionsApp()
    admin = await loginAs(t, 'admin')
    servability = t.app.get(ServabilityService)
    tag = await tagOf(t.db, 'SEED-MCQ-MATH-T4')
    await t.db.query(`insert into spm_subject_configs (subject_id, grp, display_order, databank_order) values ($1, 'teras', 1, 3) on conflict do nothing`, [tag.subjectId])
    ids = []
    for (let done = 0, i = 0; done < N; done += BATCH, i += 1) {
      ids.push(...(await bulkMcqs(t.db, { count: Math.min(BATCH, N - done), subjectId: tag.subjectId, levelId: tag.levelId, label: `PERF-SERV${String(i)}`, poolEvery: 2 })))
    }
    // Half of the rows carry the DSKP unit (Jana-eligible); the rest stay untagged legacy-like rows.
    await t.db.query(`UPDATE question_versions SET unit_node_id = $1 WHERE number_label LIKE 'PERF-SERV%' AND question_id % 2 = 0`, [tag.unitId])
    // A bulk insert leaves the planner statistics empty (it then drives a per-id read from the versions); autovacuum does this in production.
    await t.db.query('ANALYZE')
  }, 3_600_000)
  afterAll(async () => {
    process.stderr.write(`[servability perf] bank of ${String(N)} in one subject (SERVABILITY_PERF_N=${String(N)})\n  ${timings.join('\n  ')}\n`)
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
    expect(o.ms).toBeLessThan(60_000)
    const again = await timed('overview, second call (HTTP)', () => admin.get('/api/admin/servability/overview'))
    expect(again.value.body.data).toEqual(o.value.body.data)
    const jana = o.value.body.data.activities.find((a: { activity: string }) => a.activity === 'jana_kertas')
    expect(jana.served).toBeGreaterThan(0)
    expect(jana.served).toBeLessThan(jana.total)
    const lane = await timed('databank lane, page of 25 (HTTP)', () => admin.get('/api/admin/servability/lanes/databank?pageSize=25'))
    expect(lane.value.status).toBe(200)
    expect(lane.value.body.data).toHaveLength(25)
    expect(lane.value.body.meta.totalItems).toBeGreaterThanOrEqual(N)
    expect(lane.ms).toBeLessThan(30_000)
    const search = await timed('databank lane, search (HTTP)', () => admin.get('/api/admin/servability/lanes/databank?pageSize=25&search=nombor%20123'))
    expect(search.value.status).toBe(200)
    const deep = await timed('databank lane, last allowed page (HTTP)', () => admin.get('/api/admin/servability/lanes/databank?pageSize=100&page=100'))
    expect(deep.value.status).toBe(200)
  })

  it.runIf(N <= 20_000)('the Jana count: one SQL statement against the pool read it replaces (same number)', async () => {
    const reads = t.app.get(ServabilityReadsService) as unknown as { janaEligible(): Promise<number> }
    const sql = await timed('Jana eligible count (SQL)', () => reads.janaEligible())
    const pool = t.app.get(QuestionsBijakPoolSource)
    const legacy = await timed('Jana eligible count (legacy: load the whole subject, describeQuestion)', async () => {
      let n = 0
      const subjects = await t.db.query<{ id: string }>(`SELECT DISTINCT v.subject_id::text id FROM questions q JOIN question_versions v ON v.question_id = q.id AND v.version_no = q.live_version_no WHERE q.is_active AND v.status = 'approved' AND v.subject_id IS NOT NULL`)
      for (const s of subjects) for (const facts of await pool.candidatesOf(s.id)) if (describeQuestion(facts).reasons.length === 0) n++
      return n
    })
    expect(sql.value).toBe(legacy.value)
    expect(sql.ms).toBeLessThan(legacy.ms)
  })

  it('the SQL scope stays an index read: counting the Latih Tubi scope does not read per question', async () => {
    const { ms } = await timed('SQL count of the latih_tubi_spm scope', () =>
      t.db.query(`select count(*) from questions q join question_versions v on v.question_id = q.id and v.version_no = q.live_version_no where q.is_active and v.status = 'approved' and v.subject_id = $1`, [tag.subjectId]),
    )
    expect(ms).toBeLessThan(5_000)
  })
})
