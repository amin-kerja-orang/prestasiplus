import { randomBytes } from 'node:crypto'

import pg from 'pg'
import { inject } from 'vitest'

import { createPrismaClient, type PrismaClient } from '../../src/db/client'
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
  const prisma = createPrismaClient(url)
  const pool = new pg.Pool({ connectionString: url, max: 2 })

  return {
    name,
    url,
    prisma,
    async query(sql, params) {
      const res = await pool.query(sql, params)
      return res.rows
    },
    async drop() {
      await prisma.$disconnect()
      await pool.end()
      const a = new pg.Client({ connectionString: adminUrl })
      await a.connect()
      try {
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
