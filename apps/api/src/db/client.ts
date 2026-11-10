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
    // `-c jit=off`: the JIT compiler of Postgres costs 1 to 1.5 s on first use of every bank-wide count (a query with many sub-selects over
    // 450 thousand questions), more than the count itself (UAT, measured: 3.8 s with JIT, 0.6 s without). The API runs only short OLTP reads and
    // grouped counts that JIT never pays back, so it is off for every connection of the pool (a session setting, no server change).
    { connectionString, connectionTimeoutMillis: 30_000, options: '-c jit=off' },
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
