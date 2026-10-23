import type pg from 'pg'

import { ApplyGuardError } from './apply-guard'

/**
 * The per-source advisory lock key. One string for every writer of a source (the standalone `migrate:core` and
 * `migrate:activity` commands and the orchestrator), so two runs can never write the same source at once.
 */
export const sourceLockKey = (source: string): string => `etl:source:${source}`

/** Another migration run holds the lock of the source. Exit code 2 like the other guard refusals (`ApplyGuardError`). */
export class SourceLockBusyError extends ApplyGuardError {
  constructor(readonly source: string) {
    super(`Refusing to run: another migration run holds the lock for source ${source}.`)
    this.name = 'SourceLockBusyError'
  }
}

/**
 * Runs `fn` while holding the session advisory lock of `source` on a dedicated connection (never a pooled query, so
 * the lock lives exactly as long as `fn`). Dry-run and apply both take it: a dry-run reads staging that an apply may be
 * changing. Throws `SourceLockBusyError` before `fn` starts when the lock is taken. Always unlocks and releases.
 *
 * Take it at the command level, not inside `runCore` / `runActivity`: the orchestrator holds the lock on its own
 * connection and calls those functions directly.
 */
export async function withSourceLock<T>(pool: Pick<pg.Pool, 'connect'>, source: string, fn: () => Promise<T>): Promise<T> {
  const client = await pool.connect()
  let broken = false
  let locked = false
  try {
    const got = await client.query<{ ok: boolean }>(`SELECT pg_try_advisory_lock(hashtextextended($1, 0)) AS ok`, [sourceLockKey(source)])
    if (!got.rows[0]?.ok) throw new SourceLockBusyError(source)
    locked = true
    return await fn()
  } finally {
    if (locked) {
      try {
        const res = await client.query<{ ok: boolean }>(`SELECT pg_advisory_unlock(hashtextextended($1, 0)) AS ok`, [sourceLockKey(source)])
        if (!res.rows[0]?.ok) broken = true
      } catch {
        broken = true
      }
    }
    // A client that could not unlock is destroyed: closing the session releases the lock.
    client.release(broken ? true : undefined)
  }
}
