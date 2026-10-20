const SCHEDULED = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?$/
const MYT_OFFSET_MINUTES = 8 * 60

/**
 * Parses a `scheduledAt` value. A time without an offset is Malaysia time (a `datetime-local` value). The calendar is
 * checked (no 31 February, no hour 24), so a date that would roll over is refused instead of being moved. Null when invalid.
 */
export function parseScheduledAt(text: string): Date | null {
  const m = SCHEDULED.exec(text)
  if (!m) return null
  const [year, month, day, hour, minute, second] = [m[1], m[2], m[3], m[4], m[5], m[6] ?? '0'].map(Number) as [number, number, number, number, number, number]
  const fraction = m[7] ? Math.round(Number(m[7]) * 1000) : 0
  const utc = Date.UTC(year, month - 1, day, hour, minute, second, fraction)
  const probe = new Date(utc)
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day ||
    probe.getUTCHours() !== hour ||
    probe.getUTCMinutes() !== minute ||
    second > 59
  ) {
    return null
  }
  let offsetMinutes = MYT_OFFSET_MINUTES
  const zone = m[8]
  if (zone === 'Z') offsetMinutes = 0
  else if (zone) {
    const sign = zone.startsWith('-') ? -1 : 1
    const hh = Number(zone.slice(1, 3))
    const mm = Number(zone.slice(4, 6))
    if (hh > 23 || mm > 59) return null
    offsetMinutes = sign * (hh * 60 + mm)
  }
  return new Date(utc - offsetMinutes * 60_000)
}
