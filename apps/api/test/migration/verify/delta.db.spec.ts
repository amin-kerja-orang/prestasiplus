/**
 * `migrate:delta` (BE-30 card AC2) against a real PostgreSQL on the BE-35 synthetic fixture (`cloud-tiny`).
 * After a full `runAll` apply, ONE staged practice-session row is changed (a non-key column, a newer `updated_at`
 * and the recomputed `_row_hash`, which is what makes the staged fingerprint change). A delta then:
 *   - writes exactly that one target row (row-level diff over every legacy-keyed v2 table, keyed by table and legacy_id),
 *   - reports `updated = 1` for that entity and 0 elsewhere, and counts the row under its staging table,
 *   - is idempotent: a second delta on the same input changes nothing.
 * The delta needs an earlier core apply (exit 2 otherwise) and a valid `--since`.
 */
import { rmSync } from 'node:fs'
import { join } from 'node:path'

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { runCli } from '../../../src/migration/cli'
import { ApplyGuardError, hashRow } from '../../../src/migration/kit'
import { runAll, runDelta, type PipelineOptions, type PipelineResult } from '../../../src/migration/orchestrate'
import type { VerifyOptions, VerifyReport } from '../../../src/migration/verify'
import { AS_OF, bootActivity, type ActivityHarness } from '../activity/helpers'
import { capture, REPO_ROOT } from '../staging/helpers'

// Used by the CLI test (the command has no seam); the runAll / runDelta calls inject their own.
const mocks = vi.hoisted(() => ({ runVerify: vi.fn(), writeVerifyReport: vi.fn() }))
vi.mock('../../../src/migration/verify', () => ({
  runVerify: mocks.runVerify,
  writeVerifyReport: mocks.writeVerifyReport,
  rollbackLegacy: vi.fn(),
}))

const outDir = join(REPO_ROOT, '.migration-out', `orch-delta-${process.pid}`)
const SINCE = '2026-06-02T00:00:00Z'
const NEWER = '2026-06-03T00:00:00Z'
let h: ActivityHarness
let bare: ActivityHarness

const fakeVerify = async (o: VerifyOptions): Promise<VerifyReport> => ({
  generatedAt: '2026-06-01T00:00:00.000Z', source: o.source, runIds: [...(o.runIds ?? [])], status: 'pass', entities: [], checks: [],
})
mocks.runVerify.mockImplementation(fakeVerify)
mocks.writeVerifyReport.mockReturnValue({ json: 'recon-test.json', md: 'recon-test.md' })
const options = (extra: Partial<PipelineOptions> = {}): PipelineOptions => ({
  pool: h.env.pool, env: h.runEnv, asOf: AS_OF, batchSize: 2, outDir, mode: 'apply',
  verify: fakeVerify, writeReport: () => ({ json: join(outDir, 'recon-test.json'), md: join(outDir, 'recon-test.md') }), ...extra,
})

/** `table/legacy_id` (etl_id_map: `table/entity/legacy_id`) -> md5 of the whole row (ids, timestamps and legacy_hash included) for every legacy-keyed v2 table. */
async function snapshot(): Promise<Map<string, string>> {
  const tables = await h.q<{ table_name: string }>(
    `SELECT table_name FROM information_schema.columns WHERE table_schema = 'public' AND column_name = 'legacy_source'
     INTERSECT
     SELECT table_name FROM information_schema.columns WHERE table_schema = 'public' AND column_name = 'legacy_id' ORDER BY 1`,
  )
  const out = new Map<string, string>()
  for (const { table_name: t } of tables) {
    // etl_id_map is keyed by (entity, legacy_id): the legacy id alone repeats across entities.
    const key = t === 'etl_id_map' ? `x.entity || '/' || x.legacy_id` : 'x.legacy_id'
    const rows = await h.q<{ legacy_id: string; h: string }>(
      `SELECT ${key} AS legacy_id, md5(to_jsonb(x)::text) AS h FROM "${t}" x WHERE legacy_source = 'cloud'`,
    )
    for (const r of rows) out.set(`${t}/${r.legacy_id}`, r.h)
  }
  return out
}

const diff = (a: Map<string, string>, b: Map<string, string>): string[] =>
  [...new Set([...a.keys(), ...b.keys()])].filter((k) => a.get(k) !== b.get(k)).sort()

const touched = (r: PipelineResult) =>
  (r.delta?.entities ?? []).filter((e) => e.inserted > 0 || e.updated > 0).map((e) => `${e.stage}/${e.entity}:${e.inserted}+${e.updated}`)

let legacyId = ''
let before: Map<string, string>

