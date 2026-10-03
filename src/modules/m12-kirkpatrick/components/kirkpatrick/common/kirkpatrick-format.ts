/**
 * Formats and class strings of the Kirkpatrick screens (SRS M12 BR-M12-33). Class strings are full
 * literals so Tailwind sees them.
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

/** A failed fetch (no M12-specific copy on live, SRS §8.3). */
export const LOAD_ERROR_COPY = 'Gagal memuatkan data. Sila cuba lagi.'

export const CARD = 'rounded-2xl bg-white shadow-sm border border-indigo-500/10'

export interface StatTone {
  box: string
  label: string
  value: string
}

export const STAT_TONE = {
  blue: { box: 'bg-blue-50 border-blue-100', label: 'text-blue-600', value: 'text-blue-900' },
  green: { box: 'bg-green-50 border-green-100', label: 'text-green-600', value: 'text-green-900' },
  emerald: {
    box: 'bg-emerald-50 border-emerald-100',
    label: 'text-emerald-600',
    value: 'text-emerald-900',
  },
  purple: {
    box: 'bg-purple-50 border-purple-100',
    label: 'text-purple-600',
    value: 'text-purple-900',
  },
  amber: { box: 'bg-amber-50 border-amber-100', label: 'text-amber-600', value: 'text-amber-900' },
  rose: { box: 'bg-rose-50 border-rose-100', label: 'text-rose-600', value: 'text-rose-900' },
  cyan: { box: 'bg-cyan-50 border-cyan-100', label: 'text-cyan-600', value: 'text-cyan-900' },
} as const satisfies Record<string, StatTone>

/** The five engagement bands (BR-M12-06; colours of FN-M12-2.6.1 as Tailwind classes). */
export interface BandStyle {
  label: string
  /** Tile background (the live `{hex}15`), icon and number colour. */
  tile: string
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
  champion: { label: 'Champion', tile: 'bg-green-700/10', text: 'text-green-700' },
  konsisten: { label: 'Konsisten', tile: 'bg-blue-600/10', text: 'text-blue-600' },
  berkembang: { label: 'Berkembang', tile: 'bg-yellow-600/10', text: 'text-yellow-600' },
  minimum: { label: 'Minimum', tile: 'bg-orange-600/10', text: 'text-orange-600' },
  tidakTerlibat: { label: 'Tidak Terlibat', tile: 'bg-red-600/10', text: 'text-red-600' },
}

/** BR-M12-10: Ketepatan colour of the school tables of S3 (>= 70 green, 50-69.9 amber, < 50 red). */
export const accuracyText = (p: number) =>
  p >= 70 ? 'text-green-600' : p >= 50 ? 'text-amber-600' : 'text-red-600'
