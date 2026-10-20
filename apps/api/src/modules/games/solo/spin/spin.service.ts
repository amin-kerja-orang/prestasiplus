import { Inject, Injectable } from '@nestjs/common'
import { idFromString } from '../../../../db/ids'

import { CLOCK, type Clock, mytDay } from '../../../../db/clock'
import { PrismaService } from '../../../../db/prisma.service'
import type { GamesCaller } from '../../caller'
import { GamesPorts } from '../../core/ports'
import { rawSpinRefused } from '../../errors'
import { SpinDraw } from './spin-draw'
import { SPIN_SEGMENTS } from './spin.rules'

export type SpinOutcome = { status: 200; body: Record<string, unknown> } | { status: 409; body: ReturnType<typeof rawSpinRefused> }

/** Roda Nasib (M16-34, M16-35): one spin per Malaysia day, enforced by the unique `(user_id, spin_date)`. */
@Injectable()
export class SpinService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(GamesPorts) private readonly ports: GamesPorts,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(SpinDraw) private readonly draw: SpinDraw,
  ) {}

  async page(caller: GamesCaller): Promise<Record<string, unknown>> {
    const uid = idFromString(caller.userId)
    const db = this.prisma.client
    const stats = await db.spinStat.findUnique({ where: { userId: uid }, select: { spins: true, won: true } })
    const today = await db.$queryRaw<{ n: number }[]>`SELECT 1 AS n FROM spins WHERE user_id = ${uid}::bigint AND spin_date = ${mytDay(this.clock.now())}::date`
    return {
      segments: SPIN_SEGMENTS.map((s) => ({ ...s })),
      spins: stats?.spins ?? 0,
      won: stats?.won ?? 0,
      alreadySpun: today.length > 0,
      canEarnSyiling: !caller.isTest && (await this.ports.rewards.canEarnSyiling(caller.userId)),
    }
  }

  async spin(caller: GamesCaller): Promise<SpinOutcome> {
    const now = this.clock.now()
    const date = mytDay(now)
    const uid = idFromString(caller.userId)
    const index = this.draw.draw()
    const seg = SPIN_SEGMENTS[index] as (typeof SPIN_SEGMENTS)[number]
    return this.prisma.transaction(async (tx): Promise<SpinOutcome> => {
      // The unique (user_id, spin_date) decides a race: the loser waits for the winner's commit, then inserts nothing.
      const inserted = await tx.$queryRaw<{ id: bigint }[]>`
        INSERT INTO spins (user_id, spin_date, segment_index, type, value, credited, is_test, created_at)
        VALUES (${uid}::bigint, ${date}::date, ${index}, ${seg.type}, ${seg.value}, 0, ${caller.isTest}, ${now})
        ON CONFLICT (user_id, spin_date) DO NOTHING RETURNING id`
      if (inserted.length === 0) return { status: 409, body: rawSpinRefused() }
      let credited = 0
      if (!caller.isTest && (await this.ports.rewards.canEarnSyiling(caller.userId, { tx }))) {
        const out = await this.ports.rewards.onGameResult(
          caller.userId,
          { game: 'roda_nasib', event: 'spin', coins: seg.type === 'syiling' ? seg.value : 0, xp: 0, detail: { segment: seg.label }, key: `spin:${date}` },
          { tx, isTest: false },
        )
        credited = out.coinsCredited
      }
      if (credited > 0) await tx.$executeRaw`UPDATE spins SET credited = ${credited} WHERE user_id = ${uid}::bigint AND spin_date = ${date}::date`
      await tx.$executeRaw`
        INSERT INTO spin_stats (user_id, spins, won, last_spin_date, is_test)
        VALUES (${uid}::bigint, 1, ${credited}, ${date}::date, ${caller.isTest})
        ON CONFLICT (user_id) DO UPDATE SET spins = spin_stats.spins + 1, won = spin_stats.won + ${credited}, last_spin_date = ${date}::date`
      return {
        status: 200,
        body: {
          success: true,
          message: '',
          result: { segment_index: index, label: seg.label, icon: seg.icon, type: seg.type, value: seg.value },
          coinsCredited: credited,
        },
      }
    })
  }
}
