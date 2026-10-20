import { Injectable } from '@nestjs/common'

import { ApiError } from '../../../common/errors/api-error'

/** Audio reads in flight at once in this process (each loads a whole file of up to 20 MB). */
export const AUDIO_READ_CONCURRENCY = 8

/**
 * Process-wide concurrency limit for the audio stream route. The storage interface returns a whole Buffer,
 * so memory per request is the file size; this caps the worst case at 8 x 20 MB. When full the caller gets
 * 429 with Retry-After. A streaming or range read in FILE_STORAGE is a BE-33/BE-04 follow-up.
 */
@Injectable()
export class AudioReadGate {
  private inFlight = 0

  /** Takes a slot or throws 429. The returned function frees it (safe to call twice). */
  acquire(): () => void {
    if (this.inFlight >= AUDIO_READ_CONCURRENCY) throw ApiError.of('RATE_LIMITED', { retryAfter: 1 })
    this.inFlight += 1
    let released = false
    return () => {
      if (released) return
      released = true
      this.inFlight -= 1
    }
  }

  get active(): number {
    return this.inFlight
  }
}
