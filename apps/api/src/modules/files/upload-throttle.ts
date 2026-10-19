import { Inject, Injectable } from '@nestjs/common'
import { AUTH_ERROR_MESSAGES } from '@pp/contract'

import { ApiError } from '../../common/errors/api-error'
import { CLOCK, type Clock } from '../../db/clock'
import { FilesConfig } from './files.config'

const WINDOW_MS = 60_000

/**
 * A sliding one-minute window per key, held in process memory.
 *
 * - An attempt over the limit is REFUSED AND NOT COUNTED: hammering a refused route does not extend
 *   the wait, and `retryAfter` is the time until the oldest counted attempt leaves the window.
 * - An attempt that passes the limit is counted even if the request later fails (bad type, wrong
 *   role): requests refused by validation cost the same as good ones.
 * - Idle keys are swept at most once a minute (O(keys) per minute, never per hit).
 */
export class SlidingWindow {
  private readonly hits = new Map<string, number[]>()
  private lastSweep = 0

  constructor(
    private readonly limit: () => number,
    private readonly clock: Clock,
  ) {}

  /** Counts one attempt by `key`; throws 429 `RATE_LIMITED` when the minute is used up. */
  hit(key: string): void {
    const now = this.clock.now().getTime()
    if (now - this.lastSweep >= WINDOW_MS) this.sweep(now)
    const recent = (this.hits.get(key) ?? []).filter((t) => t > now - WINDOW_MS)
    if (recent.length >= this.limit()) {
      const oldest = recent[0] as number
      const retryAfter = Math.max(1, Math.ceil((oldest + WINDOW_MS - now) / 1000))
      this.hits.set(key, recent)
      throw ApiError.of('RATE_LIMITED', { message: AUTH_ERROR_MESSAGES.RATE_LIMITED, retryAfter })
    }
    recent.push(now)
    this.hits.set(key, recent)
  }

  /** Number of keys held (tests). */
  get size(): number {
    return this.hits.size
  }

  private sweep(now: number): void {
    this.lastSweep = now
    for (const [key, times] of this.hits) {
      if (times.every((t) => t <= now - WINDOW_MS)) this.hits.delete(key)
    }
  }
}

/** Uploads and deletes per user (D57a, BE-NFR-04): `UPLOAD_RATE_PER_MINUTE`. One counter for both. */
@Injectable()
export class UploadThrottle {
  readonly window: SlidingWindow

  constructor(
    @Inject(FilesConfig) config: FilesConfig,
    @Inject(CLOCK) clock: Clock,
  ) {
    this.window = new SlidingWindow(() => config.ratePerMinute, clock)
  }

  hit(userId: string): void {
    this.window.hit(`u:${userId}`)
  }
}

/**
 * Downloads (D57): `FILE_READS_PER_MINUTE`, a counter separate from the write one. Signed-in callers
 * are counted per user, anonymous `cms_image` reads per client address.
 */
@Injectable()
export class DownloadThrottle {
  readonly window: SlidingWindow

  constructor(
    @Inject(FilesConfig) config: FilesConfig,
    @Inject(CLOCK) clock: Clock,
  ) {
    this.window = new SlidingWindow(() => config.readsPerMinute, clock)
  }

  hit(caller: { userId: string } | { ip: string }): void {
    this.window.hit('userId' in caller ? `u:${caller.userId}` : `ip:${caller.ip}`)
  }
}
