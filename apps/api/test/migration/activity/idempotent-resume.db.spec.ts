/**
 * Idempotence, dry-run safety and checkpoint resume of `migrate:activity` (card AC6) against a real PostgreSQL on
 * the BE-35 synthetic fixture. Two private databases are booted the same way (staging, seeds, BE-28 apply):
 *   A  dry-run writes nothing outside etl_*; apply; apply again gives the same content hash and changes nothing;
 *   B  an apply that fails after batch N, then a resume, ends with the same content as A's uninterrupted apply.
 * The content hash (helpers.contentHashes) covers every table with `(legacy_source, legacy_id)` that the run
 * changed, so it follows whatever steps Parts A and B register; ids, foreign keys and timestamps are excluded.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { AnyEntityStep } from '../../../src/migration/kit/runner'
import { bootActivity, type ActivityHarness } from './helpers'

let a: ActivityHarness
let b: ActivityHarness
let baseA: Record<string, string>
let baseB: Record<string, string>
let finalA: Record<string, string>
let failEntity = ''
let firstApplyRunId = ''
const ownRuns = () => `mode = 'apply' and entity_set @> array['${failEntity}']::text[]`

const changed = (base: Record<string, string>, now: Record<string, string>): Record<string, string> =>
  Object.fromEntries(Object.entries(now).filter(([t, v]) => base[t] !== v))

beforeAll(async () => {
  a = await bootActivity()
  b = await bootActivity()
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
    let thrown = 0
    const failOnce = (steps: AnyEntityStep[]): AnyEntityStep[] =>
      steps.map((s) =>
        s.entity !== failEntity
          ? s
          : {
              ...s,
              async load(rows: unknown[], ctx: Parameters<AnyEntityStep['load']>[1]) {
                if (ctx.batch === 2 && thrown === 0) {
                  thrown++
                  throw new Error('injected failure after batch 1')
                }
                return s.load(rows, ctx)
              },
            },
      )
    await expect(b.run('apply', { transformSteps: failOnce })).rejects.toThrow('injected failure after batch 1')
    expect(thrown).toBe(1)
    expect(await b.count('etl_runs', `${ownRuns()} and status = 'failed'`)).toBe(1)
    const checkpoint = await b.q<{ batch: number }>(`select batch from etl_checkpoints where entity = $1`, [failEntity])
    expect(checkpoint).toEqual([{ batch: 1 }])
    // Not equal to the final state yet: the interrupted run stopped part-way.
    expect(await b.contentHashes()).not.toEqual(finalA)

    const resumed = await b.run('apply')
    expect(resumed.report.status).toBe('succeeded')
    expect(resumed.report.resumedBatches).toBeGreaterThanOrEqual(1)
    expect(await b.count('etl_runs', ownRuns())).toBe(1) // the same run row was continued
    const finalB = await b.contentHashes()
    expect(changed(baseB, finalB)).toEqual(changed(baseA, finalA))
    expect(await b.count('etl_rejects', `run_id = ${resumed.report.runId}`)).toBe(await a.count('etl_rejects', `run_id = ${firstApplyRunId}`))
  }, 180_000)
})
