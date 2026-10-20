/**
 * Read service other modules use (BE-44; SRS XR-M16-05, XR-M16-09): M11 (BE-20), M17 (BE-22) and the BE-45 hub chip.
 * Exported from `BattleModule`. Battles written under Mod Pelajar (`is_test`) never count.
 */
import { Inject, Injectable } from '@nestjs/common'
import { CLOCK, type Clock } from '../../db/clock'
import { idFromString, isIdString } from '../../db/ids'
import { PrismaService } from '../../db/prisma.service'

export interface BattleCounts {
  count: number
  correct: number
  answered: number
}

const COUNTED = ['finished', 'forfeited']
const DAY_MS = 24 * 3_600_000

@Injectable()
export class BattleReadService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /**
   * M11: finished and forfeited battles of each user created in `[from, to)` (both sides), with the user's own correct
   * count and the battle's answered count. Only ids in `userIds` appear; a user with none is absent.
   */
  async countFor(userIds: readonly string[], range: { from: Date; to: Date }): Promise<Map<string, BattleCounts>> {
    const ids = [...new Set(userIds.filter(isIdString))].map(idFromString)
    const out = new Map<string, BattleCounts>()
    if (ids.length === 0) return out
    const rows = await this.prisma.client.battleParticipant.findMany({
      where: {
        userId: { in: ids },
        isTest: false,
        battle: { isTest: false, status: { in: COUNTED }, createdAt: { gte: range.from, lt: range.to } },
      },
      select: { userId: true, correct: true, battle: { select: { answered: true } } },
    })
    for (const r of rows) {
      const key = String(r.userId)
      const e = out.get(key) ?? { count: 0, correct: 0, answered: 0 }
      e.count += 1
      e.correct += r.correct
      e.answered += r.battle.answered
      out.set(key, e)
    }
    return out
  }

  /**
   * M17: battles created in the last `days` days up to now, ANY status, whose first player (side A) is a pupil
   * (the mock counts `playerA`). Returns only the battle half; the games half belongs to BE-45.
   */
  async windowCounts(days: number): Promise<{ battles: number }> {
    const now = this.clock.now()
    const from = new Date(now.getTime() - days * DAY_MS)
    const battles = await this.prisma.client.battle.count({
      where: { isTest: false, createdAt: { gte: from, lte: now }, participants: { some: { side: 'A', isTest: false } } },
    })
    return { battles }
  }

  /** BE-45 hub chip: the user has a finished or forfeited battle. */
  async hasBattled(userId: string): Promise<boolean> {
    if (!isIdString(userId)) return false
    const n = await this.prisma.client.battle.count({
      where: { isTest: false, status: { in: COUNTED }, participants: { some: { userId: idFromString(userId) } } },
      take: 1,
    })
    return n > 0
  }
}
