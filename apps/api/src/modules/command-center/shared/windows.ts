import { toMytTimestamp } from '../../../common/time/myt'

/** Malaysia has no daylight saving: a fixed UTC+8. All windows below are MYT calendar days. */
const MYT_OFFSET_MS = 8 * 60 * 60 * 1000
export const DAY_MS = 24 * 60 * 60 * 1000

/** A half-open range `[from, to)`; `to` is `now` for the open-ended ones (the repository treats `to` as inclusive of `now`). */
export interface Window {
  from: Date
  to: Date
}

export const addDays = (at: Date, days: number): Date => new Date(at.getTime() + days * DAY_MS)

/** 00:00 MYT of the day holding `at`. */
export function startOfDay(at: Date): Date {
  const local = at.getTime() + MYT_OFFSET_MS
  return new Date(Math.floor(local / DAY_MS) * DAY_MS - MYT_OFFSET_MS)
}

/** Monday 00:00 MYT of the ISO week holding `at`. */
export function startOfIsoWeek(at: Date): Date {
  const day = startOfDay(at)
  const sinceMonday = (new Date(day.getTime() + MYT_OFFSET_MS).getUTCDay() + 6) % 7
  return addDays(day, -sinceMonday)
}

/** The 1st of the MYT calendar month holding `at`, 00:00 MYT. */
export function startOfMonth(at: Date): Date {
  const local = new Date(at.getTime() + MYT_OFFSET_MS)
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) - MYT_OFFSET_MS)
}

/** `YYYY-MM-DD` of the MYT day holding `at`. */
export const dateKey = (at: Date): string => new Date(at.getTime() + MYT_OFFSET_MS).toISOString().slice(0, 10)

/** `HH:mm` in MYT. */
export const timeOfDay = (at: Date): string => new Date(at.getTime() + MYT_OFFSET_MS).toISOString().slice(11, 16)

/** The instant `YYYY-MM-DD` starts (00:00 MYT). */
export const startOfDateKey = (key: string): Date => new Date(`${key}T00:00:00+08:00`)

export { toMytTimestamp }

/** BM weekday label of a `YYYY-MM-DD` date: Ahd, Isn, Sel, Rab, Kha, Jum, Sab. */
const WEEKDAYS_BM = ['Ahd', 'Isn', 'Sel', 'Rab', 'Kha', 'Jum', 'Sab'] as const
export const weekdayLabelBm = (key: string): string => WEEKDAYS_BM[new Date(`${key}T00:00:00Z`).getUTCDay()] as string

export type DailyPeriod = 'today' | 'week' | 'month'

/** Board (admin/school) windows: `week` is the ISO week (Monday 00:00 MYT .. now). */
export interface BoardWindows {
  now: Date
  today: Window
  week: Window
  /** The previous ISO week, Monday .. Sunday (`to` = this Monday, exclusive). */
  lastWeek: Window
  month: Window
  /** `now - 30 days .. now` (Kirkpatrick T3 "active in the last 30 days"). */
  last30d: Window
}

export function boardWindows(now: Date): BoardWindows {
  const todayStart = startOfDay(now)
  const weekStart = startOfIsoWeek(now)
  return {
    now,
    today: { from: todayStart, to: now },
    week: { from: weekStart, to: now },
    lastWeek: { from: addDays(weekStart, -7), to: weekStart },
    month: { from: startOfMonth(now), to: now },
    last30d: { from: addDays(now, -30), to: now },
  }
}

/**
 * `period` of the daily board: `week`, `month`, anything else is `today` (the raw text is still echoed by the caller).
 * Returns the canonical key and the window.
 */
export function periodWindow(period: string | undefined, now: Date): { key: DailyPeriod; window: Window } {
  const w = boardWindows(now)
  if (period === 'week') return { key: 'week', window: w.week }
  if (period === 'month') return { key: 'month', window: w.month }
  return { key: 'today', window: w.today }
}

/** Guru windows: `week` is 7 calendar days ending today (todayStart - 6d .. now). `prev*` windows end where the current one starts. */
export interface GuruWindows {
  now: Date
  today: Window
  week: Window
  prevWeek: Window
  d14: Window
  prev14: Window
  d30: Window
  prev30: Window
}

export function guruWindows(now: Date): GuruWindows {
  const t = startOfDay(now)
  const at = (days: number): Date => addDays(t, days)
  return {
    now,
    today: { from: t, to: now },
    week: { from: at(-6), to: now },
    prevWeek: { from: at(-13), to: at(-6) },
    d14: { from: at(-13), to: now },
    prev14: { from: at(-27), to: at(-13) },
    d30: { from: at(-29), to: now },
    prev30: { from: at(-59), to: at(-29) },
  }
}
