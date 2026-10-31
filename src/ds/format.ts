/**
 * The one number formatter of the DS (admin page templates 1.7, rule R14): counts print with a
 * thousands comma and no decimals ("1,271"), ratios keep one decimal and a "%" ("73.3%"), an empty
 * value is "-". Pages pass numbers; `DsStatTile`, `DsDefinitionList` and the pill counts format.
 * Built on the app formatter, which is ICU-free (output never depends on the runtime locale).
 */
import { formatCount as formatInt, formatNumber } from '@/lib/number/format'

/** Printed for a missing value. */
export const EMPTY_VALUE = '-'

/** Integer count with a thousands comma: 1271 -> "1,271". */
export function formatCount(value: number): string {
  return formatInt(Math.round(value))
}

/** Percentage with one decimal: 73.34 -> "73.3%". `value` is already 0-100. */
export function formatPercent(value: number): string {
  return `${formatNumber(value, { decimals: 1 })}%`
}

/**
 * Display text of a figure. Numbers: integers get the comma ("1,271"), fractions keep one decimal
 * ("12.5"); `null`, `undefined`, `NaN` and the empty string print "-"; a string is shown as given
 * (the caller already formatted it, e.g. "73.3%").
 */
export function formatStat(value: string | number | null | undefined, empty: string = EMPTY_VALUE): string {
  if (value === null || value === undefined || value === '') return empty
  if (typeof value === 'string') return value
  if (!Number.isFinite(value)) return empty
  return Number.isInteger(value) ? formatInt(value) : formatNumber(value, { decimals: 1 })
}
