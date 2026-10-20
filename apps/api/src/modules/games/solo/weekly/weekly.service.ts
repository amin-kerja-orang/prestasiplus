import { Inject, Injectable } from '@nestjs/common'

import { CLOCK, type Clock } from '../../../../db/clock'
import type { GamesCaller } from '../../caller'
import { GamesPorts } from '../../core/ports'
import { mytWeek } from '../../core/time'

/** Weekly prizes for ranks 1 to 3 (copy: +100 / +50 / +25 syiling). */
export const WEEKLY_PRIZES: readonly number[] = [100, 50, 25]
const WEEKLY_ROWS = 20

/** Weekly competition (M16-40): the practice owner's weekly ranking through `ports.weeklyPractice`, week in Malaysia time. */
@Injectable()
export class WeeklyService {
  constructor(
    @Inject(GamesPorts) private readonly ports: GamesPorts,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async board(caller: GamesCaller): Promise<Record<string, unknown>> {
    const week = mytWeek(this.clock.now())
    const source = await this.ports.weeklyPractice.week(caller.userId, week.start, week.endsAt)
    return {
      weekStart: week.weekStart,
      weekEnd: week.weekEnd,
      endsAt: week.endsAtStamp,
      prizes: [...WEEKLY_PRIZES],
      me: source.me ? { rank: source.me.rank, betul: source.me.betul } : null,
      // Only the contract fields: a source row can never carry another personal field into the response (D54(d)).
      rows: source.rows.slice(0, WEEKLY_ROWS).map((r) => ({ rank: r.rank, userId: r.userId, name: r.name, sesi: r.sesi, betul: r.betul, tepat: r.tepat })),
    }
  }
}
