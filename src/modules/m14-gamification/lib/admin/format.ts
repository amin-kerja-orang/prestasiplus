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

/** The tier of a key with its icon and label ("🥉 Gangsa"); the key itself when the tier is unknown. */
export function tierText(tiers: readonly Tier[], key: string): string {
  const tier = tiers.find((t) => t.tierName === key)
  if (!tier) return key === '' ? '—' : key
  return `${tier.icon} ${tier.labelMs}`.trim()
}
