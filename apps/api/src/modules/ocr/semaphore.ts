/** Counting semaphore: at most `limit` holders; the rest queue in order. */
export class Semaphore {
  private active = 0
  private readonly waiters: (() => void)[] = []

  constructor(private readonly limit: number) {}

  /** Resolves with a release function once a slot is free; rejects when the signal aborts while waiting. */
  acquire(signal?: AbortSignal): Promise<() => void> {
    return new Promise((resolve, reject) => {
      const grant = (): void => {
        signal?.removeEventListener('abort', onAbort)
        this.active++
        let released = false
        resolve(() => {
          if (released) return
          released = true
          this.active--
          this.waiters.shift()?.()
        })
      }
      const onAbort = (): void => {
        const i = this.waiters.indexOf(grant)
        if (i >= 0) this.waiters.splice(i, 1)
        reject(abortReason(signal))
      }
      if (signal?.aborted) return reject(abortReason(signal))
      if (this.active < this.limit) return grant()
      this.waiters.push(grant)
      signal?.addEventListener('abort', onAbort, { once: true })
    })
  }
}

export function abortReason(signal?: AbortSignal): unknown {
  return signal?.reason ?? new DOMException('The operation was aborted', 'AbortError')
}
