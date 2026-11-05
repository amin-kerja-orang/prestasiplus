// @vitest-environment jsdom
// DsOfflineBanner (AC-ERR-4): exact copy, status role, overlay position, 3 s recovery.
import { mount } from '@vue/test-utils'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { RESTORED_VISIBLE_MS, resetOfflineForTests } from '@/api/offline'
import { DsOfflineBanner } from '@/ds'

beforeAll(() => {
  const g = globalThis as Record<string, unknown>
  g.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})
beforeEach(() => {
  vi.useFakeTimers()
  resetOfflineForTests()
})
afterEach(() => {
  resetOfflineForTests()
  vi.useRealTimers()
})

describe('DsOfflineBanner', () => {
  it('keeps an empty polite status region while online', () => {
    const w = mount(DsOfflineBanner, { global: { stubs: { UIcon: true } } })
    const region = w.get('[role="status"]')
    expect(region.attributes('aria-live')).toBe('polite')
    expect(region.text()).toBe('')
    w.unmount()
  })

  it('shows the offline copy, then the restored copy for 3 s, then hides', async () => {
    const w = mount(DsOfflineBanner, { global: { stubs: { UIcon: true } } })
    window.dispatchEvent(new Event('offline'))
    await w.vm.$nextTick()
    expect(w.text()).toBe('Anda sedang luar talian. Semak sambungan internet anda.')
    window.dispatchEvent(new Event('online'))
    await w.vm.$nextTick()
    expect(w.text()).toBe('Sambungan dipulihkan.')
    vi.advanceTimersByTime(RESTORED_VISIBLE_MS)
    await w.vm.$nextTick()
    expect(w.text()).toBe('')
    w.unmount()
  })

  it('overlays the page (fixed) so nothing shifts, and uses no hard-coded colour', () => {
    const w = mount(DsOfflineBanner, { global: { stubs: { UIcon: true } } })
    const cls = w.get('[role="status"]').classes()
    expect(cls).toContain('fixed')
    expect(w.html()).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(/i)
    w.unmount()
  })
})
