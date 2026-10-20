import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

function intOr(value: unknown, fallback: number, min = 1): number {
  if (value === undefined || value === null || value === '') return fallback
  const n = Number(value)
  return Number.isFinite(n) && n >= min ? Math.floor(n) : fallback
}

function flag(value: unknown): boolean {
  return value === true || (typeof value === 'string' && ['true', '1'].includes(value.trim().toLowerCase()))
}

/**
 * Settings of the job runner: `JOBS_WORKER_ENABLED` (default false: nothing runs in-process),
 * `JOBS_POLL_MS` (1000), `JOBS_CONCURRENCY` (2), `JOBS_LOCK_TIMEOUT_MS` (600000) and
 * `JOBS_BACKOFF_BASE_MS` (5000; the delay doubles per attempt up to 300000).
 * Read untyped so the module works whether or not the env schema lists the keys.
 */
@Injectable()
export class JobsConfig {
  readonly workerEnabled: boolean
  readonly pollMs: number
  readonly concurrency: number
  readonly lockTimeoutMs: number
  readonly backoffBaseMs: number
  readonly backoffCapMs = 300_000
  /** How often a running job checks whether it was cancelled or lost its lock. */
  readonly cancelCheckMs: number

  constructor(@Inject(ConfigService) config: Pick<ConfigService, 'get'>) {
    const get = (key: string): unknown => config.get<unknown>(key)
    this.workerEnabled = flag(get('JOBS_WORKER_ENABLED'))
    this.pollMs = intOr(get('JOBS_POLL_MS'), 1000)
    this.concurrency = intOr(get('JOBS_CONCURRENCY'), 2)
    this.lockTimeoutMs = intOr(get('JOBS_LOCK_TIMEOUT_MS'), 600_000)
    this.backoffBaseMs = intOr(get('JOBS_BACKOFF_BASE_MS'), 5000)
    this.cancelCheckMs = intOr(get('JOBS_CANCEL_CHECK_MS'), 1000)
  }
}
