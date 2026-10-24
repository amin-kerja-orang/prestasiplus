/**
 * Formats and range rules of S3 (SRS M27 Part B BR-M27-26, 39; FR-M27-66…72). Counts use the project's `ms-MY`
 * separator, percentages one decimal (accuracy) or an integer (overview cards), times are MYT.
 */

import { formatCount, formatNumber } from '@/lib/number'
import { diffForHumans } from '@/lib/time'

export const ACTIVITY_PATH = '/admin-sekolah/laporan-aktiviti'
export const DASHBOARD_PATH = '/admin-sekolah'
export const NO_DATA = '—'

export type ActivityRange = 7 | 30 | 90

/** The pills in order (FR-M27-66). 30 days is the default. */
export const RANGES: readonly { range: ActivityRange; label: string }[] = [
  { range: 7, label: '7 Hari' },
  { range: 30, label: '30 Hari' },
  { range: 90, label: '3 Bulan' },
]

/** Any value other than 7, 30 or 90 gives 30 (FR-M27-66). */
export function normaliseRange(raw: unknown): ActivityRange {
  const value: unknown = Array.isArray(raw) ? (raw as unknown[])[0] : raw
  return value === '7' || value === '90' ? (Number(value) as ActivityRange) : 30
}

export const count = (n: number): string => formatCount(n)

/** Integer percent of `part` in `total`, 0 without a total ("57%"). */
export const wholePercent = (part: number, total: number): string =>
  `${formatCount(total > 0 ? Math.round((part / total) * 100) : 0)}%`

/** One decimal ("68.2%"). */
export const accuracy = (n: number): string => `${formatNumber(n, { decimals: 1 })}%`

/** Seconds as "{h}j {m}m" (M17 FN-M17-8.5.1). */
export function duration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds / 60))
  return `${String(Math.floor(total / 60))}j ${String(total % 60)}m`
}

/** M17 BR-M17-20 relative time, or "Belum login" for a null `lastLoginAt`. */
export const lastLogin = (iso: string | null): string =>
  iso === null ? 'Belum log masuk' : diffForHumans(iso)

/** Case-insensitive substring test used by the tab searches. */
export const matches = (query: string, ...fields: (string | null)[]): boolean => {
  const q = query.trim().toLowerCase()
  return q === '' || fields.some((f) => (f ?? '').toLowerCase().includes(q))
}
