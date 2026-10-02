/**
 * Time model of the M05 answer log and session datasets (SRS M05 v1.16 §6.14.1; M11 §6.7 / BR-M11-10
 * / BR-M11-15; M17 §6.4 windows). Everything is pinned **at the project clock**
 * 2026-09-25T15:40:00+08:00 (the M05 anchor; overview §6.12).
 *
 * - **Weeks** `M1 … M32` (M11 BR-M11-15): Monday–Sunday from `monitoringStartDate` 2026-02-16; week
 *   0 = before M1 (the 12 answers of 8765, M05 §6.14.1).
 * - **Bands** (spec buckets, not live windows): the nested windows of the pins at the clock —
 *   0 today (M17), 1 rest of the calendar week (M17 "week", Mon 21 Sep), 2 rest of M11 `7d`
 *   (≥ now − 7 days), 3 rest of the calendar month (M17 "month", 1 Sep), 4 rest of M11 `30d`,
 *   5 rest of M11 `3m` (≥ now − 3 calendar months), 6 older. Band b of a row means "inside window b
 *   and not inside window b − 1", so window W_b = bands 0…b.
 *
 * Runtime rows written after the clock are counted by time (`answeredAtMs`), never by band; the
 * band facet only places the seeded rows.
 */

/** The project clock (M05 §6.12; `CLOCK_ANCHOR_ISO`). */
export const PIN_NOW_ISO = '2026-09-25T15:40:00+08:00'
export const PIN_NOW = Date.parse(PIN_NOW_ISO)

const DAY = 86_400_000

/** M11 `monitoringStartDate` (Monday of M1). */
export const M1_START = Date.parse('2026-02-16T00:00:00+08:00')
/** Last week number at the clock (M32 = 21–27 Sep, ending today). */
export const LAST_WEEK = 32

/** Start (inclusive) of week `k` (1–32); week 0 = the 7 days before M1. */
export function weekStart(k: number): number {
  return M1_START + (k - 1) * 7 * DAY
}

/** Week number of a time (0 before M1, capped below at 0; may exceed 32 after the clock). */
export function weekOf(ms: number): number {
  if (ms < M1_START) return 0
  return Math.floor((ms - M1_START) / (7 * DAY)) + 1
}

/**
 * Lower bounds of the windows at the clock, newest first: today, calendar week, M11 7d, calendar
 * month, M11 30d, M11 3m (BR-M11-10: `answeredAt ≥ now − 7 days`, `≥ now − 30 days`,
 * `≥ now − 3 calendar months`).
 */
export const WINDOW_FROM = {
  today: Date.parse('2026-09-25T00:00:00+08:00'),
  week: Date.parse('2026-09-21T00:00:00+08:00'),
  d7: PIN_NOW - 7 * DAY,
  month: Date.parse('2026-09-01T00:00:00+08:00'),
  d30: PIN_NOW - 30 * DAY,
  m3: Date.parse('2026-06-25T15:40:00+08:00'),
} as const

export type Band = 0 | 1 | 2 | 3 | 4 | 5 | 6
export const BANDS: readonly Band[] = [0, 1, 2, 3, 4, 5, 6]

/** `[from, to)` of each band (band 0 ends at the clock; band 6 starts at week 0). */
export const BAND_RANGE: Readonly<Record<Band, readonly [number, number]>> = {
  0: [WINDOW_FROM.today, PIN_NOW],
  1: [WINDOW_FROM.week, WINDOW_FROM.today],
  2: [WINDOW_FROM.d7, WINDOW_FROM.week],
  3: [WINDOW_FROM.month, WINDOW_FROM.d7],
  4: [WINDOW_FROM.d30, WINDOW_FROM.month],
  5: [WINDOW_FROM.m3, WINDOW_FROM.d30],
  6: [weekStart(0), WINDOW_FROM.m3],
}

/** Band of a time at or before the clock. */
export function bandOf(ms: number): Band {
  for (const b of BANDS) if (ms >= BAND_RANGE[b][0]) return b
  return 6
}

/** `[from, to)` of week `k` ∩ band `b`, or null when they do not meet. */
export function weekBandRange(k: number, b: Band): readonly [number, number] | null {
  const [bf, bt] = BAND_RANGE[b]
  const from = Math.max(weekStart(k), bf)
  const to = Math.min(weekStart(k + 1), bt)
  return from < to ? [from, to] : null
}

/** The bands week `k` meets, newest first. */
export function bandsOfWeek(k: number): Band[] {
  return BANDS.filter((b) => weekBandRange(k, b) !== null)
}

/**
 * Windows as the named queries read them (`period`): M11 `7d` / `30d` / `3m` (BR-M11-10) and M17
 * `today` / `week` / `month`, evaluated against `now` (the bound clock).
 */
export type Period = 'today' | 'week' | '7d' | 'month' | '30d' | '3m'

export function periodFrom(period: Period, now: number): number {
  switch (period) {
    case 'today':
      return startOfMytDay(now)
    case 'week': {
      const day = startOfMytDay(now)
      const dow = (new Date(day + 8 * 3_600_000).getUTCDay() + 6) % 7 // 0 = Monday
      return day - dow * DAY
    }
    case '7d':
      return now - 7 * DAY
    case 'month': {
      const d = new Date(now + 8 * 3_600_000)
      return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) - 8 * 3_600_000
    }
    case '30d':
      return now - 30 * DAY
    case '3m': {
      const d = new Date(now + 8 * 3_600_000)
      const target = new Date(
        Date.UTC(
          d.getUTCFullYear(),
          d.getUTCMonth() - 3,
          d.getUTCDate(),
          d.getUTCHours(),
          d.getUTCMinutes(),
          d.getUTCSeconds(),
        ),
      )
      return target.getTime() - 8 * 3_600_000
    }
  }
}

/** Midnight (MYT) of the day of `ms`. */
export function startOfMytDay(ms: number): number {
  const offset = 8 * 3_600_000
  return Math.floor((ms + offset) / DAY) * DAY - offset
}

/** `YYYY-MM-DD` (MYT) of `ms`. */
export function mytDateKey(ms: number): string {
  const d = new Date(ms + 8 * 3_600_000)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${String(d.getUTCFullYear())}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`
}

/** Epoch ms of a local date `YYYY-MM-DD` at 00:00 MYT, or NaN. */
export function mytDayStart(date: string): number {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? Date.parse(`${date}T00:00:00+08:00`) : Number.NaN
}

export { DAY as DAY_MS }
