/**
 * A delta on a database that was rolled back is refused (exit 2): the succeeded core apply row stays in `etl_runs`, but
 * the migrated users are gone from `etl_id_map`, so the "delta" would be a full load. Real reconciliation and rollback.
 */
import { rmSync } from 'node:fs'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runCli } from '../../../src/migration/cli'
import { ApplyGuardError } from '../../../src/migration/kit'
import { ACTIVITY_GROUPS } from '../../../src/migration/load/activity'
import { runAll, runDelta } from '../../../src/migration/orchestrate'
import { rollbackLegacy } from '../../../src/migration/verify'
import type { ActivityHarness } from '../activity/helpers'
import { capture } from '../staging/helpers'
import { AS_OF, bootActivity, PROBE_GROUP, tempOutDir } from './helpers-verify'

let h: ActivityHarness
const out = tempOutDir()
const SINCE = '2026-06-02T00:00:00Z'

beforeAll(async () => {
  h = await bootActivity({ core: false })
  ACTIVITY_GROUPS.splice(ACTIVITY_GROUPS.indexOf(PROBE_GROUP), 1)
  await h.q(`update staging_cloud.users set teaching_subject = 'Subjek Ujian' where role = 'guru'`)
}, 300_000)
afterAll(async () => {
  out.cleanup()
  rmSync(out.path, { recursive: true, force: true })
  await h?.close()
})

describe('delta after a rollback', () => {
  it('works after the first load, is refused once the database was rolled back', async () => {
    const base = { pool: h.env.pool, env: h.runEnv, asOf: AS_OF, batchSize: 2, outDir: out.path }
    expect((await runAll({ ...base, mode: 'apply' })).status).toBe('succeeded')
    expect((await runDelta({ ...base, mode: 'dry-run', since: SINCE })).status).toBe('succeeded')

    const env = { ...h.runEnv, PP_ALLOW_MIGRATE_ROLLBACK: '1', PP_MIGRATE_TARGET_DB: h.env.db.name }
    const rolled = await rollbackLegacy({ pool: h.env.pool, env, source: 'cloud', confirmDb: h.env.db.name })
    expect(rolled.status).toBe('succeeded')
    expect(await h.count('etl_id_map', `legacy_source = 'cloud'`)).toBe(0)
    // The run row of the first load is still there; that is why the id map is checked too.
    expect(await h.count('etl_runs', `mode = 'apply' and status = 'succeeded'`)).toBeGreaterThan(0)

    await expect(runDelta({ ...base, mode: 'apply', since: SINCE })).rejects.toBeInstanceOf(ApplyGuardError)
    const log = capture()
    const code = await runCli(['migrate:delta', '--apply', `--since=${SINCE}`, `--as-of=${AS_OF}`, `--out-dir=${out.path}`], { pool: h.env.pool, env: h.runEnv, out: log.out, err: log.err })
    expect(code).toBe(2)
    expect(log.text()).toMatch(/run migrate:all --apply first/)
    expect(await h.count('etl_id_map', `legacy_source = 'cloud'`)).toBe(0)
  }, 400_000)
})
