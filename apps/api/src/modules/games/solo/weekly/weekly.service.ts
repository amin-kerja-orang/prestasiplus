import { Inject, Injectable } from '@nestjs/common'

import { CLOCK, type Clock } from '../../../../db/clock'
import type { GamesCaller } from '../../caller'
import { GameUsers } from '../../core/game-users'
import { NamePrivacy } from '../../core/name-privacy.service'
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
    @Inject(GameUsers) private readonly users: GameUsers,
    @Inject(NamePrivacy) private readonly privacy: NamePrivacy,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async board(caller: GamesCaller): Promise<Record<string, unknown>> {
    const week = mytWeek(this.clock.now())
    const source = await this.ports.weeklyPractice.week(caller.userId, week.start, week.endsAt)
    const rows = source.rows.slice(0, WEEKLY_ROWS)
    // Children's names rule: the full name and id only within the caller's scope (the port's name is used as is when allowed).
    const [pupils, seen] = await Promise.all([this.users.getMany(rows.map((r) => r.userId)), this.privacy.resolver(caller)])
    return {
      weekStart: week.weekStart,
      weekEnd: week.weekEnd,
      endsAt: week.endsAtStamp,
      prizes: [...WEEKLY_PRIZES],
      me: source.me ? { rank: source.me.rank, betul: source.me.betul } : null,
      // Only the contract fields: a source row can never carry another personal field into the response (D54(d)).
      rows: rows.map((r) => {
        // A pupil the users read does not know (no school) is shown as an outsider: redacted unless it is the caller's own row.
        const known = pupils.get(r.userId)
        const shown = seen.shown({ id: r.userId, name: r.name, schoolId: known?.schoolId ?? null, isPupil: known?.isPupil ?? true })
        return { rank: r.rank, userId: shown.userId, name: shown.name, sesi: r.sesi, betul: r.betul, tepat: r.tepat }
      }),
    }
  }
}
