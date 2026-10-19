import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import type { Env } from '../../common/config/env.schema'

const MB = 1024 * 1024

function numberOr(value: unknown, fallback: number): number {
  const n = Number(value)
  return value !== undefined && value !== null && value !== '' && Number.isFinite(n) && n > 0 ? n : fallback
}

/**
 * Settings of the files module: `FILE_STORAGE_DIR` (a temp folder outside production; in production
 * the API refuses to start without it, so uploads are never written to a throw-away folder),
 * `MAX_UPLOAD_MB` (global ceiling, default 10), `INTAKE_MAX_FILE_MB` (derived files for BE-37,
 * default 20) and `UPLOAD_RATE_PER_MINUTE` (default 30).
 */
@Injectable()
export class FilesConfig {
  readonly storageDir: string
  readonly maxUploadBytes: number
  readonly intakeMaxBytes: number
  readonly ratePerMinute: number

  constructor(@Inject(ConfigService) config: ConfigService<Env, true>) {
    const dir = config.get('FILE_STORAGE_DIR', { infer: true }) as string | undefined
    if (!dir && config.get('NODE_ENV', { infer: true }) === 'production') {
      throw new Error('Invalid environment configuration. FILE_STORAGE_DIR: required in production')
    }
    this.storageDir = dir ?? join(tmpdir(), 'pp-files')
    this.maxUploadBytes = numberOr(config.get('MAX_UPLOAD_MB', { infer: true }), 10) * MB
    this.intakeMaxBytes = numberOr(config.get('INTAKE_MAX_FILE_MB', { infer: true }), 20) * MB
    this.ratePerMinute = numberOr(config.get('UPLOAD_RATE_PER_MINUTE', { infer: true }), 30)
  }
}
