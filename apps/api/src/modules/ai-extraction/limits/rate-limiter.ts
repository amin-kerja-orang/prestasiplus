import { AiError } from '../ai.errors'

export interface RateBucket {
  /** `global`, `user:<id>` or `school:<id>`. */
  key: string
  /** Calls allowed per window. */
  limit: number
}

const WINDOW_MS = 60_000
const MAX_KEYS = 20_000

/**
 * Fixed-window counters for the provider calls (per process): the global `AI_RATE_LIMIT_PER_MIN`, and a per-user and a
 * per-school ceiling so that one account or one school cannot use up everybody's share. `consume` checks every bucket
 * first and counts only when all have room, so a refused call costs nobody anything. A refusal is `RATE_LIMITED` with
 * `retryAfter` seconds. Time comes from the injected clock.
 */
export class AiRateLimiter {
  private readonly windows = new Map<string, { count: number; resetAt: number }>()
  private lastPurge = 0

  constructor(private readonly now: () => number) {}

  consume(buckets: readonly RateBucket[]): void {
    const now = this.now()
    if (now - this.lastPurge >= WINDOW_MS) {
      this.lastPurge = now
      for (const [k, w] of this.windows) if (w.resetAt <= now) this.windows.delete(k)
    }
    let wait = 0
    for (const b of buckets) {
      const w = this.windows.get(b.key)
      if (w && w.resetAt > now && w.count >= b.limit) wait = Math.max(wait, Math.ceil((w.resetAt - now) / 1000))
    }
    if (wait > 0) throw AiError.rateLimited(Math.max(1, wait))
    for (const b of buckets) {
      let w = this.windows.get(b.key)
      if (!w || w.resetAt <= now) {
        while (this.windows.size >= MAX_KEYS) {
          const oldest = this.windows.keys().next().value
          if (oldest === undefined) break
          this.windows.delete(oldest)
        }
        w = { count: 0, resetAt: now + WINDOW_MS }
        this.windows.set(b.key, w)
      }
      w.count += 1
    }
  }
}
