/**
 * Pure helpers of S13 / S14 / S15 and the teacher-assigned quiz hosts Q4–Q6 (SRS M05 v1.19
 * FR-M05-115…121, FR-M05-140…144, BR-27, BR-32; copy §8.2 / §8.3).
 */

import type { MissionItem, RemedialTestItem, SpmTargetRow } from '../../api/types'

/** A route `:id` that is a positive integer, else `null` (the host shows the 404 page). */
export function parseId(raw: unknown): number | null {
  const s = typeof raw === 'string' ? raw : Array.isArray(raw) ? String(raw[0] ?? '') : ''
  return /^[1-9]\d*$/.test(s) ? Number(s) : null
}

/** S13 status chip (PROPOSED COPY §8.3): "Aktif" amber, "Selesai" green. */
export function remedialChip(status: RemedialTestItem['status']): { label: string; color: 'success' | 'warning' } {
  return status === 'completed'
    ? { label: 'Selesai', color: 'success' }
    : { label: 'Aktif', color: 'warning' }
}

/** `resourceUrl` is linked only when it is http(s) or an internal path (SEC: no `javascript:`). */
export function safeResourceUrl(url: string | null | undefined): string | null {
  if (!url) return null
  return /^https?:\/\//i.test(url) || /^\/(?![/\\])/.test(url) ? url : null
}

export const missionDone = (m: MissionItem): boolean => m.status === 'completed'

export const SPM_GRADES = ['A+', 'A', 'A-', 'B+', 'B', 'C+', 'C', 'D', 'E'] as const

/** S15 progress bar colour (legend: green ≥ 70, amber 50–69, red < 50). */
export const BAND_CLASS: Record<'green' | 'amber' | 'red', string> = {
  green: 'bg-green-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
}

/** S15 status line: "Belum mula" or "{answered} soalan · {accuracy}%" (PROPOSED COPY, BR-27). */
export function targetStatus(row: SpmTargetRow): string {
  if (row.accuracyPct === null || row.answered <= 0) return 'Belum mula'
  return `${String(row.answered)} soalan · ${String(row.accuracyPct)}%`
}

/** Bar width in % (0 without progress). */
export function targetBarWidth(row: SpmTargetRow): number {
  if (row.accuracyPct === null) return 0
  return Math.min(100, Math.max(0, row.accuracyPct))
}

export const SAVE_ERROR = 'Gagal menyimpan target. Sila cuba lagi.'
