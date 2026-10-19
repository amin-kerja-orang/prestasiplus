import { AsyncLocalStorage } from 'node:async_hooks'

import type { PrismaClient, TxClient } from './client'

const storage = new AsyncLocalStorage<TxClient>()

export interface TransactionOptions {
  /** Milliseconds to wait for a connection (Prisma default 2000). */
  maxWait?: number
  /** Milliseconds the transaction may run (Prisma default 5000). */
  timeout?: number
}

/** The transaction the current async context runs in, if any. */
export function currentTransaction(): TxClient | undefined {
  return storage.getStore()
}

/**
 * Runs `fn` in one database transaction: commit when it resolves, roll back and rethrow when it
 * throws. A nested call reuses the outer transaction (no savepoints, same as the mock's
 * `db.transaction`): the outermost call decides commit or rollback, so an error that escapes an
 * inner call rolls back the whole outer unit of work.
 */
export async function withTransaction<T>(
  prisma: PrismaClient,
  fn: (tx: TxClient) => Promise<T>,
  options: TransactionOptions = {},
): Promise<T> {
  const outer = storage.getStore()
  if (outer) return fn(outer)
  return prisma.$transaction((tx) => storage.run(tx, () => fn(tx)), options)
}
