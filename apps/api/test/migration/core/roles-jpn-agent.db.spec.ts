/**
 * `migrate:core` roles added by FIT-FIX, against a real PostgreSQL on the `cloud-tiny` fixture (FIT-FIX G4):
 *   - `jpn_officer` is loaded as a `ppd_officer` with a STATE scope from the state of the user's school; a school without a
 *     state leaves the officer unscoped and listed under `ppd_officer_without_scope`;
 *   - `agent` is not migrated: rejected on `role` (UNKNOWN_ENUM) and counted by name (`users.role_rejected.agent`);
 *   - that count is rebuilt after a resumed apply (batches committed before a crash are skipped by the resume).
 * The users are planted here (copies of staged user 1 with the role, school and login overridden; fictitious values), after
 * any `agent` / `jpn_officer` rows of the fixture are removed, so the counts do not depend on the shared fixture.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runSeeds } from '../../../prisma/seed'
import { schoolPackagesSeed } from '../../../prisma/seed/core/school-packages'
import { curriculumSeed } from '../../../prisma/seed/curriculum'
import { runCore } from '../../../src/migration/load'
import { loadStaging } from '../../../src/migration/staging/load'
import { DirReader } from '../../../src/migration/staging/readers'
import { createStagingDb, FIXTURE_DIR, stagingEnv, type StagingDb } from '../staging/helpers'

const AS_OF = '2026-06-01'
const coreEnv = { NODE_ENV: 'test', IC_HASH_KEY: 'fixture-ic-key-0123456789', PP_ALLOW_MIGRATE_APPLY: '1' }

interface Boot {
  env: StagingDb
  q<T extends Record<string, unknown> = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>
}

/** A private database with the fixture, the seeds and the planted schools and users. `extra` plants more users before the load. */
async function boot(): Promise<Boot> {
  const env = await createStagingDb()
  const q = async <T extends Record<string, unknown> = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> =>
    (await env.pool.query(sql, params)).rows as T[]
  await loadStaging(env.pool, new DirReader(FIXTURE_DIR), { env: stagingEnv(env.db) })
  await runSeeds([schoolPackagesSeed, curriculumSeed], { prisma: env.db.prisma })
  await q(`update staging_cloud.users set kelas = '4 Amanah' where role = 'pelajar'`)
  await q(`update staging_cloud.education_levels set name_bm = 'Darjah 1' where id = 1`)
  // The fixture may carry these roles itself: remove them so the planted users are the only ones.
  await q(`delete from staging_cloud.users where lower(btrim(role)) in ('agent', 'jpn_officer')`)
  await q(`insert into staging_cloud.schools (id, name, code, type, state, district, join_code, is_active, created_at) values
    (9001, 'Sekolah Tanpa Negeri', 'SC9001', 'sk', null, null, 'JOIN9001', '1', '2026-01-01T00:00:00Z'),
    (9002, 'Sekolah Tanpa Daerah', 'SC9002', 'sk', 'Negeri C', null, 'JOIN9002', '1', '2026-01-01T00:00:00Z')`)
  const cols = (await q<{ column_name: string }>(
    `select column_name from information_schema.columns where table_schema = 'staging_cloud' and table_name = 'users' order by ordinal_position`,
  )).map((c) => c.column_name)
  const plant = async (id: number, name: string, role: string, schoolId: number): Promise<void> => {
    const over: Record<string, string> = {
      id: String(id), name: `'${name}'`, email: 'null', username: `'u${id}'`, ic: 'null', phone: 'null', role: `'${role}'`, school_id: String(schoolId),
    }
    await q(
      `insert into staging_cloud.users (${cols.map((c) => `"${c}"`).join(', ')}) select ${cols.map((c) => over[c] ?? `"${c}"`).join(', ')} from staging_cloud.users where id = 1`,
    )
  }
  await plant(9101, 'Pegawai JPN Contoh A', 'jpn_officer', 9002)
  await plant(9102, 'Pegawai JPN Contoh B', 'jpn_officer', 9001)
  await plant(9103, 'Ejen Contoh A', 'agent', 1)
  await plant(9104, 'Ejen Contoh B', ' Agent ', 1)
  await plant(9199, 'Pegawai Gagal', 'pelajar', 1) // last user: the resume test crashes on it
  return { env, q }
}

const run = (b: Boot, mode: 'dry-run' | 'apply') => runCore({ pool: b.env.pool, env: coreEnv, source: 'cloud', asOf: AS_OF, mode, batchSize: 2 })

