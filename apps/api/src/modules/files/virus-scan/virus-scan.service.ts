import { Inject, Injectable } from '@nestjs/common'

import { clamdPing, clamdScan, type ClamdTarget, ScannerUnavailableError } from './clamd.client'
import { VirusScanConfig } from './virus-scan.config'

export type ScanOutcome = { status: 'clean' } | { status: 'infected'; signature: string }
export type ScannerHealth = 'ok' | 'down' | 'disabled'

/** How long a health probe is reused, so the anonymous /api/ready route cannot be turned into clamd load. */
export const SCANNER_HEALTH_TTL_MS = 15_000
const PROBE_TIMEOUT_MS = 2_000

/**
 * Upload virus scanning (backlog #78). `scan` returns clean or infected, and THROWS ScannerUnavailableError when the scanner is
 * not configured, unreachable, times out or answers badly: the caller refuses the upload (fail closed). Callers ask `required`
 * first and skip scanning only when it is false.
 */
@Injectable()
export class VirusScanService {
  private cached: { at: number; ok: boolean } | undefined
  now: () => number = () => Date.now()

  constructor(@Inject(VirusScanConfig) private readonly config: VirusScanConfig) {}

  get required(): boolean {
    return this.config.required
  }

  async scan(bytes: Buffer): Promise<ScanOutcome> {
    const target = this.target()
    if (!target) throw new ScannerUnavailableError('unreachable', 'CLAMAV_HOST is not set')
    const verdict = await clamdScan(target, bytes)
    return verdict.clean ? { status: 'clean' } : { status: 'infected', signature: verdict.signature }
  }

  /** `disabled` when no host is set; otherwise a cached PING. Informational for /api/ready, never fails readiness. */
  async health(): Promise<ScannerHealth> {
    const base = this.target()
    if (!base) return 'disabled'
    const t = this.now()
    if (!this.cached || t - this.cached.at > SCANNER_HEALTH_TTL_MS) {
      this.cached = { at: t, ok: await clamdPing({ ...base, timeoutMs: Math.min(base.timeoutMs, PROBE_TIMEOUT_MS) }) }
    }
    return this.cached.ok ? 'ok' : 'down'
  }

  private target(): ClamdTarget | null {
    return this.config.host === null ? null : { host: this.config.host, port: this.config.port, timeoutMs: this.config.timeoutMs }
  }
}
