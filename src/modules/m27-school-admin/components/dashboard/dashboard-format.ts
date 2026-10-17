/**
 * Formats and colour maps of S0 (SRS M27 v1.3 BR-M27-18, FR-M27-32…36). The tones of the GPS band and the level rows (BR-M08-03, FR-M08-19) live in the templates (FR-M08-15, 19).
 */

import { formatCount, formatNumber } from '@/lib/number'

/** The "no data" dash of an accuracy or GPS without a source row (BR-M27-18). */
export const NO_DATA = '—'

/** Paths S0 links to (SRS §2.1). */
export const PATHS = {
  perutusan: '/perutusan',
  home: '/dashboard',
  levels: '/prestasi/tingkatan',
  school: '/prestasi/sekolah',
} as const

/** Integer with the `ms-MY` thousands separator ("1,234"). */
export const count = (n: number): string => formatCount(n)

/** Accuracy with 1 decimal ("61.4%"), or the dash when there is no data. */
export const percent = (n: number | null): string =>
  n === null ? NO_DATA : `${formatNumber(n, { decimals: 1 })}%`

/** GPS with 2 decimals ("3.17"), or the dash. */
export const gps = (n: number | null): string =>
  n === null ? NO_DATA : formatNumber(n, { decimals: 2 })

/** Bar width of a level row: the accuracy, clamped to 0-100. */
export const barWidth = (n: number): number => Math.min(100, Math.max(0, n))

