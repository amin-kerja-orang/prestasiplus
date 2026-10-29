/**
 * A RAW dump:cloud output (manifest with raw:true and datetime_offset, no anonymised/synthetic marker) is accepted by
 * staging:load, with the values landing as the cutover plan needs (DATETIME with its offset, TIMESTAMP in UTC, real jsonb).
 * Needs Postgres (TEST_DATABASE_URL), like the other staging specs.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { DUMP_EXIT, runDumpCli } from '../../../src/migration/dump/cli'
import { stagingResetRefusals, StagingResetRefusedError } from '../../../src/migration/staging/guard'
import { loadStaging, SyntheticDumpRefusedError } from '../../../src/migration/staging/load'
import { DirReader } from '../../../src/migration/staging/readers'
import { countRows, createStagingDb, stagingEnv, type StagingDb } from '../staging/helpers'
import { capture, fixture, scratch, sourceTable, type Fixture } from './helpers'

const FULL_LOAD_TIMEOUT = 120_000
const work = scratch()
let db: StagingDb
let fx: Fixture
let out: string
let manifest: Record<string, unknown>

const USERS = [
  '{"id":1,"name":"Nama Satu","email":null,"is_active":1,"created_at":"2026-01-01T10:00:00.000000+08:00","last_login_at":"2026-01-01T02:00:00.000000Z","remember_token":null,"parent_invite_token":null}',
  '{"id":2,"name":null,"email":null,"is_active":0,"created_at":null,"last_login_at":null,"remember_token":null,"parent_invite_token":null}',
]
const SCHOOLS = ['{"id":1,"name":"Sekolah Satu","created_at":"2026-01-01T10:00:00.000000+08:00","updated_at":null}']
const ROOMS = ['{"id":1,"state":{"score":7,"flags":[true,"x"]},"status":"open","created_at":"2026-01-01T02:00:00.000000Z","updated_at":null}']

beforeAll(async () => {
  db = await createStagingDb()
  fx = fixture({
    tables: {
      users: sourceTable('users', USERS, { types: { created_at: 'datetime', last_login_at: 'timestamp', is_active: 'tinyint' }, drop: ['teaching_qualification'] }),
      schools: sourceTable('schools', SCHOOLS, { types: { created_at: 'datetime' } }),
      game_rooms: sourceTable('game_rooms', ROOMS, { types: { state: 'json' } }),
    },
  })
  out = work.out('raw-staging')
  const log = capture()
  const code = await runDumpCli(['dump:cloud', '--out', out, '--tables', 'users,schools,game_rooms'], { env: fx.env, out: log.out, err: log.err })
  expect(code, log.text()).toBe(DUMP_EXIT.ok)
  manifest = JSON.parse(readFileSync(join(out, 'manifest.json'), 'utf8')) as Record<string, unknown>
}, FULL_LOAD_TIMEOUT)

afterAll(async () => {
  await db?.close()
  fx?.cleanup()
  work.cleanup()
})

describe('a raw dump:cloud output loaded by staging:load', () => {
  it('has the raw manifest: raw:true, datetime_offset and no anonymised or synthetic key', () => {
    expect(manifest).toMatchObject({ format: 'pp-staging-dump/1', source: 'cloud', raw: true, datetime_offset: '+08:00' })
    expect('anonymised' in manifest || 'synthetic' in manifest).toBe(false)
    expect(new DirReader(out).syntheticMarker()).toBe(false)
  })

  it('is accepted: the row counts match the manifest and the values land as intended', async () => {
    const result = await loadStaging(db.pool, new DirReader(out), { env: stagingEnv(db.db) })
    expect(result.tables.find((t) => t.table === 'users')).toMatchObject({ rowsRead: 2, rowsLoaded: 2, expected: 2, extraColumns: [] })
    expect(await countRows(db.pool, 'users')).toBe(2)
    expect(await countRows(db.pool, 'schools')).toBe(1)
    expect(await countRows(db.pool, 'game_rooms')).toBe(1)
    expect(result.totalRows).toBe(4)

    // DATETIME 10:00 at +08:00 is 02:00 UTC; the TIMESTAMP was already UTC (Z); both are timestamptz.
    const t = await db.pool.query(
      `select to_char(created_at at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS') as created, to_char(last_login_at at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS') as login,
              pg_typeof(created_at)::text as ctype, is_active, remember_token from staging_cloud.users where id = 1`,
    )
    expect(t.rows[0]).toEqual({ created: '2026-01-01 02:00:00', login: '2026-01-01 02:00:00', ctype: 'timestamp with time zone', is_active: '1', remember_token: null })
    const shown = await db.pool.query(`select (set_config('TimeZone', 'UTC', false) is not null) as ok, created_at::text as created_at from staging_cloud.users where id = 1`)
    expect(shown.rows[0].created_at).toBe('2026-01-01 02:00:00+00')
    const nulls = await db.pool.query(`select created_at, last_login_at, name from staging_cloud.users where id = 2`)
    expect(nulls.rows[0]).toEqual({ created_at: null, last_login_at: null, name: null })

    // JSON arrives as real jsonb, not as a string.
    const j = await db.pool.query(`select jsonb_typeof(state) as kind, state->'flags'->>1 as second, (state->>'score')::int as score from staging_cloud.game_rooms`)
    expect(j.rows[0]).toEqual({ kind: 'object', second: 'x', score: 7 })
  }, FULL_LOAD_TIMEOUT)

  it('is not refused as a synthetic dump under NODE_ENV=production (it carries no marker)', async () => {
    const reader = new DirReader(out)
    const err = await loadStaging(db.pool, reader, { env: { NODE_ENV: 'production', PP_ALLOW_STAGING_RESET: '1', PP_STAGING_DB_ALLOWLIST: db.db.name } }).catch((e: unknown) => e)
    // The synthetic-dump check passes (no marker). The load is then stopped by the separate staging-reset guard, which never allows
    // a destructive reset when NODE_ENV is production: that is the loader's design, not a reaction to the raw manifest.
    expect(err).toBeInstanceOf(StagingResetRefusedError)
    expect(err).not.toBeInstanceOf(SyntheticDumpRefusedError)
    expect((err as Error).message).toMatch(/NODE_ENV is production/)
    expect(stagingResetRefusals(db.db.name, { NODE_ENV: 'production', PP_ALLOW_STAGING_RESET: '1', PP_STAGING_DB_ALLOWLIST: db.db.name })).toEqual(['NODE_ENV is production'])
  })
})
