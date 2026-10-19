/**
 * Small deterministic helpers of the M10 build (no shared state; every stream is named).
 */

import { fnv1a32 } from '@/mock/determinism/hash'
import { mulberry32 } from '@/mock/determinism/prng'

/** Stable 32-bit hash of a text. */
export const h32 = (text: string): number => fnv1a32(text)

/** A stable unit value in [0, 1) for a key. */
export const unit = (text: string): number => fnv1a32(text) / 4_294_967_296

/** Deterministic Fisher–Yates shuffle on a copy, seeded by a stream name. */
export function shuffled<T>(items: readonly T[], stream: string): T[] {
  const out = [...items]
  const rng = mulberry32(fnv1a32(stream))
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1))
    const a = out[i] as T
    out[i] = out[j] as T
    out[j] = a
  }
  return out
}

/** Sorts by a stable hash of `stream:key` (ascending); ties keep the input order. */
export function byHash<T>(
  items: readonly T[],
  stream: string,
  key: (item: T) => string | number,
): T[] {
  return items
    .map((item, i) => ({ item, i, h: fnv1a32(`${stream}:${String(key(item))}`) }))
    .sort((a, b) => a.h - b.h || a.i - b.i)
    .map((x) => x.item)
}

/**
 * Largest-remainder split of `total` over `weights` (sum of the result = `total`). All-zero
 * weights split evenly.
 */
export function splitTotal(total: number, weights: readonly number[]): number[] {
  const n = weights.length
  if (n === 0) return []
  const sum = weights.reduce((a, b) => a + b, 0)
  const w = sum > 0 ? weights : weights.map(() => 1)
  const wSum = sum > 0 ? sum : n
  const raw = w.map((x) => (total * x) / wSum)
  const base = raw.map((x) => Math.floor(x))
  let rest = total - base.reduce((a, b) => a + b, 0)
  const order = raw
    .map((x, i) => ({ i, frac: x - Math.floor(x) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i)
  for (const { i } of order) {
    if (rest <= 0) break
    base[i] = (base[i] as number) + 1
    rest--
  }
  return base
}

/**
 * Deals `pupils` into classes so that class `c` gets exactly `quotas[c]` memberships and every pupil
 * is in at least one class (a pupil is in a class at most once). Needs
 * `pupils.length ≤ Σ quotas` and `quotas[c] ≤ pupils.length`.
 */
export function dealQuotas(pupils: readonly number[], quotas: readonly number[]): number[][] {
  const total = quotas.reduce((a, b) => a + b, 0)
  if (pupils.length > total) {
    throw new Error(`dealQuotas: ${String(pupils.length)} pupils but only ${String(total)} places`)
  }
  const out: number[][] = quotas.map(() => [])
  const left = [...quotas]
  const inClass = quotas.map(() => new Set<number>())
  // First pass: every pupil once, into the class with the most places left.
  pupils.forEach((p) => {
    let best = 0
    for (let c = 1; c < left.length; c++) if ((left[c] as number) > (left[best] as number)) best = c
    if ((left[best] as number) <= 0) throw new Error('dealQuotas: no place left')
    ;(out[best] as number[]).push(p)
    ;(inClass[best] as Set<number>).add(p)
    left[best] = (left[best] as number) - 1
  })
  // Second pass: fill the remaining places with pupils not yet in that class.
  for (let c = 0; c < left.length; c++) {
    let cursor = c * 7
    let guard = 0
    while ((left[c] as number) > 0) {
      const p = pupils[cursor % pupils.length] as number
      cursor++
      if (++guard > pupils.length * 3) {
        throw new Error(`dealQuotas: class ${String(c)} needs more distinct pupils than exist`)
      }
      if ((inClass[c] as Set<number>).has(p)) continue
      ;(out[c] as number[]).push(p)
      ;(inClass[c] as Set<number>).add(p)
      left[c] = (left[c] as number) - 1
    }
  }
  return out
}
