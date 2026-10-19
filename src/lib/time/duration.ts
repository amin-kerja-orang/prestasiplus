/**
 * Duration formatters (input in whole or fractional seconds; fractions are floored).
 */

function wholeSeconds(seconds: number): number {
  if (!Number.isFinite(seconds)) throw new RangeError(`Invalid duration: ${String(seconds)}`)
  return Math.max(0, Math.floor(seconds))
}

/** `MM:SS` → "04:07"; minutes are not capped ("125:03") (M05 BR-03 quiz timer and history). */
export function formatMmSs(seconds: number): string {
  const s = wholeSeconds(seconds)
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

/** `{m}m {s}s` → "4m 7s" (M06 BR-M06 history duration). */
export function formatMinSec(seconds: number): string {
  const s = wholeSeconds(seconds)
  return `${Math.floor(s / 60)}m ${s % 60}s`
}

/** Whole minutes `{m}m` → "4m" (M05 BR-03 S8 "Masa Berlatih" = floor(seconds ÷ 60)). */
export function formatWholeMinutes(seconds: number): string {
  return `${Math.floor(wholeSeconds(seconds) / 60)}m`
}
