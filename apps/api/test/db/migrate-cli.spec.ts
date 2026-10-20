import { spawnSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'

import pg from 'pg'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'

import { withDatabase } from '../support/global-setup'

/** Migrations on disk: the tests must not hard-code how many cards have added one. */
const MIGRATION_NAMES = readdirSync(new URL('../../prisma/migrations/', import.meta.url), { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort()

const API_DIR = fileURLToPath(new URL('../../', import.meta.url))
const name = `t_cli_${randomBytes(5).toString('hex')}`
let url = ''
let admin = ''

const run = (command: string, env: Record<string, string> = {}) =>
  spawnSync(
    process.execPath,
    ['scripts/db.mjs', command, ...(command === 'seed' ? ['--profile=test'] : [])],
    {
      cwd: API_DIR,
      env: {
        ...process.env,
        // Prisma's default connect timeout is 5 s; through the Docker port forward on a loaded host the
        // CLI sometimes needs longer (P1001 in full be:verify runs, BE-03 and BE-05).
        DATABASE_URL: `${url}?connect_timeout=30`,
        NODE_ENV: 'development',
        // No network calls from the CLI (update check, telemetry): tests must not depend on them.
        CHECKPOINT_DISABLE: '1',
        PRISMA_HIDE_UPDATE_MESSAGE: '1',
        ...env,
      },
      encoding: 'utf8',
      timeout: 120_000,
    },
  )

async function query<T extends pg.QueryResultRow>(sql: string, connection = url): Promise<T[]> {
  const c = new pg.Client({ connectionString: connection })
  await c.connect()
  try {
    return (await c.query<T>(sql)).rows
  } finally {
    await c.end()
  }
}

// A cold Prisma CLI start takes 3 to 9 s on a loaded Windows host (loading its bundle; no network
// stall: measured with the update check off), so each CLI case gets a generous timeout.
describe('be:db:* scripts against an empty database', { timeout: 120_000 }, () => {
  beforeAll(async () => {
    admin = inject('testDbAdminUrl')
    if (!admin) throw new Error(inject('testDbError'))
    await query(`CREATE DATABASE "${name}"`, admin)
    url = withDatabase(admin, name)
  })
  afterAll(async () => {
    if (admin) await query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`, admin)
  })

  it('migrate applies every migration (pgcrypto, _prisma_migrations rows)', async () => {
    const r = run('migrate')
    expect(r.status, r.stdout + r.stderr).toBe(0)
    const rows = await query<{ migration_name: string }>(
      'select migration_name from _prisma_migrations order by migration_name',
    )
    expect(rows.map((x) => x.migration_name)).toEqual(MIGRATION_NAMES)
    expect(await query("select 1 from pg_extension where extname = 'pgcrypto'")).toHaveLength(1)
  })

  it('migrate is repeatable (nothing left to apply)', () => {
    expect(run('migrate').status).toBe(0)
  })

  it('seed runs against the migrated database', () => {
    const r = run('seed')
    expect(r.status, r.stdout + r.stderr).toBe(0)
    expect(r.stdout).toContain('profile=test')
  })

  it('reset refuses to run when NODE_ENV=production and leaves the database untouched', async () => {
    await query('create table leftover (id int)')
    const r = run('reset', { NODE_ENV: 'production' })
    expect(r.status).not.toBe(0)
    expect(r.stderr).toMatch(/production/)
    expect(await query("select 1 from information_schema.tables where table_name = 'leftover'")).toHaveLength(1)
    expect(await query('select migration_name from _prisma_migrations')).toHaveLength(MIGRATION_NAMES.length)
  })

  // Prisma refuses `migrate reset` when it detects an AI agent (needs the user's own consent), so
  // this case is skipped when the suite runs inside one; it runs for developers and in CI.
  it.skipIf(Boolean(process.env.CLAUDECODE))('reset works in development: the schema is rebuilt from the migrations', async () => {
    const r = run('reset')
    expect(r.status, r.stdout + r.stderr).toBe(0)
    expect(await query("select 1 from information_schema.tables where table_name = 'leftover'")).toHaveLength(0)
    expect(await query('select migration_name from _prisma_migrations')).toHaveLength(MIGRATION_NAMES.length)
  })
})
