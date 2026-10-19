import { describe, expect, it } from 'vitest'

import { createPrngRegistry } from '../../determinism/prng'
import { MockDbError } from '../errors'
import { ID_RANGES } from '../id-ranges'
import { floor, maxPlusOne, mergeIdState, opaque, sequence, uuid } from '../id-strategies'

function ctxOf<Id>(taken: Set<Id>) {
  return { taken: (id: Id) => taken.has(id), prng: createPrngRegistry() }
}

describe('ID_RANGES (TRACKER canonical seed, M02 v1.4 §6.15, M04 v1.5 §6.13)', () => {
  it('pins the documented project ranges', () => {
    expect(ID_RANGES.canonicalUsers).toEqual({ min: 1, max: 11 })
    expect(ID_RANGES.usersRuntimeFloor).toBe(9_000_001)
    expect(ID_RANGES.schoolsRuntimeFloor).toBe(10_301)
    expect(ID_RANGES.schoolsReserved).toEqual({ min: 900_001, max: 900_099 })
    expect(ID_RANGES.questionsRuntimeFloor).toBe(9_000_001)
    expect(ID_RANGES.sequenceRuntimeStart).toBe(1_000)
  })
})

describe('sequence({ runtimeStart })', () => {
  it('first free id ≥ runtimeStart, skipping seeded ids, then monotonic', () => {
    const taken = new Set([1, 2, 1000, 1001])
    const alloc = sequence({ runtimeStart: 1000 }).create()
    const ctx = ctxOf(taken)
    const a = alloc.next(ctx)
    expect(a).toBe(1002)
    taken.add(a)
    expect(alloc.next(ctx)).toBe(1003)
    // A deleted runtime id is not reused.
    taken.delete(1002)
    expect(alloc.next(ctx)).toBe(1004)
  })

  it('an explicit runtime id moves the counter past it (a removed explicit id is not reused)', () => {
    const taken = new Set<number>([5])
    const alloc = sequence({ runtimeStart: 1000 }).create()
    alloc.observe(5) // seeded id below runtimeStart: no effect
    alloc.observe(1005)
    taken.add(1005)
    taken.delete(1005) // the explicit row is removed again
    expect(alloc.next(ctxOf(taken))).toBe(1006)
    alloc.observe(1001) // below the counter: no effect
    expect(alloc.next(ctxOf(taken))).toBe(1007)
  })

  it('state round-trips and reset restarts', () => {
    const alloc = sequence({ runtimeStart: 1000 }).create()
    alloc.next(ctxOf(new Set()))
    expect(alloc.getState()).toEqual({ kind: 'sequence', next: 1001 })
    const other = sequence({ runtimeStart: 1000 }).create()
    other.setState(alloc.getState())
    expect(other.next(ctxOf(new Set()))).toBe(1001)
    other.reset()
    expect(other.next(ctxOf(new Set()))).toBe(1000)
  })

  it('validates input', () => {
    expect(() => sequence({ runtimeStart: 0 })).toThrow(MockDbError)
    expect(() =>
      sequence({ runtimeStart: 1000 }).create().setState({ kind: 'floor', hw: 3 }),
    ).toThrow(MockDbError)
  })
})

describe('maxPlusOne()', () => {
  it('highest id ever stored + 1; deleted ids are not reused', () => {
    const alloc = maxPlusOne().create()
    const ctx = ctxOf(new Set<number>())
    expect(alloc.next(ctx)).toBe(1)
    alloc.observe(72)
    expect(alloc.next(ctx)).toBe(73)
    alloc.observe(10) // lower explicit id does not move it back
    expect(alloc.next(ctx)).toBe(74)
    expect(alloc.getState()).toEqual({ kind: 'maxPlusOne', hw: 74 })
  })

  it('rejects non-integer ids', () => {
    expect(() =>
      maxPlusOne()
        .create()
        .observe('x' as unknown as number),
    ).toThrow(MockDbError)
  })
})

describe('floor({ start })', () => {
  it('starts at the floor; anchors below it never move the counter (XL-37)', () => {
    const alloc = floor({ start: ID_RANGES.usersRuntimeFloor }).create()
    alloc.observe(11)
    alloc.observe(5990)
    const ctx = ctxOf(new Set<number>())
    expect(alloc.next(ctx)).toBe(9_000_001)
    expect(alloc.next(ctx)).toBe(9_000_002)
  })

  it('= max(start, highest runtime id + 1)', () => {
    const alloc = floor({ start: ID_RANGES.schoolsRuntimeFloor }).create()
    alloc.observe(10_400)
    expect(alloc.next(ctxOf(new Set()))).toBe(10_401)
    const restored = floor({ start: 10_301 }).create()
    restored.setState({ kind: 'floor', hw: 5 }) // below the floor → clamped
    expect(restored.next(ctxOf(new Set()))).toBe(10_301)
  })
})

describe('uuid(stream) and opaque(prefix, stream)', () => {
  it('uuid: deterministic, v4-shaped, golden values', () => {
    const alloc = uuid('ids:test').create()
    const ctx = ctxOf(new Set<string>())
    const a = alloc.next(ctx)
    const b = alloc.next(ctx)
    expect(a).toBe('6be54581-0250-4258-a724-d13c172cf0e6')
    expect(b).toBe('46f57c60-99f7-462a-a7f1-a1176333b7c8')
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(alloc.getState()).toEqual({ kind: 'uuid', n: 2 })
  })

  it('uuid: a restored counter continues the same sequence; taken ids are skipped', () => {
    const first = uuid('ids:test').create()
    const ctx = ctxOf(new Set<string>())
    first.next(ctx)
    const restored = uuid('ids:test').create()
    restored.setState(first.getState())
    expect(restored.next(ctx)).toBe('46f57c60-99f7-462a-a7f1-a1176333b7c8')
    const skipping = uuid('ids:test').create()
    expect(skipping.next(ctxOf(new Set(['6be54581-0250-4258-a724-d13c172cf0e6'])))).toBe(
      '46f57c60-99f7-462a-a7f1-a1176333b7c8',
    )
  })

  it('opaque: prefix + 40 alphanumerics, golden value', () => {
    const alloc = opaque('tok_', 'mock:tokens').create()
    const id = alloc.next(ctxOf(new Set<string>()))
    expect(id).toBe('tok_oQV103JF1w47mcxzOWp7q9otspI7edo8GgRSd23U')
    expect(opaque('s_', 'x', 12).create().next(ctxOf(new Set<string>()))).toMatch(
      /^s_[0-9A-Za-z]{12}$/,
    )
    expect(() => opaque('p', 'x', 4)).toThrow(MockDbError)
    expect(() => uuid('')).toThrow(MockDbError)
  })
})

describe('mergeIdState', () => {
  it('takes the max of next / hw / n and refuses mixed kinds', () => {
    expect(
      mergeIdState({ kind: 'sequence', next: 1005 }, { kind: 'sequence', next: 1002 }),
    ).toEqual({
      kind: 'sequence',
      next: 1005,
    })
    expect(mergeIdState({ kind: 'floor', hw: 10 }, { kind: 'floor', hw: 12 })).toEqual({
      kind: 'floor',
      hw: 12,
    })
    expect(mergeIdState({ kind: 'uuid', n: 3 }, { kind: 'uuid', n: 1 })).toEqual({
      kind: 'uuid',
      n: 3,
    })
    expect(() => mergeIdState({ kind: 'uuid', n: 3 }, { kind: 'floor', hw: 1 })).toThrow(
      MockDbError,
    )
  })
})
