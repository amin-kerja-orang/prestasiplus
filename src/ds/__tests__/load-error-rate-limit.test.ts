// @vitest-environment jsdom
// DsLoadError: the S0-T08 429 countdown. ERR-RATE-01 copy, a live countdown from `retryAfter`
// (minutes from 120 s) and a retry button that stays disabled until it reaches 0.
import { mount } from '@vue/test-utils'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api/errors'
import { DsLoadError } from '@/ds'

/* eslint-disable @typescript-eslint/unbound-method -- jsdom polyfill stubs */
beforeAll(() => {
  const g = globalThis as Record<string, unknown>
  g.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
    onchange: null,
  })) as unknown as typeof window.matchMedia
})

afterEach(() => {
  vi.useRealTimers()
})

function rateLimited(retryAfter: number | undefined): ApiError {
  return new ApiError({ status: 429, code: 'RATE_LIMITED', message: 'x', retryAfter })
}

describe('DsLoadError rate-limit countdown', () => {
  it('renders unchanged with no error prop', () => {
    const w = mount(DsLoadError, { props: { message: 'Tidak dapat memuatkan data.' } })
    expect(w.text()).toContain('Tidak dapat memuatkan data.')
    expect(w.text()).not.toContain('Cuba lagi dalam')
  })

  it('shows ERR-RATE-01 with a seconds countdown and a disabled retry until it ends', async () => {
    vi.useFakeTimers()
    const w = mount(DsLoadError, {
      props: { error: rateLimited(5), retryTestid: 'retry' },
    })
    expect(w.text()).toContain('Terlalu banyak percubaan. Sila cuba sebentar lagi.')
    expect(w.text()).toContain('Cuba lagi dalam 5 saat.')
    const btn = () => w.get('[data-testid="retry"]')
    expect(btn().attributes('disabled')).toBeDefined()

    vi.advanceTimersByTime(5000)
    await w.vm.$nextTick()
    expect(btn().attributes('disabled')).toBeUndefined()
    expect(w.text()).not.toContain('Cuba lagi dalam')

    await btn().trigger('click')
    expect(w.emitted('retry')).toHaveLength(1)
  })

  it('keeps the changing countdown out of the live region announcements (aria-live off)', () => {
    vi.useFakeTimers()
    for (const variant of ['alert', 'inline'] as const) {
      const w = mount(DsLoadError, { props: { error: rateLimited(5), variant } })
      const live = w.get('[aria-live="off"]')
      expect(live.text()).toBe('Cuba lagi dalam 5 saat.')
      expect(live.element.closest('[role="alert"]')).not.toBeNull()
    }
  })

  it('clamps a huge retryAfter to 120 s and rounds a fractional one up', () => {
    vi.useFakeTimers()
    expect(mount(DsLoadError, { props: { error: rateLimited(3600) } }).text()).toContain('Cuba lagi dalam 2 minit.')
    expect(mount(DsLoadError, { props: { error: rateLimited(1.5) } }).text()).toContain('Cuba lagi dalam 2 saat.')
    expect(mount(DsLoadError, { props: { error: rateLimited(120) } }).text()).toContain('Cuba lagi dalam 2 minit.')
  })

  it('is deadline based: a 10 s clock jump inside one tick enables the retry', async () => {
    vi.useFakeTimers()
    const w = mount(DsLoadError, { props: { error: rateLimited(8), retryTestid: 'retry' } })
    expect(w.get('[data-testid="retry"]').attributes('disabled')).toBeDefined()
    vi.setSystemTime(Date.now() + 10_000) // a background tab: time passed, no tick yet
    vi.advanceTimersByTime(1000) // the single tick that finally fires
    await w.vm.$nextTick()
    expect(w.get('[data-testid="retry"]').attributes('disabled')).toBeUndefined()
    expect(w.text()).not.toContain('Cuba lagi dalam')
  })

  it('uses seconds up to 119 and minutes from 120 s', () => {
    vi.useFakeTimers()
    expect(mount(DsLoadError, { props: { error: rateLimited(119) } }).text()).toContain('Cuba lagi dalam 119 saat.')
    expect(mount(DsLoadError, { props: { error: rateLimited(150) } }).text()).toContain('Cuba lagi dalam 2 minit.')
  })

  it('leaves a non-429 ApiError on the default message', () => {
    const notFound = new ApiError({ status: 404, code: 'NOT_FOUND', message: 'nope' })
    const w = mount(DsLoadError, { props: { error: notFound, message: 'Gagal memuatkan.' } })
    expect(w.text()).toContain('Gagal memuatkan.')
    expect(w.text()).not.toContain('Terlalu banyak percubaan')
  })
})
