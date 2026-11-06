/**
 * Search and 1:1 invitations (M16-07 to M16-11; BR-M16-06, BR-M16-11). 48 section 3.10: the search shows the display name only; the `school` fields stay in the contract, always empty.
 * FR-GM-01.6: search and invite reach pupils of the caller's own school only. An invitation lasts `battle_invitation_hours`.
 * An invitation is visible to its receiver (list, accept, decline); every other caller gets "Cabaran tidak dijumpai.".
 * Invitations written under Mod Pelajar (`is_test`) are only seen by Mod Pelajar sessions.
 */
import { Inject, Injectable } from '@nestjs/common'
import { BATTLE_MESSAGES, BATTLE_RULES, type BattleQuestionCount } from '@pp/contract'

import { CLOCK, type Clock } from '../../../db/clock'
import { idFromString, idToString, isIdString } from '../../../db/ids'
import { PrismaService } from '../../../db/prisma.service'
import { BattleEngine, isUuid, parseBattleParams, ParamRefusal, type BattleParams } from '../engine'
import { canSeeName, displayName, NO_PUPILS, type BattleViewer } from '../privacy'
import { rawForbidden, rawInvalid, rawNotFound } from '../raw-response'

/** Longest search text looked at; a longer text matches no name and answers an empty list. */
export const SEARCH_MAX_CHARS = 100

/** Stream of the question draw of an invitation's battle. */
const poolStream = (uuid: string): string => `m16:battle:invite:${uuid}:pool`

const paramsOfInvitation = (inv: { questionType: string; subjectId: bigint | null; pkskDomainId: bigint | null; pkskTargetLevel: string | null; questionCount: number }): BattleParams => ({
  questionType: inv.questionType as BattleParams['questionType'],
  subjectId: inv.subjectId === null ? null : idToString(inv.subjectId),
  pkskDomainId: inv.pkskDomainId === null ? null : idToString(inv.pkskDomainId),
  pkskTargetLevel: inv.pkskTargetLevel as BattleParams['pkskTargetLevel'],
  openToAll: false,
  questionCount: inv.questionCount as BattleQuestionCount,
})

