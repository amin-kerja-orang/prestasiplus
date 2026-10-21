import { randomBytes, randomInt } from 'node:crypto'

import type { Prng } from '../../../../db/prng'

/**
 * A `Prng` backed by `node:crypto`. Every value a client must not be able to predict (statement truth, the Kad Memori
 * layout and card ids, lifeline removals) is drawn from here: mulberry32 has a 32-bit state, so a seeded stream can be
 * recovered from what the client sees. Non-secret order (which questions are sampled) stays on the named streams.
 */
export function secretRng(): Prng {
  const next = (): number => randomBytes(4).readUInt32BE(0) / 4294967296
  return {
    next,
    int(min, max) {
      if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) throw new RangeError('secretRng.int: invalid range')
      return randomInt(min, max + 1)
    },
    pick(items) {
      if (items.length === 0) throw new RangeError('secretRng.pick: empty array')
      return items[randomInt(0, items.length)] as (typeof items)[number]
    },
  }
}
