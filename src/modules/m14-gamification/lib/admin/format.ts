/** Formatting helpers of the M14 admin screens (times are Asia/Kuala_Lumpur, like the M15 pages). */
import { formatNumber } from '@/lib/number'

import type { LedgerType, Tier } from '../../api/types'

const TZ = 'Asia/Kuala_Lumpur'

/** "dd/mm/yyyy HH:MM", 24-hour (V2 `d/m/Y H:i`). */
export function formatDateTime(iso: string): string {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  const p: Record<string, string> = {}
  for (const part of fmt.formatToParts(new Date(iso))) p[part.type] = part.value
  return `${p.day ?? ''}/${p.month ?? ''}/${p.year ?? ''} ${p.hour ?? ''}:${p.minute ?? ''}`
}

/** Relative time in BM (V2 `diffForHumans`): "5 minit lalu". */
export function relativeTime(iso: string, now: Date = new Date()): string {
  const seconds = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 1000))
  if (seconds < 60) return 'beberapa saat lalu'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${String(minutes)} minit lalu`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${String(hours)} jam lalu`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${String(days)} hari lalu`
  const months = Math.floor(days / 30)
  if (months < 12) return `${String(months)} bulan lalu`
  return `${String(Math.floor(months / 12))} tahun lalu`
}

/** `+12` / `-5` (V2 prints `+` for zero or more). */
export function signedAmount(amount: number): string {
  return `${amount >= 0 ? '+' : ''}${formatNumber(amount)}`
}

/** `RM12.50`. */
export function formatRm(value: number): string {
  return `RM${formatNumber(value, { decimals: 2 })}`
}

export const LEDGER_TONE: Record<LedgerType, 'success' | 'error' | 'info' | 'warning' | 'neutral'> = {
  earn: 'success',
  spend: 'error',
  convert: 'info',
  bonus: 'warning',
  refund: 'neutral',
}

export function amountTone(amount: number): 'success' | 'error' {
  return amount >= 0 ? 'success' : 'error'
}

/** The tier of a key (or id, as the V2 filter posts it) with its icon and label ("🥉 Gangsa"); the key itself when unknown. */
export function tierText(tiers: readonly Tier[], key: string): string {
  const tier = tiers.find((t) => t.tierName === key) ?? tiers.find((t) => t.id === key)
  if (!tier) return key === '' ? '—' : key
  return `${tier.icon} ${tier.labelMs}`.trim()
}

export type TierTone = 'neutral' | 'primary' | 'success' | 'warning' | 'error' | 'info'

/**
 * The design-system tone of a tier colour (`#rrggbb`, as the API sends it): V2 paints the pill with the colour itself, here
 * the hue picks the nearest tone (red, orange or yellow, green, blue, violet) and a grey is neutral. No inline style.
 */
export function tierTone(color: string | undefined | null): TierTone {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color ?? '')
  if (!m) return 'neutral'
  const [r, g, b] = [m[1], m[2], m[3]].map((h) => parseInt(h ?? '0', 16) / 255) as [number, number, number]
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min
  if (delta < 0.12) return 'neutral'
  let hue: number
  if (max === r) hue = ((g - b) / delta + 6) % 6
  else if (max === g) hue = (b - r) / delta + 2
  else hue = (r - g) / delta + 4
  hue *= 60
  if (hue < 15 || hue >= 330) return 'error'
  if (hue < 70) return 'warning'
  if (hue < 170) return 'success'
  if (hue < 250) return 'info'
  return 'primary'
}