beforeAll(async () => {
  h = await bootActivity({ core: false })
  bare = await bootActivity({ core: false })
  const first = await runAll(options())
  expect(first.status).toBe('succeeded')
  legacyId = (await h.q<{ legacy_id: string }>(`select legacy_id from practice_sessions where legacy_source = 'cloud' order by legacy_id::bigint limit 1`))[0]?.legacy_id ?? ''
  expect(legacyId, 'the fixture loads at least one practice session').not.toBe('')
  before = await snapshot()
}, 400_000)
afterAll(async () => {
  await h?.close()
  await bare?.close()
  rmSync(outDir, { recursive: true, force: true })
})

/** One staged row changes: a non-key column, a newer updated_at and the loader's row hash recomputed. */
async function changeStagedRow(): Promise<void> {
  await h.q(`update staging_cloud.practice_sessions set duration_seconds = duration_seconds + 100, updated_at = $2::timestamptz where id = $1::bigint`, [legacyId, NEWER])
  const row = (await h.q<{ j: Record<string, unknown> }>(
    `select to_jsonb(t) - '_row_hash' - '_loaded_at' as j from staging_cloud.practice_sessions t where id = $1::bigint`, [legacyId],
  ))[0]?.j
  await h.q(`update staging_cloud.practice_sessions set _row_hash = $2 where id = $1::bigint`, [legacyId, hashRow(row ?? {})])
}

describe('a delta after one changed row', () => {
  let first: PipelineResult
  let afterFirst: Map<string, string>

  it('writes only that row (row-level diff) and reports updated = 1 for its entity', async () => {
    await changeStagedRow()
    first = await runDelta({ ...options(), since: SINCE })
    expect(first.status).toBe('succeeded')
    expect(first.stages.map((s) => [s.name, s.mode, s.status])).toEqual([
      ['core', 'dry-run', 'succeeded'],
      ['core', 'apply', 'succeeded'],
      ['activity', 'dry-run', 'succeeded'],
      ['activity', 'apply', 'succeeded'],
      ['verify', 'verify', 'succeeded'],
    ])

    afterFirst = await snapshot()
    expect(diff(before, afterFirst)).toEqual([`practice_sessions/${legacyId}`])

    expect(touched(first)).toEqual(['activity/practice_sessions:0+1'])
    const unchanged = (first.delta?.entities ?? []).filter((e) => e.entity !== 'practice_sessions')
    expect(unchanged.length).toBeGreaterThan(0)
    for (const e of unchanged) expect(e.inserted + e.updated, `${e.stage}/${e.entity}`).toBe(0)
    const ps = first.delta?.entities.find((e) => e.entity === 'practice_sessions')
    // 5 read, 2 rejected by the fixture, 1 updated, 2 unchanged.
    expect(ps).toMatchObject({ read: 5, inserted: 0, updated: 1, unchanged: 2 })
  }, 300_000)

  it('counts the changed staged row under its staging table', () => {
    expect(first.delta?.since).toBe('2026-06-02T00:00:00.000Z')
    expect(first.delta?.staged.filter((t) => t.changedRows > 0)).toEqual([{ table: 'practice_sessions', changedRows: 1 }])
    expect(first.delta?.staged.length).toBeGreaterThan(10)
  })

  it('is idempotent: a second delta on the same input changes nothing', async () => {
    const second = await runDelta({ ...options(), since: SINCE })
    expect(second.status).toBe('succeeded')
    expect(touched(second)).toEqual([])
    expect(diff(afterFirst, await snapshot())).toEqual([])
    for (const e of second.delta?.entities ?? []) expect(e.inserted + e.updated, `${e.stage}/${e.entity}`).toBe(0)
    // The staged row is still newer than `since`: the report is about the staging side and does not shrink.
    expect(second.delta?.staged.find((t) => t.table === 'practice_sessions')?.changedRows).toBe(1)
  }, 300_000)

  it('a dry-run delta writes nothing and still reports the one row as the update it would make', async () => {
    await changeStagedRow()
    const dry = await runDelta({ ...options({ mode: 'dry-run' }), since: SINCE })
    expect(dry.status).toBe('succeeded')
    expect(dry.stages.map((s) => [s.name, s.mode, s.status])).toEqual([['core', 'dry-run', 'succeeded'], ['activity', 'dry-run', 'succeeded']])
    expect(touched(dry)).toEqual(['activity/practice_sessions:0+1'])
    expect(diff(afterFirst, await snapshot())).toEqual([])
  }, 300_000)
})

