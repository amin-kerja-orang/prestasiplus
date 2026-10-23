import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createTestDatabase, type TestDatabase } from '../support/db'

/**
 * DB-ROLES (cutover plan P3, LEAD decision 23 Oct on #220): the least-privilege roles of the production VPS.
 * deploy/vps/db-roles.sh feeds deploy/vps/db-roles/apply.sql and check.sql to psql as the bootstrap superuser; this
 * spec runs the same two files on a migrated test database whose objects belong to the test superuser (the state of
 * a server that was migrated as the superuser before the roles existed). Role names get a random suffix because
 * roles are cluster-wide and test files run in parallel.
 */
const SQL_DIR = fileURLToPath(new URL('../../../../deploy/vps/db-roles/', import.meta.url))
const APPLY_SQL = readFileSync(`${SQL_DIR}apply.sql`, 'utf8')
const CHECK_SQL = readFileSync(`${SQL_DIR}check.sql`, 'utf8')

const suffix = randomBytes(4).toString('hex')
const R = { owner: `t_owner_${suffix}`, app: `t_app_${suffix}`, etl: `t_etl_${suffix}`, stage: `t_stage_${suffix}` }
const PW = { owner: randomBytes(24).toString('hex'), app: randomBytes(24).toString('hex'), etl: randomBytes(24).toString('hex') }
const GUCS = `SET pp.role_owner = '${R.owner}'; SET pp.role_app = '${R.app}'; SET pp.role_etl = '${R.etl}'; SET pp.role_stage = '${R.stage}';`

type CheckRow = { result: string; role: string; probe: string; detail: string }

let db: TestDatabase
let admin: pg.Client

/** apply.sql plus the passwords, in one transaction (db-roles.sh runs psql -1). */
async function apply(): Promise<void> {
  await admin.query('BEGIN')
  try {
    await admin.query(GUCS)
    await admin.query(APPLY_SQL)
    for (const k of ['owner', 'app', 'etl'] as const) await admin.query(`ALTER ROLE "${R[k]}" PASSWORD '${PW[k]}'`)
    await admin.query('COMMIT')
  } catch (err) {
    await admin.query('ROLLBACK')
    throw err
  }
}

async function check(): Promise<CheckRow[]> {
  await admin.query(GUCS)
  await admin.query(CHECK_SQL)
  return (await admin.query<CheckRow>('SELECT * FROM pg_temp.pp_db_roles_check()')).rows
}

/** A real network login as one of the roles. */
async function connectAs(kind: 'owner' | 'app' | 'etl'): Promise<pg.Client> {
  const u = new URL(db.url)
  u.username = R[kind]
  u.password = PW[kind]
  const c = new pg.Client({ connectionString: u.toString() })
  await c.connect()
  return c
}

async function deniedAs(kind: 'owner' | 'app' | 'etl', sql: string): Promise<string> {
  const c = await connectAs(kind)
  try {
    await c.query(sql)
    return 'allowed'
  } catch (err) {
    return (err as Error & { code?: string }).code === '42501' ? `denied: ${(err as Error).message}` : `error: ${(err as Error).message}`
  } finally {
    await c.end()
  }
}

const failures = (rows: CheckRow[]) => rows.filter((r) => r.result !== 'PASS').map((r) => `${r.role} | ${r.probe} | ${r.detail}`)

beforeAll(async () => {
  db = await createTestDatabase()
  admin = new pg.Client({ connectionString: db.url })
  await admin.connect()
})

afterAll(async () => {
  await admin?.end()
  if (!db) return
  await db.drop()
  // Roles are cluster-wide: remove them once their only database is gone.
  const a = new pg.Client({ connectionString: db.url.replace(`/${db.name}`, '/postgres') })
  await a.connect()
  try {
    for (const r of Object.values(R)) await a.query(`DROP ROLE IF EXISTS "${r}"`)
  } finally {
    await a.end()
  }
})

