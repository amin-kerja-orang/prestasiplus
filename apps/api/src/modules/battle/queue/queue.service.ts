/**
 * Matchmaking queues (M16-02 to M16-06, M16-12, M16-13; BR-M16-03 to BR-M16-05). Every mutation locks the queue row
 * (`SELECT ... FOR UPDATE`) inside one transaction, so two concurrent accepts create exactly one battle. A queue is
 * visible to its owner (and to its joiner for the joiner poll) only; anything else is the documented not-found answer.
 * Queues written under Mod Pelajar (`is_test`) only talk to Mod Pelajar sessions and the other way round.
 */
import { Inject, Injectable } from '@nestjs/common'
import { BATTLE_MESSAGES, BATTLE_RULES } from '@pp/contract'

import { CLOCK, type Clock } from '../../../db/clock'
import { idFromString, idToString, isIdString } from '../../../db/ids'
import { PrismaService } from '../../../db/prisma.service'
import type { BattleStudent } from '../battle.deps'
import { type BattleParams, BattleEngine, gradeLabel, parseBattleParams, ParamRefusal, type QueueMode } from '../engine'
import { rawForbidden, rawInvalid, rawNotFound } from '../raw-response'

type Challenger = { name: string; grade_label: string; school: string }
export type PollMatch =
  | { status: 'waiting' | 'expired' | 'not_found' }
  | { status: 'incoming_challenge'; challenger: Challenger }
  | { status: 'matched'; battle_uuid: string }
export type PollChallenger = { status: 'waiting' | 'rejected' | 'expired' | 'not_found' } | { status: 'matched'; battle_uuid: string }

const QUEUE_EXPIRES_MS = BATTLE_RULES.queueExpiresSeconds * 1000
const QUEUE_ABANDONED_MS = BATTLE_RULES.queueAbandonedSeconds * 1000

interface QueueRow {
  id: bigint
  ownerId: bigint
  mode: string
  questionType: string
  subjectId: bigint | null
  pkskDomainId: bigint | null
  pkskTargetLevel: string | null
  openToAll: boolean
  status: string
  challengerUserId: bigint | null
  battleId: string | null
  waitPolls: number
  lastPolledAt: Date | null
  joinerUserId: bigint | null
  joinerOutcome: string | null
  isTest: boolean
  createdAt: Date
}

interface Prefetch {
  owner: BattleStudent
  bot: BattleStudent | null
  /** The 10 drawn question ids, or null when the pool is too small. */
  ids: string[] | null
  forQueue: bigint
}

/** Stream of the question draw of a queue's battle (the pick uses `m16:battle:<queueId>`). */
const poolStream = (queueId: bigint): string => `m16:battle:${idToString(queueId)}:pool`

const paramsOf = (q: QueueRow): BattleParams => ({
  questionType: q.questionType as BattleParams['questionType'],
  subjectId: q.subjectId === null ? null : idToString(q.subjectId),
  pkskDomainId: q.pkskDomainId === null ? null : idToString(q.pkskDomainId),
  pkskTargetLevel: q.pkskTargetLevel as BattleParams['pkskTargetLevel'],
  openToAll: q.openToAll,
})

