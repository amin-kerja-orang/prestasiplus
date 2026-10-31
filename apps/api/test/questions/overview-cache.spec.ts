import { describe, expect, it } from 'vitest'

import { OVERVIEW_SETTLE_MS, OVERVIEW_TTL_MS, SwrSlot } from '../../src/modules/questions/serving/overview-cache'

/** H-A21 unit (no DB): the stale-while-revalidate slot. A manual clock and deferred computes make every step explicit. */
function setup(over: Partial<{ ttlMs: number; settleMs: number }> = {}) {
  let now = 1_000_000
  const errors: unknown[] = []
  const slot = new SwrSlot<string>({ ttlMs: 1000, settleMs: 100, now: () => now, onError: (e) => errors.push(e), ...over })
  let calls = 0
  const pending: { resolve: (v: string) => void; reject: (e: Error) => void }[] = []
  /** A compute that waits until the test resolves it. */
  const deferred = () => {
    calls++
    return new Promise<string>((resolve, reject) => pending.push({ resolve, reject }))
  }
  /** A compute that answers at once with `v<n>`. */
  const instant = () => Promise.resolve(`v${String(++calls)}`)
  const tick = (ms: number) => {
    now += ms
  }
  return { slot, errors, deferred, instant, tick, pending, calls: () => calls, now: () => now }
}
const flush = () => new Promise((r) => setTimeout(r, 0))

describe('SwrSlot: single flight, TTL, stale-while-revalidate (H-A21)', () => {
  it('has the documented defaults: 5 minutes, 2 s settle', () => {
    expect(OVERVIEW_TTL_MS).toBe(300_000)
    expect(OVERVIEW_SETTLE_MS).toBe(2000)
  })

  it('a cold miss is computed once however many readers arrive together', async () => {
    const s = setup()
    const reads = Promise.all(Array.from({ length: 10 }, () => s.slot.get(s.deferred)))
    await flush()
    expect(s.calls()).toBe(1)
    s.pending[0]?.resolve('first')
    const out = await reads
    expect(out.every((r) => r.value === 'first')).toBe(true)
    expect(s.calls()).toBe(1)
  })

  it('serves the cached value inside the TTL without computing again, with the time it was computed', async () => {
    const s = setup()
    const at = s.now()
    const a = await s.slot.get(s.instant)
    s.tick(999)
    const b = await s.slot.get(s.instant)
    expect(b.value).toBe(a.value)
    expect(s.calls()).toBe(1)
    expect(a.computedAt.getTime()).toBe(at)
    expect(b.computedAt.getTime()).toBe(at)
  })

  it('after the TTL it serves the stale value at once and refreshes once in the background', async () => {
    const s = setup()
    await s.slot.get(s.instant) // v1 at t0
    s.tick(1000) // exactly the TTL: expired
    const reads = await Promise.all(Array.from({ length: 5 }, () => s.slot.get(s.deferred)))
    expect(reads.every((r) => r.value === 'v1')).toBe(true) // stale, not blocked
    expect(s.calls()).toBe(2) // one background refresh, not five
    s.pending[0]?.resolve('v2')
    await flush()
    const next = await s.slot.get(s.instant)
    expect(next.value).toBe('v2')
    expect(next.computedAt.getTime()).toBe(s.now() - 0) // started at the tick after the TTL
    expect(s.calls()).toBe(2)
  })

  it('a failed background refresh keeps the stale value, is reported, and is retried by the next read', async () => {
    const s = setup()
    await s.slot.get(s.instant)
    s.tick(5000)
    expect((await s.slot.get(s.deferred)).value).toBe('v1')
    s.pending[0]?.reject(new Error('db down'))
    await flush()
    expect(s.errors).toHaveLength(1)
    expect((await s.slot.get(s.deferred)).value).toBe('v1') // still served, and tries again
    expect(s.calls()).toBe(3)
  })

  it('a failed cold compute rejects and is not cached: the next read computes again', async () => {
    const s = setup()
    const first = s.slot.get(s.deferred)
    await flush()
    s.pending[0]?.reject(new Error('cold failure'))
    await expect(first).rejects.toThrow('cold failure')
    expect((await s.slot.get(s.instant)).value).toBe('v2')
  })

  it('invalidate() marks the value stale: the next read serves it and refreshes in the background', async () => {
    const s = setup()
    await s.slot.get(s.instant)
    s.slot.invalidate()
    s.tick(OVERVIEW_SETTLE_MS) // the change had time to commit before the next read
    expect((await s.slot.get(s.instant)).value).toBe('v1')
    await flush()
    expect((await s.slot.get(s.instant)).value).toBe('v2')
    expect(s.calls()).toBe(2)
  })

  it('a refresh that starts right after an invalidation (before the change can have committed) stays stale and refreshes again', async () => {
    const s = setup()
    await s.slot.get(s.instant)
    s.slot.invalidate()
    s.tick(10) // inside the settle window
    await s.slot.get(s.instant) // starts a background refresh (v2)
    await flush()
    s.tick(10)
    await s.slot.get(s.instant) // v2 was computed too early: still stale, refreshes again (v3, still inside the window)
    await flush()
    s.tick(OVERVIEW_SETTLE_MS)
    expect((await s.slot.get(s.instant)).value).toBe('v3') // served stale while v4 (started after the window) is computed
    await flush()
    expect((await s.slot.get(s.instant)).value).toBe('v4')
    expect(s.calls()).toBe(4) // v4 started after the settle window: fresh, no further refresh
  })

  it('an invalidation while a refresh is running leaves the result stale', async () => {
    const s = setup()
    await s.slot.get(s.instant)
    s.tick(1000)
    await s.slot.get(s.deferred) // background refresh started
    s.slot.invalidate()
    s.pending[0]?.resolve('v2')
    await flush()
    s.tick(OVERVIEW_SETTLE_MS)
    await s.slot.get(s.instant) // v2 was stale on arrival: refresh again
    await flush()
    expect((await s.slot.get(s.instant)).value).toBe('v3')
  })

  it('a changed fingerprint marks the entry stale without an event', async () => {
    const s = setup()
    let fp = 'a'
    await s.slot.get(s.instant, () => Promise.resolve(fp))
    expect((await s.slot.get(s.instant, () => Promise.resolve(fp))).value).toBe('v1')
    expect(s.calls()).toBe(1)
    fp = 'b'
    expect((await s.slot.get(s.instant, () => Promise.resolve(fp))).value).toBe('v1') // stale served
    await flush()
    expect((await s.slot.get(s.instant, () => Promise.resolve(fp))).value).toBe('v2')
    expect(s.calls()).toBe(2)
  })
})