describe('db-roles apply.sql + check.sql (P3)', () => {
  it('refuses to run without the four role names', async () => {
    await admin.query(`SET pp.role_owner = ''`)
    await expect(admin.query(APPLY_SQL)).rejects.toThrow(/role names must be set/)
  })

  it('turns a superuser-migrated database into the P3 layout, and check.sql passes every probe', async () => {
    // The template is migrated from the SQL files; prisma migrate deploy would also have its ledger table.
    await admin.query(`CREATE TABLE _prisma_migrations (id varchar(36) PRIMARY KEY, migration_name varchar(255) NOT NULL)`)
    await apply()
    const rows = await check()
    expect(failures(rows)).toEqual([])
    const by = (role: string, probe: RegExp) => rows.find((r) => r.role === role && probe.test(r.probe))?.detail
    expect(by('owner', /owns every public table/)).toMatch(/^objects owned by another role: 0 of \d+$/)
    expect(by('app', /CREATE TABLE in public/)).toMatch(/^denied: permission denied for schema public/)
    expect(by('app', /^DROP TABLE/)).toMatch(/^denied: must be owner of table/)
    expect(by('stage', /^SELECT on public/)).toMatch(/^denied: permission denied for schema public/)
    expect(by('stage', /^INSERT on public/)).toMatch(/^denied: permission denied for schema public/)
    for (const role of ['owner', 'app', 'etl', 'stage'])
      expect(by(role, /^attributes /)).toBe('super=f createdb=f createrole=f replication=f bypassrls=f login=t memberships=0')
  })

  it('the API role reads and writes app tables over a real login but has no DDL, no TEMP, no superuser', async () => {
    const app = await connectAs('app')
    try {
      const me = await app.query<{ u: string; s: boolean }>(`SELECT current_user AS u, rolsuper AS s FROM pg_roles WHERE rolname = current_user`)
      expect(me.rows[0]).toEqual({ u: R.app, s: false })
      await app.query('BEGIN')
      const ins = await app.query<{ id: string }>(
        `INSERT INTO etl_runs (mode, sources, entity_set, git_sha, input_hash, status, counters)
         VALUES ('dry-run', '{}', '{}', 'test', 'h', 'running', '{}') RETURNING id::text`,
      )
      expect(ins.rows).toHaveLength(1)
      await app.query(`UPDATE etl_runs SET status = 'failed' WHERE id = $1::bigint`, [ins.rows[0]!.id])
      await app.query(`DELETE FROM etl_runs WHERE id = $1::bigint`, [ins.rows[0]!.id])
      await app.query('ROLLBACK')
      expect((await app.query('SELECT count(*) FROM _prisma_migrations')).rows).toHaveLength(1)
    } finally {
      await app.end()
    }
    expect(await deniedAs('app', `UPDATE _prisma_migrations SET migration_name = 'x'`)).toMatch(/^denied: permission denied for table _prisma_migrations/)
    expect(await deniedAs('etl', `DELETE FROM _prisma_migrations`)).toMatch(/^denied: permission denied for table _prisma_migrations/)
    expect(await deniedAs('app', 'CREATE TABLE public.pp_probe (i int)')).toMatch(/^denied: permission denied for schema public/)
    expect(await deniedAs('app', 'DROP TABLE public.users')).toMatch(/^denied: must be owner of table users/)
    expect(await deniedAs('app', 'TRUNCATE public.users')).toMatch(/^denied: permission denied for table users/)
    expect(await deniedAs('app', 'CREATE TEMP TABLE pp_probe (i int)')).toMatch(/^denied: permission denied to create temporary tables/)
    expect(await deniedAs('app', 'CREATE SCHEMA staging_cloud')).toMatch(/^denied: permission denied for database/)
    expect(await deniedAs('app', `CREATE ROLE pp_probe_${suffix}`)).toMatch(/^denied: permission denied to create role/)
  })

  it('the stage copy is readable by the migration role only; the stage role can drop it', async () => {
    // What slot.sh copy does: pg_restore --no-acl as the stage role creates both schemas.
    await admin.query(`SET ROLE "${R.stage}"`)
    await admin.query(`CREATE SCHEMA staging_cloud; CREATE TABLE staging_cloud.users (id int, nama text)`)
    await admin.query(`CREATE SCHEMA archive_cloud; CREATE TABLE archive_cloud.logs (id int, ip text)`)
    await admin.query('RESET ROLE')
    expect(await deniedAs('app', 'SELECT * FROM staging_cloud.users')).toMatch(/^denied: permission denied for schema staging_cloud/)
    expect(await deniedAs('app', 'SELECT * FROM archive_cloud.logs')).toMatch(/^denied: permission denied for schema archive_cloud/)
    expect(await deniedAs('etl', 'SELECT * FROM staging_cloud.users')).toBe('allowed')
    expect(await deniedAs('etl', 'CREATE TABLE staging_cloud.x (i int)')).toMatch(/^denied: permission denied for schema staging_cloud/)
    // UPDATE on archive_cloud (migrate:archive-minimise) comes from the apply run after the copy.
    expect(await deniedAs('etl', `UPDATE archive_cloud.logs SET ip = NULL`)).toMatch(/^denied: permission denied for table logs/)
    await apply()
    expect(await deniedAs('etl', `UPDATE archive_cloud.logs SET ip = NULL`)).toBe('allowed')
    expect(await deniedAs('etl', `UPDATE staging_cloud.users SET nama = NULL`)).toMatch(/^denied: permission denied for table users/)
    expect(failures(await check())).toEqual([])
    await admin.query(`SET ROLE "${R.stage}"`)
    await admin.query('DROP SCHEMA staging_cloud CASCADE; DROP SCHEMA archive_cloud CASCADE')
    await admin.query('RESET ROLE')
  })

  it('a copy made by the superuser is handed to the stage role by the next apply', async () => {
    await admin.query(`CREATE SCHEMA staging_cloud; CREATE TABLE staging_cloud.users (id int)`)
    expect(failures(await check()).join('\n')).toMatch(/stage \| DROP SCHEMA staging_cloud -> expect allowed \| denied: must be owner/)
    await apply()
    expect(failures(await check())).toEqual([])
    await admin.query('DROP SCHEMA staging_cloud CASCADE')
  })

  it('tables of a later migration (created by the owner) are covered by the default privileges', async () => {
    const owner = await connectAs('owner')
    try {
      await owner.query(`CREATE TABLE pp_later_migration (id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, v text)`)
    } finally {
      await owner.end()
    }
    const app = await connectAs('app')
    try {
      await app.query(`INSERT INTO pp_later_migration (v) VALUES ('x')`)
      expect((await app.query(`DELETE FROM pp_later_migration RETURNING id`)).rows).toHaveLength(1)
    } finally {
      await app.end()
    }
    expect(failures(await check())).toEqual([])
  })

  it('is idempotent: a second apply changes nothing and still passes', async () => {
    await apply()
    await apply()
    expect(failures(await check())).toEqual([])
  })
})
