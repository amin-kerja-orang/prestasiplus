import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import type { Env } from '../../common/config/env.schema'

const MB = 1024 * 1024

/**
 * Settings of the files module: `FILE_STORAGE_DIR` (required in production, checked by the env
 * loader; a temp folder otherwise), `MAX_UPLOAD_MB` (global ceiling), `INTAKE_MAX_FILE_MB` (derived
 * files, BE-37) and `UPLOAD_RATE_PER_MINUTE`.
 */
@Injectable()
export class FilesConfig {
  readonly storageDir: string
  readonly maxUploadBytes: number
  readonly intakeMaxBytes: number
  readonly ratePerMinute: number

  constructor(@Inject(ConfigService) config: ConfigService<Env, true>) {
    this.storageDir = config.get('FILE_STORAGE_DIR', { infer: true }) ?? join(tmpdir(), 'pp-files')
    this.maxUploadBytes = config.get('MAX_UPLOAD_MB', { infer: true }) * MB
    this.intakeMaxBytes = config.get('INTAKE_MAX_FILE_MB', { infer: true }) * MB
    this.ratePerMinute = config.get('UPLOAD_RATE_PER_MINUTE', { infer: true })
  }
}
