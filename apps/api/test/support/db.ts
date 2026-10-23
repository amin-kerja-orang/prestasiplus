import { randomBytes } from 'node:crypto'

import pg from 'pg'
import { inject } from 'vitest'

import { PrismaPg } from '@prisma/adapter-pg'

import { PrismaClient } from '../../src/db/client'
import { withDatabase } from './global-setup'

export interface TestDatabase {
  name: string
  url: string
  /** Plain Prisma client on the test database (not Nest). */
  prisma: PrismaClient
  /** Runs SQL (DDL for scratch tables, fixtures, assertions) outside Prisma. */
  query<T extends pg.QueryResultRow = pg.QueryResultRow>(sql: string, params?: unknown[]): Promise<T[]>
  /** Disconnects and drops the database. */
  drop(): Promise<void>
}

/**
 * A private database for one test file: a clone of the migrated template (`CREATE DATABASE ...
 * TEMPLATE`, a few tens of milliseconds). Files cannot see each other's data, extensions and
 * sequences are real, and nothing needs truncating. Call `drop()` in `afterAll`.
 */
export async function createTestDatabase(): Promise<TestDatabase> {
  const adminUrl = inject('testDbAdminUrl')
  const template = inject('testDbTemplate')
  if (!adminUrl) throw new Error(inject('testDbError') || 'Test database unavailable.')

  const name = `t_${randomBytes(6).toString('hex')}`
  const admin = new pg.Client({ connectionString: adminUrl })
  await admin.connect()
  try {
    await admin.query(`CREATE DATABASE "${name}" TEMPLATE "${template}"`)
  } finally {
    await admin.end()
  }

  const url = withDatabase(adminUrl, name)
  // Small pools: every test file has its own database and the files run in parallel.
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url, max: 3, connectionTimeoutMillis: 30_000 }) })
  const pool = new pg.Pool({ connectionString: url, max: 1, connectionTimeoutMillis: 30_000 }) // same 30 s as src/db/client.ts
  // A pg.Pool without an 'error' listener turns an idle-connection error into an uncaught exception. The only
  // error expected is the server terminating the connection (57P01), and only once the drop has started.
  let dropping = false
  pool.on('error', (err: Error & { code?: string }) => {
    if (!(dropping && err.code === '57P01')) throw err
  })

  return {
    name,
    url,
    prisma,
    async query(sql, params) {
      const res = await pool.query(sql, params)
      return res.rows
    },
    async drop() {
      dropping = true
      await prisma.$disconnect()
      await pool.end()
      const a = new pg.Client({ connectionString: adminUrl })
      await a.connect()
      try {
        await waitForClientsToLeave(a, name)
        await a.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`)
      } finally {
        await a.end()
      }
    },
  }
}

/**
 * Transaction limits for tests. Prisma's defaults (maxWait 2 s, timeout 5 s) are too tight when the
 * test host is loaded (parallel test files, each with its own database), and a slow start shows up
 * as a flaky failure. Production keeps Prisma's defaults.
 */
export const TEST_TX = { maxWait: 20_000, timeout: 20_000 } as const

/**
 * `pg.Pool.end()` (and so `$disconnect()`) resolves once the clients are sent their Terminate message, not
 * once the server backends have exited. `DROP DATABASE ... WITH (FORCE)` signalling a backend that is still
 * shutting down makes it answer 57P01 ("terminating connection due to administrator command") to a client
 * that is already closing, which node-postgres reports as an unhandled error on a random later spec. Waiting
 * for our own backends to be gone makes FORCE a no-op for them; it stays only as the fallback for a leaked
 * connection, after a bounded wait.
 */
async function waitForClientsToLeave(admin: pg.Client, database: string, timeoutMs = 5_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const res = await admin.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM pg_stat_activity WHERE datname = $1 AND backend_type = 'client backend' AND pid <> pg_backend_pid()`,
      [database],
    )
    if (res.rows[0]?.n === '0' || Date.now() >= deadline) return
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
}
