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
 * default 20) `UPLOAD_RATE_PER_MINUTE` (default 30) and `FILE_READS_PER_MINUTE` (default 120). FILE_STORAGE_DIR is read straight from the environment (it is not in the env schema).
 */
@Injectable()
export class FilesConfig {
  readonly storageDir: string
  readonly maxUploadBytes: number
  readonly intakeMaxBytes: number
  readonly ratePerMinute: number
  readonly readsPerMinute: number

  constructor(@Inject(ConfigService) config: ConfigService<Env, true>) {
    // FILE_STORAGE_DIR is deliberately not in the env schema; read it through the untyped view.
    const raw = config as unknown as ConfigService<Record<string, unknown>, false>
    const dir = raw.get<string | undefined>('FILE_STORAGE_DIR')
    if (!dir && config.get('NODE_ENV', { infer: true }) === 'production') {
      throw new Error('Invalid environment configuration. FILE_STORAGE_DIR: required in production')
    }
    this.storageDir = dir ?? join(tmpdir(), 'pp-files')
    this.maxUploadBytes = numberOr(config.get('MAX_UPLOAD_MB', { infer: true }), 10) * MB
    this.intakeMaxBytes = numberOr(config.get('INTAKE_MAX_FILE_MB', { infer: true }), 20) * MB
    this.ratePerMinute = numberOr(config.get('UPLOAD_RATE_PER_MINUTE', { infer: true }), 30)
    this.readsPerMinute = numberOr(config.get('FILE_READS_PER_MINUTE', { infer: true }), 120)
  }
}
