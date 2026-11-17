/**
 * A per-process bulkhead: at most `limit()` jobs run at once, the rest wait in arrival order (FIFO).
 *
 * Used around the bank-wide statements (a scan or count over a whole subject or the whole bank). Those hold a pooled database
 * connection for seconds; without a cap a burst of them takes every connection and the short interactive transactions (start a
 * session, check an answer, submit) wait for a free one until they fail. A job that throws frees its slot like one that returns.
 *
 * Waiting is bounded so an overload cannot pile up work for clients that have left: a waiter that has waited `maxWaitMs()` is
 * removed from the queue and rejected, and a newcomer finding `maxQueue()` waiters already queued is rejected at once. Both
 * rejections use the error built by `overloaded` (the caller supplies a retryable one, so it is never a 500).
 *
 * `limit`, `maxWaitMs` and `maxQueue` are read at each acquisition so a setting change applies without a restart of the gate.
 */
export interface BulkheadOptions {
  /** Longest a job may wait for a slot, in ms. Default: no limit. */
  maxWaitMs?: () => number
  /** Most jobs that may wait at once. Default: no limit. */
  maxQueue?: () => number
  /** The rejection for a full queue or an expired wait. */
  overloaded?: (reason: 'queue_full' | 'wait_timeout') => Error
}

interface Waiter {
  grant: () => void
  timer: ReturnType<typeof setTimeout> | null
}

export class Bulkhead {
  private active = 0
  private readonly waiting: Waiter[] = []

  constructor(
    private readonly limit: () => number,
    private readonly opts: BulkheadOptions = {},
  ) {}

  /** Jobs running now. */
  get running(): number {
    return this.active
  }

  /** Jobs waiting for a slot. */
  get queued(): number {
    return this.waiting.length
  }

  async run<T>(job: () => Promise<T>): Promise<T> {
    await this.acquire()
    try {
      return await job()
    } finally {
      this.release()
    }
  }

  private reject(reason: 'queue_full' | 'wait_timeout'): Error {
    return this.opts.overloaded ? this.opts.overloaded(reason) : new Error(`bulkhead: ${reason}`)
  }

  private acquire(): Promise<void> {
    if (this.active < this.slots() && this.waiting.length === 0) {
      this.active++
      return Promise.resolve()
    }
    const cap = this.opts.maxQueue?.()
    if (cap !== undefined && Number.isFinite(cap) && this.waiting.length >= cap) return Promise.reject(this.reject('queue_full'))
    return new Promise<void>((resolve, reject) => {
      const waiter: Waiter = { grant: resolve, timer: null }
      const wait = this.opts.maxWaitMs?.()
      if (wait !== undefined && Number.isFinite(wait)) {
        waiter.timer = setTimeout(() => {
          const at = this.waiting.indexOf(waiter)
          if (at >= 0) this.waiting.splice(at, 1)
          reject(this.reject('wait_timeout'))
        }, wait)
      }
      this.waiting.push(waiter)
    })
  }

  private release(): void {
    this.active--
    // Hand the freed slot to the longest waiter at once (no gap in which a newcomer could jump the queue). If the limit was lowered
    // below the running count, the waiter keeps waiting for a later release.
    if (this.waiting.length > 0 && this.active < this.slots()) {
      this.active++
      const next = this.waiting.shift()
      if (next?.timer) clearTimeout(next.timer)
      next?.grant()
    }
  }

  private slots(): number {
    const n = Math.trunc(this.limit())
    return Number.isFinite(n) && n >= 1 ? n : 1
  }
}
