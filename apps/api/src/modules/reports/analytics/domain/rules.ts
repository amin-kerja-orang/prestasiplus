import { MONITORING_START_DATE } from '../analytics.constants'

/**
 * Pure rules of M11 (SRS M11 v1.10 section 4): rounding, tahap, periods, weeks, time labels, name order.
 * No database and no clock; unit-tested.
 */

export type TahapKey = 'Cemerlang' | 'Sederhana' | 'Rendah' | 'Kritikal' | 'Tiada Langsung'
export type Period = '' | '7d' | '30d' | '3m'

export const DAY_MS = 86_400_000
export const WEEK_MS = 7 * DAY_MS
const MYT_OFFSET_MS = 8 * 3_600_000

export const M1_START_MS = Date.parse(`${MONITORING_START_DATE}T00:00:00+08:00`)

export const round1 = (n: number): number => Math.round(n * 10) / 10
export const round3 = (n: number): number => Math.round(n * 1000) / 1000
/** `part / whole * 100`; 0 when `whole` is 0. */
export const percent = (part: number, whole: number): number => (whole <= 0 ? 0 : (part / whole) * 100)

/** BR-M11-12: Cemerlang p > 60; Sederhana 20 <= p <= 60; Rendah 5 <= p < 20; Kritikal 0 < p < 5; Tiada Langsung p = 0. */
export function tahapOf(p: number): TahapKey {
  if (p > 60) return 'Cemerlang'
  if (p >= 20) return 'Sederhana'
  if (p >= 5) return 'Rendah'
  if (p > 0) return 'Kritikal'
  return 'Tiada Langsung'
}

/** BR-M11-28 bands: p > 70 mudah; 40 <= p <= 70 sederhana; p < 40 sukar. */
export const bandOf = (p: number): 'mudah' | 'sederhana' | 'sukar' => (p > 70 ? 'mudah' : p >= 40 ? 'sederhana' : 'sukar')

/** BR-M11-06: 7, 30 or 90; anything else (a non-number too) is 30. */
export function rangeOf(raw: string | undefined): 7 | 30 | 90 {
  const n = raw !== undefined && /^\d+$/.test(raw.trim()) ? Number(raw.trim()) : NaN
  return n === 7 || n === 90 ? n : 30
}

/** BR-M11-10: an unknown period is all time. */
export function periodOf(raw: string | undefined): Period {
  return raw === '7d' || raw === '30d' || raw === '3m' ? raw : ''
}

/** BR-M11-10 window start (epoch ms): 7d / 30d = now - n days; 3m = now - 3 calendar months (MYT); '' = no bound. */
export function periodFromMs(period: Period, now: number): number | null {
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
        Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 3, d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds(), d.getUTCMilliseconds()) -
        MYT_OFFSET_MS
      )
    }
  }
}

// --- time (Asia/Kuala_Lumpur) -----------------------------------------------------------------------------------

export const mytDayStart = (ms: number): number => Math.floor((ms + MYT_OFFSET_MS) / DAY_MS) * DAY_MS - MYT_OFFSET_MS

const p2 = (n: number): string => String(n).padStart(2, '0')

/** `dd/mm` of an instant. */
export function ddmm(ms: number): string {
  const d = new Date(ms + MYT_OFFSET_MS)
  return `${p2(d.getUTCDate())}/${p2(d.getUTCMonth() + 1)}`
}

/** `YYYY-MM-DD` (MYT) of an instant. */
export const dayKey = (ms: number): string => new Date(ms + MYT_OFFSET_MS).toISOString().slice(0, 10)

/** Epoch ms of the Monday of week `k` (1-based; M1 = the monitoring start date). */
export const weekStartMs = (k: number): number => M1_START_MS + (k - 1) * WEEK_MS

/** Week number of an instant (0 before M1; BR-M11-15). */
export const weekNumberOf = (ms: number): number => (ms < M1_START_MS ? 0 : Math.floor((ms - M1_START_MS) / WEEK_MS) + 1)

/** The weeks M1 up to the one containing `now`; the last one ends today (BR-M11-15). */
export function weeksUntil(now: number): { k: number; from: string; to: string }[] {
  const last = Math.max(1, weekNumberOf(now))
  const today = mytDayStart(now)
  const out: { k: number; from: string; to: string }[] = []
  for (let k = 1; k <= last; k++) {
    const start = weekStartMs(k)
    out.push({ k, from: ddmm(start), to: ddmm(Math.min(start + 6 * DAY_MS, today)) })
  }
  return out
}

// --- people -----------------------------------------------------------------------------------------------------

/** BR-M11-31: Malay collation of the full name, case-insensitive. */
export const byName = (a: { name: string }, b: { name: string }): number =>
  a.name.localeCompare(b.name, 'ms', { sensitivity: 'base' }) || a.name.localeCompare(b.name)

/** Numeric order of two decimal-string ids. */
export const compareIds = (a: string, b: string): number => (BigInt(a) < BigInt(b) ? -1 : BigInt(a) > BigInt(b) ? 1 : 0)

/** "T{n}" label: T4 = grade 10, T5 = grade 11. */
export const levelLabelOf = (grade: number | null): 'T4' | 'T5' => (grade === 10 ? 'T4' : 'T5')

/** The S3 / S5 pupil status (BR-M11-18). */
export function statusOf(answers: number, lastLoginAt: Date | null): 'aktif' | 'login' | 'never' {
  if (answers > 0) return 'aktif'
  return lastLoginAt !== null ? 'login' : 'never'
}

/** Plain text of question HTML (S4 `textPlain`). */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

/** BR-M11-04 / section 6.6: practice mode to the S1 activity type. */
export type ReportType = 'kuiz' | 'latihTubi' | 'trackingA'
const TYPE_OF_MODE: Readonly<Record<string, ReportType>> = {
  latih_tubi: 'latihTubi',
  ramalan: 'trackingA',
}
export const reportTypeOfMode = (mode: string): ReportType => TYPE_OF_MODE[mode] ?? 'kuiz'

/** BR-M11-23. */
export const badgeOf = (p: number): 'Kuat' | 'Sederhana' | 'Lemah' => (p >= 80 ? 'Kuat' : p >= 50 ? 'Sederhana' : 'Lemah')

/** BR-M11-19 severity of a gap group (accuracy under 60 percent). */
export const severityOf = (p: number): 'Kritikal' | 'Lemah' | 'Perlu Perhatian' => (p < 30 ? 'Kritikal' : p < 50 ? 'Lemah' : 'Perlu Perhatian')
