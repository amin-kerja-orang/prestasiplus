import { mytDay } from '../../db/clock'

/** [start, end) of the Malaysia calendar month that contains `at` (BR-M15-25): the month of the redemption cap and the admin card. */
export function mytMonthRange(at: Date): { from: Date; to: Date } {
  const [y, m] = mytDay(at).split('-').map(Number) as [number, number]
  const next = m === 12 ? { y: y + 1, m: 1 } : { y, m: m + 1 }
  const pad = (n: number): string => String(n).padStart(2, '0')
  return {
    from: new Date(`${String(y)}-${pad(m)}-01T00:00:00+08:00`),
    to: new Date(`${String(next.y)}-${pad(next.m)}-01T00:00:00+08:00`),
  }
}

/** True while an open draw still sells tickets: no closing date, or the closing date (Malaysia day) is today or later. */
export function drawStillOpen(closesAt: Date | null, now: Date): boolean {
  return closesAt === null || mytDay(closesAt) >= mytDay(now)
}
