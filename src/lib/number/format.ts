/**
 * Number, currency and percentage formatting (SRS NFR-08, overview §8).
 *
 * `ms-MY` / `en-MY` conventions: "," thousands separator, "." decimal point.
 * Implemented without `Intl` so output never depends on the runtime's ICU data.
 * Rounding is half away from zero on the decimal value (PHP `round` /
 * `number_format` style), so 38.655 → "38.7" and 1.005 → "1.01".
 */

export interface NumberFormatOptions {
  /** Fraction digits. Default 0. */
  decimals?: number
  /** Thousands separator ",". Default `true`. */
  grouping?: boolean
  /** Omit the fraction when it is all zeros ("60" instead of "60.0"). Default `false`. */
  dropZeroFraction?: boolean
  /** Prefix "+" to positive values. Default `false`. */
  signed?: boolean
}

/** Rounds half away from zero to `decimals` places, using decimal (not binary) arithmetic. */
export function roundHalfUp(value: number, decimals = 0): number {
  if (!Number.isFinite(value)) throw new RangeError(`Invalid number: ${String(value)}`)
  const sign = value < 0 ? -1 : 1
  const abs = Math.abs(value)
  const text = String(abs)
  const result = text.includes('e')
    ? // Exponent notation (very small or very large): plain binary rounding is exact enough.
      (sign * Math.round(abs * 10 ** decimals)) / 10 ** decimals
    : sign * Number(`${Math.round(Number(`${text}e${decimals}`))}e-${decimals}`)
  return result === 0 ? 0 : result // no "-0"
}

/** Inserts "," every three digits of a string of digits. */
export function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

export function formatNumber(value: number, options: NumberFormatOptions = {}): string {
  const decimals = options.decimals ?? 0
  const rounded = roundHalfUp(value, decimals)
  const [intPart = '0', fracPart = ''] = Math.abs(rounded).toFixed(decimals).split('.')
  const int = options.grouping === false ? intPart : groupThousands(intPart)
  const showFraction = decimals > 0 && !(options.dropZeroFraction && /^0+$/.test(fracPart))
  const sign = rounded < 0 ? '-' : options.signed && rounded > 0 ? '+' : ''
  return `${sign}${int}${showFraction ? `.${fracPart}` : ''}`
}

/** Integer count with thousands separators: "128,989" (`toLocaleString('ms-MY')`). */
export function formatCount(value: number): string {
  return formatNumber(value)
}

/**
 * Integer without separators: "13872" (M05 BR-03 S1 plain counts, M07 BR-M07-22,
 * and the Laravel pager numbers "Showing 1 to 20 of 465278 results").
 */
export function formatPlainCount(value: number): string {
  return formatNumber(value, { grouping: false })
}

/** Ringgit with 2 decimals and no space: "RM3,000.00" (M02 BR-33). */
export function formatCurrency(value: number): string {
  return `RM${formatNumber(value, { decimals: 2 })}`
}

export interface PercentFormatOptions {
  /** Fraction digits. Default 1. */
  decimals?: number
  /** The ".0" rule: omit an all-zero fraction ("60%" instead of "60.0%"). Default `false`. */
  dropZeroFraction?: boolean
  /** Prefix "+" to positive values (M05 BR-18 "Peningkatan"). Default `false`. */
  signed?: boolean
}

/**
 * Percentage of an already-scaled value (0–100): `formatPercent(38.655)` → "38.7%".
 * No thousands separator (live uses `toFixed` / `number_format` without grouping here).
 */
export function formatPercent(value: number, options: PercentFormatOptions = {}): string {
  return `${formatNumber(value, {
    decimals: options.decimals ?? 1,
    grouping: false,
    dropZeroFraction: options.dropZeroFraction ?? false,
    signed: options.signed ?? false,
  })}%`
}

/** `part ÷ whole × 100`, or 0 when `whole` is 0. */
export function percentOf(part: number, whole: number): number {
  return whole === 0 ? 0 : (part / whole) * 100
}
