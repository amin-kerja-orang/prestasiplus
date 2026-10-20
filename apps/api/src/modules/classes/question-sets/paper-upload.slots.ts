import { Injectable } from '@nestjs/common'

import { ApiError } from '../../../common/errors/api-error'
import { PAPER_MAX_IN_FLIGHT_GLOBAL, PAPER_MAX_IN_FLIGHT_PER_USER, PAPER_SLOT_RETRY_SECONDS } from './question-sets.constants'

/**
 * In-flight limit of the paper upload (each request can hold about 100 MB in memory): one per user and a few
 * for the whole process. A full slot answers the D57 429 `RATE_LIMITED` with `Retry-After`. Per process, like the
 * rate limiter. `acquire` returns a release function that is safe to call more than once.
 */
@Injectable()
export class PaperUploadSlots {
  private readonly perUser = new Map<string, number>()
  private total = 0

  /** Limits; plain fields (not constructor parameters) so Nest has nothing to inject, and tests may lower them. */
  maxPerUser: number = PAPER_MAX_IN_FLIGHT_PER_USER
  maxTotal: number = PAPER_MAX_IN_FLIGHT_GLOBAL

  get inFlight(): number {
    return this.total
  }

  acquire(userId: string): () => void {
    const mine = this.perUser.get(userId) ?? 0
    if (mine >= this.maxPerUser || this.total >= this.maxTotal) {
      throw ApiError.of('RATE_LIMITED', { retryAfter: PAPER_SLOT_RETRY_SECONDS })
    }
    this.perUser.set(userId, mine + 1)
    this.total += 1
    let released = false
    return () => {
      if (released) return
      released = true
      this.total -= 1
      const left = (this.perUser.get(userId) ?? 1) - 1
      if (left <= 0) this.perUser.delete(userId)
      else this.perUser.set(userId, left)
    }
  }
}
