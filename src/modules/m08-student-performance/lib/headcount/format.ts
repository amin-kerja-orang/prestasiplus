/**
 * Display helpers of the Headcount screens (S12–S15, S22, S23; SRS M08 §3 FR-M08-75…140, BR-M08-02,
 * BR-M08-08, BR-M08-22). Pure functions.
 */

import { formatNumber } from '@/lib/number'

import type { HeadcountDashboardConfig, HeadcountGrade } from '../../api/headcount-types'

/** "—": the value of an empty cell (FR-M08-96, FR-M08-139). */
export const DASH = '—'

/** BR-M08-02: percentage → SPM grade (A+ 90–100 … G < 40). */
export function gradeOfPercent(value: number): HeadcountGrade {
  if (value >= 90) return 'A+'
  if (value >= 80) return 'A'
  if (value >= 70) return 'A-'
  if (value >= 65) return 'B+'
  if (value >= 60) return 'B'
  if (value >= 55) return 'C+'
  if (value >= 50) return 'C'
  if (value >= 45) return 'D'
  if (value >= 40) return 'E'
  return 'G'
}

/** One decimal, a trailing ".0" dropped ("73", "94.1"). */
export const num1 = (value: number): string =>
  formatNumber(value, { decimals: 1, dropZeroFraction: true })

/** Exactly one decimal ("60.0"; the RS badge, FR-M08-94). */
export const fixed1 = (value: number): string => formatNumber(value, { decimals: 1 })

/** "73% (A-)": the value, "%" and its grade. */
export const valueWithGrade = (value: number): string =>
  `${num1(value)}% (${gradeOfPercent(value)})`

/** Selisih of FR-M08-127: signed, up to one decimal ("+0", "+0.4", "-10", "-29.9"). */
export function selisihText(diff: number): string {
  const text = formatNumber(diff, { decimals: 1, dropZeroFraction: true })
  return diff >= 0 && !text.startsWith('+') ? `+${text}` : text
}

/** round(n ÷ total × 100); 0 for an empty total. */
export const percentOf = (n: number, total: number): number =>
  total <= 0 ? 0 : Math.round((n / total) * 100)

/** S13 "Keseluruhan Atas Landasan" colour (FR-M08-85): ≥ 70 emerald-600, ≥ 50 amber-600, else red-500. */
export function onTrackTone(pct: number): string {
  if (pct >= 70) return 'text-emerald-600'
  if (pct >= 50) return 'text-amber-600'
  return 'text-red-500'
}

export interface DashboardStats {
  configs: number
  students: number
  onTrack: number
  offTrack: number
  noData: number
  tracked: number
  onPct: number
  offPct: number
}

/** S13 cards over the filtered configs (FR-M08-84, FR-M08-85, BR-M08-22). */
export function dashboardStats(configs: readonly HeadcountDashboardConfig[]): DashboardStats {
  let students = 0
  let onTrack = 0
  let offTrack = 0
  let noData = 0
  for (const c of configs) {
    students += c.totalStudents
    onTrack += c.onTrack
    offTrack += c.offTrack
    noData += c.noData
  }
  const tracked = onTrack + offTrack
  return {
    configs: configs.length,
    students,
    onTrack,
    offTrack,
    noData,
    tracked,
    onPct: percentOf(onTrack, tracked),
    offPct: percentOf(offTrack, tracked),
  }
}

/** The distinct config levels of S13, sorted by level id (FR-M08-83). */
export function dashboardLevels(
  configs: readonly HeadcountDashboardConfig[],
): { level: number; name: string }[] {
  const seen = new Map<number, string>()
  for (const c of configs) if (!seen.has(c.level)) seen.set(c.level, c.levelName)
  return [...seen.entries()].sort((a, b) => a[0] - b[0]).map(([level, name]) => ({ level, name }))
}

/** S12 Persediaan Auto checkboxes (FR-M08-78): Darjah D1–D6 post 1…6, Tingkatan T1–T5 post "T1"…"T5". */
export const DARJAH_LEVELS: readonly { label: string; value: number }[] = [1, 2, 3, 4, 5, 6].map(
  (n) => ({ label: `D${String(n)}`, value: n }),
)
export const TINGKATAN_LEVELS: readonly { label: string; value: string }[] = [1, 2, 3, 4, 5].map(
  (n) => ({ label: `T${String(n)}`, value: `T${String(n)}` }),
)
