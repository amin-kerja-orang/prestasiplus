/**
 * Rollback (card BE-30 AC3) against a real PostgreSQL: the row counts of every migratable table before the migration are
 * restored, the staging schema is untouched, v2-born rows survive, and the guards refuse a wrong call.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { ApplyGuardError } from '../../../src/migration/kit/apply-guard'
import { rollbackLegacy, RollbackRefusedError, runVerify } from '../../../src/migration/verify'
import { countAll } from '../staging/helpers'
import type { ActivityHarness } from '../activity/helpers'
import { bootActivity, legacyTableCounts, migrateAll } from './helpers-verify'

let h: ActivityHarness
let db = ''
let before: Record<string, number> = {}
let afterLoad: Record<string, number> = {}
let stagingBefore: Record<string, number> = {}
let v2School = ''
let v2User = ''

const allowed = () => ({ ...h.runEnv, PP_ALLOW_MIGRATE_ROLLBACK: '1', PP_MIGRATE_TARGET_DB: db })
const call = (extra: object = {}) =>
  rollbackLegacy({ pool: h.env.pool, env: allowed(), source: 'cloud', confirmDb: db, ...extra })

beforeAll(async () => {
  h = await bootActivity({ core: false })
  db = h.env.db.name
  before = await legacyTableCounts(h)
  stagingBefore = await countAll(h.env.pool)
  await migrateAll(h)
  // Rows born in v2 (no legacy pair) next to the migrated ones.
  v2School = (await h.q<{ id: string }>(`insert into schools (name, code) values ('V2 Sekolah', 'v2-born-1') returning id::text as id`))[0]?.id ?? ''
  v2User = (await h.q<{ id: string }>(`insert into users (name, school_id) values ('V2 Born', $1) returning id::text as id`, [v2School]))[0]?.id ?? ''
  // A real reference cycle among the migrated users (users.created_by_id is deferrable): the rollback must clear it.
  const [u1, u2] = (await h.q<{ id: string }>(`select id::text as id from users where legacy_source = 'cloud' order by id limit 2`)).map((r) => r.id)
  await h.q(`update users set created_by_id = $2 where id = $1`, [u1, u2])
  await h.q(`update users set created_by_id = $1 where id = $2`, [u1, u2])
  afterLoad = await legacyTableCounts(h)
}, 300_000)
afterAll(async () => {
  await h?.close()
})

describe('guards', () => {
  it('refuses without PP_ALLOW_MIGRATE_APPLY=1', async () => {
    await expect(call({ env: { NODE_ENV: 'test' } })).rejects.toBeInstanceOf(ApplyGuardError)
    expect(await legacyTableCounts(h)).toEqual(afterLoad)
  })

  it('refuses without PP_ALLOW_MIGRATE_ROLLBACK=1, a dry-run too', async () => {
    for (const dryRun of [false, true]) {
      await expect(call({ env: h.runEnv, dryRun })).rejects.toBeInstanceOf(RollbackRefusedError)
      await expect(call({ env: { ...h.runEnv, PP_ALLOW_MIGRATE_ROLLBACK: 'yes' }, dryRun })).rejects.toThrow(/PP_ALLOW_MIGRATE_ROLLBACK=1/)
    }
    expect(await legacyTableCounts(h)).toEqual(afterLoad)
  })

  it('names the database in every environment: PP_MIGRATE_TARGET_DB must equal current_database()', async () => {
    for (const target of [undefined, '', 'some_other_db']) {
      for (const dryRun of [false, true]) {
        const env = { ...h.runEnv, PP_ALLOW_MIGRATE_ROLLBACK: '1', ...(target === undefined ? {} : { PP_MIGRATE_TARGET_DB: target }) }
        await expect(call({ env, dryRun })).rejects.toBeInstanceOf(RollbackRefusedError)
        await expect(call({ env, dryRun })).rejects.toThrow(/PP_MIGRATE_TARGET_DB must equal the connected database/)
      }
    }
    expect(await legacyTableCounts(h)).toEqual(afterLoad)
  })

  it('refuses a confirmation that is not the connected database', async () => {
    await expect(call({ confirmDb: 'some_other_db' })).rejects.toThrow(/does not match the connected database/)
    await expect(call({ confirmDb: '' })).rejects.toBeInstanceOf(ApplyGuardError)
    expect(await legacyTableCounts(h)).toEqual(afterLoad)
  })

  it('refuses in production unless PP_MIGRATE_TARGET_DB names the database', async () => {
    await expect(call({ env: { ...allowed(), NODE_ENV: 'production', PP_MIGRATE_TARGET_DB: 'some_other_db' } })).rejects.toBeInstanceOf(ApplyGuardError)
  })
})

describe('dry-run', () => {
  it('reports the counts and changes nothing', async () => {
    const report = await call({ dryRun: true })
    expect(report.dryRun).toBe(true)
    expect(report.status).toBe('succeeded')
    expect(report.database).toBe(db)
    const users = report.tables.find((t) => t.table === 'users')
    expect(users?.deleted).toBe(11)
    expect(report.idMapDeleted).toBeGreaterThan(0)
    expect(await legacyTableCounts(h)).toEqual(afterLoad)
    expect(await h.count('etl_id_map', `legacy_source = 'cloud'`)).toBe(report.idMapDeleted)
  })

  it('closes only the failed runs of this source alone and warns about a multi-source one', async () => {
    await h.q(`insert into etl_runs (mode, sources, entity_set, input_hash, status, counters) values ('apply', array['cloud', 'my'], array['users'], 'multi-test', 'failed', '{}'::jsonb)`)
    try {
      const report = await call({ dryRun: true })
      expect(report.warnings?.some((w) => /1 failed apply run\(s\) cover more than this source/.test(w))).toBe(true)
      expect(await h.q(`select input_hash from etl_runs where input_hash like '%multi-test'`)).toEqual([{ input_hash: 'multi-test' }])
    } finally {
      await h.q(`delete from etl_runs where input_hash = 'multi-test'`)
    }
  })

  it('lists children before their parents', async () => {
    const names = (await call({ dryRun: true })).tables.map((t) => t.table)
    const at = (t: string) => names.indexOf(t)
    for (const [child, parent] of [
      ['user_roles', 'users'], ['enrolments', 'classrooms'], ['enrolments', 'users'], ['classrooms', 'schools'],
      ['users', 'schools'], ['schools', 'ppds'], ['ppds', 'jpns'], ['chapters', 'subjects'], ['topics', 'chapters'],
      ['coin_ledger', 'users'], ['attempt_results', 'exam_attempts'], ['exam_attempts', 'users'],
    ] as const) {
      expect(at(child), `${child} is listed`).toBeGreaterThanOrEqual(0)
      expect(at(child), `${child} before ${parent}`).toBeLessThan(at(parent))
    }
  })
})

describe('concurrent work', () => {
  it('refuses while an apply run of the source is marked running', async () => {
    await h.q(`insert into etl_runs (mode, sources, entity_set, input_hash, status, counters) values ('apply', array['cloud'], array['users'], 'running-test', 'running', '{}'::jsonb)`)
    try {
      await expect(call()).rejects.toBeInstanceOf(RollbackRefusedError)
      await expect(call({ dryRun: true })).rejects.toThrow(/marked running/)
      expect(await legacyTableCounts(h)).toEqual(afterLoad)
    } finally {
      await h.q(`delete from etl_runs where input_hash = 'running-test'`)
    }
  })

  it('refuses while another rollback of the source holds the advisory lock', async () => {
    const other = await h.env.pool.connect()
    try {
      await other.query(`SELECT pg_advisory_lock(hashtextextended('etl:rollback:cloud', 0))`)
      await expect(call()).rejects.toThrow(/etl:rollback:cloud.*held by another session/)
      await other.query(`SELECT pg_advisory_unlock_all()`)
      await other.query(`SELECT pg_advisory_lock(hashtextextended('etl:source:cloud', 0))`)
      await expect(call()).rejects.toThrow(/etl:source:cloud.*held by another session/)
      expect(await legacyTableCounts(h)).toEqual(afterLoad)
    } finally {
      await other.query(`SELECT pg_advisory_unlock_all()`)
      other.release()
    }
  })
})

describe('pinned rows', () => {
  it('refuses, and changes nothing, while v2 data depends on a migrated user', async () => {
    const migrated = (await h.q<{ id: string }>(`select min(id)::text as id from users where legacy_source = 'cloud'`))[0]?.id as string
    await h.q(`insert into user_settings (user_id) values ($1)`, [migrated])
    await expect(call()).rejects.toBeInstanceOf(RollbackRefusedError)
    await expect(call()).rejects.toThrow(/users: 1 row\(s\) referenced by user_settings\.user_id/)
    expect(await legacyTableCounts(h)).toEqual(afterLoad)
    await h.q(`delete from user_settings where user_id = $1`, [migrated])

    await h.q(`update users set created_by_id = $1 where id = $2`, [migrated, v2User])
    await expect(call()).rejects.toThrow(/referenced by users\.created_by_id/)
    await h.q(`update users set created_by_id = null where id = $1`, [v2User])
    expect(await legacyTableCounts(h)).toEqual(afterLoad)
  })
})

describe('rollback (AC3)', () => {
  it('restores the pre-migration counts of every migratable table and empties the id map', async () => {
    const report = await call()
    expect(report.status).toBe('succeeded')
    expect(report.dryRun).toBe(false)
    // The fixture level named like a seeded level was ADOPTED: other tables use it, so it is released, not deleted.
    expect(report.released?.map((r) => r.table)).toContain('education_levels')

    const now = await legacyTableCounts(h)
    // The two rows born in v2 are still there.
    const expected = { ...before, schools: (before.schools ?? 0) + 1, users: (before.users ?? 0) + 1 }
    expect(now).toEqual(expected)
    expect(await h.count('schools', `id = ${v2School}`)).toBe(1)
    expect(await h.count('users', `id = ${v2User}`)).toBe(1)
    expect(await h.count('etl_id_map', `legacy_source = 'cloud'`)).toBe(0)
    for (const table of Object.keys(now)) expect(await h.count(`"${table}"`, `legacy_source = 'cloud'`), table).toBe(0)
  })

  it('keeps the audit trail and leaves staging_cloud untouched', async () => {
    expect(await h.count('etl_runs')).toBeGreaterThan(0)
    expect(await h.count('etl_recon')).toBeGreaterThan(0)
    expect(await countAll(h.env.pool)).toEqual(stagingBefore)
  })

  it('a second rollback is a no-op, and the data can be migrated again to a green verify', async () => {
    const again = await call()
    expect(again.tables.every((t) => t.deleted === 0)).toBe(true)
    await migrateAll(h)
    const report = await runVerify({ pool: h.env.pool, env: h.runEnv, source: 'cloud' })
    expect(report.entities.filter((e) => e.status !== 'ok')).toEqual([])
    expect(report.status).toBe('pass')
  }, 120_000)
})
