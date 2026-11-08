import type { Prng } from '../../../../db/prng'

/** Fisher-Yates shuffle in place with a named stream (the mock's `rng.shuffle`). */
export function shuffle<T>(items: T[], rng: Prng): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1))
    const t = items[i] as T
    items[i] = items[j] as T
    items[j] = t
  }
  return items
}

/** True with probability `p` (the mock's `rng.chance`). */
export const chance = (rng: Prng, p: number): boolean => rng.next() < p

/** Compares two decimal-string ids numerically (ids are bigints on the wire). */
export function cmpId(a: string, b: string): number {
  const x = BigInt(a)
  const y = BigInt(b)
  return x < y ? -1 : x > y ? 1 : 0
}
