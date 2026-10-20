import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { createPrismaClient, type PrismaClient } from '../../../src/db/client'
import { JobError, JobsConfig, JobsService, JobsWorker } from '../../../src/modules/jobs'
import { createTestDatabase, type TestDatabase } from '../../support/db'

let db: TestDatabase
const extraClients: PrismaClient[] = []

beforeAll(async () => {
  db = await createTestDatabase()
})
afterAll(async () => {
  for (const c of extraClients) await c.$disconnect()
  await db.drop()
})
beforeEach(async () => {
  await db.query('DELETE FROM jobs')
})

const cfg = (over: Record<string, string> = {}) => new JobsConfig({ get: (k: string) => ({ JOBS_CANCEL_CHECK_MS: '30', ...over })[k] } as never)
const make = (over: Record<string, string> = {}, prisma: PrismaClient = db.prisma) =>
  new JobsService({ client: prisma } as never, cfg(over))
const separate = () => {
  const c = createPrismaClient(db.url)
  extraClients.push(c)
  return c
}
const row = async (id: string) => (await db.query('SELECT * FROM jobs WHERE id = $1', [id]))[0] as Record<string, unknown> & { state: string; attempts: number; error_code: string | null; locked_by: string | null; finished_at: Date | null }
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const deferred = () => {
  let resolve!: () => void
  const promise = new Promise<void>((r) => (resolve = r))
  return { promise, resolve }
}
let seq = 0
const key = () => `k-${++seq}-${Math.random()}`
const makeDue = (id: string) => db.query("UPDATE jobs SET run_after = now() - interval '1 second' WHERE id = $1", [id])

describe('lifecycle', () => {
  it('runs queued -> running -> succeeded', async () => {
    const svc = make()
    let seenState = ''
    svc.register('t.ok', async (job) => {
      seenState = (await row(job.id)).state
      expect(job.attempts).toBe(1)
      expect(job.payload).toEqual({ a: 1 })
      expect(job.entityType).toBe('thing')
    })
    const { id, created } = await svc.enqueue({ type: 't.ok', idempotencyKey: key(), entityType: 'thing', entityId: '7', payload: { a: 1 } })
    expect(created).toBe(true)
    expect((await row(id)).state).toBe('queued')
    expect(await svc.runOnce()).toBe(1)
    expect(seenState).toBe('running')
    const r = await row(id)
    expect(r.state).toBe('succeeded')
    expect(r.attempts).toBe(1)
    expect(r.finished_at).not.toBeNull()
    expect(r.locked_by).toBeNull()
    expect(await svc.runOnce()).toBe(0)
  })

  it('does not run a job before run_after', async () => {
    const svc = make()
    let n = 0
    svc.register('t.later', async () => void n++)
    await svc.enqueue({ type: 't.later', idempotencyKey: key(), runAfter: new Date(Date.now() + 3_600_000) })
    expect(await svc.runOnce()).toBe(0)
    expect(n).toBe(0)
  })

  it('refuses to register a type twice and rejects bad input', async () => {
    const svc = make()
    svc.register('t.dup', async () => undefined)
    expect(() => svc.register('t.dup', async () => undefined)).toThrow()
    await expect(svc.enqueue({ type: 'Bad Type', idempotencyKey: key() })).rejects.toThrow()
    await expect(svc.enqueue({ type: 't.dup', idempotencyKey: key(), maxAttempts: 0 })).rejects.toThrow()
  })

  it('enqueue joins the caller transaction (rolled back with it)', async () => {
    const svc = make()
    const k = key()
    await expect(
      db.prisma.$transaction(async (tx) => {
        await svc.enqueue({ type: 't.tx', idempotencyKey: k }, tx)
        throw new Error('rollback')
      }),
    ).rejects.toThrow('rollback')
    expect(await db.query('SELECT 1 FROM jobs WHERE idempotency_key = $1', [k])).toHaveLength(0)
    await db.prisma.$transaction((tx) => svc.enqueue({ type: 't.tx', idempotencyKey: k }, tx))
    expect(await db.query('SELECT 1 FROM jobs WHERE idempotency_key = $1', [k])).toHaveLength(1)
  })
})

