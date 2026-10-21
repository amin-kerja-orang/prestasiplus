/** Asia/Kuala_Lumpur is a fixed UTC+8 with no daylight saving, so a Malaysia month is a fixed-offset range. */
const MYT_OFFSET_MS = 8 * 60 * 60 * 1000

export interface MalaysiaMonth {
  /** `YYYY-MM` */
  month: string
  /** First day of the month as a `YYYY-MM-DD` date string (what the `date` columns hold). */
  firstDay: string
  /** Inclusive instant: 00:00 +08:00 on the first day. */
  from: Date
  /** Exclusive instant: 00:00 +08:00 on the first day of the next month. */
  to: Date
}

/** The Malaysia month that contains `at`. */
export function malaysiaMonthOf(at: Date): MalaysiaMonth {
  return malaysiaMonth(new Date(at.getTime() + MYT_OFFSET_MS).toISOString().slice(0, 7))
}

/** `month` is `YYYY-MM`. */
export function malaysiaMonth(month: string): MalaysiaMonth {
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month)
  if (!m) throw new RangeError(`invalid month ${month}`)
  const y = Number(m[1])
  const mo = Number(m[2])
  return {
    month,
    firstDay: `${month}-01`,
    from: new Date(Date.UTC(y, mo - 1, 1) - MYT_OFFSET_MS),
    to: new Date(Date.UTC(y, mo, 1) - MYT_OFFSET_MS),
  }
}
