import { mytDay, startOfMytDay } from '../../../../db/clock'
import { TREND_WINDOW_DAYS } from './constants'

const DAY_MS = 24 * 60 * 60 * 1000

/** Adds whole days to a yyyy-mm-dd date (UTC arithmetic on the calendar date: MYT has no DST). */
export function addMytDays(day: string, n: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10)
}

/** The last `n` MYT dates ending today, oldest first. */
export function lastDays(now: Date, n: number): string[] {
  const today = mytDay(now)
  return Array.from({ length: n }, (_, i) => addMytDays(today, i - (n - 1)))
}

/** Start (00:00 +08:00) of the MYT day `n` days before today. */
export function startOfDaysAgo(now: Date, n: number): Date {
  return new Date(startOfMytDay(now).getTime() - n * DAY_MS)
}

export interface TrendWindows {
  /** Recent window [recentFrom, recentTo): today and the 29 days before. */
  recentFrom: Date
  recentTo: Date
  /** Window before it: [beforeFrom, recentFrom). */
  beforeFrom: Date
}

export function trendWindows(now: Date): TrendWindows {
  const recentFrom = startOfDaysAgo(now, TREND_WINDOW_DAYS - 1)
  return {
    recentFrom,
    recentTo: new Date(startOfMytDay(now).getTime() + DAY_MS),
    beforeFrom: new Date(recentFrom.getTime() - TREND_WINDOW_DAYS * DAY_MS),
  }
}

export const inWindow = (at: Date, from: Date, to: Date): boolean => at >= from && at < to

/** Monday (YYYY-MM-DD) of the Malaysian ISO week that holds `day` (YYYY-MM-DD). */
export function mondayOf(day: string): string {
  const dow = new Date(`${day}T00:00:00Z`).getUTCDay() // 0 = Sunday
  return addMytDays(day, -((dow + 6) % 7))
}

/** The Mondays of the last `n` Malaysian weeks ending with the week of `now`, oldest first. */
export function lastWeeks(now: Date, n: number): string[] {
  const current = mondayOf(mytDay(now))
  return Array.from({ length: n }, (_, i) => addMytDays(current, (i - (n - 1)) * 7))
}

/** 00:00 +08:00 of a Malaysian date. */
export const mytMidnight = (day: string): Date => new Date(`${day}T00:00:00+08:00`)
