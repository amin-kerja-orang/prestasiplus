import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { findTable, TABLES, type TableSpec } from '../../../src/migration/ddl/spec'
import { DirReader, DumpFormatError } from '../../../src/migration/staging/readers'
import { LoaderError, loadStaging, SourceNotImplementedError } from '../../../src/migration/staging/load'
import { runStagingCli, STAGING_EXIT } from '../../../src/migration/staging/cli'
import { capture, countAll, createStagingDb, FIXTURE_DIR, tempDir, writeDump, type StagingDb } from './helpers'

// Creating the 118 raw tables takes seconds on a Docker-on-Windows Postgres; allow for it.
vi.setConfig({ testTimeout: 120_000 })

/** Two tables are enough for failure paths: each load otherwise re-creates all 118 tables (seconds). */
const SUBSET = ['users', 'schools'].map((n) => findTable(n) as TableSpec)

let env: StagingDb
beforeAll(async () => {
  env = await createStagingDb()
})
afterAll(async () => {
  await env.close()
})

const manifest = JSON.parse(readFileSync(join(FIXTURE_DIR, 'manifest.json'), 'utf8')) as {
  tables: Record<string, { rows: number }>
}

describe('staging:load on the synthetic fixture (AC1, AC7)', () => {
  it('loads every table and each row count equals the fixture manifest', async () => {
    const result = await loadStaging(env.pool, new DirReader(FIXTURE_DIR))
    const counts = await countAll(env.pool)
    for (const t of TABLES) expect(counts[t.name], t.name).toBe(manifest.tables[t.name]?.rows)
    expect(result.tables).toHaveLength(TABLES.length)
    expect(result.tables.every((t) => !t.absent)).toBe(true)
    expect(result.totalRows).toBe(Object.values(manifest.tables).reduce((s, t) => s + t.rows, 0))
    expect(result.inputKind).toBe('dir')
    expect(result.inputHash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('stamps _row_hash and _loaded_at on every row and keeps the source values', async () => {
    const res = await env.pool.query(
      `select count(*)::int as n, count("_row_hash")::int as hashed, count("_loaded_at")::int as stamped from staging_cloud.users`,
    )
    expect(res.rows[0]).toEqual({ n: 13, hashed: 13, stamped: 13 })
    const jsonb = await env.pool.query(`select config from staging_cloud.games where id = 1`)
    expect(jsonb.rows[0].config).toEqual({ level: 1 })
  })

  it('keeps no constraint except the primary key (dirty data loads)', async () => {
    const res = await env.pool.query<{ contype: string; n: number }>(
      `select c.contype, count(*)::int as n from pg_constraint c join pg_namespace n on n.oid = c.connamespace
        where n.nspname in ('staging_cloud', 'archive_cloud') group by 1`,
    )
    expect(res.rows).toEqual([{ contype: 'p', n: TABLES.filter((t) => t.pk).length }])
    // the fixture really contains a duplicate pivot row and orphans, so the loader did not filter anything
    const dup = await env.pool.query(`select count(*)::int as n from staging_cloud.classroom_student where classroom_id = 1 and student_id = 1`)
    expect(dup.rows[0].n).toBe(2)
  })

  it('is repeatable: a second run leaves the same row counts and drops leftovers', async () => {
    const before = await countAll(env.pool)
    await env.pool.query(`insert into staging_cloud.schools (id, name) values (424242, 'leftover')`)
    await loadStaging(env.pool, new DirReader(FIXTURE_DIR))
    expect(await countAll(env.pool)).toEqual(before)
  })

  it('rolls back as a whole: a failed load keeps the previous staging data', async () => {
    const before = await countAll(env.pool)
    const dir = tempDir()
    try {
      writeDump(dir.path, { schools: [{ id: 1, name: 'x' }], users: [{ id: 1, surprise_col: 'v' }] })
      await expect(loadStaging(env.pool, new DirReader(dir.path), { tables: SUBSET })).rejects.toBeInstanceOf(LoaderError)
    } finally {
      dir.cleanup()
    }
    expect(await countAll(env.pool)).toEqual(before)
  })
})

describe('loader strictness', () => {
  const run = async (tables: Parameters<typeof writeDump>[1], opts: NonNullable<Parameters<typeof loadStaging>[2]> = {}, rows?: Record<string, number>) => {
    const dir = tempDir()
    try {
      writeDump(dir.path, tables, rows)
      return await loadStaging(env.pool, new DirReader(dir.path), { tables: SUBSET, ...opts })
    } finally {
      dir.cleanup()
    }
  }

  it('refuses a column that staging_cloud.sql does not define, naming it but never a value', async () => {
    const err = await run({ users: [{ id: 1, hidden_notes: 'PERSONAL-VALUE-XYZ' }] }).catch((e: unknown) => e as Error)
    expect(err).toBeInstanceOf(LoaderError)
    expect((err as Error).message).toContain('hidden_notes')
    expect((err as Error).message).not.toContain('PERSONAL-VALUE-XYZ')
  })

  it('drops unknown columns only with allowExtraColumns, and reports them', async () => {
    const result = await run({ users: [{ id: 1, hidden_notes: 'v', name: 'n' }] }, { allowExtraColumns: true })
    const users = result.tables.find((t) => t.table === 'users')
    expect(users?.extraColumns).toEqual(['hidden_notes'])
    expect(users?.rowsLoaded).toBe(1)
  })

  it('does not forward a driver message that could echo a value', async () => {
    const err = await run({ users: [{ id: 'SECRET-VALUE-123' }] }).catch((e: unknown) => e as Error)
    expect(err).toBeInstanceOf(LoaderError)
    expect((err as Error).message).toMatch(/SQLSTATE 22P02/)
    expect((err as Error).message).not.toContain('SECRET-VALUE-123')
  })

  it('fails when the manifest row count differs from the rows read', async () => {
    await expect(run({ schools: [{ id: 1 }] }, {}, { schools: 2 })).rejects.toThrow(/promises 2 rows but 1 were read/)
  })

  it('creates an input-absent table empty and flags it', async () => {
    const result = await run({ schools: [{ id: 1, name: 'x' }] })
    expect(result.tables.find((t) => t.table === 'users')?.absent).toBe(true)
    expect(result.tables.find((t) => t.table === 'schools')?.absent).toBe(false)
  })

  it('rejects a bad manifest: unknown table, path-like file name, wrong format', async () => {
    const dir = tempDir()
    try {
      const fs = await import('node:fs')
      const write = (tables: unknown, format = 'pp-staging-dump/1') =>
        fs.writeFileSync(join(dir.path, 'manifest.json'), JSON.stringify({ format, source: 'cloud', tables }))
      write({ not_a_table: { rows: 0 } })
      expect(() => new DirReader(dir.path)).toThrow(DumpFormatError)
      write({ users: { rows: 1, file: '../users.ndjson' } })
      expect(() => new DirReader(dir.path)).toThrow(/plain file name/)
      write({}, 'other/9')
      expect(() => new DirReader(dir.path)).toThrow(/format/)
    } finally {
      dir.cleanup()
    }
  })

  it('knows the staging_my source name but does not implement it (OD-13)', async () => {
    await expect(loadStaging(env.pool, new DirReader(FIXTURE_DIR), { source: 'my' })).rejects.toBeInstanceOf(SourceNotImplementedError)
  })
})

describe('staging:load command', () => {
  it('loads from --from and returns 0', async () => {
    const io = capture()
    const code = await runStagingCli(['staging:load', '--from', FIXTURE_DIR], { env: { DATABASE_URL: env.db.url }, pool: env.pool, out: io.out, err: io.err })
    expect(code).toBe(STAGING_EXIT.ok)
    expect(io.text()).toMatch(/Staging load finished: 118 tables/)
  })

  it('returns 2 without an input, and 2 with both inputs', async () => {
    const a = capture()
    expect(await runStagingCli(['staging:load'], { env: { DATABASE_URL: env.db.url }, pool: env.pool, out: a.out, err: a.err })).toBe(STAGING_EXIT.usage)
    const b = capture()
    expect(
      await runStagingCli(['staging:load', '--from', FIXTURE_DIR], {
        env: { DATABASE_URL: env.db.url, CLOUD_SOURCE_URL: 'postgresql://u:p@127.0.0.1:1/x' },
        pool: env.pool,
        out: b.out,
        err: b.err,
      }),
    ).toBe(STAGING_EXIT.usage)
  })

  it('returns 1 for an unknown or unimplemented source and for a bad dump', async () => {
    const io = capture()
    expect(await runStagingCli(['staging:load', '--source', 'mysql', '--from', FIXTURE_DIR], { env: {}, pool: env.pool, out: io.out, err: io.err })).toBe(STAGING_EXIT.failed)
    expect(await runStagingCli(['staging:load', '--source', 'my', '--from', FIXTURE_DIR], { env: {}, pool: env.pool, out: io.out, err: io.err })).toBe(STAGING_EXIT.failed)
    expect(await runStagingCli(['staging:load', '--from', join(FIXTURE_DIR, 'nope')], { env: {}, pool: env.pool, out: io.out, err: io.err })).toBe(STAGING_EXIT.failed)
  })
})
