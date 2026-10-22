import { Inject, Injectable } from '@nestjs/common'

import { idFromString, isIdString } from '../../../db/ids'
import { PrismaService } from '../../../db/prisma.service'

/**
 * Read service for other modules (SRS 6.12 XR-M16-05; consumer BE-20 / M11 "Permainan" counter).
 * Counts the games users played in `[from, to)`: finished room games the user played as a human, plus submitted
 * solo and Jutawan sessions. `is_test` rows are excluded; bots are not users that played.
 */
@Injectable()
export class GameReadService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /** Total games of all `userIds` in `[from, to)` (`{count}`). */
  async countFor(userIds: readonly string[], range: { from: Date; to: Date }): Promise<{ count: number }> {
    let count = 0
    for (const { count: n } of (await this.countByUser(userIds, range)).values()) count += n
    return { count }
  }

  /** Games per user (users with none are absent from the map). */
  async countByUser(userIds: readonly string[], range: { from: Date; to: Date }): Promise<Map<string, { count: number }>> {
    const ids = [...new Set(userIds)].filter(isIdString).map(idFromString)
    const out = new Map<string, { count: number }>()
    if (ids.length === 0) return out
    const db = this.prisma.client
    const add = (userId: bigint, n: number): void => {
      const key = String(userId)
      const e = out.get(key) ?? { count: 0 }
      e.count += n
      out.set(key, e)
    }
    const rooms = await db.gameRoomPlayer.groupBy({
      by: ['userId'],
      where: {
        userId: { in: ids },
        isBot: false,
        isTest: false,
        room: { status: 'finished', isTest: false, finishedAt: { gte: range.from, lt: range.to } },
      },
      _count: { _all: true },
    })
    for (const r of rooms) add(r.userId, r._count._all)
    const sessions = await db.gameSession.groupBy({
      by: ['userId'],
      where: { userId: { in: ids }, isTest: false, submittedAt: { gte: range.from, lt: range.to } },
      _count: { _all: true },
    })
    for (const s of sessions) add(s.userId, s._count._all)
    return out
  }
}
