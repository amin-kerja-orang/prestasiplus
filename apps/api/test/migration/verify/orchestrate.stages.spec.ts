/**
 * Stage control of the BE-30 orchestrator (no database; `runCore` and `runActivity` are mocked):
 *   a failed stage stops the later ones (no activity apply, no verify) and the run is `failed` / exit 1;
 *   an `ApplyRefusedError` from a stage exits 3, a preflight error exits 2, a busy run exits 4;
 *   when a later stage throws, the stages that completed were already printed (the core apply committed).
 */
import type pg from 'pg'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { runCli } from '../../../src/migration/cli'
import { ApplyRefusedError, RunInProgressError } from '../../../src/migration/kit'
import { PreflightError } from '../../../src/migration/load/activity'
import { runAll, type StageResult } from '../../../src/migration/orchestrate'
import type { VerifyReport } from '../../../src/migration/verify'
import { capture } from '../staging/helpers'

const mocks = vi.hoisted(() => ({ runCore: vi.fn(), runActivity: vi.fn(), assertCorePreflight: vi.fn(), runVerify: vi.fn(), writeVerifyReport: vi.fn() }))
vi.mock('../../../src/migration/load', async (orig) => ({ ...(await orig<object>()), runCore: mocks.runCore }))
vi.mock('../../../src/migration/load/activity', async (orig) => ({
  ...(await orig<object>()),
  runActivity: mocks.runActivity,
  assertCorePreflight: mocks.assertCorePreflight,
}))
vi.mock('../../../src/migration/verify', () => ({
  runVerify: mocks.runVerify,
  writeVerifyReport: mocks.writeVerifyReport,
  rollbackLegacy: vi.fn(),
}))

// `query` answers the apply guard (current_database) and the source lock (ok); `connect` is the lock's dedicated client.
const answer = async () => ({ rows: [{ db: 'pp_rehearsal', ok: true }], rowCount: 1 })
const fakePool = { query: vi.fn(answer), connect: vi.fn(async () => ({ query: vi.fn(answer), release: vi.fn() })) } as unknown as pg.Pool
const env = { NODE_ENV: 'test', PP_ALLOW_MIGRATE_APPLY: '1' }

let nextRun = 0
const report = (mode: 'dry-run' | 'apply', status: 'succeeded' | 'failed') => ({
  report: {
    runId: String(++nextRun), mode, status, counters: {}, resumedBatches: 0,
    recon: [{ entity: 'e', sourceCount: 1, eligibleCount: 1, loaded: status === 'failed' ? 0 : 1, rejected: 0, expectedDelta: 0, status: status === 'failed' ? 'mismatch' : 'ok' }],
  },
})
const passReport: VerifyReport = { generatedAt: '', source: 'cloud', runIds: [], status: 'pass', entities: [], checks: [] }

beforeEach(() => {
  vi.clearAllMocks()
  nextRun = 0
  mocks.assertCorePreflight.mockResolvedValue(1)
  mocks.runVerify.mockResolvedValue(passReport)
  mocks.writeVerifyReport.mockReturnValue({ json: 'a.json', md: 'a.md' })
})

const options = (mode: 'dry-run' | 'apply') => ({ pool: fakePool, env, asOf: '2026-06-01', mode })
const shape = (stages: readonly StageResult[]) => stages.map((s) => `${s.name}/${s.mode}/${s.status}`)

