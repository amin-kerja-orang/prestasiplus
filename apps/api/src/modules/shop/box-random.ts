import { randomInt } from 'node:crypto'

import { fnv1a32, mulberry32 } from '../../db/prng'

/** A stream of integers for one mystery box opening. */
export interface BoxStream {
  /** Integer in [min, max], both inclusive. */
  int(min: number, max: number): number
}

/**
 * Where the mystery box outcome comes from. Production binds `CsprngBoxRandom` (crypto.randomInt): the result cannot
 * be computed in advance. Tests override the `BOX_RANDOM` token with `SeededBoxRandom`; nothing in a request can
 * select it.
 */
export interface BoxRandom {
  stream(seedKey: string): BoxStream
}

export const BOX_RANDOM = Symbol('BOX_RANDOM')

export const CsprngBoxRandom: BoxRandom = {
  stream: () => ({ int: (min, max) => randomInt(min, max + 1) }),
}

/** Deterministic stream (the mock's mulberry32 over the FNV-1a hash of the key). For tests only. */
export const SeededBoxRandom: BoxRandom = {
  stream: (seedKey) => mulberry32(fnv1a32(seedKey)),
}
