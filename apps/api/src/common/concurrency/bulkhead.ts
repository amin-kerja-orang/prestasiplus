/**
 * A per-process bulkhead: at most `limit()` jobs run at once, the rest wait in arrival order (FIFO).
 *
 * Used around the bank-wide statements (a scan or count over a whole subject or the whole bank). Those hold a pooled database
 * connection for seconds; without a cap a burst of them takes every connection and the short interactive transactions (start a
 * session, check an answer, submit) wait for a free one until they fail. A job that waits only queues: nothing is dropped or
 * refused, and a job that throws frees its slot like one that returns.
 *
 * `limit` is read at each acquisition so a setting change applies without a restart of the gate (tests rely on it too).
 */
export class Bulkhead {
  private active = 0
  private readonly waiting: (() => void)[] = []

  constructor(private readonly limit: () => number) {}

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

  private acquire(): Promise<void> {
    if (this.active < this.slots() && this.waiting.length === 0) {
      this.active++
      return Promise.resolve()
    }
    return new Promise<void>((resolve) => this.waiting.push(resolve))
  }

  private release(): void {
    this.active--
    // Hand the freed slot to the longest waiter at once (no gap in which a newcomer could jump the queue). If the limit was lowered
    // below the running count, the waiter keeps waiting for a later release.
    if (this.waiting.length > 0 && this.active < this.slots()) {
      this.active++
      this.waiting.shift()?.()
    }
  }

  private slots(): number {
    const n = Math.trunc(this.limit())
    return Number.isFinite(n) && n >= 1 ? n : 1
  }
}
