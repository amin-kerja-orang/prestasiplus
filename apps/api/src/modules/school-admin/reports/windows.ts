import type { SchoolAdminDskpStatus, SchoolAdminUsagePeriod } from '@pp/contract'

import { DAY_MS, mytDayStart } from '../../reports/analytics/domain/rules'

/**
 * Pure window, label and rounding rules of the school admin reports (BE-21 Part B). No database, no clock: the caller passes
 * `now`. Day and month boundaries are Asia/Kuala_Lumpur (UTC+8, no daylight saving), the same as BE-20.
 */

const MYT_OFFSET_MS = 8 * 3_600_000

/** Rows per `IN (...)` list sent to the database (large schools). */
export const IN_CHUNK = 1000

/** Splits a list into pieces of at most `size` items. */
export function chunk<T>(items: readonly T[], size: number = IN_CHUNK): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

// --- usage -----------------------------------------------------------------------------------------------------------------

/** An unknown or absent period is `30days` (never an error). */
export function usagePeriodOf(raw: string | undefined): SchoolAdminUsagePeriod {
  return raw === 'today' || raw === '7days' ? raw : '30days'
}

export const USAGE_LABELS: Readonly<Record<SchoolAdminUsagePeriod, 'Hari Ini' | '7 Hari' | '30 Hari'>> = {
  today: 'Hari Ini',
  '7days': '7 Hari',
  '30days': '30 Hari',
}

/** `today` = 00:00 MYT to now; `7days` / `30days` = the last N x 24 hours. Epoch ms. */
export function usageWindow(period: SchoolAdminUsagePeriod, now: number): { from: number; to: number } {
  if (period === 'today') return { from: mytDayStart(now), to: now }
  return { from: now - (period === '7days' ? 7 : 30) * DAY_MS, to: now }
}

/** Session mode to the usage mode label: Bab, Ulang Kaji, Tracking A, PKSK; every other mode is Latihan. */
export function modeLabelOf(mode: string): string {
  switch (mode) {
    case 'chapter':
      return 'Bab'
    case 'revision':
      return 'Ulang Kaji'
    case 'ramalan':
      return 'Tracking A'
    case 'pksk':
      return 'PKSK'
    default:
      return 'Latihan'
  }
}

// --- activity --------------------------------------------------------------------------------------------------------------

/** The activity window starts at 00:00 MYT of (today - range + 1) and ends now. Epoch ms. */
export function activityWindow(range: 7 | 30 | 90, now: number): { from: number; to: number; today: number } {
  const today = mytDayStart(now)
  return { from: today - (range - 1) * DAY_MS, to: now, today }
}

// --- monthly ---------------------------------------------------------------------------------------------------------------

export interface YearMonth {
  year: number
  month: number
}

const MONTHS_MS = [
  'Januari',
  'Februari',
  'Mac',
  'April',
  'Mei',
  'Jun',
  'Julai',
  'Ogos',
  'September',
  'Oktober',
  'November',
  'Disember',
] as const

const MONTH_KEY = /^(\d{4})-(0[1-9]|1[0-2])$/

export const monthKey = (ym: YearMonth): string => `${String(ym.year).padStart(4, '0')}-${String(ym.month).padStart(2, '0')}`

/** The calendar month (MYT) of an instant. */
export function currentMonth(now: number): YearMonth {
  const d = new Date(now + MYT_OFFSET_MS)
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 }
}

/** `YYYY-MM`; a future or invalid value (or none) is the current month. */
export function monthOf(raw: string | undefined, now: number): YearMonth {
  const current = currentMonth(now)
  const m = raw === undefined ? null : MONTH_KEY.exec(raw)
  if (!m) return current
  const ym = { year: Number(m[1]), month: Number(m[2]) }
  return monthKey(ym) > monthKey(current) ? current : ym
}

/** `n` months before (negative `n` after) a month. */
export function shiftMonth(ym: YearMonth, n: number): YearMonth {
  const index = ym.year * 12 + (ym.month - 1) + n
  return { year: Math.floor(index / 12), month: (index % 12) + 1 }
}

/** BM month name and year, e.g. "September 2026". */
export const monthLabel = (ym: YearMonth): string => `${MONTHS_MS[ym.month - 1]} ${ym.year}`

/** First instant of a month in MYT (epoch ms). */
export const monthStart = (ym: YearMonth): number => Date.UTC(ym.year, ym.month - 1, 1) - MYT_OFFSET_MS

/** Last millisecond of a month in MYT (epoch ms). */
export const monthEnd = (ym: YearMonth): number => monthStart(shiftMonth(ym, 1)) - 1

/** The 12 months ending with `ym`, ascending. */
export function lastTwelve(ym: YearMonth): YearMonth[] {
  return Array.from({ length: 12 }, (_, i) => shiftMonth(ym, i - 11))
}

/** The request minute (epoch ms). */
export const minuteOf = (now: number): number => Math.floor(now / 60_000) * 60_000

// --- numbers ---------------------------------------------------------------------------------------------------------------

export const round1 = (n: number): number => Math.round(n * 10) / 10

/** `correct / answered x 100`, 1 decimal, never above 100; null when nothing was answered. */
export const accuracyOf = (correct: number, answered: number): number | null =>
  answered > 0 ? Math.min(100, round1((correct / answered) * 100)) : null

/** `round(part / whole x 100)`; 0 without a whole. */
export const participationOf = (part: number, whole: number): number => (whole > 0 ? Math.round((part / whole) * 100) : 0)

// --- DSKP heatmap ----------------------------------------------------------------------------------------------------------

/** Pooled percent of an SP: floor(100 x correct / answered + 0.5); null when unanswered. */
export const pooledPct = (correct: number, answered: number): number | null =>
  answered > 0 ? Math.floor((100 * correct) / answered + 0.5) : null

/** mahir >= 75, sederhana >= 50, lemah < 50, belum = no percent. */
export function dskpStatusOf(pct: number | null): SchoolAdminDskpStatus {
  if (pct === null) return 'belum'
  return pct >= 75 ? 'mahir' : pct >= 50 ? 'sederhana' : 'lemah'
}

/** T4 or T5, case-insensitive; anything else is T4. */
export const tingkatanOf = (raw: string | undefined): 't4' | 't5' => (raw?.trim().toLowerCase() === 't5' ? 't5' : 't4')

// --- class list ------------------------------------------------------------------------------------------------------------

/** 25 per page; an invalid page is 1 and a page past the end is the last page. */
export function pageOf(raw: string | undefined, totalPages: number): number {
  const n = raw !== undefined && /^\d{1,9}$/.test(raw.trim()) ? Number(raw.trim()) : 1
  return Math.min(Math.max(1, n), Math.max(1, totalPages))
}
