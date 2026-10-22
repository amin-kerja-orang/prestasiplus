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
 * loadEnv refuses to start without an absolute path, so uploads are never written to a throw-away folder),
 * `MAX_UPLOAD_MB` (global ceiling, default 10), `INTAKE_MAX_FILE_MB` (derived files for BE-37,
 * default 20) `UPLOAD_RATE_PER_MINUTE` (default 30) and `FILE_READS_PER_MINUTE` (default 120).
 */
@Injectable()
export class FilesConfig {
  readonly storageDir: string
  readonly maxUploadBytes: number
  readonly intakeMaxBytes: number
  readonly ratePerMinute: number
  readonly readsPerMinute: number
  /** AZ-188: `clamd` scans every stored file; `off` (default) stores as before. */
  readonly malwareScan: 'off' | 'clamd'
  readonly clamavHost: string
  readonly clamavPort: number
  readonly clamavTimeoutMs: number

  constructor(@Inject(ConfigService) config: ConfigService<Env, true>) {
    // Required and absolute in production: loadEnv has already refused anything else at start-up.
    const dir = config.get('FILE_STORAGE_DIR', { infer: true })
    this.storageDir = dir ?? join(tmpdir(), 'pp-files')
    this.maxUploadBytes = numberOr(config.get('MAX_UPLOAD_MB', { infer: true }), 10) * MB
    this.intakeMaxBytes = numberOr(config.get('INTAKE_MAX_FILE_MB', { infer: true }), 20) * MB
    this.ratePerMinute = numberOr(config.get('UPLOAD_RATE_PER_MINUTE', { infer: true }), 30)
    this.readsPerMinute = numberOr(config.get('FILE_READS_PER_MINUTE', { infer: true }), 120)
    this.malwareScan = config.get('MALWARE_SCAN', { infer: true }) === 'clamd' ? 'clamd' : 'off'
    this.clamavHost = config.get('CLAMAV_HOST', { infer: true }) ?? ''
    this.clamavPort = numberOr(config.get('CLAMAV_PORT', { infer: true }), 3310)
    this.clamavTimeoutMs = numberOr(config.get('CLAMAV_TIMEOUT_MS', { infer: true }), 30_000)
  }
}
