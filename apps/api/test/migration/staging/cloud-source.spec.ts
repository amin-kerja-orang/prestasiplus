import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import pg from 'pg'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'

import {
  CloudSource,
  CloudSourceConfigError,
  CloudSourceConnectError,
  ReadOnlyViolationError,
} from '../../../src/migration/cloud-source'
import { renderDdl } from '../../../src/migration/ddl/render'
import { findTable, type TableSpec } from '../../../src/migration/ddl/spec'
import { runStagingCli, STAGING_EXIT } from '../../../src/migration/staging/cli'
import { serverIdentity } from '../../../src/migration/staging/guard'
import { loadStaging } from '../../../src/migration/staging/load'
import { DirReader, PgReader } from '../../../src/migration/staging/readers'
import { withDatabase } from '../../support/global-setup'
import { capture, createStagingDb, FIXTURE_DIR, stagingEnv, type StagingDb } from './helpers'

// Only the tables the tests read: creating all 127 takes seconds on a Docker-on-Windows Postgres.
const SUBSET = ['users', 'schools'].map((n) => findTable(n) as TableSpec)

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
  fileWriter: `pp_fw_${suffix}`,
  member: `pp_mem_${suffix}`,
  group: `pp_grp_${suffix}`,
  sequence: `pp_seq_${suffix}`,
  chainA: `pp_cha_${suffix}`,
  chainB: `pp_chb_${suffix}`,
  chainC: `pp_chc_${suffix}`,
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

  // The "restored dump": the spec tables (users, schools) in schema public, loaded from the fixture.
  await sourceAdmin.query(renderDdl(SUBSET))
  for (const t of SUBSET) {
    await sourceAdmin.query(
      `alter table "staging_cloud"."${t.name}" set schema public;
       alter table public."${t.name}" drop column "_loaded_at", drop column "_row_hash"`,
    )
  }
  await sourceAdmin.query('drop schema staging_cloud; drop schema archive_cloud')
  const reader = new DirReader(FIXTURE_DIR)
  for (const t of SUBSET) {
    for await (const batch of reader.read(t.name, 500)) {
      await sourceAdmin.query(`insert into public."${t.name}" select * from jsonb_populate_recordset(null::public."${t.name}", $1::jsonb)`, [JSON.stringify(batch)])
    }
  }

  const mk = async (role: string, extra = '', login = true) => {
    await admin.query(`create role "${role}" ${login ? 'login' : 'nologin'} password '${PASSWORD}' ${extra}`)
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
  // M2: membership without INHERIT still counts.
  await mk(roles.fileWriter)
  await sourceAdmin.query(`grant select on all tables in schema public to "${roles.fileWriter}"`)
  await admin.query(`grant pg_write_server_files to "${roles.fileWriter}" with inherit false`)
  await mk(roles.group, '', false)
  await sourceAdmin.query(`grant insert on public.users to "${roles.group}"`)
  await mk(roles.member)
  await sourceAdmin.query(`grant select on all tables in schema public to "${roles.member}"`)
  await admin.query(`grant "${roles.group}" to "${roles.member}" with inherit false`)
  await mk(roles.sequence)
  await sourceAdmin.query(`grant select on all tables in schema public to "${roles.sequence}"`)

  // chained membership A -> B -> C, every step WITHOUT inherit, C holds INSERT
  await mk(roles.chainC, '', false)
  await sourceAdmin.query(`grant insert on public.users to "${roles.chainC}"`)
  await mk(roles.chainB, '', false)
  await admin.query(`grant "${roles.chainC}" to "${roles.chainB}" with inherit false`)
  await mk(roles.chainA)
  await sourceAdmin.query(`grant select on all tables in schema public to "${roles.chainA}"`)
  await admin.query(`grant "${roles.chainB}" to "${roles.chainA}" with inherit false`)

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
  it('lets a SELECT-only role through, reads inside a read-only transaction, and only reports TEMP', async () => {
    const source = await CloudSource.open({ url: urlFor(roles.ro) })
    try {
      expect(source.statementCount).toBe(1) // only `begin read only ...` ran before any read
      expect(source.warnings.join(' ')).toMatch(/TEMP/)
      expect(await source.tableExists('users')).toBe(true)
      expect(await source.tableExists('cache')).toBe(false)
      let rows = 0
      for await (const batch of source.read('users', 5)) rows += batch.length
      expect(rows).toBe(15)
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
    ['membership of pg_write_server_files without INHERIT (M2)', roles.fileWriter, /member of pg_write_server_files/],
    ['membership of a role that can INSERT, without INHERIT (M2)', roles.member, new RegExp(`member role ${roles.group}: INSERT on public\\.users`)],
  ])('aborts before reading any row when the role has %s', async (_label, role, expected) => {
    const err = await CloudSource.open({ url: urlFor(role) }).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ReadOnlyViolationError)
    expect((err as Error).message).toMatch(expected)
    // Most of these roles cannot even SELECT, so reaching this error proves no table was read first.
    expect((err as Error).message).not.toContain(PASSWORD)
    expect((err as Error).message).not.toContain(role)
  })

  it('aborts for chained NOINHERIT membership A -> B -> C where only C holds INSERT', async () => {
    const err = await CloudSource.open({ url: urlFor(roles.chainA) }).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ReadOnlyViolationError)
    expect((err as Error).message).toMatch(new RegExp(`member role ${roles.chainC}: INSERT on public\.users`))
  })

  it('aborts when the role may use or update a sequence (M2)', async () => {
    await sourceAdmin.query(`create sequence public.pp_seq_${suffix}`)
    await sourceAdmin.query(`grant usage on sequence public.pp_seq_${suffix} to "${roles.sequence}"`)
    try {
      const err = await CloudSource.open({ url: urlFor(roles.sequence) }).catch((e: unknown) => e)
      expect(err).toBeInstanceOf(ReadOnlyViolationError)
      expect((err as Error).message).toMatch(new RegExp(`USAGE or UPDATE on sequence public\\.pp_seq_${suffix}`))
      // the read-only role has no grant on it, so it is fine
      const ok = await CloudSource.open({ url: urlFor(roles.ro) })
      await ok.close()
    } finally {
      await sourceAdmin.query(`drop sequence public.pp_seq_${suffix}`)
    }
  })

  it('aborts when the role may execute a SECURITY DEFINER function (M2)', async () => {
    await sourceAdmin.query(`create function public.pp_secdef_${suffix}() returns int language sql security definer as 'select 1'`)
    try {
      const err = await CloudSource.open({ url: urlFor(roles.ro) }).catch((e: unknown) => e)
      expect(err).toBeInstanceOf(ReadOnlyViolationError)
      expect((err as Error).message).toMatch(new RegExp(`SECURITY DEFINER function public\\.pp_secdef_${suffix}`))
    } finally {
      await sourceAdmin.query(`drop function public.pp_secdef_${suffix}()`)
    }
  })

  it('aborts for a superuser (the admin role of the test server)', async () => {
    const err = await CloudSource.open({ url: withDatabase(adminUrl, sourceDb) }).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ReadOnlyViolationError)
    expect((err as Error).message).toMatch(/SUPERUSER/)
  })

  it('staging:load exits with the source-refused code and creates no staging schema when the role can write', async () => {
    const io = capture()
    const code = await runStagingCli(['staging:load'], {
      env: { ...stagingEnv(target.db), DATABASE_URL: target.db.url, CLOUD_SOURCE_URL: urlFor(roles.insert) },
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

  it('exits with the connect-failure code for a role that does not exist (one specific code)', async () => {
    const io = capture()
    const code = await runStagingCli(['staging:load'], {
      env: { ...stagingEnv(target.db), CLOUD_SOURCE_URL: urlFor(`pp_nobody_${suffix}`) },
      pool: target.pool,
      out: io.out,
      err: io.err,
    })
    expect(code).toBe(STAGING_EXIT.failed)
    expect(io.text()).toMatch(/Could not connect to the cloud source/)
  })
})

describe('source configuration (L1, L2)', () => {
  it('refuses a missing URL and a URL that is not a URL', async () => {
    await expect(CloudSource.open({ url: undefined })).rejects.toBeInstanceOf(CloudSourceConfigError)
    await expect(CloudSource.open({ url: 'not a url' })).rejects.toBeInstanceOf(CloudSourceConfigError)
  })

  it('compares source and target through the server, not the URL text (L1)', async () => {
    const targetId = await serverIdentity(target.pool)
    expect(targetId.database).toBe(target.db.name)
    // Same database reached through a differently spelled URL (user, parameters, host alias).
    const alias = new URL(urlFor(roles.ro, target.db.name))
    alias.hostname = alias.hostname === '127.0.0.1' ? 'localhost' : '127.0.0.1'
    alias.searchParams.set('application_name', 'alias')
    const err = await CloudSource.open({ url: alias.toString(), target: targetId }).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(CloudSourceConfigError)
    expect((err as Error).message).toMatch(/target database/)
    // A different database on the same server is fine.
    const ok = await CloudSource.open({ url: urlFor(roles.ro), target: targetId })
    await ok.close()
  })

  it('requires sslmode=require or verify-full for a remote host (L2)', async () => {
    for (const url of [
      `postgresql://u:${PASSWORD}@db.example.invalid:5432/x`,
      `postgresql://u:${PASSWORD}@db.example.invalid:5432/x?sslmode=disable`,
      `postgresql://u:${PASSWORD}@db.example.invalid:5432/x?sslmode=prefer`,
    ]) {
      const err = await CloudSource.open({ url }).catch((e: unknown) => e)
      expect(err, url).toBeInstanceOf(CloudSourceConfigError)
      expect((err as Error).message).toMatch(/sslmode=require/)
      expect((err as Error).message).not.toContain(PASSWORD)
    }
    // With TLS requested the check passes and the (unresolvable) host is a connect error, not a config error.
    for (const mode of ['require', 'verify-full']) {
      const err = await CloudSource.open({ url: `postgresql://u:${PASSWORD}@db.example.invalid:5432/x?sslmode=${mode}` }).catch((e: unknown) => e)
      expect(err, mode).toBeInstanceOf(CloudSourceConnectError)
      expect((err as Error).message).not.toContain(PASSWORD)
    }
  })

  it('applies the sslmode rule to the host= query parameter, which overrides the URL host (L2)', async () => {
    for (const url of [
      `postgresql://u:${PASSWORD}@localhost/db?host=db.remote.example`,
      `postgresql://u:${PASSWORD}@127.0.0.1/db?host=/var/run/postgresql,db.remote.example`,
    ]) {
      const err = await CloudSource.open({ url }).catch((e: unknown) => e)
      expect(err, url).toBeInstanceOf(CloudSourceConfigError)
      expect((err as Error).message).toMatch(/sslmode=require/)
    }
    // the empty-authority form of the same bypass is not even a parsable URL here, so it is refused too
    const empty = await CloudSource.open({ url: `postgresql://u:${PASSWORD}@/db?host=db.remote.example` }).catch((e: unknown) => e)
    expect(empty).toBeInstanceOf(CloudSourceConfigError)
    expect((empty as Error).message).not.toContain(PASSWORD)
    const ok = await CloudSource.open({ url: `postgresql://u:${PASSWORD}@localhost/db?host=db.remote.example&sslmode=verify-full` }).catch((e: unknown) => e)
    expect(ok).toBeInstanceOf(CloudSourceConnectError) // passes the TLS rule, then fails to connect
  })

  it('does not need sslmode on a loopback host', async () => {
    const err = await CloudSource.open({ url: `postgresql://u:${PASSWORD}@127.0.0.1:1/none` }).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(CloudSourceConnectError)
    expect((err as Error).message).not.toContain(PASSWORD)
  })
})

describe('loading from the read-only source (same path as a dump)', () => {
  it('loads the same row counts as the fixture manifest through PgReader', async () => {
    const source = await CloudSource.open({ url: urlFor(roles.ro), target: await serverIdentity(target.pool) })
    try {
      const result = await loadStaging(target.pool, new PgReader(source), { env: stagingEnv(target.db), tables: SUBSET })
      expect(result.inputKind).toBe('pg')
      expect(result.inputHash).toBeNull()
      const manifest = JSON.parse(readFileSync(join(FIXTURE_DIR, 'manifest.json'), 'utf8')) as { tables: Record<string, { rows: number }> }
      expect(result.tables.map((t) => t.table).sort()).toEqual(['schools', 'users'])
      for (const t of result.tables) expect(t.rowsLoaded, t.table).toBe(manifest.tables[t.table]?.rows)
      // M4 also applies on this path
      const tokens = await target.pool.query(`select count(remember_token)::int as rt, count(parent_invite_token)::int as pit from staging_cloud.users`)
      expect(tokens.rows[0]).toEqual({ rt: 0, pit: 0 })
    } finally {
      await source.close()
    }
  })
})
