import { Inject, Injectable } from '@nestjs/common'
import { GAMIFICATION_DRAW_MESSAGES } from '@pp/contract'

import { AUDIT_ACTIONS, AuditService } from '../../common/audit'
import { ApiError } from '../../common/errors/api-error'
import type { TxClient } from '../../db/client'
import { CLOCK, type Clock } from '../../db/clock'
import { idFromString, idToString } from '../../db/ids'
import { PrismaService } from '../../db/prisma.service'
import { NotificationsService } from '../notifications'
import type { ShopActor } from './actor'
import { BOX_RANDOM, type BoxRandom, type BoxStream } from './box-random'
import { drawStillOpen } from './shop.time'

/** One winner as the admin reads it (DM-36): `prizePosition` is the 0-based line of the draw's prize pool, `slot` counts that line's winners from 0. */
export interface DrawWinnerRecord {
  id: string
  drawId: string
  prizePosition: number
  prizeLabel: string
  slot: number
  userId: string
  name: string
  ticketId: string
  drawnAt: Date
  deliveredAt: Date | null
}

/** [PROPOSED] code of "Tiada peserta": 48 GAME-22 gives the text and "the draw stays closed" but no code or status. 409 like every other state refusal. */
export const NO_PARTICIPANTS_CODE = 'NO_PARTICIPANTS'

/**
 * The in-app winner notice. Body: the exact copy of 48 GAME-22. [PROPOSED]: the type `cabutan_winner` and the title "Cabutan Bertuah"
 * (the page name of 48 GAME-22), which the SRS does not give; the category is `milestone`.
 */
export const drawWinnerNotice = (prize: string, title: string) => ({
  type: 'cabutan_winner',
  category: 'milestone' as const,
  title: 'Cabutan Bertuah',
  body: `Tahniah! Anda memenangi ${prize} dalam ${title}.`,
})

/**
 * The draw itself (48 GAME-22): for each prize line in the given order and each of its `qty` slots, one ticket is taken uniformly at
 * random among the remaining tickets (`stream.int`, a CSPRNG in production); the winner's other tickets then leave the pool, so a pupil
 * wins at most one prize. It stops when the pool is empty, so there are never more winners than pupils or than the sum of `qty`.
 */
export function pickWinners<T extends { userId: bigint }, P extends { qty: number }>(tickets: readonly T[], prizes: readonly P[], stream: BoxStream): { prize: P; slot: number; ticket: T }[] {
  let pool = tickets
  const picks: { prize: P; slot: number; ticket: T }[] = []
  for (const prize of prizes) {
    for (let slot = 0; slot < prize.qty && pool.length > 0; slot++) {
      const ticket = pool[stream.int(0, pool.length - 1)] as T
      picks.push({ prize, slot, ticket })
      pool = pool.filter((t) => t.userId !== ticket.userId)
    }
  }
  return picks
}

const lockDraw = async (tx: TxClient, id: bigint): Promise<void> => {
  await tx.$queryRaw`SELECT id FROM draws WHERE id = ${id} FOR UPDATE`
}

/**
 * "Cabut pemenang" and "Tandakan Dihantar" (48 GAME-22, DM-36, API-GAME-09, API-ADM-24). The draw row is locked FOR UPDATE for the whole
 * run, the same lock family a ticket purchase takes FOR SHARE, so no ticket can arrive between the read of the pool and the new status,
 * and two presses are serialised: the second sees `drawn` and is refused (409). Writes are audited in the same transaction with the
 * draw id as target. Callers pass a parsed draw id; the HTTP route lives on `RewardControlController`.
 */
