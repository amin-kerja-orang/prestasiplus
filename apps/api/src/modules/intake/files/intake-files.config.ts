import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import type { RateLimitSpec } from '../../../common/throttle'

function intOr(value: unknown, fallback: number): number {
  const n = Number(value)
  return value !== undefined && value !== null && value !== '' && Number.isInteger(n) && n >= 1 ? n : fallback
}

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

  constructor(@Inject(ConfigService) config: ConfigService) {
    this.maxFilesPerBatch = intOr(config.get('INTAKE_MAX_FILES_PER_BATCH'), 10)
    this.maxActiveBatches = intOr(config.get('INTAKE_MAX_ACTIVE_BATCHES'), 5)
    this.dailyPageQuota = intOr(config.get('INTAKE_DAILY_PAGE_QUOTA'), 500)
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
} as const
export const INTAKE_JOB_ENTITY = 'intake_file'
