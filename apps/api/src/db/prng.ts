/**
 * Named, seeded PRNG streams for seeds (ADR-0006 section 2), same algorithms as the frontend mock
 * (`src/mock/determinism`): mulberry32 seeded from FNV-1a of `seedBase:name`. A stream depends only
 * on `(seedBase, name)`, so adding a seed module never changes another module's data.
 */
export interface Prng {
  /** Float in [0, 1). */
  next(): number
  /** Integer in [min, max], both inclusive. */
  int(min: number, max: number): number
  pick<T>(items: readonly T[]): T
}

export function fnv1a32(input: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    const unit = input.charCodeAt(i)
    hash = Math.imul(hash ^ (unit & 0xff), 0x01000193)
    if (unit > 0xff) hash = Math.imul(hash ^ (unit >>> 8), 0x01000193)
  }
  return hash >>> 0
}

export function mulberry32(seed: number): Prng {
  let state = seed >>> 0
  const step = (): number => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return (t ^ (t >>> 14)) >>> 0
  }
  const next = (): number => step() / 4294967296
  return {
    next,
    int(min, max) {
      if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
        throw new RangeError('Prng.int: invalid range')
      }
      return min + Math.floor(next() * (max - min + 1))
    },
    pick(items) {
      if (items.length === 0) throw new RangeError('Prng.pick: empty array')
      return items[Math.floor(next() * items.length)] as (typeof items)[number]
    },
  }
}

export const DEFAULT_SEED_BASE = 1

/** Returns a fresh stream for `name` each call (call once per generator). */
export function prngStream(name: string, seedBase: number = DEFAULT_SEED_BASE): Prng {
  return mulberry32(fnv1a32(`${seedBase}:${name}`))
}
