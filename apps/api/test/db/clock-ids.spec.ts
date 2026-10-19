import { describe, expect, it } from 'vitest'

import { FixedClock, mytDay, startOfMytDay } from '../../src/db/clock'
import { idFromString, idToString, isIdString } from '../../src/db/ids'

describe('Clock', () => {
  it('maps 23:59:59+08:00 and 00:00:01+08:00 the next day to different Malaysia days', () => {
    const clock = new FixedClock('2026-10-19T23:59:59+08:00')
    expect(mytDay(clock.now())).toBe('2026-10-19')
    clock.set('2026-10-20T00:00:01+08:00')
    expect(mytDay(clock.now())).toBe('2026-10-20')
    clock.set('2026-10-19T23:59:59+08:00')
    clock.advance(2000)
    expect(mytDay(clock.now())).toBe('2026-10-20')
  })

  it('uses Malaysia time even when the UTC date differs', () => {
    expect(mytDay(new Date('2026-10-19T16:30:00Z'))).toBe('2026-10-20')
    expect(startOfMytDay(new Date('2026-10-19T16:30:00Z')).toISOString()).toBe(
      '2026-10-19T16:00:00.000Z',
    )
  })

  it('rejects an invalid time', () => {
    expect(() => new FixedClock('nope')).toThrow(RangeError)
  })
})

describe('ids', () => {
  it('maps a bigint to its decimal string and back', () => {
    expect(idToString(9007199254740993n)).toBe('9007199254740993')
    expect(idFromString('9007199254740993')).toBe(9007199254740993n)
    expect(idFromString(idToString(123n))).toBe(123n)
  })

  it('rejects non-canonical or out-of-range ids', () => {
    for (const bad of ['', '-1', '01', '1.5', 'abc', '9223372036854775808']) {
      expect(isIdString(bad)).toBe(false)
    }
    expect(() => idToString(-1n)).toThrow(RangeError)
  })
})
