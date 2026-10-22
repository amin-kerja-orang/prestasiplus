/** Rounds half away from zero (PHP/Laravel `round()`), unlike `Math.round` on negatives. */
export function round(value: number): number {
  return Math.sign(value) * Math.round(Math.abs(value))
}

export const round1 = (value: number): number => round(value * 10) / 10
export const round2 = (value: number): number => round(value * 100) / 100
export const round3 = (value: number): number => round(value * 1000) / 1000

/** Share as a percentage with `digits` decimals (0, 1 or 2); 0 when `whole` is 0. */
export function percent(part: number, whole: number, digits: 0 | 1 | 2 = 0): number {
  if (whole <= 0) return 0
  const raw = (part / whole) * 100
  return digits === 0 ? round(raw) : digits === 1 ? round1(raw) : round2(raw)
}

/** `round((now - last) / last * 100)`; 0 when `last` is 0. */
export function weekChange(now: number, last: number): number {
  return last === 0 ? 0 : round(((now - last) / last) * 100)
}

/** Digits with ',' thousands: 1234567 -> "1,234,567". */
export function formatCount(value: number): string {
  return String(Math.trunc(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}
