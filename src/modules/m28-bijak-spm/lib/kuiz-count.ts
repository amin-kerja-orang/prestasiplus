/** Pure count rules of Simulasi Kuiz; no UI imports so mock-server code (also loaded by apps/api) can use it. */
export const KUIZ_COUNTS = [5, 10, 20, 40] as const
export const KUIZ_DEFAULT_COUNT = 20

/** Count from `?count=`; V2 casts with (int), anything outside 5/10/20/40 falls back to 20 (the server does the same). */
export function parseCount(raw: unknown): number {
  const v = Array.isArray(raw) ? raw[0] : raw
  // The server's rule (`normaliseKuizCount`): a number is truncated, a string is parseInt'ed ('5abc' is 5), anything else is NaN.
  const n = typeof v === 'number' ? Math.trunc(v) : typeof v === 'string' ? Number.parseInt(v, 10) : Number.NaN
  return (KUIZ_COUNTS as readonly number[]).includes(n) ? n : KUIZ_DEFAULT_COUNT
}
