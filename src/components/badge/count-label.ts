import { formatCount } from '@/lib/number'

/**
 * Text of a count badge.
 * - With `cap`: counts above it read "{cap}+" (bell badge "99+", M01 FR-M01-53).
 * - Otherwise thousands-grouped as live `toLocaleString` ("Gambar Rajah 6,144").
 * Negative or non-finite input is treated as 0.
 */
export function countLabel(count: number, cap?: number): string {
  const n = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0
  if (cap !== undefined && n > cap) return `${formatCount(cap)}+`
  return formatCount(n)
}
