/**
 * Formats, tahap styles and accuracy colours of the monitoring screens (SRS M11 BR-M11-11, 12, 22, 23).
 * Class strings are full literals so Tailwind sees them.
 */

import { formatCount, formatNumber, formatPercent } from '@/lib/number'
import { formatDateEnUnpadded, formatMyt } from '@/lib/time'

import type { TahapKey, TopicBadge } from '../../api/types'

export const count = formatCount
/** Monitoring percentage: 1 decimal, ".0" dropped ("35.2%", "100%"). */
export const pct = (value: number) => formatPercent(value, { decimals: 1, dropZeroFraction: true })
/** Average per pupil: 1 decimal, ".0" dropped ("323.1", "323"). */
export const avg = (value: number) => formatNumber(value, { decimals: 1, dropZeroFraction: true })
/** S4 accuracy keeps the decimal ("100.0%"). */
export const pct1 = (value: number) => formatPercent(value, { decimals: 1 })

/** `dd/mm/yyyy HH:mm` MYT, "-" when absent. */
export const dmyHm = (iso: string | null) => (iso ? formatMyt(iso, 'dd/MM/yyyy HH:mm') : '-')
export const dmy = (iso: string) => formatMyt(iso, 'dd/MM/yyyy')
/** Modal time, raw `yyyy-mm-dd HH:mm:ss`. */
export const rawTime = (iso: string) => formatMyt(iso, 'yyyy-MM-dd HH:mm:ss')
/** Subscription date with the live English month ("12 May 2027"). */
export const subscriptionDate = formatDateEnUnpadded

export interface TahapStyle {
  /** White text on the tahap colour (pill). */
  pill: string
  /** Text colour of the % value. */
  text: string
  /** Fill of the bar. */
  fill: string
  /** Variant of the table bar: label inside the fill, outside it, or an empty track. */
  bar: 'inside' | 'outside' | 'empty'
}

export const TAHAP: Record<TahapKey, TahapStyle> = {
  Cemerlang: { pill: 'bg-green-700', text: 'text-green-700', fill: 'bg-green-700', bar: 'inside' },
  Sederhana: {
    pill: 'bg-orange-600',
    text: 'text-orange-600',
    fill: 'bg-orange-600',
    bar: 'inside',
  },
  Rendah: { pill: 'bg-red-600', text: 'text-red-600', fill: 'bg-red-600', bar: 'outside' },
  Kritikal: { pill: 'bg-red-800', text: 'text-red-800', fill: 'bg-red-800', bar: 'outside' },
  'Tiada Langsung': {
    pill: 'bg-gray-500',
    text: 'text-gray-500',
    fill: 'bg-gray-500',
    bar: 'empty',
  },
}

/** BR-M11-22: ≥ 70 green; 50-69.9 amber; < 50 red. */
export type AccuracyBand = 'good' | 'mid' | 'low'
export const accuracyBand = (p: number): AccuracyBand =>
  p >= 70 ? 'good' : p >= 50 ? 'mid' : 'low'

export const ACCURACY_TEXT_700: Record<AccuracyBand, string> = {
  good: 'text-green-700',
  mid: 'text-amber-700',
  low: 'text-red-700',
}
export const ACCURACY_TEXT_600: Record<AccuracyBand, string> = {
  good: 'text-green-600',
  mid: 'text-amber-600',
  low: 'text-red-600',
}
export const ACCURACY_BAR_500: Record<AccuracyBand, string> = {
  good: 'bg-green-500',
  mid: 'bg-amber-500',
  low: 'bg-red-500',
}

export const TOPIC_BADGE: Record<TopicBadge, string> = {
  Kuat: 'bg-green-100 text-green-700',
  Sederhana: 'bg-amber-100 text-amber-700',
  Lemah: 'bg-red-100 text-red-700',
}

export const STATUS_LABEL = { aktif: 'Aktif', login: 'Login sahaja', never: 'Belum login' } as const
export const STATUS_PILL = {
  aktif: 'bg-green-100 text-green-700',
  login: 'bg-amber-100 text-amber-700',
  never: 'bg-slate-100 text-slate-500',
} as const

/** Shared copy: a failed fetch (no M11-specific copy on live, SRS §8.3). */
export const LOAD_ERROR_COPY = 'Gagal memuatkan data. Sila cuba lagi.'

export const CARD = 'rounded-2xl bg-white shadow-sm border border-indigo-500/10'
