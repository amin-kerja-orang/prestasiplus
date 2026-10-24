/**
 * `migrate:all` (BE-30 card AC1 shape) against a real PostgreSQL on the BE-35 synthetic fixture (`cloud-tiny`):
 * a private database with staging loaded and the seeds, but NO BE-28 run yet.
 *   dry-run before any apply: core succeeded, activity skipped with the reason, no verify, nothing written;
 *   apply: core and activity each dry-run then apply (same input hash), then verify and the report writer;
 *   a verify that fails fails the run; the CLI maps the result to the kit exit codes.
 * The reconciliation (Part B) is replaced by a fake that returns `pass`; its own spec covers the real one.
 */
import { rmSync } from 'node:fs'
import { join } from 'node:path'

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { runCli } from '../../../src/migration/cli'
import { runAll, runDelta, SourceBusyError, type PipelineOptions } from '../../../src/migration/orchestrate'
import type { VerifyOptions, VerifyReport } from '../../../src/migration/verify'
import { AS_OF, bootActivity, type ActivityHarness } from '../activity/helpers'
import { capture, REPO_ROOT } from '../staging/helpers'

const mocks = vi.hoisted(() => ({ runVerify: vi.fn(), writeVerifyReport: vi.fn() }))
// Used by the CLI test (the command has no seam); the runAll tests inject their own.
vi.mock('../../../src/migration/verify', () => ({
  runVerify: mocks.runVerify,
  writeVerifyReport: mocks.writeVerifyReport,
  rollbackLegacy: vi.fn(),
}))

const outDir = join(REPO_ROOT, '.migration-out', `orch-all-${process.pid}`)
let h: ActivityHarness

const report = (status: 'pass' | 'fail', o: VerifyOptions): VerifyReport => ({
  generatedAt: '2026-06-01T00:00:00.000Z', source: o.source, runIds: [...(o.runIds ?? [])], status, entities: [], checks: [],
})

function fakes(status: 'pass' | 'fail' = 'pass') {
  const verify = vi.fn(async (o: VerifyOptions) => report(status, o))
  const writeReport = vi.fn((_r: VerifyReport, dir?: string) => ({ json: join(dir ?? '', 'recon-test.json'), md: join(dir ?? '', 'recon-test.md') }))
  return { verify, writeReport }
}

const options = (extra: Partial<PipelineOptions> = {}): PipelineOptions => ({
  pool: h.env.pool, env: h.runEnv, asOf: AS_OF, batchSize: 2, outDir, ...extra,
})

beforeAll(async () => {
  h = await bootActivity({ core: false })
}, 300_000)
afterAll(async () => {
  await h?.close()
  rmSync(outDir, { recursive: true, force: true })
})
beforeEach(() => {
  mocks.runVerify.mockImplementation(async (o: VerifyOptions) => report('pass', o))
  mocks.writeVerifyReport.mockReturnValue({ json: 'recon-test.json', md: 'recon-test.md' })
})

describe('dry-run before any apply', () => {
  it('runs core, skips activity with the reason, does not verify and writes nothing', async () => {
    const before = await h.contentHashes()
    const f = fakes()
    const r = await runAll(options({ mode: 'dry-run', ...f }))
    expect(r.status).toBe('succeeded')
    expect(r.stages.map((s) => [s.name, s.mode, s.status])).toEqual([
      ['core', 'dry-run', 'succeeded'],
      ['activity', 'dry-run', 'skipped'],
    ])
    expect(r.stages[1]?.skippedReason).toBe('needs migrate:core --apply first')
    expect(r.stages[0]?.recon?.length).toBeGreaterThan(0)
    expect(f.verify).not.toHaveBeenCalled()
    expect(r.verify).toBeUndefined()
    expect(await h.contentHashes()).toEqual(before)
    expect(await h.count('etl_id_map')).toBe(0)
  }, 120_000)

  it('the mode defaults to dry-run', async () => {
    const r = await runAll(options({ ...fakes() }))
    expect(r.stages.every((s) => s.mode === 'dry-run')).toBe(true)
  }, 120_000)
})

/** The same key and expression that rollbackLegacy and linkQuestions take. */
const SOURCE_LOCK = `select pg_try_advisory_lock(hashtextextended('etl:source:cloud', 0)) as ok`

