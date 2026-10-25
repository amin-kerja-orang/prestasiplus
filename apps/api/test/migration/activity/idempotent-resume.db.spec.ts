/**
 * Idempotence, dry-run safety and checkpoint resume of `migrate:activity` (card AC6) against a real PostgreSQL on
 * the BE-35 synthetic fixture. Two private databases are booted the same way (staging, seeds, BE-28 apply):
 *   A  dry-run writes nothing outside etl_*; apply; apply again gives the same content hash and changes nothing;
 *   B  an apply that fails after batch N, then a resume, ends with the same content as A's uninterrupted apply.
 * The resumed run must also REPORT the same as the uninterrupted one: the wallet / ledger / streak drift ids and the
 * `mode_rejected.*`, `tier_unmapped` and `rejected_amount` counters are in memory, so they are rebuilt after a resume.
 * The content hash (helpers.contentHashes) covers every table with `(legacy_source, legacy_id)` that the run
 * changed, so it follows whatever steps Parts A and B register; ids, foreign keys and timestamps are excluded.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { AnyEntityStep } from '../../../src/migration/kit/runner'
import type { ActivityContext } from '../../../src/migration/load/activity'
import { bootActivity, type ActivityHarness } from './helpers'

let a: ActivityHarness
let b: ActivityHarness
let baseA: Record<string, string>
let baseB: Record<string, string>
let finalA: Record<string, string>
let failEntity = ''
let firstApplyRunId = ''
let firstActivity: ActivityContext | undefined
const ownRuns = () => `mode = 'apply' and entity_set @> array['${failEntity}']::text[]`

/** Counters the rebuild after a resume must reproduce, and every drift kind with its ids (sorted). */
const REBUILT_NOTES = /^(practice_sessions\.mode_rejected\.|exam_attempts\.(?:status_rejected|excluded)\.|wallets\.tier_unmapped$|coin_ledger\.rejected_amount$)/
const reportOf = (ctx: ActivityContext) => ({
  notes: Object.fromEntries([...ctx.notes.counters].filter(([k]) => REBUILT_NOTES.test(k)).sort(([x], [y]) => (x < y ? -1 : 1))),
  drift: ctx.drift.lines().map((l) => (l.startsWith('drift ids ') ? l.split(': ')[0] + ': ' + (l.split(': ')[1] ?? '').split(',').sort().join(',') : l)),
})

/** Plants rows that make the drift and the mode counters non-empty (same rows in both databases; fictitious values). */
async function plantReportRows(h: ActivityHarness): Promise<void> {
  await h.q(
    `insert into staging_cloud.practice_sessions (id, user_id, subject_id, mode, paper, client_uuid, total_questions, correct, accuracy, duration_seconds, syiling_earned, started_at, created_at)
     select 9000 + v.n, (select user_id from staging_cloud.student_wallets order by id limit 1), 1, v.m, 'paper1', null, 5, 1, 20, 60, 0, '2026-05-31T05:00:00Z', '2026-05-31T05:00:00Z'
     from (values (1, 'spm'), (2, 'battle'), (3, 'misteri')) as v(n, m)`,
  )
  // Two exam attempts still in progress (slug in_progress is a documented exclusion, counted by name, not a reject). With the fixture's attempt 1 they
  // make two batches (size 2): the first holds one of them, so the resume has to rebuild the count.
  // The second one has a differently written slug (` In-Progress `): the step excludes it through `enumKey`, so the rebuilt note must too.
  await h.q(`insert into staging_cloud.attempt_statuses (id, slug) values (8, ' In-Progress ')`)
  await h.q(
    `insert into staging_cloud.exam_attempts (id, user_id, exam_paper_id, mode, status_id, score, max_score, created_at, updated_at)
     select 9500 + v.n, (select user_id from staging_cloud.student_wallets order by id limit 1), 1, 'exam', case when v.n = 1 then 1 else 8 end, null, null, '2026-05-31T05:00:00Z', '2026-05-31T05:00:00Z'
     from (values (1), (2)) as v(n)`,
  )
  await h.q(
    `insert into staging_cloud.coin_transactions (id, user_id, type, source, amount, balance_after, created_at)
     select 9001, user_id, 'earn', 'practice', 7, 12345, '2026-05-03T01:00:00Z' from staging_cloud.student_wallets order by id limit 1`,
  )
}

const changed = (base: Record<string, string>, now: Record<string, string>): Record<string, string> =>
  Object.fromEntries(Object.entries(now).filter(([t, v]) => base[t] !== v))

beforeAll(async () => {
  a = await bootActivity()
  b = await bootActivity()
  await plantReportRows(a)
  await plantReportRows(b)
  baseA = await a.contentHashes()
  baseB = await b.contentHashes()
}, 300_000)
afterAll(async () => {
  await a?.close()
  await b?.close()
})