describe('idempotent enqueue', () => {
  it('same key twice gives one row and created=false the second time', async () => {
    const svc = make()
    const k = key()
    const a = await svc.enqueue({ type: 't.idem', idempotencyKey: k, payload: { n: 1 } })
    const b = await svc.enqueue({ type: 't.idem', idempotencyKey: k, payload: { n: 2 } })
    expect(a.created).toBe(true)
    expect(b).toEqual({ id: a.id, created: false })
    const rows = await db.query('SELECT payload FROM jobs WHERE idempotency_key = $1', [k])
    expect(rows).toHaveLength(1)
    expect(rows[0]!.payload).toEqual({ n: 1 })
  })
})

describe('failures and retries', () => {
  it('retries with growing backoff, then fails after max_attempts', async () => {
    const svc = make({ JOBS_BACKOFF_BASE_MS: '5000' })
    svc.register('t.flaky', async () => {
      throw new JobError('UPSTREAM', true)
    })
    const { id } = await svc.enqueue({ type: 't.flaky', idempotencyKey: key(), maxAttempts: 3 })

    await svc.runOnce()
    let r = await row(id)
    expect(r.state).toBe('queued')
    expect(r.attempts).toBe(1)
    expect(r.error_code).toBe('UPSTREAM')
    const d1 = (await db.query<{ s: number }>("SELECT extract(epoch FROM run_after - now())::float8 AS s FROM jobs WHERE id = $1", [id]))[0]!.s
    expect(d1).toBeGreaterThan(3)
    expect(d1).toBeLessThanOrEqual(5.5)
    expect(await svc.runOnce()).toBe(0) // not due yet

    await makeDue(id)
    await svc.runOnce()
    r = await row(id)
    expect(r.state).toBe('queued')
    expect(r.attempts).toBe(2)
    const d2 = (await db.query<{ s: number }>("SELECT extract(epoch FROM run_after - now())::float8 AS s FROM jobs WHERE id = $1", [id]))[0]!.s
    expect(d2).toBeGreaterThan(8)
    expect(d2).toBeLessThanOrEqual(10.5)

    await makeDue(id)
    await svc.runOnce()
    r = await row(id)
    expect(r.state).toBe('failed')
    expect(r.attempts).toBe(3)
    expect(r.error_code).toBe('UPSTREAM')
    expect(r.finished_at).not.toBeNull()
  })

  it('caps the backoff at 300000 ms', async () => {
    const svc = make({ JOBS_BACKOFF_BASE_MS: '200000' })
    svc.register('t.cap', async () => {
      throw new JobError('X', true)
    })
    const { id } = await svc.enqueue({ type: 't.cap', idempotencyKey: key(), maxAttempts: 5 })
    await svc.runOnce()
    await makeDue(id)
    await svc.runOnce() // 2nd attempt: 400000 -> capped
    const s = (await db.query<{ s: number }>("SELECT extract(epoch FROM run_after - now())::float8 AS s FROM jobs WHERE id = $1", [id]))[0]!.s
    expect(s).toBeLessThanOrEqual(300.5)
    expect(s).toBeGreaterThan(290)
  })

  it('a non-retryable error fails immediately', async () => {
    const svc = make()
    svc.register('t.fatal', async () => {
      throw new JobError('BAD_INPUT', false)
    })
    const { id } = await svc.enqueue({ type: 't.fatal', idempotencyKey: key(), maxAttempts: 5 })
    await svc.runOnce()
    const r = await row(id)
    expect(r.state).toBe('failed')
    expect(r.attempts).toBe(1)
    expect(r.error_code).toBe('BAD_INPUT')
  })

  it('an unknown exception becomes retryable INTERNAL and its message is never stored', async () => {
    const svc = make()
    svc.register('t.boom', async () => {
      throw new Error('secret content: student name')
    })
    const { id } = await svc.enqueue({ type: 't.boom', idempotencyKey: key() })
    await svc.runOnce()
    const r = await row(id)
    expect(r.state).toBe('queued')
    expect(r.error_code).toBe('INTERNAL')
    expect(JSON.stringify(r)).not.toContain('secret content')
  })

  it('truncates an over-long error code to 64 characters', async () => {
    const svc = make()
    svc.register('t.long', async () => {
      throw new JobError('E'.repeat(100), false)
    })
    const { id } = await svc.enqueue({ type: 't.long', idempotencyKey: key() })
    await svc.runOnce()
    expect((await row(id)).error_code).toHaveLength(64)
  })

  it('an unknown type fails with UNKNOWN_TYPE and no retry', async () => {
    const svc = make()
    const { id } = await svc.enqueue({ type: 't.nobody', idempotencyKey: key() })
    await svc.runOnce()
    const r = await row(id)
    expect(r.state).toBe('failed')
    expect(r.error_code).toBe('UNKNOWN_TYPE')
  })

  it('a handler that exceeds its timeout is aborted and retried with TIMEOUT', async () => {
    const svc = make()
    let aborted = false
    svc.register(
      't.slow',
      (_job, signal) =>
        new Promise<void>((resolve) => {
          signal.addEventListener('abort', () => {
            aborted = true
            resolve()
          })
        }),
      { timeoutMs: 80 },
    )
    const { id } = await svc.enqueue({ type: 't.slow', idempotencyKey: key() })
    await svc.runOnce()
    const r = await row(id)
    expect(aborted).toBe(true)
    expect(r.state).toBe('queued')
    expect(r.error_code).toBe('TIMEOUT')
  })

  it('a timeout is enforced even when the handler ignores the signal', async () => {
    const svc = make()
    svc.register('t.deaf', () => new Promise<void>(() => undefined), { timeoutMs: 60 })
    const { id } = await svc.enqueue({ type: 't.deaf', idempotencyKey: key(), maxAttempts: 1 })
    await svc.runOnce()
    const r = await row(id)
    expect(r.state).toBe('failed')
    expect(r.error_code).toBe('TIMEOUT')
  })
})