describe('source lock', () => {
  it('another session holding etl:source:cloud makes runAll, runDelta and the CLI refuse (exit 4) before writing anything', async () => {
    const holder = await h.env.pool.connect()
    try {
      expect((await holder.query(SOURCE_LOCK)).rows[0]?.ok).toBe(true)
      const before = await h.contentHashes()
      const runsBefore = await h.count('etl_runs')
      const f = fakes()
      await expect(runAll(options({ mode: 'apply', ...f }))).rejects.toBeInstanceOf(SourceBusyError)
      await expect(runDelta({ ...options({ mode: 'apply', ...f }), since: '2026-06-02T00:00:00Z' })).rejects.toBeInstanceOf(SourceBusyError)

      const log = capture()
      const code = await runCli(['migrate:all', '--apply', `--as-of=${AS_OF}`, `--out-dir=${outDir}`], { pool: h.env.pool, env: h.runEnv, out: log.out, err: log.err })
      expect(code).toBe(4)
      expect(log.text()).toContain('another migration, rollback or backfill holds the source lock')

      expect(f.verify).not.toHaveBeenCalled()
      expect(await h.count('etl_runs')).toBe(runsBefore)
      expect(await h.count('etl_id_map')).toBe(0)
      expect(await h.contentHashes()).toEqual(before)
    } finally {
      await holder.query(`select pg_advisory_unlock_all()`)
      holder.release()
    }
  }, 120_000)

  it('a normal run releases the lock, so another session (a rollback dry-run, a backfill) can take it', async () => {
    const r = await runAll(options({ mode: 'dry-run', ...fakes() }))
    expect(r.status).toBe('succeeded')
    const other = await h.env.pool.connect()
    try {
      expect((await other.query(SOURCE_LOCK)).rows[0]?.ok).toBe(true)
    } finally {
      await other.query(`select pg_advisory_unlock_all()`)
      other.release()
    }
  }, 120_000)

  it('releases the lock when a stage throws too', async () => {
    // A synthetic dump in production is refused by runCore; here the apply guard throws (no PP_ALLOW_MIGRATE_APPLY).
    await expect(runAll({ ...options({ mode: 'apply', ...fakes() }), env: { NODE_ENV: 'test', IC_HASH_KEY: 'fixture-ic-key-0123456789' } })).rejects.toThrow(/PP_ALLOW_MIGRATE_APPLY/)
    const other = await h.env.pool.connect()
    try {
      expect((await other.query(SOURCE_LOCK)).rows[0]?.ok).toBe(true)
    } finally {
      await other.query(`select pg_advisory_unlock_all()`)
      other.release()
    }
  }, 120_000)
})

