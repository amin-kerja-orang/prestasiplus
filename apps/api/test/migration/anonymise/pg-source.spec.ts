import { randomBytes } from 'node:crypto'
import { existsSync, readdirSync } from 'node:fs'

import pg from 'pg'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'

import { ANON_EXIT, runAnonymiseCli } from '../../../src/migration/anonymise/cli'
import { renderDdl } from '../../../src/migration/ddl/render'
import { findTable, type TableSpec } from '../../../src/migration/ddl/spec'
import { withDatabase } from '../../support/global-setup'
import { allText, capture, originalValues, piiTables, readDump, scratch, TEST_KEY } from './helpers'

/**
 * `--source pg`: the anonymiser reads a restore through the same read-only guard as `staging:load`.
 * Only users and schools exist in the scratch source, so the other tables are reported absent.
 */
const SUBSET = ['users', 'schools'].map((n) => findTable(n) as TableSpec)
const adminUrl = inject('testDbAdminUrl')
const suffix = randomBytes(4).toString('hex')
const PASSWORD = 'Fixture-pass-not-a-secret'
const sourceDb = `anon_src_${suffix}`
const roles = { ro: `pp_anon_ro_${suffix}`, writer: `pp_anon_w_${suffix}` }
const work = scratch()

const urlFor = (role: string, password = PASSWORD): string => {
  const u = new URL(withDatabase(adminUrl, sourceDb))
  u.username = role
  u.password = password
  return u.toString()
}

let admin: pg.Client
let sourceAdmin: pg.Client

beforeAll(async () => {
  if (!adminUrl) throw new Error('Test database unavailable.')
  admin = new pg.Client({ connectionString: adminUrl })
  await admin.connect()
  await admin.query(`create database "${sourceDb}"`)
  sourceAdmin = new pg.Client({ connectionString: withDatabase(adminUrl, sourceDb) })
  await sourceAdmin.connect()
  await sourceAdmin.query(renderDdl(SUBSET))
  const data = piiTables()
  for (const t of SUBSET) {
    await sourceAdmin.query(
      `alter table "staging_cloud"."${t.name}" set schema public;
       alter table public."${t.name}" drop column "_loaded_at", drop column "_row_hash"`,
    )
  }
  await sourceAdmin.query('drop schema staging_cloud; drop schema archive_cloud')
  for (const t of SUBSET) {
    await sourceAdmin.query(
      `insert into public."${t.name}" select * from jsonb_populate_recordset(null::public."${t.name}", $1::jsonb)`,
      [JSON.stringify(data[t.name])],
    )
  }
  for (const role of Object.values(roles)) {
    await admin.query(`create role "${role}" login password '${PASSWORD}'`)
    await admin.query(`grant connect on database "${sourceDb}" to "${role}"`)
    await sourceAdmin.query(`grant select on all tables in schema public to "${role}"`)
  }
  await sourceAdmin.query(`grant insert on public.users to "${roles.writer}"`)
}, 120_000)

afterAll(async () => {
  await sourceAdmin?.end()
  await admin?.query(`drop database if exists "${sourceDb}" with (force)`)
  for (const role of Object.values(roles)) await admin?.query(`drop role if exists "${role}"`)
  await admin?.end()
  work.cleanup()
})

const run = async (url: string, out: string) => {
  const log = capture()
  const code = await runAnonymiseCli(['anonymise:run', '--source', 'pg', '--out', out], {
    env: { ANON_HMAC_KEY: TEST_KEY, CLOUD_SOURCE_URL: url },
    out: log.out,
    err: log.err,
  })
  return { code, log }
}

describe('anonymise:run --source pg', () => {
  it('reads through a SELECT-only role and writes an anonymised dump with no original value', async () => {
    const out = work.out('pg-ok')
    const r = await run(urlFor(roles.ro), out)
    expect(r.code, r.log.text()).toBe(ANON_EXIT.ok)
    const dump = readDump(out)
    expect(dump.users).toHaveLength(6)
    expect(dump.schools).toHaveLength(1)
    expect(Object.keys(dump)).toEqual(expect.arrayContaining(['schools', 'users']))
    const text = allText(out)
    for (const original of originalValues()) expect(text.includes(original), original.slice(0, 4)).toBe(false)
    expect(dump.users?.[0]?.name).toMatch(/^Nama Anon /)
    expect(dump.users?.[2]?.email).toBe(dump.users?.[0]?.email)
    // the connection string, its user and its password are never logged
    for (const secret of [PASSWORD, roles.ro, sourceDb]) expect(r.log.text()).not.toContain(secret)
    expect(r.log.text()).toMatch(/is absent from the input/)
  })

  it('refuses a source role that can write, before reading anything', async () => {
    const out = work.out('pg-writer')
    const r = await run(urlFor(roles.writer), out)
    expect(r.code).toBe(ANON_EXIT.sourceRefused)
    expect(r.log.text()).toMatch(/not read-only/)
    expect(existsSync(out) ? readdirSync(out) : []).toEqual([])
    expect(r.log.text()).not.toContain(PASSWORD)
  })

  it('a failed connection reports no password and no user', async () => {
    const out = work.out('pg-badpw')
    const r = await run(urlFor(roles.ro, 'Wrong-Password-1'), out)
    expect(r.code).toBe(ANON_EXIT.failed)
    expect(r.log.text()).not.toContain('Wrong-Password-1')
    expect(r.log.text()).not.toContain(roles.ro)
    expect(existsSync(out) ? readdirSync(out) : []).toEqual([])
  })
})
