import { startOfMytDay } from '../../../db/clock'

const DAY_MS = 24 * 3_600_000
const MYT_OFFSET_MS = 8 * 3_600_000

/** Standing periods the routes accept. */
export type StandingPeriod = 'weekly' | 'monthly' | 'all_time'

export const isStandingPeriod = (v: unknown): v is StandingPeriod => v === 'weekly' || v === 'monthly' || v === 'all_time'

/** `[from, to)` of a period; both `null` for all time. Asia/Kuala_Lumpur is a fixed UTC+8. */
export interface PeriodWindow {
  from: Date | null
  to: Date | null
}

/** The week from Monday 00:00 (MYT) that contains `now`, and the calendar month (MYT) that contains `now`. */
export function periodWindow(period: StandingPeriod, now: Date): PeriodWindow {
  if (period === 'all_time') return { from: null, to: null }
  if (period === 'weekly') {
    const day = startOfMytDay(now)
    const dow = new Date(day.getTime() + MYT_OFFSET_MS).getUTCDay() // 0 = Sunday
    const from = new Date(day.getTime() - ((dow + 6) % 7) * DAY_MS)
    return { from, to: new Date(from.getTime() + 7 * DAY_MS) }
  }
  const local = new Date(now.getTime() + MYT_OFFSET_MS)
  const y = local.getUTCFullYear()
  const m = local.getUTCMonth()
  return { from: new Date(Date.UTC(y, m, 1) - MYT_OFFSET_MS), to: new Date(Date.UTC(y, m + 1, 1) - MYT_OFFSET_MS) }
}
