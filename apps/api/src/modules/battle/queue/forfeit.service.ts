/** Forfeit (M16-14; BR-M16-09): a player of an active battle gives up, the opponent wins. */
import { Inject, Injectable } from '@nestjs/common'
import { BATTLE_MESSAGES } from '@pp/contract'

import type { TxClient } from '../../../db/client'
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
      await this.forfeitLocked(tx, battle, mine.side as 'A' | 'B')
    })
    return { success: true }
  }

  /**
   * The result of a forfeit by `loserSide`, in the caller's transaction. The caller holds the row lock of the battle and has
   * read it `active` (the button above, and the third consecutive timeout of the arena, FR-GM-01.7): the other side wins, the
   * winner gets the win XP, the one who left nothing, a robot nothing at all (48 section 3.4 rule 1).
   */
  async forfeitLocked(tx: TxClient, battle: { id: string; createdAt: Date; answered: number; isTest: boolean }, loserSide: 'A' | 'B'): Promise<void> {
    const winner: 'A' | 'B' = loserSide === 'A' ? 'B' : 'A'
    const seats = await this.prisma.client.battleParticipant.findMany({ where: { battleId: battle.id } })
    const mine = seats.find((p) => p.side === loserSide)
    const other = seats.find((p) => p.side === winner)
    if (!mine || mine.userId === null) throw rawNotFound(BATTLE_MESSAGES.battleNotFound)
    await this.prisma.client.battle.update({ where: { id: battle.id }, data: { status: 'forfeited', winner, finishedAt: this.clock.now() } })
    const common = { tx, battleId: battle.id, startedAt: battle.createdAt, winner, forfeited: true, robotsOnly: other?.isBot ?? true, total: battle.answered, isTest: battle.isTest }
    if (other && !other.isBot && other.userId !== null) await this.engine.report({ ...common, userId: idToString(other.userId), side: winner, correct: other.correct })
    await this.engine.report({ ...common, userId: idToString(mine.userId), side: loserSide, correct: mine.correct })
  }
}