describe('concurrency', () => {
  it('two services on separate connections never run the same job', async () => {
    const a = make({ JOBS_CONCURRENCY: '10' }, separate())
    const b = make({ JOBS_CONCURRENCY: '10' }, separate())
    const calls = new Map<string, number>()
    const handler = async (job: { id: string }) => {
      calls.set(job.id, (calls.get(job.id) ?? 0) + 1)
      await sleep(20)
    }
    a.register('t.par', handler)
    b.register('t.par', handler)
    const ids: string[] = []
    for (let i = 0; i < 20; i++) ids.push((await a.enqueue({ type: 't.par', idempotencyKey: key() })).id)
    const claimed = await Promise.all([a.runOnce(10), b.runOnce(10), a.runOnce(10), b.runOnce(10)])
    expect(claimed.reduce((x, y) => x + y, 0)).toBe(20)
    expect(calls.size).toBe(20)
    for (const n of calls.values()) expect(n).toBe(1)
    const rows = await db.query<{ state: string; attempts: number }>('SELECT state, attempts FROM jobs')
    expect(rows.every((r) => r.state === 'succeeded' && r.attempts === 1)).toBe(true)
  })

  it('skips rows locked by another transaction (SKIP LOCKED)', async () => {
    const svc = make()
    svc.register('t.skip', async () => undefined)
    const { id: locked } = await svc.enqueue({ type: 't.skip', idempotencyKey: key() })
    const { id: free } = await svc.enqueue({ type: 't.skip', idempotencyKey: key() })
    const other = separate()
    const held = deferred()
    const release = deferred()
    const holder = other.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM jobs WHERE id = ${locked}::bigint FOR UPDATE`
      held.resolve()
      await release.promise
    })
    await held.promise
    expect(await svc.runOnce(10)).toBe(1)
    expect((await row(free)).state).toBe('succeeded')
    expect((await row(locked)).state).toBe('queued')
    release.resolve()
    await holder
    expect(await svc.runOnce(10)).toBe(1)
  })

  it('respects JOBS_CONCURRENCY for in-flight jobs', async () => {
    const svc = make({ JOBS_CONCURRENCY: '2' })
    const gate = deferred()
    let running = 0
    let peak = 0
    svc.register('t.cc', async () => {
      peak = Math.max(peak, ++running)
      await gate.promise
      running--
    })
    for (let i = 0; i < 5; i++) await svc.enqueue({ type: 't.cc', idempotencyKey: key() })
    const first = await svc.dispatch(10)
    expect(first.count).toBe(2)
    expect((await svc.dispatch(10)).count).toBe(0)
    gate.resolve()
    await first.done
    expect(peak).toBe(2)
  })
})

describe('cancelFor', () => {
  it('cancels queued jobs of the given entities only', async () => {
    const svc = make()
    svc.register('t.c', async () => undefined)
    const a = await svc.enqueue({ type: 't.c', idempotencyKey: key(), entityType: 'file', entityId: '1' })
    const b = await svc.enqueue({ type: 't.c', idempotencyKey: key(), entityType: 'file', entityId: '2' })
    const c = await svc.enqueue({ type: 't.c', idempotencyKey: key(), entityType: 'page', entityId: '1' })
    expect(await svc.cancelFor('file', ['1'])).toBe(1)
    expect(await svc.cancelFor('file', [])).toBe(0)
    expect((await row(a.id)).state).toBe('cancelled')
    expect((await row(b.id)).state).toBe('queued')
    expect((await row(c.id)).state).toBe('queued')
    expect(await svc.runOnce(10)).toBe(2)
  })

  it('aborts a running job and the final state stays cancelled', async () => {
    const svc = make()
    let signalled = false
    svc.register(
      't.run',
      (_job, signal) =>
        new Promise<void>((resolve) => {
          signal.addEventListener('abort', () => {
            signalled = true
            resolve() // a handler that "succeeds" after being aborted must not override the cancel
          })
        }),
    )
    const { id } = await svc.enqueue({ type: 't.run', idempotencyKey: key(), entityType: 'file', entityId: '9' })
    const run = svc.runOnce()
    while ((await row(id)).state !== 'running') await sleep(10)
    expect(await svc.cancelFor('file', ['9'])).toBe(1)
    await run
    expect(signalled).toBe(true)
    const r = await row(id)
    expect(r.state).toBe('cancelled')
    expect(r.error_code).toBeNull()
  })
})

describe('stuck sweeper and crash recovery', () => {
  it('requeues a running job with an old lock; it completes once and the dead worker is ignored', async () => {
    const dead = make({ JOBS_LOCK_TIMEOUT_MS: '600000', JOBS_CANCEL_CHECK_MS: '600000' }, separate())
    const alive = make({ JOBS_LOCK_TIMEOUT_MS: '600000' }, separate())
    const gate = deferred()
    let deadCalls = 0
    let aliveCalls = 0
    dead.register('t.crash', async () => {
      deadCalls++
      await gate.promise
    })
    alive.register('t.crash', async () => {
      aliveCalls++
    })
    const { id } = await dead.enqueue({ type: 't.crash', idempotencyKey: key() })
    const deadRun = dead.runOnce()
    while ((await row(id)).state !== 'running') await sleep(10)
    expect(await alive.sweepStuck()).toBe(0) // lock is fresh

    await db.query("UPDATE jobs SET locked_at = now() - interval '2 hours' WHERE id = $1", [id])
    expect(await alive.sweepStuck()).toBe(1)
    let r = await row(id)
    expect(r.state).toBe('queued')
    expect(r.attempts).toBe(1)
    expect(r.locked_by).toBeNull()

    expect(await alive.runOnce()).toBe(1)
    r = await row(id)
    expect(r.state).toBe('succeeded')
    expect(r.attempts).toBe(2)

    gate.resolve() // the "dead" worker finally reports success / failure
    await deadRun
    r = await row(id)
    expect(r.state).toBe('succeeded')
    expect(r.attempts).toBe(2)
    expect(deadCalls).toBe(1)
    expect(aliveCalls).toBe(1)
    expect(await alive.runOnce()).toBe(0)
  })

  it('a failure from the dead worker after requeue is ignored too', async () => {
    const dead = make({ JOBS_CANCEL_CHECK_MS: '600000' }, separate())
    const alive = make({}, separate())
    const gate = deferred()
    dead.register('t.crash2', async () => {
      await gate.promise
      throw new JobError('LATE', false)
    })
    alive.register('t.crash2', async () => undefined)
    const { id } = await dead.enqueue({ type: 't.crash2', idempotencyKey: key() })
    const deadRun = dead.runOnce()
    while ((await row(id)).state !== 'running') await sleep(10)
    await db.query("UPDATE jobs SET locked_at = now() - interval '2 hours' WHERE id = $1", [id])
    await alive.sweepStuck()
    gate.resolve()
    await deadRun
    expect((await row(id)).state).toBe('queued') // not failed by the dead worker
    await alive.runOnce()
    expect((await row(id)).state).toBe('succeeded')
  })

  it('fails with STUCK when no attempts are left', async () => {
    const svc = make()
    const { id } = await svc.enqueue({ type: 't.stuck', idempotencyKey: key(), maxAttempts: 1 })
    await db.query("UPDATE jobs SET state = 'running', attempts = 1, locked_by = 'ghost', locked_at = now() - interval '1 day' WHERE id = $1", [id])
    expect(await svc.sweepStuck()).toBe(1)
    const r = await row(id)
    expect(r.state).toBe('failed')
    expect(r.error_code).toBe('STUCK')
    expect(r.finished_at).not.toBeNull()
  })

  it('accepts an explicit "now" for the cutoff', async () => {
    const svc = make({ JOBS_LOCK_TIMEOUT_MS: '60000' })
    const { id } = await svc.enqueue({ type: 't.stuck2', idempotencyKey: key() })
    await db.query("UPDATE jobs SET state = 'running', attempts = 1, locked_by = 'ghost', locked_at = now() WHERE id = $1", [id])
    expect(await svc.sweepStuck()).toBe(0)
    expect(await svc.sweepStuck(new Date(Date.now() + 120_000))).toBe(1)
    expect((await row(id)).state).toBe('queued')
  })
})

describe('JobsWorker', () => {
  it('does nothing when JOBS_WORKER_ENABLED is unset', async () => {
    const config = cfg({ JOBS_POLL_MS: '20' })
    const svc = new JobsService({ client: db.prisma } as never, config)
    let n = 0
    svc.register('t.w0', async () => void n++)
    const { id } = await svc.enqueue({ type: 't.w0', idempotencyKey: key() })
    const worker = new JobsWorker(svc, config)
    worker.onApplicationBootstrap()
    await sleep(200)
    await worker.onModuleDestroy()
    expect(n).toBe(0)
    expect((await row(id)).state).toBe('queued')
  })

  it('runs jobs when enabled and drains on destroy', async () => {
    const config = cfg({ JOBS_WORKER_ENABLED: 'true', JOBS_POLL_MS: '20' })
    const svc = new JobsService({ client: db.prisma } as never, config)
    const gate = deferred()
    let started = 0
    let finished = 0
    svc.register('t.w1', async () => {
      started++
      await gate.promise
      finished++
    })
    const { id } = await svc.enqueue({ type: 't.w1', idempotencyKey: key() })
    const worker = new JobsWorker(svc, config)
    worker.onApplicationBootstrap()
    const t0 = Date.now()
    while (started === 0 && Date.now() - t0 < 5000) await sleep(20)
    expect(started).toBe(1)
    let drained = false
    const stopping = worker.onModuleDestroy().then(() => (drained = true))
    await sleep(100)
    expect(drained).toBe(false) // waits for the in-flight job
    gate.resolve()
    await stopping
    expect(finished).toBe(1)
    expect((await row(id)).state).toBe('succeeded')
    // After drain nothing is claimed any more.
    await svc.enqueue({ type: 't.w1', idempotencyKey: key() })
    expect(await svc.runOnce()).toBe(0)
  })

  it('also sweeps stuck jobs on each tick', async () => {
    const config = cfg({ JOBS_WORKER_ENABLED: 'true', JOBS_LOCK_TIMEOUT_MS: '1000' })
    const svc = new JobsService({ client: db.prisma } as never, config)
    let n = 0
    svc.register('t.w2', async () => void n++)
    const { id } = await svc.enqueue({ type: 't.w2', idempotencyKey: key() })
    await db.query("UPDATE jobs SET state = 'running', attempts = 1, locked_by = 'ghost', locked_at = now() - interval '1 hour' WHERE id = $1", [id])
    const worker = new JobsWorker(svc, config)
    await worker.tick()
    await svc.drain()
    expect(n).toBe(1)
    expect((await row(id)).state).toBe('succeeded')
  })
})

describe('terminal-failure hook (onExhausted)', () => {
  it('runs once with the final code when a job fails for good, not on a retry or a success', async () => {
    const svc = make()
    const seen: Array<[string, string]> = []
    svc.register(
      't.hook',
      async () => {
        throw new JobError('UPSTREAM', true)
      },
      { onExhausted: async (job, code) => void seen.push([job.id, code]) },
    )
    const { id } = await svc.enqueue({ type: 't.hook', idempotencyKey: key(), maxAttempts: 2 })
    await svc.runOnce()
    expect(seen).toEqual([]) // retried, not exhausted
    await makeDue(id)
    await svc.runOnce()
    expect(seen).toEqual([[id, 'UPSTREAM']])
    expect((await row(id)).state).toBe('failed')

    svc.register('t.hook2', async () => undefined, { onExhausted: async () => void seen.push(['x', 'x']) })
    await svc.enqueue({ type: 't.hook2', idempotencyKey: key() })
    await svc.runOnce()
    expect(seen).toHaveLength(1)
  })

  it('also runs for a non-retryable error and for a swept STUCK job, and a throwing hook is swallowed', async () => {
    const svc = make()
    const seen: string[] = []
    svc.register(
      't.hook3',
      async () => {
        throw new JobError('FATAL', false)
      },
      {
        onExhausted: async (_job, code) => {
          seen.push(code)
          throw new Error('hook bug')
        },
      },
    )
    const a = await svc.enqueue({ type: 't.hook3', idempotencyKey: key() })
    await svc.runOnce()
    expect((await row(a.id)).state).toBe('failed')
    expect(seen).toEqual(['FATAL'])

    const b = await svc.enqueue({ type: 't.hook3', idempotencyKey: key(), maxAttempts: 1 })
    await db.query("UPDATE jobs SET state = 'running', attempts = 1, locked_by = 'ghost', locked_at = now() - interval '2 hours' WHERE id = $1", [b.id])
    expect(await svc.sweepStuck()).toBe(1)
    expect((await row(b.id)).state).toBe('failed')
    expect(seen).toEqual(['FATAL', 'STUCK'])
  })

  it('does not run when the job was cancelled while it ran', async () => {
    const svc = make()
    const seen: string[] = []
    const gate = deferred()
    svc.register(
      't.hook4',
      async () => {
        await gate.promise
        throw new JobError('LATE', false)
      },
      { onExhausted: async (_j, code) => void seen.push(code) },
    )
    const { id } = await svc.enqueue({ type: 't.hook4', idempotencyKey: key(), entityType: 'thing', entityId: 'c1' })
    const running = svc.runOnce()
    await sleep(100)
    await svc.cancelFor('thing', ['c1'])
    gate.resolve()
    await running
    expect((await row(id)).state).toBe('cancelled')
    expect(seen).toEqual([])
  })
})

describe('claim fairness and per-claim tokens', () => {
  it('skips a queued job while another job of the same entity runs; other entities proceed', async () => {
    const svc = make({ JOBS_CONCURRENCY: '4' })
    const gate = deferred()
    const started: string[] = []
    svc.register('t.fair', async (job) => {
      started.push(job.entityId ?? '')
      await gate.promise
    })
    await svc.enqueue({ type: 't.fair', idempotencyKey: key(), entityType: 'file', entityId: 'A' })
    await svc.enqueue({ type: 't.fair', idempotencyKey: key(), entityType: 'file', entityId: 'A' })
    await svc.enqueue({ type: 't.fair', idempotencyKey: key(), entityType: 'file', entityId: 'B' })
    await svc.enqueue({ type: 't.fair', idempotencyKey: key() }) // no entity: never held back
    const first = svc.runOnce(4)
    await sleep(300)
    expect(started.sort()).toEqual(['', 'A', 'B'])
    expect(await db.query("SELECT 1 FROM jobs WHERE state = 'queued'")).toHaveLength(1)
    gate.resolve()
    await first
    expect(await svc.runOnce(4)).toBe(1) // the second job of A runs once the first is done
    expect(started.sort()).toEqual(['', 'A', 'A', 'B'])
  })

  it('a run that outlived a sweep cannot close the job after the same process claimed it again', async () => {
    const svc = make({ JOBS_CONCURRENCY: '4', JOBS_LOCK_TIMEOUT_MS: '1000' })
    const gates = [deferred(), deferred()]
    let call = 0
    svc.register('t.token', async () => {
      const gate = gates[call++]!
      await gate.promise
    })
    const { id } = await svc.enqueue({ type: 't.token', idempotencyKey: key(), maxAttempts: 5 })
    const oldRun = svc.runOnce()
    await sleep(100)
    const firstToken = (await row(id)).locked_by
    await db.query("UPDATE jobs SET locked_at = now() - interval '1 hour' WHERE id = $1", [id])
    expect(await svc.sweepStuck()).toBe(1)
    const newRun = svc.runOnce()
    await sleep(100)
    const secondToken = (await row(id)).locked_by
    expect(secondToken).not.toBe(firstToken)
    expect(secondToken?.split(':')[0]).toBe(firstToken?.split(':')[0]) // same process, new token
    gates[0]!.resolve() // the old run finishes late
    await oldRun
    const mid = await row(id)
    expect(mid.state).toBe('running')
    expect(mid.locked_by).toBe(secondToken)
    gates[1]!.resolve()
    await newRun
    expect((await row(id)).state).toBe('succeeded')
  })

  it('cancelFor joins the caller transaction', async () => {
    const svc = make()
    const { id } = await svc.enqueue({ type: 't.txc', idempotencyKey: key(), entityType: 'thing', entityId: 'tx1' })
    await expect(
      db.prisma.$transaction(async (tx) => {
        expect(await svc.cancelFor('thing', ['tx1'], tx)).toBe(1)
        throw new Error('rollback')
      }),
    ).rejects.toThrow('rollback')
    expect((await row(id)).state).toBe('queued')
    await db.prisma.$transaction((tx) => svc.cancelFor('thing', ['tx1'], tx))
    expect((await row(id)).state).toBe('cancelled')
  })
})
