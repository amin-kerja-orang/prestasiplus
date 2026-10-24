/**
 * Rollback then re-apply (review item): an apply that fails part-way leaves a failed run with checkpoints; the rollback
 * deletes the loaded rows, so a resume of that run would skip batches that no longer exist. The rollback therefore closes
 * the unfinished run (`rolled-back:` input hash) and deletes its checkpoints; the next `migrate:all --apply` starts from scratch and
 * ends with the same counts and a green reconciliation as an uninterrupted load.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { AnyEntityStep } from '../../../src/migration/kit/runner'
import { runCore } from '../../../src/migration/load'
import { ACTIVITY_GROUPS } from '../../../src/migration/load/activity'
import { runAll } from '../../../src/migration/orchestrate'
import { rollbackLegacy } from '../../../src/migration/verify'
import { AS_OF, type ActivityHarness } from '../activity/helpers'
import { testOutDir } from '../staging/helpers'
import { bootActivity, legacyTableCounts, migrateAll, PROBE_GROUP, tempOutDir } from './helpers-verify'

let h: ActivityHarness
let clean: Record<string, number> = {}
let failedRun = ''
const out = tempOutDir()

const rollback = () =>
  rollbackLegacy({ pool: h.env.pool, env: { ...h.runEnv, PP_ALLOW_MIGRATE_ROLLBACK: '1', PP_MIGRATE_TARGET_DB: h.env.db.name }, source: 'cloud', confirmDb: h.env.db.name })

beforeAll(async () => {
  h = await bootActivity({ core: false })
  // `runAll` runs the registry: leave the test probe out so the run holds exactly the production entities.
  const probe = ACTIVITY_GROUPS.indexOf(PROBE_GROUP)
  if (probe >= 0) ACTIVITY_GROUPS.splice(probe, 1)
  // Baseline: an uninterrupted load, then back to the empty state.
  await migrateAll(h)
  clean = await legacyTableCounts(h)
  await rollback()
}, 300_000)
afterAll(async () => {
  out.cleanup()
  await h?.close()
})

describe('rollback after an interrupted apply', () => {
  it('closes the failed run and deletes its checkpoints', async () => {
    const base = { pool: h.env.pool, env: h.runEnv, source: 'cloud' as const, asOf: AS_OF, batchSize: 2, outDir: testOutDir() }
    for (const mode of ['dry-run', 'apply'] as const) expect((await runCore({ ...base, mode })).report.status).toBe('succeeded')
    const dry = await h.run('dry-run')
    expect(dry.report.status).toBe('succeeded')
    const entity = Object.entries(dry.report.counters).find(([, c]) => c.batches >= 2)?.[0] ?? ''
    expect(entity, 'the fixture must give a step of at least two batches').not.toBe('')

    const failAtBatch2 = (steps: AnyEntityStep[]): AnyEntityStep[] =>
      steps.map((s) =>
        s.entity !== entity
          ? s
          : {
              ...s,
              async load(rows: unknown[], ctx: Parameters<AnyEntityStep['load']>[1]) {
                if (ctx.batch === 2) throw new Error('injected failure after batch 1')
                return s.load(rows, ctx)
              },
            },
      )
    await expect(h.run('apply', { transformSteps: failAtBatch2 })).rejects.toThrow('injected failure after batch 1')
    const failed = await h.q<{ id: string }>(`select id::text as id from etl_runs where mode = 'apply' and status = 'failed' and entity_set @> array['${entity}']::text[]`)
    expect(failed).toHaveLength(1)
    failedRun = failed[0]?.id as string
    expect(await h.count('etl_checkpoints', `run_id = ${failedRun}`)).toBeGreaterThan(0)

    const report = await rollback()
    expect(report.warnings?.some((w) => /resume/i.test(w))).toBe(false)
    const closed = await h.q<{ status: string; input_hash: string }>(`select status, input_hash from etl_runs where id = ${failedRun}`)
    expect(closed[0]?.status).toBe('failed')
    expect(closed[0]?.input_hash).toMatch(/^rolled-back:[0-9a-f]{64}$/)
    expect(await h.count('etl_checkpoints', `run_id = ${failedRun}`)).toBe(0)
    // The audit trail stays: the run, its reconciliation rows and its rejects are still there.
    expect(await h.count('etl_runs', `id = ${failedRun}`)).toBe(1)
    expect(await legacyTableCounts(h)).toEqual(Object.fromEntries(Object.keys(clean).map((t) => [t, expect.any(Number)])))
  }, 120_000)

  it('migrate:all --apply starts from scratch: same counts, green reconciliation', async () => {
    const result = await runAll({ pool: h.env.pool, env: h.runEnv, mode: 'apply', asOf: AS_OF, batchSize: 2, outDir: out.path })
    expect(result.stages.map((s) => [s.name, s.mode, s.status])).toEqual([
      ['core', 'dry-run', 'succeeded'], ['core', 'apply', 'succeeded'],
      ['activity', 'dry-run', 'succeeded'], ['activity', 'apply', 'succeeded'],
      ['verify', 'verify', 'succeeded'],
    ])
    expect(result.status).toBe('succeeded')
    expect(result.verify?.status).toBe('pass')
    expect(await legacyTableCounts(h)).toEqual(clean)
    // The closed run was not reopened.
    expect(await h.q(`select status from etl_runs where id = ${failedRun}`)).toEqual([{ status: 'failed' }])
    expect(await h.count('etl_checkpoints', `run_id = ${failedRun}`)).toBe(0)
  }, 180_000)
})
