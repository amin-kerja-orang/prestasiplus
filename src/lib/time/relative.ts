/**
 * Carbon-style `diffForHumans()` in the `ms` locale (M01 BR-20, M04 BR-M04-16,
 * M06 BR-M06-29, M09 BR-M09-09).
 *
 * Carbon computes a calendar interval (years, months, days, hours, minutes,
 * seconds, like PHP `DateTime::diff`), turns days ≥ 7 into weeks, and prints
 * the largest non-zero unit only (whole units, floored). With Carbon's default
 * `NO_ZERO_DIFF` option a zero difference reads as 1 second.
 *
 * Past: "{n} {unit} yang lepas" (observed: jam, minggu, bulan).
 * Future: "{n} {unit} dari sekarang" (Carbon `ms` locale; not observed on live).
 */

import { clock } from './clock'
import { type DateInput, daysInMonth, mytParts, toEpochMs } from './zone'

export interface CalendarInterval {
  years: number
  months: number
  days: number
  hours: number
  minutes: number
  seconds: number
  /** `true` when `to` is before `from`. */
  invert: boolean
}

/** Calendar difference between two instants in Malaysian wall time (PHP `DateTime::diff` style). */
export function calendarDiff(from: DateInput, to: DateInput): CalendarInterval {
  const fromMs = toEpochMs(from)
  const toMs = toEpochMs(to)
  const invert = toMs < fromMs
  const a = mytParts(invert ? toMs : fromMs)
  const b = mytParts(invert ? fromMs : toMs)

  let seconds = b.second - a.second
  let minutes = b.minute - a.minute
  let hours = b.hour - a.hour
  let days = b.day - a.day
  let months = b.month - a.month
  let years = b.year - a.year

  // Sub-second remainder: a later millisecond field that is smaller borrows a second.
  if (b.millisecond < a.millisecond) seconds -= 1
  if (seconds < 0) {
    seconds += 60
    minutes -= 1
  }
  if (minutes < 0) {
    minutes += 60
    hours -= 1
  }
  if (hours < 0) {
    hours += 24
    days -= 1
  }
  if (days < 0) {
    days += daysInMonth(a.year, a.month)
    months -= 1
  }
  if (months < 0) {
    months += 12
    years -= 1
  }
  return { years, months, days, hours, minutes, seconds, invert }
}

export type RelativeUnit = 'tahun' | 'bulan' | 'minggu' | 'hari' | 'jam' | 'minit' | 'saat'

/** The largest non-zero unit of the difference (Carbon `parts = 1`), minimum 1 second. */
export function largestUnit(interval: CalendarInterval): { count: number; unit: RelativeUnit } {
  if (interval.years > 0) return { count: interval.years, unit: 'tahun' }
  if (interval.months > 0) return { count: interval.months, unit: 'bulan' }
  if (interval.days >= 7) return { count: Math.floor(interval.days / 7), unit: 'minggu' }
  if (interval.days > 0) return { count: interval.days, unit: 'hari' }
  if (interval.hours > 0) return { count: interval.hours, unit: 'jam' }
  if (interval.minutes > 0) return { count: interval.minutes, unit: 'minit' }
  return { count: Math.max(1, interval.seconds), unit: 'saat' }
}

/** "{n} jam yang lepas" etc., relative to `now` (default: the shared clock). */
export function diffForHumans(date: DateInput, now: DateInput = clock.now()): string {
  const interval = calendarDiff(date, now)
  const { count, unit } = largestUnit(interval)
  // `invert` means `now` is before `date`, i.e. the date is in the future.
  return interval.invert ? `${count} ${unit} dari sekarang` : `${count} ${unit} yang lepas`
}
