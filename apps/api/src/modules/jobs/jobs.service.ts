import { randomBytes, randomUUID } from 'node:crypto'
import { hostname } from 'node:os'

import { Inject, Injectable, Logger } from '@nestjs/common'

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
  onExhausted?: RegisterOptions['onExhausted']
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
  private readonly logger = new Logger(JobsService.name)

  constructor(
    @Inject(PrismaService) private readonly prisma: Pick<PrismaService, 'client'>,
    @Inject(JobsConfig) private readonly config: JobsConfig,
  ) {}

  register(type: string, handler: JobHandler, opts: RegisterOptions = {}): void {
    if (this.handlers.has(type)) throw new Error(`Job type already registered: ${type}`)
    this.handlers.set(type, { handler, timeoutMs: opts.timeoutMs, onExhausted: opts.onExhausted })
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
  async cancelFor(entityType: string, entityIds: string[], tx?: Db): Promise<number> {
    if (entityIds.length === 0) return 0
    return (tx ?? this.prisma.client).$executeRaw`
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
    // One job per statement, so the fairness test below sees the jobs this call has just started: a job is
    // skipped while another job of the same entity (one file) is running, so one file cannot hold every slot.
    // Every claim gets its own token in `locked_by`, so a run that outlived a sweep cannot close a later claim.
    const claimed: Array<{ row: ClaimRow; token: string }> = []
    for (let i = 0; i < n; i++) {
      const token = `${this.workerId}:${randomUUID()}`
      const rows = await this.prisma.client.$queryRaw<ClaimRow[]>`
        UPDATE jobs SET state = 'running', attempts = attempts + 1, locked_at = now(), locked_by = ${token},
                        started_at = COALESCE(started_at, now()), updated_at = now()
        WHERE id IN (
          SELECT j.id FROM jobs j
          WHERE j.state = 'queued' AND j.run_after <= now()
            AND (j.entity_id IS NULL OR NOT EXISTS (
              SELECT 1 FROM jobs r WHERE r.state = 'running' AND r.entity_type = j.entity_type AND r.entity_id = j.entity_id))
          ORDER BY j.run_after, j.id LIMIT 1 FOR UPDATE OF j SKIP LOCKED)
        RETURNING id::text AS id, type, entity_type, entity_id, payload, attempts, max_attempts`
      if (!rows[0]) break
      claimed.push({ row: rows[0], token })
    }
    const runs = claimed.map(({ row, token }) => {
      const p: Promise<void> = this.execute(row, token).finally(() => this.inFlight.delete(p))
      this.inFlight.add(p)
      return p
    })
    return { count: claimed.length, done: Promise.all(runs).then(() => undefined) }
  }

  /** Running jobs whose lock is older than `JOBS_LOCK_TIMEOUT_MS` go back to `queued` (or `failed` `STUCK` when out of attempts). */
  async sweepStuck(now?: Date): Promise<number> {
    const at = now ? now.toISOString() : null
    const rows = await this.prisma.client.$queryRaw<(ClaimRow & { state: string })[]>`
      UPDATE jobs SET
        state = CASE WHEN attempts < max_attempts THEN 'queued' ELSE 'failed' END,
        error_code = CASE WHEN attempts < max_attempts THEN error_code ELSE 'STUCK' END,
        finished_at = CASE WHEN attempts < max_attempts THEN NULL ELSE COALESCE(${at}::timestamptz, now()) END,
        run_after = CASE WHEN attempts < max_attempts THEN COALESCE(${at}::timestamptz, now()) ELSE run_after END,
        locked_at = NULL, locked_by = NULL, updated_at = now()
      WHERE state = 'running'
        AND locked_at < COALESCE(${at}::timestamptz, now()) - make_interval(secs => ${this.config.lockTimeoutMs}::float8 / 1000.0)
      RETURNING id::text AS id, type, entity_type, entity_id, payload, attempts, max_attempts, state`
    for (const row of rows) if (row.state === 'failed') await this.exhausted(toJob(row), 'STUCK')
    return rows.length
  }

  /** Stops claiming and waits for in-flight runs (graceful shutdown). */
  async drain(): Promise<void> {
    this.draining = true
    while (this.inFlight.size > 0) await Promise.allSettled([...this.inFlight])
  }

  get isDraining(): boolean {
    return this.draining
  }

  private async execute(row: ClaimRow, token: string): Promise<void> {
    const job = toJob(row)
    const reg = this.handlers.get(job.type)
    if (!reg) {
      await this.fail(job, token, new Outcome('UNKNOWN_TYPE', false))
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
      watcher = setInterval(() => void this.checkStillOwned(job.id, token, controller), this.config.cancelCheckMs)
      watcher.unref()
      await Promise.race([reg.handler(job, controller.signal), ...guards])
      // A handler that returns normally after an abort (timeout, cancel) must not count as success.
      if (controller.signal.aborted) throw controller.signal.reason
      await this.complete(job, token)
    } catch (err) {
      await this.fail(job, token, toOutcome(err))
    } finally {
      if (timer) clearTimeout(timer)
      if (watcher) clearInterval(watcher)
    }
  }

  /** Aborts the handler when the row was cancelled, swept or taken over. */
  private async checkStillOwned(id: string, token: string, controller: AbortController): Promise<void> {
    if (controller.signal.aborted) return
    try {
      const rows = await this.prisma.client.$queryRaw<{ ok: boolean }[]>`
        SELECT (state = 'running' AND locked_by = ${token}) AS ok FROM jobs WHERE id = ${id}::bigint`
      if (!rows[0]?.ok) controller.abort(new JobError('CANCELLED', false))
    } catch {
      // A failed check is retried on the next beat.
    }
  }

  private async complete(job: ClaimedJob, token: string): Promise<void> {
    await this.prisma.client.$executeRaw`
      UPDATE jobs SET state = 'succeeded', finished_at = now(), updated_at = now(), locked_at = NULL, locked_by = NULL, error_code = NULL
      WHERE id = ${job.id}::bigint AND state = 'running' AND locked_by = ${token}`
  }

  private async fail(job: ClaimedJob, token: string, outcome: Outcome): Promise<void> {
    const code = outcome.code.slice(0, MAX_ERROR_CODE_LENGTH)
    const retry = outcome.retryable && job.attempts < job.maxAttempts
    try {
      if (retry) {
        const delay = Math.min(this.config.backoffBaseMs * 2 ** (job.attempts - 1), this.config.backoffCapMs)
        await this.prisma.client.$executeRaw`
          UPDATE jobs SET state = 'queued', error_code = ${code}, run_after = now() + make_interval(secs => ${delay}::float8 / 1000.0),
                          locked_at = NULL, locked_by = NULL, updated_at = now()
          WHERE id = ${job.id}::bigint AND state = 'running' AND locked_by = ${token}`
      } else {
        const changed = await this.prisma.client.$executeRaw`
          UPDATE jobs SET state = 'failed', error_code = ${code}, finished_at = now(),
                          locked_at = NULL, locked_by = NULL, updated_at = now()
          WHERE id = ${job.id}::bigint AND state = 'running' AND locked_by = ${token}`
        // Only when this run really ended the job (not when it was cancelled or swept meanwhile).
        if (changed === 1) await this.exhausted(job, code)
      }
    } catch {
      // Could not record the failure: the stuck sweeper requeues the row later.
    }
  }

  /** Runs the type's `onExhausted` hook; never throws. */
  private async exhausted(job: ClaimedJob, code: string): Promise<void> {
    const hook = this.handlers.get(job.type)?.onExhausted
    if (!hook) return
    try {
      await hook(job, code)
    } catch {
      this.logger.warn(`onExhausted hook failed for job type ${job.type}`)
    }
  }
}

function toJob(row: ClaimRow): ClaimedJob {
  return {
    id: row.id,
    type: row.type,
    entityType: row.entity_type,
    entityId: row.entity_id,
    payload: row.payload,
    attempts: row.attempts,
    maxAttempts: row.max_attempts,
  }
}

function toOutcome(err: unknown): Outcome {
  if (err instanceof JobError) return new Outcome(err.code, err.retryable)
  return new Outcome('INTERNAL', true)
}
