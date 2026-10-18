/**
 * Formats, tahap styles and accuracy colours of the monitoring screens (SRS M11 BR-M11-11, 12, 22, 23).
 * Colours are Nuxt UI semantic names (token colours).
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

/** Nuxt UI colour names used by the staff badges, progress bars and text (token colours only). */
export type UiColor = 'success' | 'warning' | 'error' | 'info' | 'neutral'

export interface TahapStyle {
  /** Badge / progress colour. */
  color: UiColor
  /** Text colour of the % value. */
  text: string
  /** Variant of the table bar: label inside the fill, outside it, or an empty track. */
  bar: 'inside' | 'outside' | 'empty'
}

export const TAHAP: Record<TahapKey, TahapStyle> = {
  Cemerlang: { color: 'success', text: 'text-success', bar: 'inside' },
  Sederhana: { color: 'warning', text: 'text-warning', bar: 'inside' },
  Rendah: { color: 'error', text: 'text-error', bar: 'outside' },
  Kritikal: { color: 'error', text: 'text-error', bar: 'outside' },
  'Tiada Langsung': { color: 'neutral', text: 'text-muted', bar: 'empty' },
}

/** BR-M11-22: >= 70 good; 50-69.9 mid; < 50 low. */
export type AccuracyBand = 'good' | 'mid' | 'low'
export const accuracyBand = (p: number): AccuracyBand =>
  p >= 70 ? 'good' : p >= 50 ? 'mid' : 'low'

export const ACCURACY_TEXT: Record<AccuracyBand, string> = {
  good: 'text-success',
  mid: 'text-warning',
  low: 'text-error',
}
export const ACCURACY_COLOR: Record<AccuracyBand, UiColor> = {
  good: 'success',
  mid: 'warning',
  low: 'error',
}

export const TOPIC_COLOR: Record<TopicBadge, UiColor> = {
  Kuat: 'success',
  Sederhana: 'warning',
  Lemah: 'error',
}

export const STATUS_LABEL = { aktif: 'Aktif', login: 'Login sahaja', never: 'Belum login' } as const
export const STATUS_COLOR = { aktif: 'success', login: 'warning', never: 'neutral' } as const
