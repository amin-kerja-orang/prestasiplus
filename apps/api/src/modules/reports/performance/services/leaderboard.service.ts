import { Inject, Injectable } from '@nestjs/common'

import { CLOCK, type Clock } from '../../../../db/clock'
import { LEADERBOARD_ROW_CAP } from '../domain/constants'
import { canSeeName, displayName } from '../domain/privacy'
import { parsePeriod, periodWindow } from '../domain/ranking'
import { accuracyOf } from '../domain/rules'
import { DIRECTORY_PORT, PerformancePorts, type DirectoryPort } from '../ports'
import { resolveNameScope } from './name-scope'
import type { Ctx, PerformanceLeaderboard } from './types'

/**
 * Practice coin leaderboard (S20, BR-M08-28) over `PracticeReadPort.leaderboard`: completed non-test practice
 * sessions of the period (MYT), top 50. Not BE-23's `/gamification/leaderboard` (lifetime syiling). Names and ids follow
 * the same `canSeeName` rule as the rankings (children's privacy): every other row gets the first name plus
 * the last initial and a null userId. A pupil with only test sessions is never listed.
 */
@Injectable()
export class LeaderboardService {
  constructor(
    protected readonly ports: PerformancePorts,
    @Inject(CLOCK) protected readonly clock: Clock,
    @Inject(DIRECTORY_PORT) protected readonly directory: DirectoryPort,
  ) {}

  async leaderboard(ctx: Ctx, rawPeriod: string | undefined): Promise<PerformanceLeaderboard> {
    const period = parsePeriod(rawPeriod)
    const window = periodWindow(period, this.clock.now())
    const res = await this.ports.practice.leaderboard({ ...window, limit: LEADERBOARD_ROW_CAP, viewerId: ctx.userId })
    const top = res.rows.slice(0, LEADERBOARD_ROW_CAP)
    const names = await resolveNameScope(ctx, top.map((r) => r.userId), this.ports.classes, this.directory)
    const rows = top.map((r, i) => {
      const visible = canSeeName(ctx.role, ctx.userId, r.userId, names.ownPupils, names.schoolPupils)
      return {
        rank: i + 1,
        userId: visible ? r.userId : null,
        name: displayName(r.name, visible),
        avatarUrl: null,
        coins: r.coins,
        sessions: r.sessions,
        accuracy: accuracyOf(r.accuracy, 100),
      }
    })
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
