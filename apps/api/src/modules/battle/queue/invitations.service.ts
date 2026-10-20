/**
 * Search and 1:1 invitations (M16-07 to M16-11; BR-M16-06, BR-M16-11). D54(d): the search shows display name and school only.
 * An invitation is visible to its receiver (list, accept, decline); every other caller gets "Cabaran tidak dijumpai.".
 * Invitations written under Mod Pelajar (`is_test`) are only seen by Mod Pelajar sessions.
 */
import { Inject, Injectable } from '@nestjs/common'
import { BATTLE_MESSAGES, BATTLE_RULES } from '@pp/contract'

import { CLOCK, type Clock } from '../../../db/clock'
import { idFromString, idToString, isIdString } from '../../../db/ids'
import { PrismaService } from '../../../db/prisma.service'
import { BattleEngine, isUuid, parseBattleParams, ParamRefusal, type BattleParams } from '../engine'
import { rawForbidden, rawInvalid, rawNotFound } from '../raw-response'

const EXPIRES_MS = BATTLE_RULES.invitationExpiresHours * 3_600_000
/** Longest search text looked at; a longer text matches no name and answers an empty list. */
export const SEARCH_MAX_CHARS = 100

/** Stream of the question draw of an invitation's battle. */
const poolStream = (uuid: string): string => `m16:battle:invite:${uuid}:pool`

const paramsOfInvitation = (inv: { questionType: string; subjectId: bigint | null; pkskDomainId: bigint | null; pkskTargetLevel: string | null }): BattleParams => ({
  questionType: inv.questionType as BattleParams['questionType'],
  subjectId: inv.subjectId === null ? null : idToString(inv.subjectId),
  pkskDomainId: inv.pkskDomainId === null ? null : idToString(inv.pkskDomainId),
  pkskTargetLevel: inv.pkskTargetLevel as BattleParams['pkskTargetLevel'],
  openToAll: false,
})

