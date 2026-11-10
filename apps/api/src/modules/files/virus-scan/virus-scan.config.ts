import { Inject, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { intakeTeacherEnabled } from '../../intake/intake-teacher.gate'

export const DEFAULT_CLAMAV_PORT = 3310
export const DEFAULT_CLAMAV_TIMEOUT_MS = 30_000

function intIn(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value)
  return value !== undefined && value !== null && value !== '' && Number.isInteger(n) && n >= min && n <= max ? n : fallback
}

/**
 * ClamAV settings (backlog #78): `CLAMAV_HOST` (unset = no scanner), `CLAMAV_PORT` (3310), `CLAMAV_TIMEOUT_MS` (30000).
 * Scanning is REQUIRED when `INTAKE_TEACHER_ENABLED` is on, or when a host is configured (admin intake is then scanned too).
 */
@Injectable()
export class VirusScanConfig {
  readonly host: string | null
  readonly port: number
  readonly timeoutMs: number
  readonly teacherIntake: boolean
  private readonly log = new Logger(VirusScanConfig.name)

  constructor(@Inject(ConfigService) config: ConfigService) {
    const host = String(config.get<unknown>('CLAMAV_HOST') ?? '').trim()
    this.host = host === '' ? null : host
    this.port = intIn(config.get<unknown>('CLAMAV_PORT'), 1, 65_535, DEFAULT_CLAMAV_PORT)
    this.timeoutMs = intIn(config.get<unknown>('CLAMAV_TIMEOUT_MS'), 1000, 600_000, DEFAULT_CLAMAV_TIMEOUT_MS)
    this.teacherIntake = intakeTeacherEnabled(config.get<unknown>('INTAKE_TEACHER_ENABLED'))
    if (this.teacherIntake && this.host === null) {
      this.log.error('INTAKE_TEACHER_ENABLED is on but CLAMAV_HOST is not set: every intake upload is refused (fail closed) until a scanner is configured')
    }
  }

  /** An upload may be accepted only after a clean scan. */
  get required(): boolean {
    return this.teacherIntake || this.host !== null
  }
}
