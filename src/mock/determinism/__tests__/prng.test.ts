import { describe, expect, it } from 'vitest'

import { fnv1a32 } from '../hash'
import { DEFAULT_SEED_BASE, createPrngRegistry, mulberry32, streamSeed } from '../prng'

describe('fnv1a32 (golden values)', () => {
  it('matches the FNV-1a 32-bit reference vectors', () => {
    expect(fnv1a32('')).toBe(0x811c9dc5)
    expect(fnv1a32('a')).toBe(0xe40c292c)
    expect(fnv1a32('foobar')).toBe(0xbf9cf968)
  })

  it('is stable for stream names and non-Latin text', () => {
    expect(fnv1a32('1:m04:generated-questions')).toBe(3259157550)
    expect(fnv1a32('Soalan é ā')).toBe(3149803796)
  })
})

describe('mulberry32 (golden values)', () => {
  it('matches the reference sequence for seed 1', () => {
    const rng = mulberry32(1)
    expect(rng.next()).toBe(0.6270739405881613)
    expect(rng.next()).toBe(0.002735721180215478)
    expect(rng.next()).toBe(0.5274470399599522)
  })

  it('uint32 for seed 0', () => {
    const rng = mulberry32(0)
    expect(rng.uint32()).toBe(1144304738)
    expect(rng.uint32()).toBe(1416247)
  })

  it('shuffle is a deterministic in-place Fisher–Yates', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    const out = mulberry32(42).shuffle(items)
    expect(out).toBe(items)
    expect(out).toEqual([1, 8, 4, 6, 3, 2, 9, 10, 5, 7])
  })

  it('next() stays in [0, 1) and int() in its inclusive range', () => {
    const rng = mulberry32(7)
    const seen = new Set<number>()
    for (let i = 0; i < 5000; i++) {
      const f = rng.next()
      expect(f).toBeGreaterThanOrEqual(0)
      expect(f).toBeLessThan(1)
      const n = rng.int(3, 6)
      expect(n).toBeGreaterThanOrEqual(3)
      expect(n).toBeLessThanOrEqual(6)
      seen.add(n)
    }
    expect([...seen].sort()).toEqual([3, 4, 5, 6])
  })

  it('pick, chance and invalid input', () => {
    const rng = mulberry32(3)
    expect(['a', 'b', 'c']).toContain(rng.pick(['a', 'b', 'c']))
    expect(rng.chance(0)).toBe(false)
    expect(rng.chance(1)).toBe(true)
    expect(() => rng.pick([])).toThrow(RangeError)
    expect(() => rng.int(5, 4)).toThrow(RangeError)
    expect(() => rng.int(1.5, 4)).toThrow(RangeError)
  })
})

describe('named PRNG streams (ADR-0006 §2)', () => {
  it('seeds a stream from hash(seedBase + name), default base 1', () => {
    const reg = createPrngRegistry()
    expect(reg.seedBase).toBe(DEFAULT_SEED_BASE)
    expect(DEFAULT_SEED_BASE).toBe(1)
    expect(reg.seedFor('m04:generated-questions')).toBe(3259157550)
    expect(streamSeed(1, 'm04:generated-questions')).toBe(3259157550)
    const s = reg.stream('m04:generated-questions')
    expect([s.uint32(), s.uint32(), s.int(1, 100), s.next()]).toEqual([
      2571263228, 1152618915, 32, 0.32682104338891804,
    ])
  })

  it('stream() continues; fresh() always restarts', () => {
    const reg = createPrngRegistry()
    const a = reg.stream('x').uint32()
    const b = reg.stream('x').uint32()
    expect(b).not.toBe(a)
    expect(reg.fresh('x').uint32()).toBe(a)
    expect(reg.fresh('x').uint32()).toBe(a)
  })

  it('streams are independent of creation order and of each other', () => {
    const r1 = createPrngRegistry()
    const r2 = createPrngRegistry()
    r1.stream('m01:a').uint32()
    const fromR1 = r1.stream('m05:b').uint32()
    const fromR2 = r2.stream('m05:b').uint32()
    expect(fromR1).toBe(fromR2)
    expect(r1.seedFor('m01:a')).not.toBe(r1.seedFor('m05:b'))
  })

  it('setSeedBase (mock.setRandomSeed) changes every stream and drops cached ones', () => {
    const reg = createPrngRegistry()
    const first = reg.stream('m04:generated-questions').uint32()
    reg.setSeedBase(2)
    expect(reg.seedBase).toBe(2)
    const after = reg.stream('m04:generated-questions').uint32()
    expect(after).toBe(3927692317)
    expect(after).not.toBe(first)
    reg.setSeedBase(1)
    expect(reg.stream('m04:generated-questions').uint32()).toBe(first)
    expect(createPrngRegistry({ seedBase: 2 }).stream('m04:generated-questions').uint32()).toBe(
      3927692317,
    )
    expect(() => reg.setSeedBase(Number.NaN)).toThrow(RangeError)
  })
})
