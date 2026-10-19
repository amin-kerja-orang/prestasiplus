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
    { connectionString, connectionTimeoutMillis: 5_000 },
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
