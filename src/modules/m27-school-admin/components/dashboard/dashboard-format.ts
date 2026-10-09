/**
 * Formats and colour maps of S0 (SRS M27 v1.3 BR-M27-18, FR-M27-32…36). Colours are Tailwind palette
 * classes (design tokens); the tones of the level rows and the grade bars replicate M08 (FR-M08-15, 19).
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

/** GPS band (BR-M08-03) → the colour of the GPS figure (INFERRED: the tint follows the band). */
export const BAND_TEXT: Readonly<Record<string, string>> = {
  Cemerlang: 'text-emerald-500',
  Baik: 'text-blue-500',
  Sederhana: 'text-amber-500',
  'Perlu Perhatian': 'text-red-500',
}
export const BAND_PANEL: Readonly<Record<string, string>> = {
  Cemerlang: 'border-emerald-200 bg-emerald-50',
  Baik: 'border-blue-200 bg-blue-50',
  Sederhana: 'border-amber-200 bg-amber-50',
  'Perlu Perhatian': 'border-red-200 bg-red-50',
}
/** The panel when GPS has no data (no band): the amber tint of the deck. */
export const DEFAULT_GPS_PANEL = 'border-amber-200 bg-amber-50'

/** FR-M27-35 / M08 FR-M08-19: amber 50–69.9, emerald ≥ 70, red < 50. */
export function levelTone(accuracy: number): { text: string; bar: string } {
  if (accuracy < 50) return { text: 'text-red-500', bar: 'bg-red-500' }
  if (accuracy < 70) return { text: 'text-amber-500', bar: 'bg-amber-500' }
  return { text: 'text-emerald-500', bar: 'bg-emerald-500' }
}

/** Bar width of a level row: the accuracy, clamped to 0–100. */
export const barWidth = (n: number): number => Math.min(100, Math.max(0, n))

/** M08 FR-M08-15 grade bar colours. */
export const GRADE_BAR: Readonly<Record<string, string>> = {
  'A+': 'bg-emerald-500',
  A: 'bg-emerald-400',
  'A-': 'bg-green-400',
  'B+': 'bg-blue-400',
  B: 'bg-blue-500',
  'C+': 'bg-amber-400',
  C: 'bg-amber-500',
  D: 'bg-orange-500',
  E: 'bg-red-400',
  G: 'bg-red-600',
}

/** Grade bar width: count ÷ the largest count, 0 when there is nothing (no NaN). */
export const ratioPct = (part: number, max: number): number => (max > 0 ? (part / max) * 100 : 0)
