/** Forfeit (M16-14; BR-M16-09): a player of an active battle gives up, the opponent wins. */
import { Inject, Injectable } from '@nestjs/common'
import { BATTLE_MESSAGES } from '@pp/contract'

import { CLOCK, type Clock } from '../../../db/clock'
import { idFromString, idToString } from '../../../db/ids'
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
    await this.prisma.transaction(async (tx) => {
      const mine = await this.prisma.client.battleParticipant.findFirst({ where: { battleId: uuid, userId: idFromString(userId), isBot: false } })
      if (!mine) throw rawNotFound(BATTLE_MESSAGES.battleNotFound)
      await this.prisma.client.$queryRaw`SELECT id FROM battles WHERE id = ${uuid}::uuid FOR UPDATE`
      const battle = await this.prisma.client.battle.findUnique({ where: { id: uuid } })
      if (!battle) throw rawNotFound(BATTLE_MESSAGES.battleNotFound)
      if (battle.status !== 'active') throw rawConflict(BATTLE_MESSAGES.battleOver)
      const side = mine.side as 'A' | 'B'
      const winner: 'A' | 'B' = side === 'A' ? 'B' : 'A'
      await this.prisma.client.battle.update({ where: { id: uuid }, data: { status: 'forfeited', winner, finishedAt: this.clock.now() } })
      const other = await this.prisma.client.battleParticipant.findFirst({ where: { battleId: uuid, side: winner } })
      const common = { tx, battleId: uuid, startedAt: battle.createdAt, winner, forfeited: true, robotsOnly: other?.isBot ?? true, total: battle.answered, isTest: battle.isTest }
      // 48 section 3.4 rule 1: the opponent gets the win XP, the one who left nothing. A robot gets nothing at all.
      if (other && !other.isBot && other.userId !== null) await this.engine.report({ ...common, userId: idToString(other.userId), side: winner, correct: other.correct })
      await this.engine.report({ ...common, userId, side, correct: mine.correct })
    })
    return { success: true }
  }
}