describe('a failed stage stops the run', () => {
  it('failed core dry-run: nothing else runs', async () => {
    mocks.runCore.mockResolvedValueOnce(report('dry-run', 'failed'))
    const r = await runAll(options('apply'))
    expect(r.status).toBe('failed')
    expect(shape(r.stages)).toEqual(['core/dry-run/failed'])
    expect(mocks.runCore).toHaveBeenCalledTimes(1)
    expect(mocks.runActivity).not.toHaveBeenCalled()
    expect(mocks.runVerify).not.toHaveBeenCalled()
  })

  it('failed core apply: no activity stage, no verify', async () => {
    mocks.runCore.mockResolvedValueOnce(report('dry-run', 'succeeded')).mockResolvedValueOnce(report('apply', 'failed'))
    const r = await runAll(options('apply'))
    expect(r.status).toBe('failed')
    expect(shape(r.stages)).toEqual(['core/dry-run/succeeded', 'core/apply/failed'])
    expect(mocks.runActivity).not.toHaveBeenCalled()
    expect(mocks.runVerify).not.toHaveBeenCalled()
  })

  it('failed activity dry-run: no activity apply, no verify; exit 1 through the CLI', async () => {
    mocks.runCore.mockResolvedValueOnce(report('dry-run', 'succeeded')).mockResolvedValueOnce(report('apply', 'succeeded'))
    mocks.runActivity.mockResolvedValueOnce(report('dry-run', 'failed'))
    const log = capture()
    const code = await runCli(['migrate:all', '--apply', '--as-of=2026-06-01'], { pool: fakePool, env, out: log.out, err: log.err })
    expect(code).toBe(1)
    expect(mocks.runActivity).toHaveBeenCalledTimes(1)
    expect(mocks.runVerify).not.toHaveBeenCalled()
    expect(log.text()).toMatch(/migrate:all stopped: stage activity \(dry-run\) failed/)
  })

  it('a failed core dry-run in dry-run mode skips the activity stage entirely', async () => {
    mocks.runCore.mockResolvedValueOnce(report('dry-run', 'failed'))
    const r = await runAll(options('dry-run'))
    expect(shape(r.stages)).toEqual(['core/dry-run/failed'])
    expect(mocks.assertCorePreflight).not.toHaveBeenCalled()
  })
})

describe('a stage that throws', () => {
  it('ApplyRefusedError exits 3', async () => {
    mocks.runCore.mockRejectedValueOnce(new ApplyRefusedError('abc'))
    const log = capture()
    const code = await runCli(['migrate:all', '--apply', '--as-of=2026-06-01'], { pool: fakePool, env, out: log.out, err: log.err })
    expect(code).toBe(3)
    expect(log.text()).toMatch(/Refusing --apply: no passing dry-run/)
  })

  it('a busy run exits 4', async () => {
    mocks.runCore.mockRejectedValueOnce(new RunInProgressError('dry-run', 'abc'))
    const log = capture()
    expect(await runCli(['migrate:all', '--as-of=2026-06-01'], { pool: fakePool, env, out: log.out, err: log.err })).toBe(4)
  })

  it('the completed stages are printed before the error (the core apply committed)', async () => {
    mocks.runCore.mockResolvedValueOnce(report('dry-run', 'succeeded')).mockResolvedValueOnce(report('apply', 'succeeded'))
    mocks.runActivity.mockRejectedValueOnce(new PreflightError('Preflight failed: run `migrate:core --apply` first.'))
    const log = capture()
    const code = await runCli(['migrate:all', '--apply', '--as-of=2026-06-01'], { pool: fakePool, env, out: log.out, err: log.err })
    expect(code).toBe(2)
    const text = log.text()
    expect(text).toMatch(/migrate:all core dry-run: run 1 succeeded/)
    expect(text).toMatch(/migrate:all core apply: run 2 succeeded/)
    expect(text.indexOf('core apply: run 2')).toBeLessThan(text.indexOf('Preflight failed'))
  })

  it('runAll reports each stage through onStage as it finishes', async () => {
    mocks.runCore.mockResolvedValueOnce(report('dry-run', 'succeeded'))
    mocks.runActivity.mockResolvedValueOnce(report('dry-run', 'succeeded'))
    const seen: string[] = []
    const r = await runAll({ ...options('dry-run'), onStage: (s) => void seen.push(`${s.name}/${s.mode}/${s.status}`) })
    expect(seen).toEqual(shape(r.stages))
  })
})
