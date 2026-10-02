/**
 * Calendar helpers in fixed UTC+8: "today", Monday-start weeks, months, years
 * (M05 BR-19/BR-21 period filters, M07 BR-M07-16 "today", M08 BR-M08-25 "hari bersama").
 *
 * Ranges are half-open: `[start, end)` in epoch ms.
 */

import { clock } from './clock'
import { DAY_MS, type DateInput, fromMytParts, mytParts, toEpochMs } from './zone'

export interface TimeRange {
  start: number
  /** Exclusive. */
  end: number
}

/** Malaysian midnight of the day containing `input`. */
export function startOfDay(input: DateInput): number {
  const p = mytParts(input)
  return fromMytParts({ year: p.year, month: p.month, day: p.day })
}

export function dayRange(input: DateInput = clock.now()): TimeRange {
  const start = startOfDay(input)
  return { start, end: start + DAY_MS }
}

/** Monday 00:00 → next Monday 00:00 (week starts on Monday). */
export function weekRange(input: DateInput = clock.now()): TimeRange {
  const p = mytParts(input)
  const start = fromMytParts({ year: p.year, month: p.month, day: p.day - (p.weekday - 1) })
  return { start, end: start + 7 * DAY_MS }
}

/** First of the month 00:00 → first of the next month 00:00. */
export function monthRange(input: DateInput = clock.now()): TimeRange {
  const p = mytParts(input)
  return {
    start: fromMytParts({ year: p.year, month: p.month, day: 1 }),
    end: fromMytParts({ year: p.year, month: p.month + 1, day: 1 }),
  }
}

/** 1 January 00:00 → next 1 January 00:00. */
export function yearRange(input: DateInput = clock.now()): TimeRange {
  const p = mytParts(input)
  return {
    start: fromMytParts({ year: p.year, month: 1, day: 1 }),
    end: fromMytParts({ year: p.year + 1, month: 1, day: 1 }),
  }
}

export function inRange(input: DateInput, range: TimeRange): boolean {
  const ms = toEpochMs(input)
  return ms >= range.start && ms < range.end
}

export function isSameDay(a: DateInput, b: DateInput): boolean {
  return startOfDay(a) === startOfDay(b)
}

/** Whether `input` falls on the current Malaysian day of `now` (default: the shared clock). */
export function isToday(input: DateInput, now: DateInput = clock.now()): boolean {
  return isSameDay(input, now)
}

/** Adds whole days (Malaysia has no DST, so a day is always 24 h). */
export function addDays(input: DateInput, days: number): number {
  return toEpochMs(input) + days * DAY_MS
}

/** floor((to − from) ÷ 1 day), e.g. "{n} hari bersama" (M08 BR-M08-25). */
export function wholeDaysBetween(from: DateInput, to: DateInput = clock.now()): number {
  return Math.floor((toEpochMs(to) - toEpochMs(from)) / DAY_MS)
}
