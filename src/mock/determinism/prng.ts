/**
 * Named, seeded PRNG streams (overview §6.9, ADR-0006 §2).
 *
 * - The generator is mulberry32 (32-bit state, period 2^32).
 * - A stream's seed is `fnv1a32(seedBase + ':' + name)`. Streams are therefore independent of each
 *   other and of module order: adding a module or reordering generation in one module never
 *   changes another module's data.
 * - `setSeedBase(n)` is what `mock.setRandomSeed(n)` calls (M06, M09). It drops every cached stream,
 *   so streams obtained afterwards start from the new base.
 *
 * Nothing in the mock may use `Math.random()`; every random choice goes through a `Prng`.
 */

import { fnv1a32 } from './hash'

/** Default `seedBase`. E2E suites also call `setRandomSeed(1)` by default (M06 §12, M09 §12). */
export const DEFAULT_SEED_BASE = 1

export interface Prng {
  /** Next float in [0, 1). */
  next(): number
  /** Next unsigned 32-bit integer. */
  uint32(): number
  /** Integer in [min, max], both inclusive. */
  int(min: number, max: number): number
  /** `true` with probability `p` (0–1). */
  chance(p: number): boolean
  /** One element of a non-empty array. */
  pick<T>(items: readonly T[]): T
  /** Fisher–Yates shuffle, **in place**; returns the same array. */
  shuffle<T>(items: T[]): T[]
}

/** The raw mulberry32 step function. Returns an unsigned 32-bit integer per call. */
export function mulberry32Step(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return (t ^ (t >>> 14)) >>> 0
  }
}

/** A `Prng` backed by mulberry32 seeded with `seed` (any number; truncated to uint32). */
export function mulberry32(seed: number): Prng {
  const step = mulberry32Step(seed)
  const next = () => step() / 4294967296

  const prng: Prng = {
    next,
    uint32: step,
    int(min, max) {
      if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
        throw new RangeError(`Prng.int: invalid range [${String(min)}, ${String(max)}]`)
      }
      return min + Math.floor(next() * (max - min + 1))
    },
    chance: (p) => next() < p,
    pick(items) {
      if (items.length === 0) throw new RangeError('Prng.pick: empty array')
      return items[Math.floor(next() * items.length)] as (typeof items)[number]
    },
    shuffle(items) {
      for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1))
        const tmp = items[i] as (typeof items)[number]
        items[i] = items[j] as (typeof items)[number]
        items[j] = tmp
      }
      return items
    },
  }
  return prng
}

/** The seed of stream `name` under `seedBase`. */
export function streamSeed(seedBase: number, name: string): number {
  return fnv1a32(`${String(seedBase)}:${name}`)
}

export interface PrngRegistry {
  readonly seedBase: number
  /** Changes the base (`mock.setRandomSeed(n)`) and drops every cached stream. */
  setSeedBase(seedBase: number): void
  /**
   * The shared stream `name`: repeated calls return the same generator, which continues where it
   * left off (e.g. `m04:generated-questions`, `practice:<sessionId>`).
   */
  stream(name: string): Prng
  /**
   * A new generator for `name`, always starting at the stream's first value. Use it for per-row
   * derivations that must not depend on call order (e.g. `dataset:questions:row:<id>`).
   */
  fresh(name: string): Prng
  /** The uint32 seed of stream `name` under the current base. */
  seedFor(name: string): number
}

export interface PrngRegistryOptions {
  seedBase?: number
}

export function createPrngRegistry(options: PrngRegistryOptions = {}): PrngRegistry {
  let seedBase = checkSeedBase(options.seedBase ?? DEFAULT_SEED_BASE)
  const streams = new Map<string, Prng>()

  return {
    get seedBase() {
      return seedBase
    },
    setSeedBase(next) {
      seedBase = checkSeedBase(next)
      streams.clear()
    },
    stream(name) {
      let prng = streams.get(name)
      if (!prng) {
        prng = mulberry32(streamSeed(seedBase, name))
        streams.set(name, prng)
      }
      return prng
    },
    fresh: (name) => mulberry32(streamSeed(seedBase, name)),
    seedFor: (name) => streamSeed(seedBase, name),
  }
}

function checkSeedBase(seedBase: number): number {
  if (!Number.isFinite(seedBase)) throw new RangeError(`Invalid seed base: ${String(seedBase)}`)
  return seedBase
}
