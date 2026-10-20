/**
 * Malaysia calendar months (card BE-40 AC2). Asia/Kuala_Lumpur is a fixed UTC+8 with no daylight saving, so a month
 * `YYYY-MM` is the half-open instant range [YYYY-MM-01T00:00+08:00, next month's 1st 00:00+08:00).
 */
const MYT_OFFSET_MS = 8 * 60 * 60 * 1000

export interface MonthRange {
  month: string
  /** Inclusive. */
  from: Date
  /** Exclusive. */
  to: Date
}

function parse(month: string): { y: number; m: number } {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month)
  if (!match) throw new RangeError(`invalid month ${month}`)
  return { y: Number(match[1]), m: Number(match[2]) }
}

/** The Malaysia month that contains `at`. */
export function mytMonthOf(at: Date): string {
  return new Date(at.getTime() + MYT_OFFSET_MS).toISOString().slice(0, 7)
}

export function monthRange(month: string): MonthRange {
  const { y, m } = parse(month)
  return {
    month,
    from: new Date(Date.UTC(y, m - 1, 1) - MYT_OFFSET_MS),
    to: new Date(Date.UTC(y, m, 1) - MYT_OFFSET_MS),
  }
}

/** Every Malaysia day of the month, `YYYY-MM-DD`, in order. */
export function daysOfMonth(month: string): string[] {
  const { y, m } = parse(month)
  const n = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return Array.from({ length: n }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`)
}
