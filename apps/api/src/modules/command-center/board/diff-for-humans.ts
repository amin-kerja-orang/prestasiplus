/**
 * Carbon-style `diffForHumans()` in the `ms` locale, the wire text of `timeAgo` / `lastActiveHuman` (mock `src/lib/time/relative.ts`):
 * the largest non-zero calendar unit of the interval in Malaysian wall time, days >= 7 become weeks, minimum 1 second.
 * Past "{n} {unit} yang lepas", future "{n} {unit} dari sekarang". The contract flags the wording as an open question for the frontend.
 */
const MYT_OFFSET_MS = 8 * 60 * 60 * 1000

interface Parts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
  ms: number
}

function mytParts(at: number): Parts {
  const d = new Date(at + MYT_OFFSET_MS)
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    second: d.getUTCSeconds(),
    ms: d.getUTCMilliseconds(),
  }
}

const daysInMonth = (year: number, month: number): number => new Date(Date.UTC(year, month, 0)).getUTCDate()

export function diffForHumans(date: Date, now: Date): string {
  const invert = now.getTime() < date.getTime()
  const a = mytParts(invert ? now.getTime() : date.getTime())
  const b = mytParts(invert ? date.getTime() : now.getTime())
  let seconds = b.second - a.second
  let minutes = b.minute - a.minute
  let hours = b.hour - a.hour
  let days = b.day - a.day
  let months = b.month - a.month
  let years = b.year - a.year
  if (b.ms < a.ms) seconds -= 1
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
  let count: number
  let unit: string
  if (years > 0) [count, unit] = [years, 'tahun']
  else if (months > 0) [count, unit] = [months, 'bulan']
  else if (days >= 7) [count, unit] = [Math.floor(days / 7), 'minggu']
  else if (days > 0) [count, unit] = [days, 'hari']
  else if (hours > 0) [count, unit] = [hours, 'jam']
  else if (minutes > 0) [count, unit] = [minutes, 'minit']
  else [count, unit] = [Math.max(1, seconds), 'saat']
  return invert ? `${count} ${unit} dari sekarang` : `${count} ${unit} yang lepas`
}
