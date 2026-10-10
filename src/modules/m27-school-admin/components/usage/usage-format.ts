/**
 * Formats and period rules of S1 (SRS M27 Part B BR-M27-21, FR-M27-51…56). Counts use the project's `ms-MY`
 * separator, accuracy one decimal, the dash when there is no data.
 */

import { formatCount, formatNumber } from '@/lib/number'

import type { UsagePeriod } from '../../api/school-admin'

export const USAGE_PATH = '/admin-sekolah/statistik-penggunaan'
export const DASHBOARD_PATH = '/admin-sekolah'
export const NO_DATA = '—'

/** The pills in order (FR-M27-51). `30days` is the default. */
export const PERIODS: readonly { period: UsagePeriod; label: string }[] = [
  { period: 'today', label: 'Hari Ini' },
  { period: '7days', label: '7 Hari' },
  { period: '30days', label: '30 Hari' },
]

/** A missing, repeated or unknown `period` gives `30days` (BR-M27-21). */
export function normalisePeriod(raw: unknown): UsagePeriod {
  const value: unknown = Array.isArray(raw) ? (raw as unknown[])[0] : raw
  return value === 'today' || value === '7days' || value === '30days' ? value : '30days'
}

export const count = (n: number): string => formatCount(n)

/** Integer percent ("68%"). */
export const wholePercent = (n: number): string => `${formatCount(n)}%`

/** One decimal ("61.4%") or the dash. */
export const accuracy = (n: number | null): string =>
  n === null ? NO_DATA : `${formatNumber(n, { decimals: 1 })}%`
