/**
 * S5 formats (SRS M27 BR-M27-39; FR-M27-81…86): `ms-MY` counts, one-decimal accuracy, BM month names.
 */

import { formatCount, formatNumber } from '@/lib/number'
import { formatMyt, monthName } from '@/lib/time'

/** The "no data" dash of an accuracy (FR-M27-82). */
export const NO_DATA = '—'

export const count = (n: number): string => formatCount(n)

/** Integer percent, e.g. "60%". */
export const pct0 = (n: number): string => `${formatNumber(n)}%`

/** One decimal, e.g. "61.4%"; the dash when null. */
export const pct1 = (n: number | null): string =>
  n === null ? NO_DATA : `${formatNumber(n, { decimals: 1 })}%`

/** One decimal without a unit (Purata/Pelajar). */
export const dec1 = (n: number): string => formatNumber(n, { decimals: 1 })

/** "2026-08" gives "Ogos 2026" (the label of the previous and next links). */
export function monthLabel(month: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(month)
  if (!m) return month
  const n = Number(m[2])
  return n >= 1 && n <= 12 ? `${monthName(n)} ${m[1] as string}` : month
}

/** FR-M27-86: "25 Sep 2026, 03:40 PM" in Asia/Kuala_Lumpur (Laravel `M` English abbreviations). */
export const generatedAtLabel = (iso: string): string =>
  formatMyt(iso, 'd MMM yyyy, hh:mm A', { months: 'en' })
