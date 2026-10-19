import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import pg from 'pg'

import { DUMP_FORMAT } from '../../../src/migration/staging/readers'
import { TABLES, schemaOf, findTable } from '../../../src/migration/ddl/spec'
import { createTestDatabase, type TestDatabase } from '../../support/db'

export const FIXTURE_DIR = fileURLToPath(new URL('../fixtures/cloud-tiny/', import.meta.url))
export const REPO_ROOT = fileURLToPath(new URL('../../../../../', import.meta.url))

export interface StagingDb {
  db: TestDatabase
  pool: pg.Pool
  close(): Promise<void>
}

/** A private migrated database plus a `pg` pool on it (the loader works on `pg`). */
export async function createStagingDb(): Promise<StagingDb> {
  const db = await createTestDatabase()
  const pool = new pg.Pool({ connectionString: db.url, max: 4 })
  return {
    db,
    pool,
    async close() {
      await pool.end()
      await db.drop()
    },
  }
}

export interface TempDir {
  path: string
  cleanup(): void
}

export function tempDir(prefix = 'pp-staging-'): TempDir {
  const path = mkdtempSync(join(tmpdir(), prefix))
  return { path, cleanup: () => rmSync(path, { recursive: true, force: true }) }
}

/** Writes a small dump directory: `tables` maps table name to rows. */
export function writeDump(dir: string, tables: Record<string, Record<string, unknown>[]>, manifestRows?: Record<string, number>): void {
  mkdirSync(dir, { recursive: true })
  const manifestTables: Record<string, { rows: number; file?: string }> = {}
  for (const [name, rows] of Object.entries(tables)) {
    const declared = manifestRows?.[name] ?? rows.length
    if (rows.length === 0 && declared === 0) {
      manifestTables[name] = { rows: 0 }
      continue
    }
    manifestTables[name] = { rows: declared, file: `${name}.ndjson` }
    writeFileSync(join(dir, `${name}.ndjson`), `${rows.map((r) => JSON.stringify(r)).join('\n')}\n`)
  }
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify({ format: DUMP_FORMAT, source: 'cloud', tables: manifestTables }))
}

export async function countRows(pool: pg.Pool, table: string): Promise<number> {
  const spec = findTable(table)
  if (!spec) throw new Error(`Unknown table ${table}`)
  const res = await pool.query<{ n: number }>(`select count(*)::int as n from "${schemaOf(spec)}"."${table}"`)
  return res.rows[0]?.n ?? 0
}

export async function countAll(pool: pg.Pool): Promise<Record<string, number>> {
  const out: Record<string, number> = {}
  for (const t of TABLES) out[t.name] = await countRows(pool, t.name)
  return out
}

/** Collects what a CLI run prints. */
export function capture() {
  const lines: string[] = []
  return {
    lines,
    out: (l: string) => void lines.push(l),
    err: (l: string) => void lines.push(l),
    text: () => lines.join('\n'),
  }
}

/** Environment under which a destructive staging load is allowed for this test database (M1). */
export function stagingEnv(db: { name: string }, extra: Record<string, string> = {}): Record<string, string> {
  return { NODE_ENV: 'test', PP_ALLOW_STAGING_RESET: '1', PP_STAGING_DB_ALLOWLIST: db.name, ...extra }
}
