import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it, inject, vi } from 'vitest'

import {
  CloudSource,
  CloudSourceConfigError,
  CloudSourceConnectError,
  ReadOnlyViolationError,
} from '../../../src/migration/cloud-source'
import { renderDdl } from '../../../src/migration/ddl/render'
import { TABLES } from '../../../src/migration/ddl/spec'
import { runStagingCli, STAGING_EXIT } from '../../../src/migration/staging/cli'
import { DirReader, PgReader } from '../../../src/migration/staging/readers'
import { loadStaging } from '../../../src/migration/staging/load'
import { withDatabase } from '../../support/global-setup'
import { capture, createStagingDb, FIXTURE_DIR, type StagingDb } from './helpers'

// Creating the 118 raw tables takes seconds on a Docker-on-Windows Postgres; allow for it.
vi.setConfig({ testTimeout: 120_000 })

const adminUrl = inject('testDbAdminUrl')
const suffix = randomBytes(4).toString('hex')
const PASSWORD = 'Fixture-pass-not-a-secret'
const sourceDb = `src_${suffix}`
const roles = {
  ro: `pp_ro_${suffix}`,
  insert: `pp_ins_${suffix}`,
  update: `pp_upd_${suffix}`,
  updateColumn: `pp_updc_${suffix}`,
  delete: `pp_del_${suffix}`,
  truncate: `pp_trn_${suffix}`,
  ddl: `pp_ddl_${suffix}`,
  createdb: `pp_cdb_${suffix}`,
}

const urlFor = (role: string, database = sourceDb): string => {
  const u = new URL(withDatabase(adminUrl, database))
  u.username = role
  u.password = PASSWORD
  return u.toString()
}

let admin: pg.Client
let sourceAdmin: pg.Client
let target: StagingDb

beforeAll(async () => {
  if (!adminUrl) throw new Error('Test database unavailable.')
  admin = new pg.Client({ connectionString: adminUrl })
  await admin.connect()
  await admin.query(`create database "${sourceDb}"`)
  sourceAdmin = new pg.Client({ connectionString: withDatabase(adminUrl, sourceDb) })
  await sourceAdmin.connect()

  // The "restored dump": the spec tables in schema public, loaded from the synthetic fixture.
  await sourceAdmin.query(renderDdl())
  for (const t of TABLES) {
    const schema = t.group === 'staging' ? 'staging_cloud' : 'archive_cloud'
    await sourceAdmin.query(
      `alter table "${schema}"."${t.name}" set schema public;
       alter table public."${t.name}" drop column "_loaded_at", drop column "_row_hash"`,
    )
  }
  await sourceAdmin.query('drop schema staging_cloud; drop schema archive_cloud')
  const reader = new DirReader(FIXTURE_DIR)
  for (const t of TABLES) {
    for await (const batch of reader.read(t.name, 500)) {
      await sourceAdmin.query(`insert into public."${t.name}" select * from jsonb_populate_recordset(null::public."${t.name}", $1::jsonb)`, [JSON.stringify(batch)])
    }
  }

  const mk = async (role: string, extra = '') => {
    await admin.query(`create role "${role}" login password '${PASSWORD}' ${extra}`)
    await admin.query(`grant connect on database "${sourceDb}" to "${role}"`)
  }
  await mk(roles.ro)
  await sourceAdmin.query(`grant select on all tables in schema public to "${roles.ro}"`)
  // Write roles deliberately get NO select: if the loader tried to read first it would fail with a
  // permission error, not with the read-only violation. Each also has exactly one write privilege.
  await mk(roles.insert)
  await sourceAdmin.query(`grant insert on public.users to "${roles.insert}"`)
  await mk(roles.update)
  await sourceAdmin.query(`grant update on public.schools to "${roles.update}"`)
  await mk(roles.updateColumn)
  await sourceAdmin.query(`grant update (name) on public.schools to "${roles.updateColumn}"`)
  await mk(roles.delete)
  await sourceAdmin.query(`grant delete on public.users to "${roles.delete}"`)
  await mk(roles.truncate)
  await sourceAdmin.query(`grant truncate on public.users to "${roles.truncate}"`)
  await mk(roles.ddl)
  await sourceAdmin.query(`grant create on schema public to "${roles.ddl}"`)
  await mk(roles.createdb, 'createdb')

  target = await createStagingDb()
})

