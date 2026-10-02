import { describe, expect, it, vi } from 'vitest'

import { CLOCK_ANCHOR_MS, createClock } from '@/lib/time'

import { initMockClock, mockClockControls, mockClockPolicyForMode } from '../clock'

const REAL = Date.parse('2027-03-01T00:00:00Z')

describe('mockClockPolicyForMode', () => {
  it('only the e2e build passes the browser clock through', () => {
    expect(mockClockPolicyForMode('e2e')).toBe('passthrough')
    expect(mockClockPolicyForMode('development')).toBe('anchored')
    expect(mockClockPolicyForMode('demo')).toBe('anchored')
  })
})

describe('initMockClock (overview §6.12)', () => {
  it('anchored, first boot: now = 2026-09-25T15:40:00+08:00, and time keeps running', () => {
    let real = REAL
    const clock = createClock({ source: () => real })
    expect(initMockClock(clock, { policy: 'anchored' })).toBe('anchor')
    expect(clock.now()).toBe(CLOCK_ANCHOR_MS)
    real += 5_000
    expect(clock.now()).toBe(CLOCK_ANCHOR_MS + 5_000)
  })

  it('anchored with a persisted offset restores it (continuous time across reloads)', () => {
    const clock = createClock({ source: () => REAL })
    expect(initMockClock(clock, { policy: 'anchored', persistedOffset: -1234 })).toBe('persisted')
    expect(clock.getOffset()).toBe(-1234)
  })

  it('passthrough (e2e) keeps offset 0 and ignores a persisted offset', () => {
    const clock = createClock({ source: () => REAL, offset: 99 })
    expect(initMockClock(clock, { policy: 'passthrough', persistedOffset: -5 })).toBe('passthrough')
    expect(clock.getOffset()).toBe(0)
    expect(clock.now()).toBe(REAL)
  })

  it('an explicit __MOCK_INIT__.now wins over every policy', () => {
    for (const policy of ['anchored', 'passthrough'] as const) {
      const clock = createClock({ source: () => REAL })
      expect(
        initMockClock(clock, { policy, persistedOffset: 7, now: '2026-09-25T10:00:00+08:00' }),
      ).toBe('init')
      expect(clock.now()).toBe(Date.parse('2026-09-25T02:00:00Z'))
    }
  })

  it('notifies clock subscribers (F-07 persists the offset)', () => {
    const clock = createClock({ source: () => REAL })
    const listener = vi.fn()
    clock.subscribe(listener)
    initMockClock(clock, { policy: 'anchored' })
    expect(listener).toHaveBeenCalledWith(CLOCK_ANCHOR_MS - REAL)
  })
})

describe('mockClockControls (mock.setNow / mock.advanceTime)', () => {
  it('moves the shared clock', () => {
    const clock = createClock({ source: () => REAL })
    const controls = mockClockControls(clock)
    controls.setNow('2026-09-25T15:40:00+08:00')
    expect(controls.now()).toBe(CLOCK_ANCHOR_MS)
    controls.advanceTime(60_000)
    expect(clock.now()).toBe(CLOCK_ANCHOR_MS + 60_000)
    expect(() => controls.advanceTime(Number.NaN)).toThrow(RangeError)
  })
})

describe('passthrough policy and the controls', () => {
  it('the controls move the offset; in e2e F-08 drives Playwright instead, so passthrough keeps 0 until used', () => {
    const clock = createClock({ source: () => REAL })
    initMockClock(clock, { policy: 'passthrough' })
    expect(clock.getOffset()).toBe(0)
    mockClockControls(clock).advanceTime(1000)
    expect(clock.getOffset()).toBe(1000)
  })
})
