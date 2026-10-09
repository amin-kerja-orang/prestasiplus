import { formatMyt } from '@/lib/time'

const MIN_MS = 60_000
const HOUR_MS = 60 * MIN_MS
const DAY_MS = 24 * HOUR_MS

/** "{d}h {h}j {m}m" (floor) of the time left, "Tamat!" at or after the end (BR-M16-31). */
export function formatCountdown(endsAtMs: number, nowMs: number, ended = 'Tamat!'): string {
  const left = endsAtMs - nowMs
  if (!(left > 0)) return ended
  const d = Math.floor(left / DAY_MS)
  const h = Math.floor((left % DAY_MS) / HOUR_MS)
  const m = Math.floor((left % HOUR_MS) / MIN_MS)
  return `${String(d)}h ${String(h)}j ${String(m)}m`
}

/** "21 Sep — 27 Sep 2026" from two `YYYY-MM-DD` keys (Monday and Sunday, MYT). */
export function formatWeekRange(weekStart: string, weekEnd: string): string {
  return `${formatMyt(weekStart, 'dd MMM', { months: 'en' })} — ${formatMyt(weekEnd, 'dd MMM yyyy', { months: 'en' })}`
}

/** "{x.x}%" (one decimal, as the stored `tepat`). */
export function formatPct(value: number): string {
  return `${value.toFixed(1)}%`
}
