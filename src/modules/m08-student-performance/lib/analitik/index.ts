/**
 * Display helpers of S7 "Analitik Pembelajaran" and S6 "Prestasi 360" (M08-T2; SRS M08 §3 FR-37…53,
 * BR-M08-11, -14, -16). Pure functions.
 */

import type { AnalyticsSubject, Trend, WeakSp } from '../../api/types'

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
  return n < 50 ? 'text-error' : n < 75 ? 'text-warning' : 'text-success'
}

/** FR-M08-52 tile and legend colours by status (a badge colour; the word is always shown beside it). */
export const TILE_COLOR = {
  mahir: 'success',
  sederhana: 'warning',
  lemah: 'error',
  belum: 'neutral',
} as const

export const STATUS_LABEL = {
  mahir: 'Mahir',
  sederhana: 'Sederhana',
  lemah: 'Lemah',
  belum: 'Belum cuba',
} as const

/** Trend icon colour (BR-M08-14): stable dimmed; up success, down error (INFERRED). */
export const TREND_TEXT: Record<Trend, string> = {
  stable: 'text-dimmed',
  up: 'text-success',
  down: 'text-error',
}

/** Trend icons (icon + colour, never colour alone); names of `lib/icons.ts`. */
export const TREND_ICON = {
  stable: 'minus',
  up: 'trend-up',
  down: 'trend-down',
} as const satisfies Record<Trend, string>

/** S6 "Masa Belajar" (FR-M08-38): "{h}j {m}m" from 60 minutes, else "{m}m" (whole minutes; INFERRED floor). */
export function studyTime(seconds: number): string {
  const minutes = Math.floor(Math.max(seconds, 0) / 60)
  return minutes >= 60
    ? `${String(Math.floor(minutes / 60))}j ${String(minutes % 60)}m`
    : `${String(minutes)}m`
}

/** BR-M08-11 heatmap buckets 0, 1, 2, 3, ≥ 4 sessions: a five-step single-hue ramp (elevated to primary). */
export const HEAT_RAMP = [
  'bg-elevated',
  'bg-primary/15',
  'bg-primary/35',
  'bg-primary/60',
  'bg-primary',
] as const
export function heatClass(sessions: number): string {
  return HEAT_RAMP[Math.min(Math.max(Math.floor(sessions), 0), 4)] ?? 'bg-elevated'
}

const WEEKDAYS = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'] as const
const two = (n: number): string => String(n).padStart(2, '0')

/** FR-M08-42 tooltip: "{dd/mm} ({Ahad…Sabtu}) — Tiada aktiviti" or "— {n} sesi" (INFERRED). */
export function dayLabel(date: string, sessions: number): string {
  const [y = 0, m = 1, d = 1] = date.split('-').map(Number)
  const weekday = WEEKDAYS[new Date(y, m - 1, d).getDay()] ?? ''
  return `${two(d)}/${two(m)} (${weekday}) — ${sessions === 0 ? 'Tiada aktiviti' : `${String(sessions)} sesi`}`
}

export const HEAT_LEGEND_360 = ['0', '1-4', '5-8', '9-12', '13+'] as const
/** Prestasi 360 map bin (R1-MUR-4): 0, 1-4, 5-8, 9-12, 13+ sessions a day. */
export function heatBin360(sessions: number): number {
  const n = Math.max(Math.floor(sessions), 0)
  return n === 0 ? 0 : n <= 4 ? 1 : n <= 8 ? 2 : n <= 12 ? 3 : 4
}

/** Prestasi 360 tooltip: "{dd/mm} ({Hari}) — {n} sesi latihan" or "— Tiada aktiviti". */
export function dayLabel360(date: string, sessions: number): string {
  return dayLabel(date, sessions).replace(/ sesi$/, ' sesi latihan')
}

/** FR-M08-40 bar and text colours: ≥ 80 success, 60–79.9 warning, < 60 error (INFERRED bands). */
export function masteryTone(accuracy: number): {
  color: 'success' | 'warning' | 'error'
  text: string
} {
  if (accuracy >= 80) return { color: 'success', text: 'text-success' }
  if (accuracy >= 60) return { color: 'warning', text: 'text-warning' }
  return { color: 'error', text: 'text-error' }
}

/** FR-MUR-5-6, AC-MUR-5-2: the message of a subject without any answer. */
export const noPracticeText = (subject: string): string =>
  `Belum ada latihan untuk ${subject}. Mula berlatih untuk membuka analitik penuh.`

/** Summary sentence of a subject with answers (reference behaviour 3): "{mahir} daripada {total} Standard Pembelajaran ..." */
export function masterySummary(subject: Pick<AnalyticsSubject, 'name' | 'counts' | 'ringTotal'>): string {
  const base = `${String(subject.counts.mahir)} daripada ${String(subject.ringTotal)} Standard Pembelajaran sudah dikuasai untuk ${subject.name}.`
  return subject.counts.belum > 0 ? `${base} Masih ada ${String(subject.counts.belum)} SP belum dicuba.` : base
}

/** Tab label of a subject: "{Subjek}" and, only with answers, the accuracy as a whole number (FR-MUR-5-2). */
export const tabAccuracy = (s: Pick<AnalyticsSubject, 'accuracy' | 'answered'>): string | null =>
  s.answered > 0 && s.accuracy !== null ? `${String(Math.round(s.accuracy))}%` : null

/** The first subject with at least one answer, else the first (FR-MUR-5-8). */
export function defaultTab<T extends Pick<AnalyticsSubject, 'answered'>>(subjects: readonly T[]): T | null {
  return subjects.find((s) => s.answered > 0) ?? subjects[0] ?? null
}

/** FR-MUR-5-5 / PRD map: the tiles of a subject grouped by strand, in the order the strands first appear. */
export function groupByStrand<T extends { strand: string | null }>(tiles: readonly T[]): { strand: string | null; tiles: T[] }[] {
  const groups: { strand: string | null; tiles: T[] }[] = []
  for (const t of tiles) {
    const g = groups.find((x) => x.strand === t.strand)
    if (g) g.tiles.push(t)
    else groups.push({ strand: t.strand, tiles: [t] })
  }
  return groups
}
