/**
 * Calendar-day arithmetic for the subscription dates. `school_subscriptions.starts_on` / `ends_on`
 * are `date` columns (data model 3.2), so a day is a `YYYY-MM-DD` string in Malaysia time
 * (UTC+8, no daylight saving). The wire carries it as `YYYY-MM-DDT00:00:00+08:00`.
 */
const MYT_OFFSET_MS = 8 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

/** The Malaysian calendar day of an instant. */
export function mytDay(at: Date): string {
  return new Date(at.getTime() + MYT_OFFSET_MS).toISOString().slice(0, 10)
}

/** `day` plus `months` calendar months; the last day of the month when the target month is shorter. */
export function addMonthsDay(day: string, months: number): string {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number]
  const target = new Date(Date.UTC(y, m - 1 + months, 1))
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  target.setUTCDate(Math.min(d, last))
  return target.toISOString().slice(0, 10)
}

export function addDaysDay(day: string, days: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10)
}

/** A `date` column value as a `Date` (UTC midnight, what Prisma writes to a `date`). */
export const dayToDate = (day: string): Date => new Date(`${day}T00:00:00Z`)
export const dateToDay = (date: Date): string => date.toISOString().slice(0, 10)

/** Wire timestamp of a day: its first instant in Malaysia time. */
export const dayTimestamp = (day: string): string => `${day}T00:00:00+08:00`

/** `dd/MM/yyyy HH:mm` in Malaysia time (the history lines of `notes`, mock `formatDateTime`). */
export function formatMytDateTime(at: Date): string {
  const iso = new Date(at.getTime() + MYT_OFFSET_MS).toISOString()
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)} ${iso.slice(11, 16)}`
}

/** `yyyymmdd` in Malaysia time (invoice reference). */
export const compactDay = (at: Date): string => mytDay(at).replace(/-/g, '')
