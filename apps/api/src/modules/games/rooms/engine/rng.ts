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

/** Compares two seats: user ids numerically (bigints on the wire), then the robot seats by number. */
export function cmpId(a: string, b: string): number {
  const robot = (s: string): number => (s.startsWith('robot-') ? Number(s.slice(6)) : 0)
  if (robot(a) !== robot(b)) return robot(a) - robot(b)
  const x = BigInt(robot(a) === 0 ? a : 0)
  const y = BigInt(robot(b) === 0 ? b : 0)
  return x < y ? -1 : x > y ? 1 : 0
}