@Injectable()
export class QueueService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(BattleEngine) private readonly engine: BattleEngine,
  ) {}

  private queueKey(raw: string): bigint | null {
    return isIdString(raw) ? idFromString(raw) : null
  }

  /** The queue row with a write lock held until the transaction ends. */
  private async lock(id: bigint): Promise<QueueRow | null> {
    const found = await this.prisma.client.$queryRaw<{ id: bigint }[]>`SELECT id FROM battle_queues WHERE id = ${id} FOR UPDATE`
    if (found.length === 0) return null
    return (await this.prisma.client.battleQueue.findUnique({ where: { id } })) as QueueRow | null
  }

  /** M16-02 / M16-03. Refusals answer an EMPTY body (BR-M16-03). */
  async start(userId: string, isTest: boolean, mode: QueueMode, body: unknown): Promise<{ queue_id: string }> {
    const grade = await this.engine.deps.gradeOf(userId)
    let params: BattleParams
    try {
      params = await parseBattleParams(body, grade, this.engine.deps)
    } catch (e) {
      if (e instanceof ParamRefusal) throw e.forbidden ? rawForbidden() : rawInvalid()
      throw e
    }
    if (!(await this.engine.poolOk(params, grade, 'm16:pool-check'))) throw rawInvalid()
    const now = this.clock.now()
    const row = await this.prisma.client.battleQueue.create({
      data: {
        ownerId: idFromString(userId),
        mode,
        questionType: params.questionType,
        subjectId: params.subjectId === null ? null : idFromString(params.subjectId),
        pkskDomainId: params.pkskDomainId === null ? null : idFromString(params.pkskDomainId),
        pkskTargetLevel: params.pkskTargetLevel,
        openToAll: params.openToAll,
        status: 'waiting',
        lastPolledAt: now,
        createdAt: now,
        isTest,
      },
      select: { id: true },
    })
    return { queue_id: idToString(row.id) }
  }

  private async challengerOf(userId: bigint): Promise<Challenger> {
    const p = await this.engine.player(idToString(userId))
    if (!p) throw rawNotFound(BATTLE_MESSAGES.noOpponent)
    return { name: p.name, grade_label: gradeLabel(p.grade), school: p.schoolName ?? '' }
  }

  /** M16-04. */
  async pollMatch(userId: string, isTest: boolean, queueId: string): Promise<PollMatch> {
    const key = this.queueKey(queueId)
    if (key === null) return { status: 'not_found' }
    const prefetched = await this.prefetchOpponent(key, userId, isTest)
    return this.prisma.transaction(async () => {
      const q = await this.lock(key)
      if (!q || idToString(q.ownerId) !== userId || q.isTest !== isTest) return { status: 'not_found' as const }
      if (q.status === 'matched' && q.battleId) return { status: 'matched' as const, battle_uuid: q.battleId }
      if (q.status === 'expired' || q.status === 'abandoned' || q.status === 'matched') return { status: 'expired' as const }
      const now = this.clock.now()
      if (now.getTime() - (q.lastPolledAt ?? q.createdAt).getTime() > QUEUE_ABANDONED_MS) {
        await this.prisma.client.battleQueue.update({ where: { id: q.id }, data: { status: 'abandoned' } })
        return { status: 'expired' as const }
      }
      if (now.getTime() - q.createdAt.getTime() >= QUEUE_EXPIRES_MS) {
        await this.prisma.client.battleQueue.update({ where: { id: q.id }, data: { status: 'expired' } })
        return { status: 'expired' as const }
      }
      const polled = await this.prisma.client.battleQueue.update({
        where: { id: q.id },
        data: { polls: { increment: 1 }, waitPolls: { increment: 1 }, lastPolledAt: now },
      })
      if (q.status === 'incoming_challenge' && q.challengerUserId !== null) {
        return { status: 'incoming_challenge' as const, challenger: await this.challengerOf(q.challengerUserId) }
      }
      if (q.joinerOutcome === 'pending' && q.joinerUserId !== null) {
        const challenger = await this.challengerOf(q.joinerUserId)
        await this.prisma.client.battleQueue.update({ where: { id: q.id }, data: { status: 'incoming_challenge', challengerUserId: q.joinerUserId } })
        return { status: 'incoming_challenge' as const, challenger }
      }
      if (polled.waitPolls >= BATTLE_RULES.matchOnPoll) {
        const battleId = await this.matchWithBot(q, userId, isTest, prefetched)
        return { status: 'matched' as const, battle_uuid: battleId }
      }
      return { status: 'waiting' as const }
    })
  }

  /**
   * The owner and the bot of a queue whose NEXT poll will match (read before the transaction: the student read of the
   * users owner runs queries side by side, which a transaction connection must not). Null when this poll cannot match
   * or the pick failed; the transaction then picks for itself.
   */
  private async prefetchOpponent(key: bigint, userId: string, isTest: boolean): Promise<Prefetch | null> {
    const q = (await this.prisma.client.battleQueue.findUnique({ where: { id: key } })) as QueueRow | null
    if (!q || idToString(q.ownerId) !== userId || q.isTest !== isTest || q.status !== 'waiting' || q.waitPolls + 1 < BATTLE_RULES.matchOnPoll) return null
    const owner = await this.engine.player(userId)
    if (!owner) return null
    return {
      owner,
      bot: await this.engine.pickOpponent(idToString(q.id), owner, q.mode as QueueMode, q.openToAll),
      ids: await this.engine.draw(paramsOf(q), owner.grade, poolStream(q.id)),
      forQueue: q.id,
    }
  }

  private async matchWithBot(q: QueueRow, ownerId: string, isTest: boolean, prefetched: Prefetch | null): Promise<string> {
    const ready = prefetched !== null && prefetched.forQueue === q.id && prefetched.bot !== null ? prefetched : null
    const owner = ready?.owner ?? (await this.engine.player(ownerId))
    if (!owner) throw rawNotFound(BATTLE_MESSAGES.noOpponent)
    const bot = ready?.bot ?? (await this.engine.pickOpponent(idToString(q.id), owner, q.mode as QueueMode, q.openToAll))
    if (!bot) throw rawNotFound(BATTLE_MESSAGES.noOpponent)
    const battleId = await this.engine.createBattle({
      mode: q.mode as QueueMode,
      params: paramsOf(q),
      a: { id: owner.id, schoolId: owner.schoolId },
      b: { id: bot.id, schoolId: bot.schoolId },
      bIsBot: true,
      isTest,
      ownerGrade: owner.grade,
      drawStream: poolStream(q.id),
      ...(ready ? { questionIds: ready.ids } : {}),
    })
    await this.prisma.client.battleQueue.update({ where: { id: q.id }, data: { status: 'matched', battleId, challengerUserId: null } })
    return battleId
  }

  /** M16-05. */
  async acceptChallenger(userId: string, isTest: boolean, queueId: string): Promise<{ matched: true; battle_uuid: string }> {
    const key = this.queueKey(queueId)
    if (key === null) throw rawNotFound(BATTLE_MESSAGES.queueNotFound)
    const ids = await this.prefetchIds(key, userId, isTest, ['incoming_challenge'])
    return this.prisma.transaction(async () => {
      const q = await this.lock(key)
      if (!q || idToString(q.ownerId) !== userId || q.isTest !== isTest || q.status !== 'incoming_challenge' || q.challengerUserId === null) {
        throw rawNotFound(BATTLE_MESSAGES.queueNotFound)
      }
      const battleId = await this.createWithJoiner(q, userId, q.challengerUserId, isTest, ids)
      await this.prisma.client.battleQueue.update({
        where: { id: q.id },
        data: { status: 'matched', battleId, ...(q.joinerUserId === null ? {} : { joinerOutcome: 'matched' }) },
      })
      return { matched: true as const, battle_uuid: battleId }
    })
  }

  /** The question draw of a queue's battle, made before the transaction (undefined when the queue does not qualify). */
  private async prefetchIds(key: bigint, ownerId: string, isTest: boolean, statuses: string[]): Promise<string[] | null | undefined> {
    const q = (await this.prisma.client.battleQueue.findUnique({ where: { id: key } })) as QueueRow | null
    if (!q || idToString(q.ownerId) !== ownerId || q.isTest !== isTest || !statuses.includes(q.status)) return undefined
    const owner = await this.engine.player(ownerId)
    return owner ? this.engine.draw(paramsOf(q), owner.grade, poolStream(q.id)) : undefined
  }

  /** Owner = A, the other person = B. */
  private async createWithJoiner(q: QueueRow, ownerId: string, otherId: bigint, isTest: boolean, ids?: string[] | null): Promise<string> {
    const owner = await this.engine.player(ownerId)
    const other = await this.engine.player(idToString(otherId))
    if (!owner || !other) throw rawNotFound(BATTLE_MESSAGES.queueNotFound)
    return this.engine.createBattle({
      mode: q.mode as QueueMode,
      params: paramsOf(q),
      a: { id: owner.id, schoolId: owner.schoolId },
      b: { id: other.id, schoolId: other.schoolId },
      bIsBot: false,
      isTest,
      ownerGrade: owner.grade,
      drawStream: poolStream(q.id),
      ...(ids === undefined ? {} : { questionIds: ids }),
    })
  }

  /** M16-06: nothing to reject is not an error. */
  async rejectChallenger(userId: string, isTest: boolean, queueId: string): Promise<{ success: true }> {
    const key = this.queueKey(queueId)
    if (key === null) throw rawNotFound(BATTLE_MESSAGES.queueNotFound)
    return this.prisma.transaction(async () => {
      const q = await this.lock(key)
      if (!q || idToString(q.ownerId) !== userId || q.isTest !== isTest) throw rawNotFound(BATTLE_MESSAGES.queueNotFound)
      if (q.status === 'incoming_challenge') {
        await this.prisma.client.battleQueue.update({
          where: { id: q.id },
          data: { status: 'waiting', challengerUserId: null, waitPolls: 0, ...(q.joinerUserId === null ? {} : { joinerOutcome: 'rejected' }) },
        })
      }
      return { success: true as const }
    })
  }

  /** M16-12. */
  async joinQueue(userId: string, isTest: boolean, queueId: string): Promise<{ success: true }> {
    const key = this.queueKey(queueId)
    if (key === null) throw rawNotFound(BATTLE_MESSAGES.joinFailed)
    return this.prisma.transaction(async () => {
      const q = await this.lock(key)
      if (
        !q ||
        q.isTest !== isTest ||
        idToString(q.ownerId) === userId ||
        (q.status !== 'waiting' && q.status !== 'incoming_challenge') ||
        q.joinerOutcome === 'pending'
      ) {
        throw rawNotFound(BATTLE_MESSAGES.joinFailed)
      }
      await this.prisma.client.battleQueue.update({ where: { id: q.id }, data: { joinerUserId: idFromString(userId), joinerOutcome: 'pending' } })
      return { success: true as const }
    })
  }

  /** M16-13: never an HTTP error. */
  async pollChallenger(userId: string, isTest: boolean, queueId: string): Promise<PollChallenger> {
    const key = this.queueKey(queueId)
    if (key === null) return { status: 'not_found' }
    const ids = await this.prefetchJoinerIds(key, userId, isTest)
    return this.prisma.transaction(async () => {
      const q = await this.lock(key)
      if (!q || q.joinerUserId === null || idToString(q.joinerUserId) !== userId || q.isTest !== isTest) return { status: 'not_found' as const }
      if (q.joinerOutcome === 'rejected') return { status: 'rejected' as const }
      if (q.joinerOutcome === 'expired') return { status: 'expired' as const }
      if (q.joinerOutcome === 'matched') {
        let battleId = q.battleId
        if (!battleId) {
          battleId = await this.createWithJoiner(q, idToString(q.ownerId), q.joinerUserId, isTest, ids)
          await this.prisma.client.battleQueue.update({ where: { id: q.id }, data: { status: 'matched', battleId } })
        }
        return { status: 'matched' as const, battle_uuid: battleId }
      }
      if (q.status === 'matched' || q.status === 'expired' || q.status === 'abandoned') return { status: 'expired' as const }
      return { status: 'waiting' as const }
    })
  }

  /** Question draw for a joiner poll that will have to create the battle (accepted by the owner, no battle yet). */
  private async prefetchJoinerIds(key: bigint, joinerId: string, isTest: boolean): Promise<string[] | null | undefined> {
    const q = (await this.prisma.client.battleQueue.findUnique({ where: { id: key } })) as QueueRow | null
    if (!q || q.joinerUserId === null || idToString(q.joinerUserId) !== joinerId || q.isTest !== isTest || q.joinerOutcome !== 'matched' || q.battleId) return undefined
    return this.prefetchIds(key, idToString(q.ownerId), isTest, [q.status])
  }
}
