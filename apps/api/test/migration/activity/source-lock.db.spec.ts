/**
 * The per-source advisory lock of the standalone `migrate:core` and `migrate:activity` commands (AM-08 follow-up to
 * AM-09): the same key as the orchestrator (`etl:source:<source>`), taken at the command level for dry-run and apply, so
 * two runs can never write the same source at once. Against a real PostgreSQL on the BE-35 fixture.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { ApplyGuardError, SourceLockBusyError, sourceLockKey, withSourceLock } from '../../../src/migration/kit'
import { migrateCore } from '../../../src/migration/load/command'
import { migrateActivity } from '../../../src/migration/load/activity/command'
import { capture } from '../staging/helpers'
import { AS_OF, bootActivity, type ActivityHarness } from './helpers'

let h: ActivityHarness

beforeAll(async () => {
  h = await bootActivity()
}, 300_000)
afterAll(async () => {
  await h?.close()
})

const runs = async (): Promise<number> => h.count('etl_runs')
/** Can another connection take the lock now (i.e. nobody holds it)? Releases it again. */
async function isFree(source = 'cloud'): Promise<boolean> {
  const c = await h.env.pool.connect()
  try {
    const got = (await c.query<{ ok: boolean }>(`select pg_try_advisory_lock(hashtextextended($1, 0)) as ok`, [`etl:source:${source}`])).rows[0]?.ok === true
    if (got) await c.query(`select pg_advisory_unlock(hashtextextended($1, 0))`, [`etl:source:${source}`])
    return got
  } finally {
    c.release()
  }
}
/** Holds the lock on its own connection until `release()` (as the orchestrator does). */
async function hold(source = 'cloud'): Promise<{ release(): Promise<void> }> {
  const c = await h.env.pool.connect()
  const got = (await c.query<{ ok: boolean }>(`select pg_try_advisory_lock(hashtextextended($1, 0)) as ok`, [`etl:source:${source}`])).rows[0]?.ok
  if (!got) {
    c.release()
    throw new Error('test setup: the lock was already held')
  }
  return {
    async release() {
      await c.query(`select pg_advisory_unlock(hashtextextended($1, 0))`, [`etl:source:${source}`])
      c.release()
    },
  }
}

const core = (mode: 'dry-run' | 'apply', env: Record<string, string> = h.runEnv) => {
  const io = capture()
  const flags = new Map<string, string | true>([['as-of', AS_OF], ['batch-size', '5']])
  return migrateCore.run({ mode, flags, positional: [] }, { pool: h.env.pool, env, out: io.out, err: io.err }).then((code) => ({ code, text: io.text() }))
}
const activity = (mode: 'dry-run' | 'apply', extra: [string, string][] = []) => {
  const io = capture()
  const flags = new Map<string, string | true>([['as-of', AS_OF], ['core-as-of', AS_OF], ['batch-size', '5'], ...extra])
  return migrateActivity.run({ mode, flags, positional: [] }, { pool: h.env.pool, env: h.runEnv, out: io.out, err: io.err }).then((code) => ({ code, text: io.text() }))
}

describe('withSourceLock', () => {
  it('uses the orchestrator key', () => {
    expect(sourceLockKey('cloud')).toBe('etl:source:cloud')
  })

  it('runs the work under the lock and releases it after success', async () => {
    let freeInside: boolean | undefined
    const out = await withSourceLock(h.env.pool, 'cloud', async () => {
      freeInside = await isFree()
      return 42
    })
    expect(out).toBe(42)
    expect(freeInside).toBe(false)
    expect(await isFree()).toBe(true)
  })

  it('releases the lock after the work throws, and passes the error on', async () => {
    await expect(withSourceLock(h.env.pool, 'cloud', async () => Promise.reject(new Error('boom')))).rejects.toThrow('boom')
    expect(await isFree()).toBe(true)
  })

  it('refuses with a guard error (exit 2) and never starts the work when the lock is held; the holder keeps it', async () => {
    const held = await hold()
    try {
      let started = false
      const err = await withSourceLock(h.env.pool, 'cloud', async () => void (started = true)).catch((e: unknown) => e)
      expect(err).toBeInstanceOf(SourceLockBusyError)
      expect(err).toBeInstanceOf(ApplyGuardError)
      expect((err as Error).message).toBe('Refusing to run: another migration run holds the lock for source cloud.')
      expect(started).toBe(false)
      expect(await isFree()).toBe(false)
    } finally {
      await held.release()
    }
    expect(await isFree()).toBe(true)
  })

  it('locks per source: another source is not blocked', async () => {
    const held = await hold('cloud')
    try {
      expect(await withSourceLock(h.env.pool, 'my', async () => 'ok')).toBe('ok')
    } finally {
      await held.release()
    }
  })
})

describe.each([
  ['migrate:core', core],
  ['migrate:activity', activity],
] as const)('%s takes the source lock', (name, run) => {
  it.each(['dry-run', 'apply'] as const)('refuses a %s while the lock is held, before any etl_runs row', async (mode) => {
    const held = await hold()
    try {
      const before = await runs()
      const err = await run(mode).catch((e: unknown) => e)
      expect(err, name).toBeInstanceOf(SourceLockBusyError)
      expect(await runs()).toBe(before)
    } finally {
      await held.release()
    }
    expect(await isFree()).toBe(true)
  })

  it('runs without contention and releases the lock afterwards', async () => {
    const before = await runs()
    const res = await run('dry-run')
    expect(res.code, res.text).toBe(0)
    expect(await runs()).toBeGreaterThan(before)
    expect(await isFree()).toBe(true)
  }, 120_000)
})

describe('the lock is released after a failure', () => {
  it('migrate:activity: a run that throws inside the lock', async () => {
    const err = await activity('dry-run', [['table', 'no_such_entity']]).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(RangeError)
    expect(await isFree()).toBe(true)
  })

  it('migrate:core: a run that throws inside the lock', async () => {
    const err = await core('dry-run', { NODE_ENV: 'production' }).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(Error)
    expect(err).not.toBeInstanceOf(SourceLockBusyError)
    expect(await isFree()).toBe(true)
  })
})
