/**
 * Pure rules of M11 (SRS M11 v1.10 §4): rounding, tahap, periods, weeks, time formats, name order.
 * No store access; unit-tested.
 */

import type { MonitoringPeriod, TahapKey } from '../../api/types'
import { M1_START_MS } from '../data/settings'

export const DAY_MS = 86_400_000
export const WEEK_MS = 7 * DAY_MS
const MYT_OFFSET_MS = 8 * 3_600_000

/** 1 decimal (BR-M11-11). */
export const round1 = (n: number): number => Math.round(n * 10) / 10
export const round3 = (n: number): number => Math.round(n * 1000) / 1000
/** `part ÷ whole × 100`; 0 when `whole` is 0. */
export const percent = (part: number, whole: number): number =>
  whole <= 0 ? 0 : (part / whole) * 100

/** BR-M11-12: Cemerlang p > 60; Sederhana 20 ≤ p ≤ 60; Rendah 5 ≤ p < 20; Kritikal 0 < p < 5; Tiada p = 0. */
export function tahapOf(p: number): TahapKey {
  if (p > 60) return 'Cemerlang'
  if (p >= 20) return 'Sederhana'
  if (p >= 5) return 'Rendah'
  if (p > 0) return 'Kritikal'
  return 'Tiada Langsung'
}

/** BR-M11-06. */
export function rangeOf(raw: number | undefined): 7 | 30 | 90 {
  return raw === 7 || raw === 90 ? raw : 30
}

/** BR-M11-10: an unknown period is all time (INFERRED). */
export function periodOf(raw: string | undefined): MonitoringPeriod {
  return raw === '7d' || raw === '30d' || raw === '3m' ? raw : ''
}

/** BR-M11-10 window start (epoch ms): 7d / 30d = now − n days; 3m = now − 3 calendar months. */
export function periodFromMs(period: MonitoringPeriod, now: number): number | null {
  switch (period) {
    case '':
      return null
    case '7d':
      return now - 7 * DAY_MS
    case '30d':
      return now - 30 * DAY_MS
    case '3m': {
      const d = new Date(now + MYT_OFFSET_MS)
      return (
        Date.UTC(
          d.getUTCFullYear(),
          d.getUTCMonth() - 3,
          d.getUTCDate(),
          d.getUTCHours(),
          d.getUTCMinutes(),
          d.getUTCSeconds(),
          d.getUTCMilliseconds(),
        ) - MYT_OFFSET_MS
      )
    }
  }
}

// --- time (Asia/Kuala_Lumpur) ---------------------------------------------------------------------

export const mytDayStart = (ms: number): number =>
  Math.floor((ms + MYT_OFFSET_MS) / DAY_MS) * DAY_MS - MYT_OFFSET_MS

const p2 = (n: number) => String(n).padStart(2, '0')

/** `dd/mm` of a time (the S1 trend labels, the weeks). */
export function ddmm(ms: number): string {
  const d = new Date(ms + MYT_OFFSET_MS)
  return `${p2(d.getUTCDate())}/${p2(d.getUTCMonth() + 1)}`
}

/** Epoch ms of the Monday of week `k` (1-based; M1 = `monitoringStartDate`). */
export const weekStartMs = (k: number): number => M1_START_MS + (k - 1) * WEEK_MS

/** Week number of a time (0 before M1; BR-M11-15). */
export function weekNumberOf(ms: number): number {
  return ms < M1_START_MS ? 0 : Math.floor((ms - M1_START_MS) / WEEK_MS) + 1
}

/** The weeks M1 … the one containing `now`; the last one ends today (BR-M11-15). */
export function weeksUntil(now: number): { k: number; from: string; to: string }[] {
  const last = Math.max(1, weekNumberOf(now))
  const today = mytDayStart(now)
  const out: { k: number; from: string; to: string }[] = []
  for (let k = 1; k <= last; k++) {
    const start = weekStartMs(k)
    const end = Math.min(start + 6 * DAY_MS, today)
    out.push({ k, from: ddmm(start), to: ddmm(end) })
  }
  return out
}

// --- people ---------------------------------------------------------------------------------------------

/** BR-M11-31: Malay collation of the full name, case-insensitive. */
export const byName = (a: { name: string }, b: { name: string }): number =>
  a.name.localeCompare(b.name, 'ms', { sensitivity: 'base' }) || a.name.localeCompare(b.name)

/** Tingkatan label of a grade (DV-M11-07: one format "T{n}"); T4 = grade 10, T5 = grade 11. */
export const levelLabelOf = (grade: number | null): 'T4' | 'T5' => (grade === 10 ? 'T4' : 'T5')

/** The S3 / S5 student status (BR-M11-18). */
export function statusOf(answers: number, lastLoginAt: string | null): 'aktif' | 'login' | 'never' {
  if (answers > 0) return 'aktif'
  return lastLoginAt !== null ? 'login' : 'never'
}

/** Plain text of question HTML (S4 `textPlain`). */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}
