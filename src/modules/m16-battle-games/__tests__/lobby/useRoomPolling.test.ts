// @vitest-environment jsdom
/**
 * The polling contract of SRS M16 v1.6 §7.1 (room poll #26, quick-match poll #30): 3 s interval, a tick is
 * skipped while a request is in flight, an abort signal per request, nothing keeps running after stop or
 * after the owning scope is disposed (NFR-M16-01).
 */

import { effectScope } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { BATTLE_POLL_MS } from '../../api'
import { useRoomPolling } from '../../composables/useRoomPolling'

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('useRoomPolling', () => {
  it('polls every BATTLE_POLL_MS (3 s) and not before', async () => {
    expect(BATTLE_POLL_MS).toBe(3000)
    const tick = vi.fn().mockResolvedValue(undefined)
    const p = useRoomPolling(tick)
    p.start()
    expect(p.running.value).toBe(true)
    await vi.advanceTimersByTimeAsync(2999)
    expect(tick).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(tick).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(6000)
    expect(tick).toHaveBeenCalledTimes(3)
    p.stop()
  })

  it('skips a tick while the previous request is still in flight', async () => {
    let finish!: () => void
    const tick = vi.fn(() => new Promise<void>((r) => (finish = r)))
    const p = useRoomPolling(tick)
    p.start()
    await vi.advanceTimersByTimeAsync(9000) // three intervals, the first request never settles
    expect(tick).toHaveBeenCalledTimes(1)
    finish()
    await vi.advanceTimersByTimeAsync(3000)
    expect(tick).toHaveBeenCalledTimes(2)
    p.stop()
  })

  it('hands each tick an AbortSignal that stop() aborts, and clears the timer', async () => {
    const signals: AbortSignal[] = []
    const tick = vi.fn((s: AbortSignal) => {
      signals.push(s)
      return new Promise<void>(() => undefined)
    })
    const p = useRoomPolling(tick)
    p.start()
    await vi.advanceTimersByTimeAsync(3000)
    expect(signals[0]?.aborted).toBe(false)
    p.stop()
    expect(signals[0]?.aborted).toBe(true)
    expect(p.running.value).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('swallows an error of a tick and keeps polling', async () => {
    const tick = vi.fn().mockRejectedValueOnce(new Error('network')).mockResolvedValue(undefined)
    const p = useRoomPolling(tick)
    p.start()
    await vi.advanceTimersByTimeAsync(6000)
    expect(tick).toHaveBeenCalledTimes(2)
    p.stop()
  })

  it('stops with its effect scope (page left)', async () => {
    const tick = vi.fn().mockResolvedValue(undefined)
    const scope = effectScope()
    scope.run(() => useRoomPolling(tick).start())
    await vi.advanceTimersByTimeAsync(3000)
    expect(tick).toHaveBeenCalledTimes(1)
    scope.stop()
    expect(vi.getTimerCount()).toBe(0)
    await vi.advanceTimersByTimeAsync(9000)
    expect(tick).toHaveBeenCalledTimes(1)
  })

  it('start() twice does not double the interval', async () => {
    const tick = vi.fn().mockResolvedValue(undefined)
    const p = useRoomPolling(tick)
    p.start()
    p.start()
    await vi.advanceTimersByTimeAsync(3000)
    expect(tick).toHaveBeenCalledTimes(1)
    p.stop()
  })
})
