// @vitest-environment jsdom
// Offline state (AC-ERR-4): offline from the browser events or two NETWORK_ERRORs in 10 s,
// "restored" for 3 s after reconnecting, then online.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  NETWORK_ERROR_WINDOW_MS,
  RESTORED_VISIBLE_MS,
  onReconnect,
  reportNetworkError,
  reportNetworkOk,
  resetOfflineForTests,
  startOfflineWatch,
  useOffline,
} from '../offline'

beforeEach(() => {
  vi.useFakeTimers()
  resetOfflineForTests()
})
afterEach(() => {
  resetOfflineForTests()
  vi.useRealTimers()
})

describe('offline state', () => {
  it('goes offline on the offline event and restored then online on reconnect', () => {
    const { status } = useOffline()
    const stop = startOfflineWatch()
    expect(status.value).toBe('online')
    window.dispatchEvent(new Event('offline'))
    expect(status.value).toBe('offline')
    window.dispatchEvent(new Event('online'))
    expect(status.value).toBe('restored')
    vi.advanceTimersByTime(RESTORED_VISIBLE_MS - 1)
    expect(status.value).toBe('restored')
    vi.advanceTimersByTime(1)
    expect(status.value).toBe('online')
    stop()
  })

  it('an online event while already online changes nothing', () => {
    const { status } = useOffline()
    const stop = startOfflineWatch()
    window.dispatchEvent(new Event('online'))
    expect(status.value).toBe('online')
    stop()
  })

  it('two NETWORK_ERRORs within 10 s mean offline; one, or two far apart, do not', () => {
    const { status } = useOffline()
    reportNetworkError(1000)
    expect(status.value).toBe('online')
    reportNetworkError(1000 + NETWORK_ERROR_WINDOW_MS + 1)
    expect(status.value).toBe('online')
    reportNetworkError(1000 + NETWORK_ERROR_WINDOW_MS + 5000)
    expect(status.value).toBe('offline')
  })

  it('a response ends error-driven offline but not browser-driven offline', () => {
    const { status } = useOffline()
    const stop = startOfflineWatch()
    reportNetworkError(1)
    reportNetworkError(2)
    expect(status.value).toBe('offline')
    reportNetworkOk()
    expect(status.value).toBe('restored')
    window.dispatchEvent(new Event('offline'))
    reportNetworkOk()
    expect(status.value).toBe('offline')
    stop()
  })

  it('runs reconnect handlers once on reconnection, even when one throws', () => {
    const stop = startOfflineWatch()
    const bad = vi.fn(() => {
      throw new Error('x')
    })
    const good = vi.fn()
    onReconnect(bad)
    const off = onReconnect(good)
    window.dispatchEvent(new Event('offline'))
    window.dispatchEvent(new Event('online'))
    expect(bad).toHaveBeenCalledTimes(1)
    expect(good).toHaveBeenCalledTimes(1)
    off()
    stop()
  })

  it('stops listening when the last watcher stops', () => {
    const { status } = useOffline()
    const a = startOfflineWatch()
    const b = startOfflineWatch()
    a()
    window.dispatchEvent(new Event('offline'))
    expect(status.value).toBe('offline')
    b()
    window.dispatchEvent(new Event('online'))
    expect(status.value).toBe('offline')
  })
})