describe('apply', () => {
  it('runs dry-run then apply per stage with identical input, then verifies and writes the report', async () => {
    const f = fakes()
    const r = await runAll(options({ mode: 'apply', ...f }))
    expect(r.stages.map((s) => [s.name, s.mode, s.status])).toEqual([
      ['core', 'dry-run', 'succeeded'],
      ['core', 'apply', 'succeeded'],
      ['activity', 'dry-run', 'succeeded'],
      ['activity', 'apply', 'succeeded'],
      ['verify', 'verify', 'succeeded'],
    ])
    expect(r.status).toBe('succeeded')

    // The dry-run and the apply of a stage share the input hash (that is what lets the apply start).
    const hashes = await h.q<{ id: string; mode: string; input_hash: string; status: string }>(
      `select id::text, mode, input_hash, status from etl_runs order by id`,
    )
    const run = (id: string | undefined) => hashes.find((x) => x.id === id)
    for (const name of ['core', 'activity'] as const) {
      const dry = run(r.stages.find((s) => s.name === name && s.mode === 'dry-run')?.runId)
      const applied = run(r.stages.find((s) => s.name === name && s.mode === 'apply')?.runId)
      expect(dry?.input_hash, name).toBeTruthy()
      expect(applied?.input_hash, name).toBe(dry?.input_hash)
      expect(applied?.status).toBe('succeeded')
    }

    expect(f.verify).toHaveBeenCalledTimes(1)
    const applyIds = r.stages.filter((s) => s.mode === 'apply').map((s) => s.runId)
    expect(f.verify.mock.calls[0]?.[0]).toMatchObject({ source: 'cloud', outDir, runIds: applyIds })
    expect(f.writeReport).toHaveBeenCalledTimes(1)
    expect(r.verify?.files).toEqual({ json: join(outDir, 'recon-test.json'), md: join(outDir, 'recon-test.md') })

    expect(await h.count('etl_id_map', `entity = 'users'`)).toBeGreaterThan(0)
    expect(await h.count('practice_sessions', `legacy_source = 'cloud'`)).toBeGreaterThan(0)
    for (const s of r.stages.filter((x) => x.recon)) for (const rc of s.recon ?? []) expect(rc.status, `${s.name}/${rc.entity}`).toBe('ok')
  }, 240_000)

  it('after the apply, a dry-run runs both stages', async () => {
    const r = await runAll(options({ mode: 'dry-run', ...fakes() }))
    expect(r.stages.map((s) => [s.name, s.mode, s.status])).toEqual([
      ['core', 'dry-run', 'succeeded'],
      ['activity', 'dry-run', 'succeeded'],
    ])
  }, 120_000)

  it('a verify that fails fails the run but keeps the report', async () => {
    const r = await runAll(options({ mode: 'apply', ...fakes('fail') }))
    expect(r.status).toBe('failed')
    expect(r.stages.at(-1)).toMatchObject({ name: 'verify', status: 'failed' })
    expect(r.verify?.status).toBe('fail')
    expect(r.verify?.files).toBeDefined()
  }, 240_000)

  it('a verify that throws is a failed stage, not a crash', async () => {
    const verify = vi.fn(async () => {
      throw new Error('not implemented yet')
    })
    const r = await runAll(options({ mode: 'apply', verify, writeReport: fakes().writeReport }))
    expect(r.status).toBe('failed')
    expect(r.stages.at(-1)).toMatchObject({ name: 'verify', status: 'failed', error: 'not implemented yet' })
  }, 240_000)

  it('uses the Part B reconciliation when no seam is given', async () => {
    const r = await runAll({ pool: h.env.pool, env: h.runEnv, asOf: AS_OF, batchSize: 2, outDir, mode: 'apply' })
    expect(r.status).toBe('succeeded')
    expect(mocks.runVerify).toHaveBeenCalledTimes(1)
    expect(mocks.writeVerifyReport).toHaveBeenCalledTimes(1)
  }, 240_000)
})

describe('command line', () => {
  it('migrate:all --apply exits 0, prints a table per stage and counts only', async () => {
    const log = capture()
    const code = await runCli(
      ['migrate:all', '--apply', `--as-of=${AS_OF}`, '--batch-size=2', `--out-dir=${outDir}`],
      { pool: h.env.pool, env: h.runEnv, out: log.out, err: log.err },
    )
    expect(code, log.text()).toBe(0)
    const text = log.text()
    for (const s of ['core dry-run', 'core apply', 'activity dry-run', 'activity apply']) expect(text).toContain(`migrate:all ${s}: run `)
    expect(text).toContain('entity | source | eligible | loaded | rejected | status')
    expect(text).toContain('migrate:all verify: succeeded')
    // No fixture e-mail address ever reaches the output.
    expect(text).not.toMatch(/@/)
  }, 300_000)

  it('migrate:all (dry-run) exits 0 with the activity stage listed', async () => {
    const log = capture()
    const code = await runCli(['migrate:all', `--as-of=${AS_OF}`, `--out-dir=${outDir}`], { pool: h.env.pool, env: h.runEnv, out: log.out, err: log.err })
    expect(code, log.text()).toBe(0)
    expect(log.text()).toContain('migrate:all activity dry-run: run ')
  }, 120_000)

  it('a different --as-of leaves activity skipped (its preflight needs a core apply with that as-of)', async () => {
    const log = capture()
    const code = await runCli(['migrate:all', '--as-of=2030-01-01', `--out-dir=${outDir}`], { pool: h.env.pool, env: h.runEnv, out: log.out, err: log.err })
    expect(code, log.text()).toBe(0)
    expect(log.text()).toContain('activity dry-run: skipped (needs migrate:core --apply first)')
  }, 120_000)
})
