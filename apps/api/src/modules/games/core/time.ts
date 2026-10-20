import { startOfMytDay } from '../../../db/clock'
import { toMytTimestamp } from '../../../common/time/myt'

const DAY_MS = 86_400_000
const MYT_OFFSET_MS = 8 * 3_600_000

/** Monday 00:00 Malaysia of the week containing `at`, as an instant. */
export function startOfMytWeek(at: Date): Date {
  const day = startOfMytDay(at)
  const weekday = new Date(day.getTime() + MYT_OFFSET_MS).getUTCDay() // 0 = Sunday
  return new Date(day.getTime() - ((weekday + 6) % 7) * DAY_MS)
}

/** `YYYY-MM-DD` of an instant read in Malaysia time. */
export const mytDateOf = (at: Date): string => new Date(at.getTime() + MYT_OFFSET_MS).toISOString().slice(0, 10)

export interface MytWeek {
  /** Monday 00:00 +08:00. */
  start: Date
  /** Sunday 23:59:59 +08:00 (start + 7 days - 1 s). */
  endsAt: Date
  /** `YYYY-MM-DD` of the Monday. */
  weekStart: string
  /** `YYYY-MM-DD` of the Sunday. */
  weekEnd: string
  /** Contract `Timestamp` of `endsAt` (+08:00). */
  endsAtStamp: string
}

/** The Malaysia week (Monday to Sunday) containing `at`. */
export function mytWeek(at: Date): MytWeek {
  const start = startOfMytWeek(at)
  const endsAt = new Date(start.getTime() + 7 * DAY_MS - 1000)
  return { start, endsAt, weekStart: mytDateOf(start), weekEnd: mytDateOf(endsAt), endsAtStamp: toMytTimestamp(endsAt) }
}
