import { randomBytes } from 'node:crypto'
import { hostname } from 'node:os'

import { Inject, Injectable } from '@nestjs/common'

import type { TxClient } from '../../db/client'
import { PrismaService } from '../../db/prisma.service'
import { JobsConfig } from './jobs.config'
import {
  type ClaimedJob,
  type EnqueueInput,
  JOB_TYPE_PATTERN,
  JobError,
  type JobHandler,
  MAX_ERROR_CODE_LENGTH,
  type RegisterOptions,
} from './job.types'

interface ClaimRow {
  id: string
  type: string
  entity_type: string | null
  entity_id: string | null
  payload: unknown
  attempts: number
  max_attempts: number
}

interface Registered {
  handler: JobHandler
  timeoutMs?: number
}

type Db = Pick<TxClient, '$queryRaw' | '$executeRaw'>

class Outcome {
  constructor(
    readonly code: string,
    readonly retryable: boolean,
  ) {}
}

/**
 * DB-backed job queue (table `jobs`). Rows are claimed with `FOR UPDATE SKIP LOCKED`, so several
 * processes can share the queue. Time comes from the database (`now()`), which keeps claim, backoff
 * and sweep consistent between processes. Jobs have no HTTP route: only services enqueue, and handlers
 * re-load and re-check the entity they belong to.
 */
@Injectable()
export class JobsService {
  private readonly handlers = new Map<string, Registered>()
  private readonly inFlight = new Set<Promise<void>>()
  private readonly workerId = `${hostname()}:${process.pid}:${randomBytes(4).toString('hex')}`
  private draining = false

  constructor(
    @Inject(PrismaService) private readonly prisma: Pick<PrismaService, 'client'>,
    @Inject(JobsConfig) private readonly config: JobsConfig,
  ) {}

  register(type: string, handler: JobHandler, opts: RegisterOptions = {}): void {
    if (this.handlers.has(type)) throw new Error(`Job type already registered: ${type}`)
    this.handlers.set(type, { handler, timeoutMs: opts.timeoutMs })
  }