@Injectable()
export class DrawWinnersService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(BOX_RANDOM) private readonly random: BoxRandom,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
  ) {}

  /**
   * Draws every prize slot of a closed draw, in prize order, and sets it to `drawn` (ruling 3 on #505). A draw that reads closed
   * is one stored `closed`, or stored `open` with its closing day (Malaysia time) past. Each slot takes one ticket uniformly at
   * random (CSPRNG) among the remaining tickets; the winner's other tickets then leave the pool (one prize per pupil per draw).
   * Fewer pupils than prizes gives fewer winners; no ticket at all is 409 "Tiada peserta" and the draw is left as it was.
   */
  async draw(actor: ShopActor, drawId: bigint): Promise<void> {
    await this.prisma.transaction(async (tx) => {
      await lockDraw(tx, drawId)
      const draw = await tx.draw.findUnique({ where: { id: drawId }, include: { prizes: { orderBy: { position: 'asc' } } } })
      if (!draw) throw ApiError.of('NOT_FOUND')
      const at = this.clock.now()
      const reads = draw.status === 'closed' || (draw.status === 'open' && !drawStillOpen(draw.closesAt, at))
      if (!reads) throw ApiError.of('CONFLICT')
      const tickets = await tx.drawTicket.findMany({ where: { drawId }, orderBy: { id: 'asc' }, select: { id: true, userId: true } })
      if (tickets.length === 0) throw new ApiError({ code: NO_PARTICIPANTS_CODE, status: 409, message: GAMIFICATION_DRAW_MESSAGES.noParticipants })

      const picks = pickWinners(tickets, draw.prizes, this.random.stream(`cabutan-draw:${idToString(drawId)}`))

      await tx.drawWinner.createMany({
        data: picks.map((p) => ({ drawId, drawPrizeId: p.prize.id, ticketId: p.ticket.id, slot: p.slot, userId: p.ticket.userId, drawnAt: at, drawnById: idFromString(actor.userId) })),
      })
      // The first winner of the first prize line stays in `winner_user_id` (compatibility, DM-36).
      const first = picks[0] as (typeof picks)[number]
      const moved = await tx.draw.updateMany({ where: { id: drawId, status: draw.status }, data: { status: 'drawn', drawnAt: at, winnerUserId: first.ticket.userId, updatedAt: at } })
      if (moved.count !== 1) throw ApiError.of('CONFLICT')
      for (const p of picks) await this.notifications.push(idToString(p.ticket.userId), drawWinnerNotice(p.prize.label, draw.title))
      await this.audit.record({
        action: AUDIT_ACTIONS.GAMIFICATION_DRAW_DRAWN,
        actorUserId: actor.userId,
        actorRole: actor.role,
        requestId: actor.requestId,
        ip: actor.ip,
        isTest: actor.isTest,
        targetType: 'draw',
        targetId: idToString(drawId),
        details: {
          ticketCount: tickets.length,
          winners: picks.map((p) => ({ prizePosition: p.prize.position, slot: p.slot, ticketId: idToString(p.ticket.id), userId: idToString(p.ticket.userId) })),
        },
        tx,
      })
    })
  }

  /**
   * "Tandakan Dihantar": the winner's prize was handed over outside the app. The winner must belong to the draw (else 404); one already
   * marked is 409, so a double press writes one audit event.
   */
  async deliver(actor: ShopActor, drawId: bigint, winnerId: bigint): Promise<void> {
    await this.prisma.transaction(async (tx) => {
      await lockDraw(tx, drawId)
      const winner = await tx.drawWinner.findFirst({ where: { id: winnerId, drawId }, include: { drawPrize: { select: { position: true } } } })
      if (!winner) throw ApiError.of('NOT_FOUND')
      if (winner.deliveredAt !== null) throw ApiError.of('CONFLICT')
      const at = this.clock.now()
      const marked = await tx.drawWinner.updateMany({ where: { id: winnerId, deliveredAt: null }, data: { deliveredAt: at, deliveredById: idFromString(actor.userId) } })
      if (marked.count !== 1) throw ApiError.of('CONFLICT')
      await this.audit.record({
        action: AUDIT_ACTIONS.GAMIFICATION_DRAW_WINNER_DELIVERED,
        actorUserId: actor.userId,
        actorRole: actor.role,
        requestId: actor.requestId,
        ip: actor.ip,
        isTest: actor.isTest,
        targetType: 'draw',
        targetId: idToString(drawId),
        details: { winnerId: idToString(winnerId), prizePosition: winner.drawPrize.position, slot: winner.slot },
        tx,
      })
    })
  }

  /** The winners of the given draws (decimal-string ids), in prize order then slot order, with the pupil's name. Draws without winners are absent. */
  async winnersOf(drawIds: readonly string[]): Promise<Map<string, DrawWinnerRecord[]>> {
    const out = new Map<string, DrawWinnerRecord[]>()
    if (drawIds.length === 0) return out
    const db = this.prisma.client
    const rows = await db.drawWinner.findMany({
      where: { drawId: { in: drawIds.map(idFromString) } },
      include: { drawPrize: { select: { label: true, position: true } } },
      orderBy: [{ drawId: 'asc' }, { drawPrize: { position: 'asc' } }, { slot: 'asc' }],
    })
    if (rows.length === 0) return out
    const users = await db.user.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.userId))] } }, select: { id: true, name: true } })
    const names = new Map(users.map((u) => [u.id, u.name]))
    for (const r of rows) {
      const list = out.get(idToString(r.drawId)) ?? []
      list.push({
        id: idToString(r.id),
        drawId: idToString(r.drawId),
        prizePosition: r.drawPrize.position,
        prizeLabel: r.drawPrize.label,
        slot: r.slot,
        userId: idToString(r.userId),
        name: names.get(r.userId) ?? '',
        ticketId: idToString(r.ticketId),
        drawnAt: r.drawnAt,
        deliveredAt: r.deliveredAt,
      })
      out.set(idToString(r.drawId), list)
    }
    return out
  }
}
