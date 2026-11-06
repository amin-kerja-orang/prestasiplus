import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import type { RateLimitSpec } from '../../../common/throttle'

function intOr(value: unknown, fallback: number): number {
  const n = Number(value)
  return value !== undefined && value !== null && value !== '' && Number.isInteger(n) && n >= 1 ? n : fallback
}

/** 15 minutes per batch (45 section 3.3.2 item 6). */
export const DEFAULT_BATCH_TIMEOUT_MS = 900_000
/** How often the `intake.batch_timeout` job looks for timed-out batches (not configurable: no new env key). */
export const BATCH_SWEEP_SECONDS = 60
/** Retries a file is allowed after its original run (ERR-INT-11 on the 4th). */
export const MAX_FILE_RETRIES = 3

/**
 * Quotas of the intake files module (BE-37): `INTAKE_MAX_FILES_PER_BATCH` (10), `INTAKE_MAX_ACTIVE_BATCHES`
 * (5 per teacher; Admin Pusat exempt) and `INTAKE_DAILY_PAGE_QUOTA` (500 pages per user per Malaysia day; Admin
 * Pusat exempt). Read untyped so the class does not depend on the env schema listing the keys.
 */
@Injectable()
export class IntakeFilesConfig {
  readonly maxFilesPerBatch: number
  readonly maxActiveBatches: number
  readonly dailyPageQuota: number
  readonly uploadConcurrency: number
  /** `OCR_BATCH_TIMEOUT_MS` (default 900000 = 15 min, ERR-INT-05 / `OCR_BATCH_TIMEOUT`): a batch processing longer than this is failed by the sweep. */
  readonly batchTimeoutMs: number
  /** `JOBS_WORKER_ENABLED` (the same flag the job runner reads): only then is the first `intake.batch_timeout` run seeded at boot. */
  readonly workerEnabled: boolean

  constructor(@Inject(ConfigService) config: ConfigService) {
    this.maxFilesPerBatch = intOr(config.get('INTAKE_MAX_FILES_PER_BATCH'), 10)
    this.maxActiveBatches = intOr(config.get('INTAKE_MAX_ACTIVE_BATCHES'), 5)
    this.dailyPageQuota = intOr(config.get('INTAKE_DAILY_PAGE_QUOTA'), 500)
    this.uploadConcurrency = intOr(config.get('INTAKE_UPLOAD_CONCURRENCY'), 2)
    this.batchTimeoutMs = intOr(config.get('OCR_BATCH_TIMEOUT_MS'), DEFAULT_BATCH_TIMEOUT_MS)
    const worker = config.get<unknown>('JOBS_WORKER_ENABLED')
    this.workerEnabled = worker === true || (typeof worker === 'string' && ['true', '1'].includes(worker.trim().toLowerCase()))
  }
}

/** Rate limits per signed-in user (variables documented in .env.api.example, PC-5 block). */
export const INTAKE_LIMITS = {
  write: { bucket: 'intake-write', env: 'INTAKE_WRITES_PER_MINUTE', default: 20, per: 'user' },
  read: { bucket: 'intake-read', env: 'INTAKE_READS_PER_MINUTE', default: 240, per: 'user' },
} as const satisfies Record<string, RateLimitSpec>

/** Job types and the entity type every intake job is filed under (so `cancelFor` finds them by intake file id). */
export const INTAKE_JOB_TYPES = {
  processFile: 'intake.process_file',
  page: 'intake.page',
  cropFigure: 'intake.crop_figure',
  /** Self-rescheduling sweep that fails batches over `OCR_BATCH_TIMEOUT_MS` (job types match ^[a-z][a-z0-9_.]{1,63}$, so not `intake-batch-timeout`). */
  batchTimeout: 'intake.batch_timeout',
} as const
export const INTAKE_JOB_ENTITY = 'intake_file'