describe('jpn_officer and agent, fresh run', () => {
  let b: Boot
  let notes: Map<string, number>
  let ids: Map<string, string[]>
  let runId = ''
  beforeAll(async () => {
    b = await boot()
    expect((await run(b, 'dry-run')).report.status).toBe('succeeded')
    const applied = await run(b, 'apply')
    expect(applied.report.status).toBe('succeeded')
    notes = applied.core.notes.counters
    ids = applied.core.notes.ids
    runId = applied.report.runId
  }, 300_000)
  afterAll(async () => {
    await b?.env.close()
  })

  it('loads a jpn_officer as a ppd_officer with a state scope taken from the school', async () => {
    const state = (await b.q<{ state: string }>(`select state from schools where legacy_source = 'cloud' and legacy_id = '9002'`))[0]?.state
    expect(state).toBeTruthy()
    const rows = await b.q(
      `select u.legacy_id, r.role, s.level, s.state_code, s.district_code, s.school_id::text as school_id
       from users u join user_roles r on r.user_id = u.id left join user_scopes s on s.user_id = u.id
       where u.legacy_source = 'cloud' and u.legacy_id = '9101'`,
    )
    expect(rows).toEqual([{ legacy_id: '9101', role: 'ppd_officer', level: 'state', state_code: state, district_code: null, school_id: null }])
  })

  it('loads a jpn_officer whose school has no state without a scope and lists the id', async () => {
    const rows = await b.q(
      `select r.role, s.id as scope from users u join user_roles r on r.user_id = u.id left join user_scopes s on s.user_id = u.id
       where u.legacy_source = 'cloud' and u.legacy_id = '9102'`,
    )
    expect(rows).toEqual([{ role: 'ppd_officer', scope: null }])
    expect(ids.get('ppd_officer_without_scope')).toContain('9102')
    expect(ids.get('ppd_officer_without_scope')).not.toContain('9101')
  })

  it('does not migrate the agents: rejected UNKNOWN_ENUM on role, counted by name, nothing loaded', async () => {
    expect(await b.q(`select 1 from users where legacy_source = 'cloud' and legacy_id in ('9103','9104')`)).toEqual([])
    const rej = await b.q(
      `select legacy_id, reason, column_name from etl_rejects where run_id = $1 and entity = 'users' and legacy_id in ('9103','9104') order by 1`,
      [runId],
    )
    expect(rej).toEqual([
      { legacy_id: '9103', reason: 'UNKNOWN_ENUM', column_name: 'role' },
      { legacy_id: '9104', reason: 'UNKNOWN_ENUM', column_name: 'role' },
    ])
    expect(notes.get('users.role_rejected.agent')).toBe(2)
    // The fixture's unplanned role (super_guru) is counted apart, never under a name.
    expect(notes.get('users.role_rejected.other')).toBeGreaterThanOrEqual(1)
    expect([...notes.keys()].filter((k) => k.startsWith('users.role_rejected.')).sort()).toEqual(['users.role_rejected.agent', 'users.role_rejected.other'])
  })
})

describe('the agent count after a resumed apply', () => {
  let b: Boot
  let fresh: Boot
  beforeAll(async () => {
    b = await boot()
    fresh = await boot()
  }, 300_000)
  afterAll(async () => {
    await b?.env.close()
    await fresh?.env.close()
  })

  it('equals the uninterrupted run: the batches committed before the crash are recounted from etl_rejects', async () => {
    expect((await run(fresh, 'dry-run')).report.status).toBe('succeeded')
    const want = (await run(fresh, 'apply')).core.notes.counters

    expect((await run(b, 'dry-run')).report.status).toBe('succeeded')
    // The last user cannot be written: the apply stops there, after the earlier batches (and the agents' rejects) committed.
    await b.q(`create or replace function crash_on_gagal() returns trigger language plpgsql as $$
      begin if new.name = 'Pegawai Gagal' then raise exception 'simulated crash'; end if; return new; end $$`)
    await b.q(`create trigger crash_on_gagal before insert on users for each row execute function crash_on_gagal()`)
    await expect(run(b, 'apply')).rejects.toThrow(/SQLSTATE P0001/) // the trigger's RAISE EXCEPTION, as the kit reports it
    expect(await b.q(`select 1 from users where legacy_source = 'cloud' and legacy_id = '9199'`)).toEqual([])
    expect(await b.q(`select 1 from etl_rejects where entity = 'users' and legacy_id = '9103' and run_id in (select id from etl_runs where mode = 'apply')`)).toHaveLength(1)
    await b.q(`drop trigger crash_on_gagal on users`)

    const resumed = await run(b, 'apply')
    expect(resumed.report.status).toBe('succeeded')
    expect(resumed.report.resumedBatches).toBeGreaterThanOrEqual(1)
    expect(resumed.core.notes.counters.get('users.role_rejected.agent')).toBe(2)
    const roleNotes = (m: Map<string, number>) => Object.fromEntries([...m].filter(([k]) => k.startsWith('users.role_rejected.')).sort(([x], [y]) => (x < y ? -1 : 1)))
    expect(roleNotes(resumed.core.notes.counters)).toEqual(roleNotes(want))
  }, 300_000)
})
