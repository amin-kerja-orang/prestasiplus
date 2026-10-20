import { Inject, Injectable } from '@nestjs/common'

import { CLOCK, type Clock } from '../../../../db/clock'
import { LEADERBOARD_ROW_CAP } from '../domain/constants'
import { parsePeriod, periodWindow } from '../domain/ranking'
import { accuracyOf } from '../domain/rules'
import { PerformancePorts } from '../ports'
import type { Ctx, PerformanceLeaderboard } from './types'

/**
 * Practice coin leaderboard (S20, BR-M08-28) over `PracticeReadPort.leaderboard`: completed non-test practice
 * sessions of the period (MYT), top 50. Not BE-23's `/gamification/leaderboard` (lifetime syiling). Names follow
 * the BE-23 precedent (top 50, full name). A pupil with only test sessions is never listed.
 */
@Injectable()
export class LeaderboardService {
  constructor(
    protected readonly ports: PerformancePorts,
    @Inject(CLOCK) protected readonly clock: Clock,
  ) {}

  async leaderboard(ctx: Ctx, rawPeriod: string | undefined): Promise<PerformanceLeaderboard> {
    const period = parsePeriod(rawPeriod)
    const window = periodWindow(period, this.clock.now())
    const res = await this.ports.practice.leaderboard({ ...window, limit: LEADERBOARD_ROW_CAP, viewerId: ctx.userId })
    const rows = res.rows.slice(0, LEADERBOARD_ROW_CAP).map((r, i) => ({
      rank: i + 1,
      userId: r.userId,
      name: r.name,
      avatarUrl: null,
      coins: r.coins,
      sessions: r.sessions,
      accuracy: accuracyOf(r.accuracy, 100),
    }))
    return {
      period,
      me: res.me
        ? { rank: res.me.rank, coins: res.me.coins, sessions: res.me.sessions, accuracy: accuracyOf(res.me.accuracy, 100) }
        : { rank: null, coins: 0, sessions: 0, accuracy: 0 },
      rows,
      participants: rows.length,
    }
  }
}
