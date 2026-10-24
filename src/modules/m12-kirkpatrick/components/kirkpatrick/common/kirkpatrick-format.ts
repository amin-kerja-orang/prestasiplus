/**
 * Formats and token colour names of the Kirkpatrick screens (SRS M12 BR-M12-33). Class strings are full
 * literals so Tailwind sees them; colours are theme tokens only (v2 staff theme).
 */

import { formatCount, formatNumber, formatPercent } from '@/lib/number'
import { formatDateEn } from '@/lib/time'

import type { BandKey } from '../../../api/types'

/** Integer with thousands separators ("306,133"). */
export const count = formatCount
/** Integer without separators, as live prints sessions, active students, "{n} soalan". */
export const plain = (value: number) => formatNumber(value, { grouping: false })
/** Percent, 1 decimal, ".0" dropped ("82.8%", "87%", "0%"). */
export const pct = (value: number) => formatPercent(value, { decimals: 1, dropZeroFraction: true })
/** Percent that keeps the decimal ("100.0%": the S3 bars). */
export const pct1 = (value: number) => formatPercent(value, { decimals: 1 })
/** A mean on a /5 or /10 scale, 1 decimal, ".0" dropped ("4.6", "8.4"). */
export const mean = (value: number) => formatNumber(value, { decimals: 1, dropZeroFraction: true })
/** GPS, 2 decimals (DV-M12-09). */
export const gps = (value: number) => formatNumber(value, { decimals: 2 })
/** Day key to "dd Mmm yyyy" with the English month as live ("01 Jan 2026"). */
export const dateEn = (dayKey: string) => formatDateEn(dayKey)

/** Semantic colour of a badge or progress bar (Nuxt UI colour names, theme tokens only). */
export type KirkColor = 'primary' | 'success' | 'info' | 'warning' | 'error' | 'neutral'

/** The five engagement bands (BR-M12-06): label, semantic colour and the matching text token. */
export interface BandStyle {
  label: string
  color: KirkColor
  text: string
}

export const BAND_ORDER: readonly BandKey[] = [
  'champion',
  'konsisten',
  'berkembang',
  'minimum',
  'tidakTerlibat',
]

export const BAND: Record<BandKey, BandStyle> = {
  champion: { label: 'Juara', color: 'success', text: 'text-success' },
  konsisten: { label: 'Konsisten', color: 'primary', text: 'text-primary-t' },
  berkembang: { label: 'Berkembang', color: 'info', text: 'text-info' },
  minimum: { label: 'Minimum', color: 'warning', text: 'text-warning' },
  tidakTerlibat: { label: 'Tidak Terlibat', color: 'error', text: 'text-error' },
}

/** BR-M12-10: Ketepatan colour of the school tables of S3 (>= 70 success, 50-69.9 warning, < 50 error). */
export const accuracyText = (p: number) =>
  p >= 70 ? 'text-success' : p >= 50 ? 'text-warning' : 'text-error'
