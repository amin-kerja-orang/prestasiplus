import { Logger } from '@nestjs/common'

import { startOfMytDay } from '../../../db/clock'
import { toMytTimestamp } from '../../../common/time/myt'

/** FR-GM-00.7, 48 section 3.3: the background sweep of the game clocks, so a game with no poller still moves. */
export const GAME_SWEEP_MS = 5_000

/**
 * Runs `pass` every 5 s (the plain interval of `AttemptSweeper`, no `@nestjs/schedule`); off under NODE_ENV=test, where specs
 * call the pass themselves. A pass never overlaps itself and a failing one is logged. Safe on several API instances: every
 * step takes its row lock and re-checks. Returns the stop function.
 */
export function startGameSweep(name: string, nodeEnv: string | undefined, pass: () => Promise<unknown>): () => void {
  if (nodeEnv === 'test') return () => undefined
  const logger = new Logger(name)
  let running = false
  const timer = setInterval(() => {
    if (running) return
    running = true
    void pass()
      .catch((err: unknown) => logger.warn(`Game clock sweep failed: ${err instanceof Error ? err.message : String(err)}`))
      .finally(() => {
        running = false
      })
  }, GAME_SWEEP_MS)
  timer.unref()
  return () => clearInterval(timer)
}

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
