/**
 * Display helpers of the Prestasi screens (S1–S4, S9–S11; SRS M08 §3, BR-M08-05). Pure functions.
 * Tones are semantic names / theme text tokens; pages never carry palette colours (v2 restyle).
 */

import { formatNumber } from '@/lib/number'

import type { DifficultyLevel, GpsBand } from '../../api/types'

/** Semantic tone: the colour name of a Nuxt UI badge / progress / alert. */
export type Tone = 'success' | 'warning' | 'error' | 'info' | 'neutral'

/** Tahap badges of S9 / S11 (FR-M08-68, FR-M08-142): Sukar error, Sederhana warning, Mudah success. */
export const LEVEL_BADGE: Record<DifficultyLevel, Tone> = {
  Sukar: 'error',
  Sederhana: 'warning',
  Mudah: 'success',
}
/** Icon of the Tahap badges (word + icon, never colour alone); a name of `lib/icons.ts`. */
export const LEVEL_ICON = {
  Sukar: 'smiley-sad',
  Sederhana: 'smiley-meh',
  Mudah: 'smiley',
} as const satisfies Record<DifficultyLevel, string>

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

/** Accuracy tone (BR-M08-05: error < 50, warning 50–69.9, success ≥ 70). */
export type AccuracyTone = 'low' | 'mid' | 'high'
export const accuracyTone = (n: number): AccuracyTone => (n < 50 ? 'low' : n < 70 ? 'mid' : 'high')

/** Text token of an accuracy tone (level cards, teacher rows, class table). */
export const TONE_TEXT: Record<AccuracyTone, string> = {
  low: 'text-error',
  mid: 'text-warning',
  high: 'text-success',
}
/** Progress / badge colour of an accuracy tone. */
export const TONE_COLOR: Record<AccuracyTone, Tone> = {
  low: 'error',
  mid: 'warning',
  high: 'success',
}

/** BR-M08-03 GPS bands: text token and badge colour. */
export const BAND_STYLE: Record<GpsBand, { text: string; badge: Tone }> = {
  Cemerlang: { text: 'text-success', badge: 'success' },
  Baik: { text: 'text-info', badge: 'info' },
  Sederhana: { text: 'text-warning', badge: 'warning' },
  'Perlu Perhatian': { text: 'text-error', badge: 'error' },
}

/** Pencapaian progress colour of the subject rows (FR-M08-18). */
export const ACHIEVEMENT_COLOR: Record<GpsBand, 'success' | 'info' | 'warning' | 'error'> = {
  Cemerlang: 'success',
  Baik: 'info',
  Sederhana: 'warning',
  'Perlu Perhatian': 'error',
}

/** BR-M08-03: ≤ 2 Cemerlang, ≤ 4 Baik, ≤ 6 Sederhana, else Perlu Perhatian. */
export function bandOf(gps: number): GpsBand {
  if (gps <= 2) return 'Cemerlang'
  if (gps <= 4) return 'Baik'
  if (gps <= 6) return 'Sederhana'
  return 'Perlu Perhatian'
}

/** Bar width: part ÷ max, 0 when there is nothing (no NaN). */
export const ratioPct = (part: number, max: number): number => (max > 0 ? (part / max) * 100 : 0)

/** "Tingkatan 4" from `t4` (S2, S3). */
export const levelNumber = (code: string): number => (code === 't4' ? 4 : 5)
