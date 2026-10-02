/**
 * Display helpers of S7 "Analitik Pembelajaran" and S6 "Prestasi 360" (M08-T2; SRS M08 §3 FR-37…53,
 * BR-M08-11, -14, -16). Pure functions.
 */

import type { Trend, WeakSp } from '../../api/types'

/** The ring circumference of the SVG r=50 (FR-M08-49). */
export const RING_LENGTH = 314

/** FR-M08-45: the top block shows at most 4 cards; FR-M08-46 counts the rest. */
export const TOP_WEAK_LIMIT = 4

/** "…" cut of FR-M08-43 / 45 / 47: more than `max` characters → the first `max` + "...". */
export function cut(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max).trimEnd()}...` : text
}

/** "{code} — {title}" of a weak SP card, cut at 70 (top block) or 100 characters (expanded list). */
export const weakTitle = (sp: Pick<WeakSp, 'code' | 'title'>, max: number): string =>
  cut(`${sp.code} — ${sp.title}`, max)

/** BR-M08-16 link of "Latihan Fokus" / "Fokus"; `level` is left out when unknown (S6, both OBSERVED). */
export function focusHref(o: {
  subjectCode: string
  spId: number
  count: number
  levelId: number | null
}): string {
  const query = [
    ...(o.levelId === null ? [] : [`level=${String(o.levelId)}`]),
    `dskp_sp_id=${String(o.spId)}`,
    `count=${String(o.count)}`,
  ].join('&')
  return `/practice/${encodeURIComponent(o.subjectCode)}/quiz?${query}`
}

/** FR-M08-49: dasharray of the arc, `314 × ratio` and `314 × (1 − ratio)`; ratio 0 when there is no SP. */
export function ringDash(mahir: number, total: number): string {
  const ratio = total > 0 ? Math.min(mahir / total, 1) : 0
  return `${String(RING_LENGTH * ratio)} ${String(RING_LENGTH * (1 - ratio))}`
}

/** FR-M08-50 "Ketepatan" colour: red < 50, amber 50–74.9, green ≥ 75 (INFERRED). */
export function accuracyText(n: number): string {
  return n < 50 ? 'text-red-600' : n < 75 ? 'text-amber-600' : 'text-green-600'
}

/** FR-M08-52 tile and legend styles by status. */
export const TILE_STYLE = {
  mahir: 'border-green-200 bg-green-100 text-green-700',
  sederhana: 'border-yellow-200 bg-yellow-100 text-yellow-700',
  lemah: 'border-red-200 bg-red-100 text-red-700',
  belum: 'border-slate-200 bg-slate-100 text-slate-400',
} as const

export const STATUS_LABEL = {
  mahir: 'Mahir',
  sederhana: 'Sederhana',
  lemah: 'Lemah',
  belum: 'Belum cuba',
} as const

/** Trend icon colour (BR-M08-14): stable slate-400; up green, down red (INFERRED). */
export const TREND_TEXT: Record<Trend, string> = {
  stable: 'text-slate-400',
  up: 'text-green-600',
  down: 'text-red-600',
}

/** S6 "Masa Belajar" (FR-M08-38): "{h}j {m}m" from 60 minutes, else "{m}m" (whole minutes; INFERRED floor). */
export function studyTime(seconds: number): string {
  const minutes = Math.floor(Math.max(seconds, 0) / 60)
  return minutes >= 60
    ? `${String(Math.floor(minutes / 60))}j ${String(minutes % 60)}m`
    : `${String(minutes)}m`
}

/** BR-M08-11 heatmap buckets: 0 #f1f5f9, 1 #bbf7d0, 2 #4ade80, 3 #16a34a, ≥ 4 #15803d. */
export function heatClass(sessions: number): string {
  if (sessions <= 0) return 'bg-slate-100'
  if (sessions === 1) return 'bg-green-200'
  if (sessions === 2) return 'bg-green-400'
  if (sessions === 3) return 'bg-green-600'
  return 'bg-green-700'
}

const WEEKDAYS = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'] as const
const two = (n: number): string => String(n).padStart(2, '0')

/** FR-M08-42 tooltip: "{dd/mm} ({Ahad…Sabtu}) — Tiada aktiviti" or "— {n} sesi" (INFERRED). */
export function dayLabel(date: string, sessions: number): string {
  const [y = 0, m = 1, d = 1] = date.split('-').map(Number)
  const weekday = WEEKDAYS[new Date(y, m - 1, d).getDay()] ?? ''
  return `${two(d)}/${two(m)} (${weekday}) — ${sessions === 0 ? 'Tiada aktiviti' : `${String(sessions)} sesi`}`
}

/** FR-M08-40 bar and text colours: ≥ 80 emerald / green, 60–79.9 amber, < 60 red (INFERRED bands). */
export function masteryTone(accuracy: number): { bar: string; text: string } {
  if (accuracy >= 80) return { bar: 'bg-emerald-500', text: 'text-green-600' }
  if (accuracy >= 60) return { bar: 'bg-amber-500', text: 'text-amber-600' }
  return { bar: 'bg-red-500', text: 'text-red-600' }
}
