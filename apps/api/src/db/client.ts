import { PrismaPg } from '@prisma/adapter-pg'

import { PrismaClient } from './generated/client'

export { PrismaClient }
/** Client used inside a transaction callback. */
export type TxClient = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0]

/**
 * Builds a Prisma client over a `pg` pool (driver adapter; no query engine binary is needed, so the
 * same code runs on Windows, glibc and Alpine/musl). Used by `PrismaService`, the seed runner and
 * the test harness. Connections are lazy: building a client never touches the database.
 */
export function createAdapter(connectionString: string): PrismaPg {
  return new PrismaPg(
    // 30 s: under load a new connection to Postgres (Docker port forward) can take over 5 s, which
    // surfaced as random 500s and P1001 in full test runs (BE-05). Queries still fail fast once connected.
    { connectionString, connectionTimeoutMillis: 30_000 },
    {
      // An idle-connection error (database restarted) must not crash the process; the next query
      // opens a fresh connection.
      onPoolError: () => undefined,
      onConnectionError: () => undefined,
    },
  )
}

export function createPrismaClient(connectionString: string): PrismaClient {
  return new PrismaClient({ adapter: createAdapter(connectionString) })
}
