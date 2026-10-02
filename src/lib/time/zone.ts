/**
 * Fixed UTC+8 (Asia/Kuala_Lumpur) conversion (overview §6.12, ADR-0006 §4).
 *
 * Malaysia has no DST, so every computation uses a fixed +08:00 offset and
 * never the browser's time zone or ICU data. All helpers accept a `DateInput`:
 * - `number`: epoch milliseconds;
 * - `Date`;
 * - `string`: ISO 8601 with `Z` or an offset (`2026-09-25T15:40:00+08:00`),
 *   or a zone-less Laravel-style value that is read as Malaysian wall time
 *   (`2026-09-25`, `2026-09-25 15:40`, `2026-09-25 15:40:00`, `2026-09-25T15:40:00`).
 */

export type DateInput = Date | number | string

export const MYT_OFFSET_MINUTES = 480
export const MYT_OFFSET_MS = MYT_OFFSET_MINUTES * 60_000

export const SECOND_MS = 1000
export const MINUTE_MS = 60 * SECOND_MS
export const HOUR_MS = 60 * MINUTE_MS
export const DAY_MS = 24 * HOUR_MS

/** Wall-clock fields in Malaysian time. `month` is 1–12; `weekday` is ISO (1 = Monday … 7 = Sunday). */
export interface MytParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
  millisecond: number
  weekday: number
}

export interface MytFields {
  year: number
  month: number
  day: number
  hour?: number
  minute?: number
  second?: number
  millisecond?: number
}

const ZONED_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:?\d{2})$/i
const LOCAL_DATE_TIME =
  /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?)?$/

/** Epoch ms for Malaysian wall-clock fields. Out-of-range fields overflow like `Date.UTC`. */
export function fromMytParts(fields: MytFields): number {
  return (
    Date.UTC(
      fields.year,
      fields.month - 1,
      fields.day,
      fields.hour ?? 0,
      fields.minute ?? 0,
      fields.second ?? 0,
      fields.millisecond ?? 0,
    ) - MYT_OFFSET_MS
  )
}

function fieldsOf(match: RegExpExecArray): Required<MytFields> {
  const [, y, mo, d, h, mi, s, frac] = match
  return {
    year: Number(y),
    month: Number(mo),
    day: Number(d),
    hour: Number(h ?? 0),
    minute: Number(mi ?? 0),
    second: Number(s ?? 0),
    millisecond: frac ? Number(frac.padEnd(3, '0')) : 0,
  }
}

/** Whether the fields name a real wall-clock time (no overflow such as 31 Feb or 24:00). */
function isValidWallTime(f: Required<MytFields>): boolean {
  return (
    f.month >= 1 &&
    f.month <= 12 &&
    f.day >= 1 &&
    f.day <= daysInMonth(f.year, f.month) &&
    f.hour <= 23 &&
    f.minute <= 59 &&
    f.second <= 59
  )
}

/** Converts any `DateInput` to epoch ms. Throws `RangeError` on an invalid value. */
export function toEpochMs(input: DateInput): number {
  let ms: number
  if (typeof input === 'number') {
    ms = input
  } else if (input instanceof Date) {
    ms = input.getTime()
  } else {
    const text = input.trim()
    const local = LOCAL_DATE_TIME.exec(text)
    if (local) {
      const fields = fieldsOf(local)
      ms = isValidWallTime(fields) ? fromMytParts(fields) : Number.NaN
    } else if (ZONED_ISO.test(text)) {
      // The regex guarantees a leading `yyyy-mm-ddTHH:mm[:ss]`; reject impossible
      // calendar values instead of letting the engine overflow them.
      const head = LOCAL_DATE_TIME.exec(text.replace(/(?:Z|[+-]\d{2}:?\d{2})$/i, ''))
      ms = head && isValidWallTime(fieldsOf(head)) ? Date.parse(text) : Number.NaN
    } else {
      ms = Number.NaN
    }
  }
  if (!Number.isFinite(ms)) {
    throw new RangeError(`Invalid date: ${String(input)}`)
  }
  return ms
}

/** Malaysian wall-clock fields of an instant. */
export function mytParts(input: DateInput): MytParts {
  const shifted = new Date(toEpochMs(input) + MYT_OFFSET_MS)
  const utcDay = shifted.getUTCDay()
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds(),
    millisecond: shifted.getUTCMilliseconds(),
    weekday: utcDay === 0 ? 7 : utcDay,
  }
}

/** ISO 8601 string with the fixed `+08:00` offset, e.g. `2026-09-25T15:40:00+08:00`. */
export function toIsoMyt(input: DateInput): string {
  const p = mytParts(input)
  const pad = (n: number, w = 2) => String(n).padStart(w, '0')
  const ms = p.millisecond ? `.${pad(p.millisecond, 3)}` : ''
  return `${pad(p.year, 4)}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}${ms}+08:00`
}

/** Days in a calendar month (`month` 1–12). */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}
