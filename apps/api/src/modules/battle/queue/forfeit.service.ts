/** Forfeit (M16-14; BR-M16-09): a player of an active battle gives up, the opponent wins. */
import { Inject, Injectable } from '@nestjs/common'
import { BATTLE_MESSAGES } from '@pp/contract'

import { CLOCK, type Clock } from '../../../db/clock'
import { idFromString } from '../../../db/ids'
import { PrismaService } from '../../../db/prisma.service'
import { BattleEngine, isUuid } from '../engine'
import { rawConflict, rawNotFound } from '../raw-response'

@Injectable()
export class ForfeitService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(BattleEngine) private readonly engine: BattleEngine,
  ) {}

  async forfeit(userId: string, uuid: string): Promise<{ success: true }> {
    if (!isUuid(uuid)) throw rawNotFound(BATTLE_MESSAGES.battleNotFound)
    const done = await this.prisma.transaction(async () => {
      const mine = await this.prisma.client.battleParticipant.findFirst({ where: { battleId: uuid, userId: idFromString(userId), isBot: false } })
      if (!mine) throw rawNotFound(BATTLE_MESSAGES.battleNotFound)
      await this.prisma.client.$queryRaw`SELECT id FROM battles WHERE id = ${uuid}::uuid FOR UPDATE`
      const battle = await this.prisma.client.battle.findUnique({ where: { id: uuid } })
      if (!battle) throw rawNotFound(BATTLE_MESSAGES.battleNotFound)
      if (battle.status !== 'active') throw rawConflict(BATTLE_MESSAGES.battleOver)
      const side = mine.side as 'A' | 'B'
      const winner: 'A' | 'B' = side === 'A' ? 'B' : 'A'
      await this.prisma.client.battle.update({ where: { id: uuid }, data: { status: 'forfeited', winner, finishedAt: this.clock.now() } })
      return { side, winner, correct: mine.correct, total: battle.answered, isTest: battle.isTest }
    })
    await this.engine.reportSafely({ userId, side: done.side, winner: done.winner, forfeited: true, correct: done.correct, total: done.total, isTest: done.isTest })
    return { success: true }
  }
}
