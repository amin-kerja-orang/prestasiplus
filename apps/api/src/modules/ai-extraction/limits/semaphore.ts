import { AiCancelledError } from '../ai.errors'

/**
 * Counting semaphore for `AI_MAX_CONCURRENCY`: at most `max` provider calls in flight in this process; the others wait
 * in arrival order (they are not rejected: the rate limit is what rejects). Waiting honours the caller's abort signal.
 */
export class Semaphore {
  private active = 0
  private readonly waiters: (() => void)[] = []
  /** Highest number of calls in flight at once (diagnostics and the burst test). */
  peak = 0

  constructor(readonly max: number) {}

  get inFlight(): number {
    return this.active
  }

  get waiting(): number {
    return this.waiters.length
  }

  async acquire(signal?: AbortSignal): Promise<() => void> {
    if (signal?.aborted) throw new AiCancelledError()
    if (this.active >= this.max) {
      await new Promise<void>((resolve, reject) => {
        const grant = (): void => {
          signal?.removeEventListener('abort', onAbort)
          resolve()
        }
        const onAbort = (): void => {
          const i = this.waiters.indexOf(grant)
          if (i !== -1) this.waiters.splice(i, 1)
          reject(new AiCancelledError())
        }
        this.waiters.push(grant)
        signal?.addEventListener('abort', onAbort, { once: true })
      })
    }
    // The slot is handed over by `release` (active is not decremented for a waiter), so it is counted already.
    if (this.active < this.max) this.active += 1
    this.peak = Math.max(this.peak, this.active)
    let released = false
    return () => {
      if (released) return
      released = true
      const next = this.waiters.shift()
      if (next) next()
      else this.active -= 1
    }
  }
}
