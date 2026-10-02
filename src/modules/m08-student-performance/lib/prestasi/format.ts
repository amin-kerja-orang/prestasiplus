/**
 * Display helpers of the Prestasi screens (S1–S4, S9–S11; SRS M08 §3, BR-M08-05). Pure functions.
 */

import { formatNumber } from '@/lib/number'

import type { DifficultyLevel, Grade, GpsBand } from '../../api/types'

/** Tahap pills of S9 / S11 (FR-M08-68, FR-M08-142): Sukar #FEE2E2/#991B1B, Sederhana #FEF3C7/#92400E, Mudah #DCFCE7/#166534. */
export const LEVEL_PILL: Record<DifficultyLevel, string> = {
  Sukar: 'bg-red-100 text-red-800',
  Sederhana: 'bg-amber-100 text-amber-800',
  Mudah: 'bg-green-100 text-green-800',
}

/** "—": the observed convention for a value that has no data (FR-M08-14, FR-M08-18). */
export const DASH = '—'

/** Integer without separators ("4533"), as S1 shows every count except "Soalan Dijawab". */
export const plain = (n: number): string => formatNumber(n, { grouping: false })

/** Integer with the `ms-MY` thousands separator ("478,499"). */
export const grouped = (n: number): string => formatNumber(n)

/** "79.8%": one decimal and "%" (S1 "Purata Ketepatan", level cards, S9). */
export const pct1 = (n: number): string => `${formatNumber(n, { decimals: 1 })}%`

/** "64%" / "93.3%": one decimal, no trailing ".0" (S3 rows, FR-M08-27). */
export const pctTrim = (n: number): string =>
  `${formatNumber(n, { decimals: 1, dropZeroFraction: true })}%`

/** Two decimals ("3.45", GPS, AR / target of the at-risk rows). */
export const dec2 = (n: number): string => formatNumber(n, { decimals: 2 })

/** The at-risk gap: up to one decimal, no trailing ".0" ("-26", "-33.3"; FR-M08-28). */
export const gapText = (n: number): string =>
  formatNumber(n, { decimals: 1, dropZeroFraction: true })

/** DV-07: a shown accuracy never exceeds 100. */
export const capPct = (n: number): number => Math.min(n, 100)

/** Accuracy colour (BR-M08-05: red / slate < 50, amber 50–69.9, emerald ≥ 70), one class set per use. */
export type AccuracyTone = 'low' | 'mid' | 'high'
export const accuracyTone = (n: number): AccuracyTone => (n < 50 ? 'low' : n < 70 ? 'mid' : 'high')

/** Level cards on S1 (FR-M08-19): amber-400 50–69.9, emerald-400 ≥ 70, red-400 < 50 (INFERRED). */
export const LEVEL_TEXT: Record<AccuracyTone, string> = {
  low: 'text-red-400',
  mid: 'text-amber-400',
  high: 'text-emerald-400',
}
export const LEVEL_BAR: Record<AccuracyTone, string> = {
  low: 'bg-red-500',
  mid: 'bg-amber-500',
  high: 'bg-emerald-500',
}
/** "Prestasi Guru" (FR-M08-20): slate-500 < 50, amber-400 50–69.9, emerald-400 ≥ 70. */
export const TEACHER_TEXT: Record<AccuracyTone, string> = {
  low: 'text-slate-500',
  mid: 'text-amber-400',
  high: 'text-emerald-400',
}
/** S3 class table (FR-M08-26): red-600 < 50, amber-600 50–69.9, emerald-600 ≥ 70. */
export const TABLE_TEXT: Record<AccuracyTone, string> = {
  low: 'text-red-600',
  mid: 'text-amber-600',
  high: 'text-emerald-600',
}

/** BR-M08-03 GPS bands: chart / tooltip colour, text class and the pill style. */
export const BAND_STYLE: Record<GpsBand, { hex: string; text: string; pill: string }> = {
  Cemerlang: {
    hex: '#10b981',
    text: 'text-emerald-400',
    pill: 'border-emerald-300 bg-emerald-50 text-emerald-600',
  },
  Baik: { hex: '#3b82f6', text: 'text-blue-400', pill: 'border-blue-300 bg-blue-50 text-blue-600' },
  Sederhana: {
    hex: '#f59e0b',
    text: 'text-amber-400',
    pill: 'border-amber-300 bg-amber-50 text-amber-600',
  },
  'Perlu Perhatian': {
    hex: '#ef4444',
    text: 'text-red-400',
    pill: 'border-red-300 bg-red-50 text-red-600',
  },
}

/** BR-M08-03: ≤ 2 Cemerlang, ≤ 4 Baik, ≤ 6 Sederhana, else Perlu Perhatian. */
export function bandOf(gps: number): GpsBand {
  if (gps <= 2) return 'Cemerlang'
  if (gps <= 4) return 'Baik'
  if (gps <= 6) return 'Sederhana'
  return 'Perlu Perhatian'
}

/** Pencapaian bar colour of the subject rows (FR-M08-18). */
export const ACHIEVEMENT_BAR: Record<GpsBand, string> = {
  Cemerlang: 'bg-emerald-500',
  Baik: 'bg-blue-500',
  Sederhana: 'bg-amber-500',
  'Perlu Perhatian': 'bg-red-500',
}

/** Grade distribution bar colours (FR-M08-15). */
export const GRADE_BAR: Record<Grade, string> = {
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

/** Bar width: part ÷ max, 0 when there is nothing (no NaN). */
export const ratioPct = (part: number, max: number): number => (max > 0 ? (part / max) * 100 : 0)

/** Rank number colour of "Murid Terbaik" (FR-M08-27). */
export const rankTone = (rank: number): string =>
  rank === 1 ? 'text-amber-500' : rank === 3 ? 'text-amber-700' : 'text-gray-400'

/** "Tingkatan 4" from `t4` (S2, S3). */
export const levelNumber = (code: string): number => (code === 't4' ? 4 : 5)

/** Hex colour + 2-digit alpha, for the S10 card border (`{colour}30`) and background (`{colour}10`). */
export const withAlpha = (hex: string, alpha: string): string => `${hex}${alpha}`
