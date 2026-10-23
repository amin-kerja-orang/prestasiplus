import { randomBytes } from 'node:crypto'
import { readdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import pg from 'pg'
import type { TestProject } from 'vitest/node'

declare module 'vitest' {
  export interface ProvidedContext {
    /** Admin connection URL of the Postgres server the tests use ('' when it could not start). */
    testDbAdminUrl: string
    /** Name of the migrated template database each test file clones. */
    testDbTemplate: string
    /** Why the server is unavailable (empty when it is). */
    testDbError: string
  }
}

const MIGRATIONS_DIR = fileURLToPath(new URL('../../prisma/migrations/', import.meta.url))

export function withDatabase(url: string, database: string): string {
  const u = new URL(url)
  u.pathname = `/${database}`
  u.search = ''
  return u.toString()
}

/** Applies every `prisma/migrations/<name>/migration.sql` in name order (what `migrate deploy` runs). */
export async function applyMigrations(url: string): Promise<void> {
  const client = new pg.Client({ connectionString: url })
  await client.connect()
  try {
    const dirs = readdirSync(MIGRATIONS_DIR)
      .filter((d) => statSync(join(MIGRATIONS_DIR, d)).isDirectory())
      .sort()
    for (const dir of dirs) await client.query(readFileSync(join(MIGRATIONS_DIR, dir, 'migration.sql'), 'utf8'))
  } finally {
    await client.end()
  }
}

/** The restricted id files of `runCore --apply` that specs write into `.migration-out/core-test-*` (`testOutDir`). */
function removeMigrationTestOutputs(): void {
  const root = fileURLToPath(new URL('../../../../.migration-out/', import.meta.url))
  try {
    for (const d of readdirSync(root)) if (d.startsWith('core-test-')) rmSync(join(root, d), { recursive: true, force: true })
  } catch {
    // no such folder: nothing to remove
  }
}

/**
 * Starts (or connects to) one Postgres for the whole run, migrates a template database once, and
 * hands the coordinates to the workers. `TEST_DATABASE_URL` (CI service container) wins over
 * Testcontainers. If neither works, only the DB tests fail (with the reason); other tests still run.
 */
export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  let container: StartedPostgreSqlContainer | undefined
  let adminUrl = process.env.TEST_DATABASE_URL ?? ''
  const template = `pp_tpl_${randomBytes(6).toString('hex')}`
  try {
    if (!adminUrl) {
      // Throwaway test server: skip disk flushes. Every spec clones a template database, and with
      // fsync on, CREATE DATABASE ... TEMPLATE took 20+ s under a full run (BE-03).
      container = await new PostgreSqlContainer('postgres:16-alpine')
        .withCommand(['postgres', '-c', 'fsync=off', '-c', 'synchronous_commit=off', '-c', 'full_page_writes=off', '-c', 'max_connections=400'])
        .start()
      // 127.0.0.1, not localhost: on Windows localhost may resolve to ::1 first and stall or fail.
      adminUrl = container.getConnectionUri().replace('@localhost:', '@127.0.0.1:')
    }
    const admin = new pg.Client({ connectionString: adminUrl })
    await admin.connect()
    try {
      await admin.query(`CREATE DATABASE "${template}"`)
    } finally {
      await admin.end()
    }
    await applyMigrations(withDatabase(adminUrl, template))
    project.provide('testDbAdminUrl', adminUrl)
    project.provide('testDbTemplate', template)
    project.provide('testDbError', '')
  } catch (err) {
    project.provide('testDbAdminUrl', '')
    project.provide('testDbTemplate', '')
    project.provide(
      'testDbError',
      `Test database unavailable (start Docker or set TEST_DATABASE_URL): ${err instanceof Error ? err.message : String(err)}`,
    )
  }

  return async () => {
    removeMigrationTestOutputs()
    try {
      if (adminUrl && !container) {
        const admin = new pg.Client({ connectionString: adminUrl })
        await admin.connect()
        await admin.query(`DROP DATABASE IF EXISTS "${template}" WITH (FORCE)`)
        await admin.end()
      }
    } finally {
      await container?.stop()
    }
  }
}