describe('preconditions and flags', () => {
  it('refuses a delta when no core apply exists yet (exit 2)', async () => {
    await expect(runDelta({ ...options(), pool: bare.env.pool, env: bare.runEnv, since: SINCE })).rejects.toBeInstanceOf(ApplyGuardError)
    const log = capture()
    const code = await runCli(['migrate:delta', `--since=${SINCE}`, `--as-of=${AS_OF}`, `--out-dir=${outDir}`], { pool: bare.env.pool, env: bare.runEnv, out: log.out, err: log.err })
    expect(code).toBe(2)
    expect(log.text()).toMatch(/run migrate:all --apply first/)
    expect(await bare.count('etl_runs')).toBe(0)
  }, 120_000)

  it('rejects an invalid --since before any run', async () => {
    await expect(runDelta({ ...options(), since: 'last week' })).rejects.toBeInstanceOf(ApplyGuardError)
  })

  it('migrate:delta --apply through the CLI prints the delta table and writes the delta report', async () => {
    const log = capture()
    const code = await runCli(
      ['migrate:delta', '--apply', `--since=${SINCE}`, `--as-of=${AS_OF}`, '--batch-size=2', `--out-dir=${outDir}`],
      { pool: h.env.pool, env: h.runEnv, out: log.out, err: log.err },
    )
    expect(code, log.text()).toBe(0)
    const text = log.text()
    expect(text).toContain('delta since 2026-06-02T00:00:00.000Z (apply)')
    expect(text).toContain('practice_sessions | 1')
    expect(text).toContain('stage | entity | read | inserted | updated | unchanged')
    expect(text).toContain('warning: cannot verify --as-of against the first load; make sure it is the same value')
    expect(text).toMatch(/delta report: .*\.migration-out.*delta-.*\.json/)
    expect(text).not.toMatch(/@/)
  }, 300_000)
})

/** Sets `_row_hash` the way the staging loader would after a change: a hash of the row without the loader's own columns. */
async function restage(table: string, id: string, set: string): Promise<void> {
  await h.q(`update staging_cloud.${table} set ${set}, updated_at = $2::timestamptz where id = $1::bigint`, [id, NEWER])
  const row = (await h.q<{ j: Record<string, unknown> }>(
    `select to_jsonb(t) - '_row_hash' - '_loaded_at' as j from staging_cloud.${table} t where id = $1::bigint`, [id],
  ))[0]?.j
  await h.q(`update staging_cloud.${table} set _row_hash = $2 where id = $1::bigint`, [id, hashRow(row ?? {})])
}

describe('a changed core row and a new row', () => {
  it('users row: the apply writes exactly that user; the dry-run skips activity (its preflight needs the core apply)', async () => {
    expect((await runDelta({ ...options(), since: SINCE })).status).toBe('succeeded') // bring the database level with staging
    const base = await snapshot()
    const userId = (await h.q<{ legacy_id: string }>(`select legacy_id from users where legacy_source = 'cloud' order by legacy_id::bigint limit 1`))[0]?.legacy_id ?? ''
    expect(userId).not.toBe('')
    await restage('users', userId, `name = 'Renamed Fixture User'`)

    const dry = await runDelta({ ...options({ mode: 'dry-run' }), since: SINCE })
    expect(dry.status).toBe('succeeded')
    expect(dry.stages.map((s) => [s.name, s.mode, s.status])).toEqual([['core', 'dry-run', 'succeeded'], ['activity', 'dry-run', 'skipped']])
    expect(dry.stages[1]?.skippedReason).toBe('needs migrate:core --apply first')
    expect(touched(dry)).toEqual(['core/users:0+1'])
    expect(diff(base, await snapshot())).toEqual([])

    const applied = await runDelta({ ...options(), since: SINCE })
    expect(applied.status).toBe('succeeded')
    expect(diff(base, await snapshot())).toEqual([`users/${userId}`])
    expect(touched(applied)).toEqual(['core/users:0+1'])
    expect(applied.delta?.staged.find((t) => t.table === 'users')?.changedRows).toBe(1)
  }, 400_000)

  it('a new staged row is inserted (inserted = 1 for its entity) and nothing else changes', async () => {
    const base = await snapshot()
    await h.q(
      `insert into staging_cloud.practice_sessions
       select (jsonb_populate_record(null::staging_cloud.practice_sessions,
                 to_jsonb(t) || '{"id": 9001, "client_uuid": "00000000-0000-0000-0000-000000009001"}'::jsonb)).*
       from staging_cloud.practice_sessions t where id = $1::bigint`, [legacyId],
    )
    await restage('practice_sessions', '9001', 'duration_seconds = duration_seconds')

    const r = await runDelta({ ...options(), since: SINCE })
    expect(r.status).toBe('succeeded')
    // The new row and its id-map entry (the only bookkeeping row a load adds).
    expect(diff(base, await snapshot())).toEqual(['etl_id_map/practice_sessions/9001', 'practice_sessions/9001'])
    expect(touched(r)).toEqual(['activity/practice_sessions:1+0'])
    expect(r.delta?.entities.find((e) => e.entity === 'practice_sessions')).toMatchObject({ read: 6, inserted: 1, updated: 0 })
  }, 400_000)
})