@Injectable()
export class InvitationsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(BattleEngine) private readonly engine: BattleEngine,
  ) {}

  /** M16-07. `q` is whatever the query carried (only a single string counts). */
  async search(userId: string, q: unknown): Promise<{ users: { id: string; name: string; school: string; avatar: string | null }[] }> {
    const term = typeof q === 'string' ? q.trim() : ''
    if (term.length < BATTLE_RULES.searchMinChars || term.length > SEARCH_MAX_CHARS) return { users: [] }
    const rows = await this.engine.deps.searchStudents(term, userId, BATTLE_RULES.searchMaxResults)
    return { users: rows.map((u) => ({ id: u.id, name: u.name, school: u.schoolName ?? '', avatar: u.avatar })) }
  }

  /** M16-08. */
  async invite(senderId: string, isTest: boolean, body: unknown): Promise<{ success: true }> {
    const grade = await this.engine.deps.gradeOf(senderId)
    let params: BattleParams
    try {
      params = await parseBattleParams(body, grade, this.engine.deps, true)
    } catch (e) {
      if (e instanceof ParamRefusal) throw e.forbidden ? rawForbidden(e.message) : rawInvalid(e.message)
      throw e
    }
    const rid = (body as { receiver_id?: unknown }).receiver_id
    const receiver = typeof rid === 'string' && isIdString(rid) && rid !== senderId ? await this.engine.deps.student(rid) : null
    if (!receiver) throw rawInvalid(BATTLE_MESSAGES.receiverInvalid)
    if (!(await this.engine.poolOk(params, grade, 'm16:pool-check'))) throw rawInvalid(BATTLE_MESSAGES.poolTooSmall)
    await this.prisma.client.battleInvitation.create({
      data: {
        senderId: idFromString(senderId),
        receiverId: idFromString(receiver.id),
        questionType: params.questionType,
        subjectId: params.subjectId === null ? null : idFromString(params.subjectId),
        pkskDomainId: params.pkskDomainId === null ? null : idFromString(params.pkskDomainId),
        pkskTargetLevel: params.pkskTargetLevel,
        status: 'pending',
        isTest,
        createdAt: this.clock.now(),
      },
    })
    return { success: true }
  }

  /** M16-09: pending, not older than 24 h, newest first. */
  async list(userId: string, isTest: boolean): Promise<{ invitations: { uuid: string; sender_name: string; sender_school: string }[] }> {
    const from = new Date(this.clock.now().getTime() - EXPIRES_MS)
    const rows = await this.prisma.client.battleInvitation.findMany({
      where: { receiverId: idFromString(userId), status: 'pending', isTest, createdAt: { gte: from } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 100,
    })
    const senders = await this.engine.deps.players([...new Set(rows.map((r) => idToString(r.senderId)))])
    return {
      invitations: rows.map((r) => {
        const s = senders.get(idToString(r.senderId))
        return { uuid: r.id, sender_name: s?.name ?? 'Pelajar', sender_school: s?.schoolName ?? '' }
      }),
    }
  }

  private async lock(uuid: string) {
    if (!isUuid(uuid)) return null
    const found = await this.prisma.client.$queryRaw<{ id: string }[]>`SELECT id::text FROM battle_invitations WHERE id = ${uuid}::uuid FOR UPDATE`
    if (found.length === 0) return null
    return this.prisma.client.battleInvitation.findUnique({ where: { id: uuid } })
  }

  /** The question draw, made before the transaction (undefined when the invitation does not qualify). */
  private async prefetchIds(userId: string, isTest: boolean, uuid: string): Promise<string[] | null | undefined> {
    if (!isUuid(uuid)) return undefined
    const inv = await this.prisma.client.battleInvitation.findUnique({ where: { id: uuid } })
    if (!inv || inv.isTest !== isTest || idToString(inv.receiverId) !== userId || inv.status !== 'pending') return undefined
    const sender = await this.engine.player(idToString(inv.senderId))
    return sender ? this.engine.draw(paramsOfInvitation(inv), sender.grade, poolStream(uuid)) : undefined
  }

  /** M16-10: the sender is player A. */
  async accept(userId: string, isTest: boolean, uuid: string): Promise<{ success: true; battle_uuid: string }> {
    const ids = await this.prefetchIds(userId, isTest, uuid)
    return this.prisma.transaction(async () => {
      const inv = await this.lock(uuid)
      if (
        !inv ||
        inv.isTest !== isTest ||
        idToString(inv.receiverId) !== userId ||
        inv.status !== 'pending' ||
        this.clock.now().getTime() - inv.createdAt.getTime() > EXPIRES_MS
      ) {
        throw rawNotFound(BATTLE_MESSAGES.invitationNotFound)
      }
      const sender = await this.engine.player(idToString(inv.senderId))
      const receiver = await this.engine.player(userId)
      if (!sender || !receiver) throw rawNotFound(BATTLE_MESSAGES.invitationNotFound)
      const battleId = await this.engine.createBattle({
        mode: 'challenge',
        params: paramsOfInvitation(inv),
        a: { id: sender.id, schoolId: sender.schoolId },
        b: { id: receiver.id, schoolId: receiver.schoolId },
        bIsBot: false,
        isTest,
        ownerGrade: sender.grade,
        drawStream: poolStream(uuid),
        ...(ids === undefined ? {} : { questionIds: ids }),
      })
      await this.prisma.client.battleInvitation.update({ where: { id: uuid }, data: { status: 'accepted' } })
      return { success: true as const, battle_uuid: battleId }
    })
  }

  /** M16-11. */
  async decline(userId: string, isTest: boolean, uuid: string): Promise<{ success: true }> {
    return this.prisma.transaction(async () => {
      const inv = await this.lock(uuid)
      if (!inv || inv.isTest !== isTest || idToString(inv.receiverId) !== userId || inv.status !== 'pending') {
        throw rawNotFound(BATTLE_MESSAGES.invitationNotFound)
      }
      await this.prisma.client.battleInvitation.update({ where: { id: uuid }, data: { status: 'declined' } })
      return { success: true as const }
    })
  }
}