afterAll(async () => {
  await target?.close()
  await sourceAdmin?.end()
  await admin?.query(`drop database if exists "${sourceDb}" with (force)`)
  for (const role of Object.values(roles)) await admin?.query(`drop role if exists "${role}"`)
  await admin?.end()
})

describe('read-only guard (AC2, BE-MIG-05)', () => {
  it('lets a SELECT-only role through and reads inside a read-only transaction', async () => {
    const source = await CloudSource.open({ url: urlFor(roles.ro) })
    try {
      expect(source.statements).toEqual(['begin read only isolation level repeatable read'])
      expect(await source.tableExists('users')).toBe(true)
      expect(await source.tableExists('cache')).toBe(false)
      let rows = 0
      for await (const batch of source.read('users', 5)) rows += batch.length
      expect(rows).toBe(13)
    } finally {
      await source.close()
    }
  })

  it.each([
    ['INSERT', roles.insert, /INSERT on public\.users/],
    ['UPDATE', roles.update, /UPDATE on public\.schools/],
    ['column UPDATE', roles.updateColumn, /UPDATE on public\.schools/],
    ['DELETE', roles.delete, /DELETE on public\.users/],
    ['TRUNCATE', roles.truncate, /TRUNCATE on public\.users/],
    ['DDL (CREATE on a schema)', roles.ddl, /CREATE on schema public/],
    ['CREATEDB', roles.createdb, /CREATEDB/],
  ])('aborts before reading any row when the role has %s', async (_label, role, expected) => {
    const err = await CloudSource.open({ url: urlFor(role) }).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ReadOnlyViolationError)
    expect((err as Error).message).toMatch(expected)
    // The role cannot even SELECT, so reaching this error proves no table was read first.
    expect((err as Error).message).not.toContain(PASSWORD)
    expect((err as Error).message).not.toContain(role)
  })

  it('aborts for a superuser (the admin role of the test server)', async () => {
    const err = await CloudSource.open({ url: withDatabase(adminUrl, sourceDb) }).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ReadOnlyViolationError)
    expect((err as Error).message).toMatch(/SUPERUSER/)
  })

  it('staging:load exits with the source-refused code and loads nothing when the role can write', async () => {
    const io = capture()
    const code = await runStagingCli(['staging:load'], {
      env: { DATABASE_URL: target.db.url, CLOUD_SOURCE_URL: urlFor(roles.insert) },
      pool: target.pool,
      out: io.out,
      err: io.err,
    })
    expect(code).toBe(STAGING_EXIT.sourceRefused)
    expect(io.text()).toMatch(/not read-only/)
    expect(io.text()).not.toContain(PASSWORD)
    const exists = await target.pool.query<{ ok: boolean }>(`select to_regclass('staging_cloud.users') is not null as ok`)
    expect(exists.rows[0]?.ok).toBe(false)
  })

  it('refuses a missing URL, the target database as the source, and an unreachable host', async () => {
    await expect(CloudSource.open({ url: undefined })).rejects.toBeInstanceOf(CloudSourceConfigError)
    await expect(CloudSource.open({ url: urlFor(roles.ro, target.db.name), targetUrl: target.db.url })).rejects.toBeInstanceOf(
      CloudSourceConfigError,
    )
    const err = await CloudSource.open({ url: `postgresql://u:${PASSWORD}@127.0.0.1:1/none` }).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(CloudSourceConnectError)
    expect((err as Error).message).not.toContain(PASSWORD)
  })
})

describe('loading from the read-only source (same path as a dump)', () => {
  it('loads the same row counts as the fixture manifest through PgReader', async () => {
    const source = await CloudSource.open({ url: urlFor(roles.ro), targetUrl: target.db.url })
    try {
      const result = await loadStaging(target.pool, new PgReader(source))
      expect(result.inputKind).toBe('pg')
      expect(result.inputHash).toBeNull()
      const manifest = JSON.parse(readFileSync(join(FIXTURE_DIR, 'manifest.json'), 'utf8')) as { tables: Record<string, { rows: number }> }
      for (const t of result.tables) expect(t.rowsLoaded, t.table).toBe(manifest.tables[t.table]?.rows)
      expect(result.totalRows).toBeGreaterThan(100)
    } finally {
      await source.close()
    }
  })
})
