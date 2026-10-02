import { afterEach, describe, expect, it, vi } from 'vitest'

import { CLOCK_ANCHOR_ISO, CLOCK_ANCHOR_MS, anchorOffset, clock, createClock } from '../clock'
import { toIsoMyt } from '../zone'

afterEach(() => {
  clock.reset()
  vi.useRealTimers()
})

describe('clock anchor', () => {
  it('is Friday 25 Sep 2026, 15:40 MYT (ADR-0006)', () => {
    expect(CLOCK_ANCHOR_ISO).toBe('2026-09-25T15:40:00+08:00')
    expect(CLOCK_ANCHOR_MS).toBe(Date.parse('2026-09-25T07:40:00Z'))
  })

  it('anchorOffset makes now() equal the anchor', () => {
    const real = Date.parse('2030-01-01T00:00:00Z')
    const c = createClock({ source: () => real, offset: anchorOffset(real) })
    expect(c.now()).toBe(CLOCK_ANCHOR_MS)
  })
})

describe('createClock', () => {
  it('a frozen test clock stays at `at` until moved', () => {
    const c = createClock({ at: CLOCK_ANCHOR_ISO })
    expect(c.now()).toBe(CLOCK_ANCHOR_MS)
    expect(c.now()).toBe(CLOCK_ANCHOR_MS)
    expect(c.date()).toEqual(new Date(CLOCK_ANCHOR_MS))
  })

  it('setNow, advance and reset move the offset', () => {
    const c = createClock({ at: CLOCK_ANCHOR_ISO })
    c.setNow('2026-09-25T10:00:00+08:00') // M06/M07 test time
    expect(toIsoMyt(c.now())).toBe('2026-09-25T10:00:00+08:00')
    c.advance(60_000)
    expect(toIsoMyt(c.now())).toBe('2026-09-25T10:01:00+08:00')
    expect(c.getOffset()).toBe(-5 * 3600_000 - 39 * 60_000)
    c.reset()
    expect(c.now()).toBe(CLOCK_ANCHOR_MS)
  })

  it('keeps running from the set time when the source moves', () => {
    let real = 1_000_000
    const c = createClock({ source: () => real })
    c.setNow(CLOCK_ANCHOR_MS)
    real += 5000
    expect(c.now()).toBe(CLOCK_ANCHOR_MS + 5000)
  })

  it('notifies subscribers on offset changes only', () => {
    const c = createClock({ at: CLOCK_ANCHOR_MS })
    const seen: number[] = []
    const off = c.subscribe((o) => seen.push(o))
    c.advance(1000)
    c.setOffset(1000) // unchanged → no call
    c.advance(-1000)
    off()
    c.advance(5)
    expect(seen).toEqual([1000, 0])
  })

  it('a throwing listener does not stop the others and is reported via console.error', () => {
    const c = createClock({ at: CLOCK_ANCHOR_MS })
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const seen: string[] = []
    const boom = new Error('boom')
    c.subscribe(() => {
      seen.push('first')
      throw boom
    })
    c.subscribe((o) => seen.push(`second:${o}`))
    expect(() => c.advance(1000)).not.toThrow()
    expect(seen).toEqual(['first', 'second:1000'])
    expect(c.getOffset()).toBe(1000)
    expect(errorSpy).toHaveBeenCalledTimes(1)
    expect(errorSpy).toHaveBeenCalledWith('clock listener failed', boom)
    errorSpy.mockRestore()
  })

  it('rejects a non-finite offset', () => {
    expect(() => createClock().setOffset(Number.NaN)).toThrow(RangeError)
  })
})

describe('shared clock', () => {
  it('is Date.now() + offset (E2E: offset 0 with a controlled Date.now)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(CLOCK_ANCHOR_MS)
    expect(clock.now()).toBe(CLOCK_ANCHOR_MS)
    vi.advanceTimersByTime(60_000)
    expect(clock.now()).toBe(CLOCK_ANCHOR_MS + 60_000)
    clock.setNow('2026-09-25T10:00:00+08:00')
    expect(toIsoMyt(clock.now())).toBe('2026-09-25T10:00:00+08:00')
  })
})