  async enqueue(input: EnqueueInput, tx?: Db): Promise<{ id: string; created: boolean }> {
    if (!JOB_TYPE_PATTERN.test(input.type)) throw new RangeError('Invalid job type')
    if (!input.idempotencyKey) throw new RangeError('idempotencyKey is required')
    const maxAttempts = input.maxAttempts ?? 3
    if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 20) throw new RangeError('maxAttempts must be 1..20')
    const db: Db = tx ?? this.prisma.client
    const payload = input.payload === undefined ? null : JSON.stringify(input.payload)
    const runAfter = input.runAfter ? input.runAfter.toISOString() : null
    const inserted = await db.$queryRaw<{ id: string }[]>`
      INSERT INTO jobs (type, entity_type, entity_id, payload, max_attempts, run_after, idempotency_key)
      VALUES (${input.type}, ${input.entityType ?? null}, ${input.entityId ?? null}, ${payload}::jsonb,
              ${maxAttempts}::int, COALESCE(${runAfter}::timestamptz, now()), ${input.idempotencyKey})
      ON CONFLICT (idempotency_key) DO NOTHING
      RETURNING id::text AS id`
    if (inserted[0]) return { id: inserted[0].id, created: true }
    const existing = await db.$queryRaw<{ id: string }[]>`SELECT id::text AS id FROM jobs WHERE idempotency_key = ${input.idempotencyKey}`
    if (!existing[0]) throw new Error('Job vanished after conflict')
    return { id: existing[0].id, created: false }
  }

  /** Queued and running jobs of these entities become `cancelled`; running ones notice within `cancelCheckMs` and are aborted. */
  async cancelFor(entityType: string, entityIds: string[]): Promise<number> {
    if (entityIds.length === 0) return 0
    return this.prisma.client.$executeRaw`
      UPDATE jobs SET state = 'cancelled', finished_at = now(), updated_at = now(), locked_at = NULL, locked_by = NULL
      WHERE entity_type = ${entityType} AND entity_id = ANY(${entityIds}::text[]) AND state IN ('queued', 'running')`
  }

  /** Claims up to `limit` due jobs (bounded by free concurrency), runs them and waits for them. Returns how many were claimed. */
  async runOnce(limit?: number): Promise<number> {
    const { count, done } = await this.dispatch(limit)
    await done
    return count
  }

  /** Like `runOnce` but does not wait: used by the worker tick so a long job never blocks the next claim. */
  async dispatch(limit?: number): Promise<{ count: number; done: Promise<void> }> {
    const free = this.config.concurrency - this.inFlight.size
    const n = Math.min(limit ?? this.config.concurrency, free)
    if (this.draining || n <= 0) return { count: 0, done: Promise.resolve() }
    const rows = await this.prisma.client.$queryRaw<ClaimRow[]>`
      UPDATE jobs SET state = 'running', attempts = attempts + 1, locked_at = now(), locked_by = ${this.workerId},
                      started_at = COALESCE(started_at, now()), updated_at = now()
      WHERE id IN (
        SELECT id FROM jobs WHERE state = 'queued' AND run_after <= now()
        ORDER BY run_after, id LIMIT ${n}::int FOR UPDATE SKIP LOCKED)
      RETURNING id::text AS id, type, entity_type, entity_id, payload, attempts, max_attempts`
    const runs = rows.map((row) => {
      const p: Promise<void> = this.execute(row).finally(() => this.inFlight.delete(p))
      this.inFlight.add(p)
      return p
    })
    return { count: rows.length, done: Promise.all(runs).then(() => undefined) }
  }

  /** Running jobs whose lock is older than `JOBS_LOCK_TIMEOUT_MS` go back to `queued` (or `failed` `STUCK` when out of attempts). */
  async sweepStuck(now?: Date): Promise<number> {
    const at = now ? now.toISOString() : null
    return this.prisma.client.$executeRaw`
      UPDATE jobs SET
        state = CASE WHEN attempts < max_attempts THEN 'queued' ELSE 'failed' END,
        error_code = CASE WHEN attempts < max_attempts THEN error_code ELSE 'STUCK' END,
        finished_at = CASE WHEN attempts < max_attempts THEN NULL ELSE COALESCE(${at}::timestamptz, now()) END,
        run_after = CASE WHEN attempts < max_attempts THEN COALESCE(${at}::timestamptz, now()) ELSE run_after END,
        locked_at = NULL, locked_by = NULL, updated_at = now()
      WHERE state = 'running'
        AND locked_at < COALESCE(${at}::timestamptz, now()) - make_interval(secs => ${this.config.lockTimeoutMs}::float8 / 1000.0)`
  }

  /** Stops claiming and waits for in-flight runs (graceful shutdown). */
  async drain(): Promise<void> {
    this.draining = true
    while (this.inFlight.size > 0) await Promise.allSettled([...this.inFlight])
  }

  get isDraining(): boolean {
    return this.draining
  }

  private async execute(row: ClaimRow): Promise<void> {
    const job: ClaimedJob = {
      id: row.id,
      type: row.type,
      entityType: row.entity_type,
      entityId: row.entity_id,
      payload: row.payload,
      attempts: row.attempts,
      maxAttempts: row.max_attempts,
    }
    const reg = this.handlers.get(job.type)
    if (!reg) {
      await this.fail(job, new Outcome('UNKNOWN_TYPE', false))
      return
    }
    const controller = new AbortController()
    let timer: NodeJS.Timeout | undefined
    let watcher: NodeJS.Timeout | undefined
    try {
      const guards: Promise<never>[] = []
      if (reg.timeoutMs !== undefined) {
        guards.push(
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => {
              controller.abort(new JobError('TIMEOUT', true))
              reject(new JobError('TIMEOUT', true))
            }, reg.timeoutMs)
          }),
        )
      }
      watcher = setInterval(() => void this.checkStillOwned(job.id, controller), this.config.cancelCheckMs)
      watcher.unref()
      await Promise.race([reg.handler(job, controller.signal), ...guards])
      // A handler that returns normally after an abort (timeout, cancel) must not count as success.
      if (controller.signal.aborted) throw controller.signal.reason
      await this.complete(job)
    } catch (err) {
      await this.fail(job, toOutcome(err))
    } finally {
      if (timer) clearTimeout(timer)
      if (watcher) clearInterval(watcher)
    }
  }

  /** Aborts the handler when the row was cancelled, swept or taken over. */
  private async checkStillOwned(id: string, controller: AbortController): Promise<void> {
    if (controller.signal.aborted) return
    try {
      const rows = await this.prisma.client.$queryRaw<{ ok: boolean }[]>`
        SELECT (state = 'running' AND locked_by = ${this.workerId}) AS ok FROM jobs WHERE id = ${id}::bigint`
      if (!rows[0]?.ok) controller.abort(new JobError('CANCELLED', false))
    } catch {
      // A failed check is retried on the next beat.
    }
  }

  private async complete(job: ClaimedJob): Promise<void> {
    await this.prisma.client.$executeRaw`
      UPDATE jobs SET state = 'succeeded', finished_at = now(), updated_at = now(), locked_at = NULL, locked_by = NULL, error_code = NULL
      WHERE id = ${job.id}::bigint AND state = 'running' AND locked_by = ${this.workerId}`
  }

  private async fail(job: ClaimedJob, outcome: Outcome): Promise<void> {
    const code = outcome.code.slice(0, MAX_ERROR_CODE_LENGTH)
    const retry = outcome.retryable && job.attempts < job.maxAttempts
    try {
      if (retry) {
        const delay = Math.min(this.config.backoffBaseMs * 2 ** (job.attempts - 1), this.config.backoffCapMs)
        await this.prisma.client.$executeRaw`
          UPDATE jobs SET state = 'queued', error_code = ${code}, run_after = now() + make_interval(secs => ${delay}::float8 / 1000.0),
                          locked_at = NULL, locked_by = NULL, updated_at = now()
          WHERE id = ${job.id}::bigint AND state = 'running' AND locked_by = ${this.workerId}`
      } else {
        await this.prisma.client.$executeRaw`
          UPDATE jobs SET state = 'failed', error_code = ${code}, finished_at = now(),
                          locked_at = NULL, locked_by = NULL, updated_at = now()
          WHERE id = ${job.id}::bigint AND state = 'running' AND locked_by = ${this.workerId}`
      }
    } catch {
      // Could not record the failure: the stuck sweeper requeues the row later.
    }
  }
}

function toOutcome(err: unknown): Outcome {
  if (err instanceof JobError) return new Outcome(err.code, err.retryable)
  return new Outcome('INTERNAL', true)
}