@Injectable()
export class InvitationsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(BattleEngine) private readonly engine: BattleEngine,
  ) {}

  /** M16-07. `q` is whatever the query carried (only a single string counts). */
  async search(viewer: BattleViewer, q: unknown): Promise<{ users: { id: string; name: string; school: string; avatar: string | null }[] }> {
    const term = typeof q === 'string' ? q.trim() : ''
    if (term.length < BATTLE_RULES.searchMinChars || term.length > SEARCH_MAX_CHARS) return { users: [] }
    // FR-GM-01.6: the caller's own school (the account's current one); a caller with no school finds nobody.
    const schoolId = (await this.engine.player(viewer.userId))?.schoolId ?? null
    if (schoolId === null) return { users: [] }
    const rows = await this.engine.deps.searchStudents(term, viewer.userId, BATTLE_RULES.searchMaxResults, schoolId)
    // Children's names rule (LEAD 2026-10-21, issue #76): the id stays (it is the handle `POST invite` takes), the name is masked outside the viewer's scope.
    const own = viewer.role === 'teacher' ? await this.engine.deps.ownPupilIdsOfTeacher(viewer.userId) : NO_PUPILS
    return {
      users: rows.map((u) => ({
        id: u.id,
        name: canSeeName(viewer, u.id, u.schoolId, own) ? u.name : displayName(u.name) || 'Pelajar',
        school: '',
        avatar: u.avatar,
      })),
    }
  }

  /** M16-08. */
  async invite(who: { userId: string; role: string }, isTest: boolean, body: unknown): Promise<{ success: true }> {
    const senderId = who.userId
    const grade = await this.engine.deps.gradeOf(senderId)
    let params: BattleParams
    try {
      params = await parseBattleParams(body, grade, this.engine.deps, who, await this.engine.questionCountDefault(), true)
    } catch (e) {
      if (e instanceof ParamRefusal) throw e.forbidden ? rawForbidden(e.message) : rawInvalid(e.message)
      throw e
    }
    const rid = (body as { receiver_id?: unknown }).receiver_id
    const receiver = typeof rid === 'string' && isIdString(rid) && rid !== senderId ? await this.engine.deps.student(rid) : null
    // FR-GM-01.6: the receiver must be a pupil of the sender's school; any other answers like a receiver that does not exist.
    const senderSchool = (await this.engine.player(senderId))?.schoolId ?? null
    if (!receiver || senderSchool === null || receiver.schoolId !== senderSchool) throw rawInvalid(BATTLE_MESSAGES.receiverInvalid)
    if (!(await this.engine.poolOk(params, grade, 'm16:pool-check'))) throw rawInvalid(BATTLE_MESSAGES.poolTooSmall)
    // One open invitation per sender and receiver (same test flag): a repeat answers the same success and creates nothing.
    const open = await this.prisma.client.battleInvitation.findFirst({
      where: {
        senderId: idFromString(senderId),
        receiverId: idFromString(receiver.id),
        status: 'pending',
        isTest,
        createdAt: { gte: new Date(this.clock.now().getTime() - (await this.engine.invitationMs())) },
      },
      select: { id: true },
    })
    if (open) return { success: true }
    await this.prisma.client.battleInvitation.create({
      data: {
        senderId: idFromString(senderId),
        receiverId: idFromString(receiver.id),
        questionType: params.questionType,
        subjectId: params.subjectId === null ? null : idFromString(params.subjectId),
        pkskDomainId: params.pkskDomainId === null ? null : idFromString(params.pkskDomainId),
        pkskTargetLevel: params.pkskTargetLevel,
        questionCount: params.questionCount,
        status: 'pending',
        isTest,
        createdAt: this.clock.now(),
      },
    })
    return { success: true }
  }

  /** M16-09: pending, not older than `battle_invitation_hours`, newest first. */
  async list(userId: string, isTest: boolean): Promise<{ invitations: { uuid: string; sender_name: string; sender_school: string }[] }> {
    const from = new Date(this.clock.now().getTime() - (await this.engine.invitationMs()))
    const rows = await this.prisma.client.battleInvitation.findMany({
      where: { receiverId: idFromString(userId), status: 'pending', isTest, createdAt: { gte: from } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 100,
    })
    const senders = await this.engine.deps.players([...new Set(rows.map((r) => idToString(r.senderId)))])
    return {
      invitations: rows.map((r) => {
        const s = senders.get(idToString(r.senderId))
        return { uuid: r.id, sender_name: displayName(s?.name ?? '') || 'Pelajar', sender_school: '' }
      }),
    }
  }

  private async lock(uuid: string) {
    if (!isUuid(uuid)) return null
    const found = await this.prisma.client.$queryRaw<{ id: string }[]>`SELECT id::text FROM battle_invitations WHERE id = ${uuid}::uuid FOR UPDATE`
    if (found.length === 0) return null
    return this.prisma.client.battleInvitation.findUnique({ where: { id: uuid } })
  }

  /** A PKSK battle needs a grant for its level on both sides, checked at match start (48 GAME-01); the sender's was checked at invite. */
  private async mustHavePkskGrant(who: { userId: string; role: string }, isTest: boolean, uuid: string): Promise<void> {
    if (!isUuid(uuid)) return
    const inv = await this.prisma.client.battleInvitation.findUnique({ where: { id: uuid } })
    if (!inv || inv.isTest !== isTest || idToString(inv.receiverId) !== who.userId || inv.questionType !== 'pksk') return
    const level = inv.pkskTargetLevel as 'T1' | 'T4'
    if (!(await this.engine.deps.pkskAccess(who))[level]) throw rawForbidden(BATTLE_MESSAGES.pkskNoAccess)
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
  async accept(who: { userId: string; role: string }, isTest: boolean, uuid: string): Promise<{ success: true; battle_uuid: string }> {
    const { userId } = who
    await this.mustHavePkskGrant(who, isTest, uuid)
    const ids = await this.prefetchIds(userId, isTest, uuid)
    const expiresMs = await this.engine.invitationMs()
    return this.prisma.transaction(async () => {
      const inv = await this.lock(uuid)
      if (!inv || inv.isTest !== isTest || idToString(inv.receiverId) !== userId || inv.status !== 'pending') {
        throw rawNotFound(BATTLE_MESSAGES.invitationNotFound)
      }
      // Only the receiver of a pending invitation learns that it ran out: everyone else gets the same not-found.
      if (this.clock.now().getTime() - inv.createdAt.getTime() > expiresMs) throw rawNotFound(BATTLE_MESSAGES.invitationExpired)
      const sender = await this.engine.player(idToString(inv.senderId))
      const receiver = await this.engine.player(userId)
      if (!sender || !receiver) throw rawNotFound(BATTLE_MESSAGES.invitationNotFound)
      const battleId = await this.engine.createBattle({
        mode: 'challenge',
        params: paramsOfInvitation(inv),
        a: { id: sender.id, schoolId: sender.schoolId },
        b: { id: receiver.id, schoolId: receiver.schoolId },
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