describe('dry-run (AC6)', () => {
  it('writes nothing outside etl_* and records its run and reconciliation', async () => {
    const mapBefore = await a.count('etl_id_map')
    const { report } = await a.run('dry-run')
    expect(report.status).toBe('succeeded')
    for (const r of report.recon) expect(r.eligibleCount - r.loaded - r.rejected, r.entity).toBe(0)
    expect(await a.contentHashes()).toEqual(baseA)
    expect(await a.count('etl_id_map')).toBe(mapBefore)
    expect(await a.count('etl_recon', `run_id = ${report.runId}`)).toBe(report.recon.length)
    // The entity that is long enough to be interrupted in the resume test (at least two batches).
    failEntity = Object.entries(report.counters).find(([, c]) => c.batches >= 2)?.[0] ?? ''
    expect(failEntity, 'the fixture must give one step at least two batches (batch size 2)').not.toBe('')
  }, 120_000)
})

describe('apply twice (AC6)', () => {
  it('loads once, and a second apply repeats nothing and keeps the same content hash', async () => {
    const first = await a.run('apply')
    expect(first.report.status).toBe('succeeded')
    firstApplyRunId = first.report.runId
    firstActivity = first.activity
    finalA = await a.contentHashes()
    const diff = changed(baseA, finalA)
    expect(Object.keys(diff).length, 'the run changed at least one table').toBeGreaterThan(0)
    expect(Object.keys(diff)).toContain('act_probe')

    const second = await a.run('apply')
    expect(second.report.status).toBe('succeeded')
    expect(second.report.runId).not.toBe(first.report.runId)
    expect(await a.contentHashes()).toEqual(finalA)
    for (const [entity, c] of Object.entries(second.report.counters)) {
      expect(c.inserted, `${entity} inserted`).toBe(0)
      expect(c.updated, `${entity} updated`).toBe(0)
    }
    for (const r of second.report.recon) {
      expect(r.status, r.entity).toBe('ok')
      const was = first.report.recon.find((x) => x.entity === r.entity)
      expect(r.loaded, r.entity).toBe(was?.loaded)
      expect(r.rejected, r.entity).toBe(was?.rejected)
    }
  }, 120_000)
})

describe('checkpoint resume (AC6)', () => {
  it('a failure after batch 1 rolls batch 2 back; the resume continues at batch 2 and ends equal to the uninterrupted run', async () => {
    expect((await b.run('dry-run')).report.status).toBe('succeeded')
    // One failure at batch 2 in each of these steps (in run order), so the report of the final resume has to be rebuilt.
    const targets = new Set([failEntity, 'wallet_ledger_drift', 'practice_sessions', 'exam_attempts'])
    const failed: string[] = []
    const failOnce = (steps: AnyEntityStep[]): AnyEntityStep[] =>
      steps.map((s) =>
        !targets.has(s.entity)
          ? s
          : {
              ...s,
              async load(rows: unknown[], ctx: Parameters<AnyEntityStep['load']>[1]) {
                if (ctx.batch === 2 && !failed.includes(s.entity)) {
                  failed.push(s.entity)
                  throw new Error('injected failure after batch 1')
                }
                return s.load(rows, ctx)
              },
            },
      )
    await expect(b.run('apply', { transformSteps: failOnce })).rejects.toThrow('injected failure after batch 1')
    expect(failed.length).toBe(1)
    expect(await b.count('etl_runs', `${ownRuns()} and status = 'failed'`)).toBe(1)
    const checkpoint = await b.q<{ batch: number }>(`select batch from etl_checkpoints where entity = $1`, [failed[0]])
    expect(checkpoint).toEqual([{ batch: 1 }])
    // Not equal to the final state yet: the interrupted run stopped part-way.
    expect(await b.contentHashes()).not.toEqual(finalA)

    let resumed = await b.run('apply', { transformSteps: failOnce }).catch(() => null)
    while (resumed === null && failed.length < targets.size) resumed = await b.run('apply', { transformSteps: failOnce }).catch(() => null)
    resumed ??= await b.run('apply')
    expect(failed.length).toBe(targets.size)
    expect(resumed.report.status).toBe('succeeded')
    expect(resumed.report.resumedBatches).toBeGreaterThanOrEqual(1)
    expect(await b.count('etl_runs', ownRuns())).toBe(1) // the same run row was continued
    const finalB = await b.contentHashes()
    expect(changed(baseB, finalB)).toEqual(changed(baseA, finalA))
    expect(await b.count('etl_rejects', `run_id = ${resumed.report.runId}`)).toBe(await a.count('etl_rejects', `run_id = ${firstApplyRunId}`))

    // The report equals the uninterrupted run's: drift ids and the mode / ledger / tier counters over the full set.
    const want = reportOf(firstActivity as ActivityContext)
    expect(firstActivity?.drift.idsOf('wallet_ledger_mismatch').length, 'the planted ledger row must make a wallet drift').toBeGreaterThan(0)
    expect(Object.keys(want.notes).some((k) => k.startsWith('practice_sessions.mode_rejected.')), 'the planted modes must be rejected').toBe(true)
    expect(want.notes['exam_attempts.excluded.in_progress'], 'the planted attempts must be counted by name').toBe(2)
    expect(reportOf(resumed.activity)).toEqual(want)
  }, 240_000)
})
