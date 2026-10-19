import { Inject, Injectable } from '@nestjs/common'
import { AUTH_ERROR_MESSAGES } from '@pp/contract'

import { ApiError } from '../../common/errors/api-error'
import { CLOCK, type Clock } from '../../db/clock'
import { FilesConfig } from './files.config'

const WINDOW_MS = 60_000
const SWEEP_AT = 5_000

/**
 * Sliding one-minute window per user for uploads and deletes (D57a, BE-NFR-04). It lives in the
 * process: one API instance is the deployment (compose); a second instance would need a shared
 * counter. The message is the platform "Too Many Attempts." copy with `retryAfter`.
 */
@Injectable()
export class UploadThrottle {
  private readonly hits = new Map<string, number[]>()

  constructor(
    @Inject(FilesConfig) private readonly config: FilesConfig,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** Counts one write by `userId`; throws 429 `RATE_LIMITED` when the minute is used up. */
  hit(userId: string): void {
    const now = this.clock.now().getTime()
    if (this.hits.size > SWEEP_AT) this.sweep(now)
    const recent = (this.hits.get(userId) ?? []).filter((t) => t > now - WINDOW_MS)
    if (recent.length >= this.config.ratePerMinute) {
      const oldest = recent[0] as number
      const retryAfter = Math.max(1, Math.ceil((oldest + WINDOW_MS - now) / 1000))
      this.hits.set(userId, recent)
      throw ApiError.of('RATE_LIMITED', { message: AUTH_ERROR_MESSAGES.RATE_LIMITED, retryAfter })
    }
    recent.push(now)
    this.hits.set(userId, recent)
  }

  private sweep(now: number): void {
    for (const [user, times] of this.hits) {
      if (times.every((t) => t <= now - WINDOW_MS)) this.hits.delete(user)
    }
  }
}
