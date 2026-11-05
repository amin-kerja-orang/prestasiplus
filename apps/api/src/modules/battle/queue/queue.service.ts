/**
 * Matchmaking queues (M16-02 to M16-06, M16-12, M16-13; BR-M16-03, BR-M16-04). Every mutation locks the queue row
 * (`SELECT ... FOR UPDATE`) inside one transaction, so two concurrent accepts create exactly one battle. A queue is
 * visible to its owner (and to its joiner for the joiner poll) only; anything else is the documented not-found answer.
 * Queues written under Mod Pelajar (`is_test`) only talk to Mod Pelajar sessions and the other way round.
 */
import { Inject, Injectable } from '@nestjs/common'
import { BATTLE_MESSAGES, BATTLE_RULES, type BattleQuestionCount } from '@pp/contract'

import { ApiError } from '../../../common/errors/api-error'
import { CLOCK, type Clock, startOfMytDay } from '../../../db/clock'
import { idFromString, idToString, isIdString } from '../../../db/ids'
import { PrismaService } from '../../../db/prisma.service'
import type { BattleStudent } from '../battle.deps'
import { type BattleParams, BattleEngine, gradeLabel, parseBattleParams, ParamRefusal, type QueueMode } from '../engine'
import { displayName } from '../privacy'
import { rawForbidden, rawInvalid, rawNotFound } from '../raw-response'

type Challenger = { name: string; grade_label: string; school: string }
export type PollMatch =
  | { status: 'waiting' | 'expired' | 'not_found' }
  | { status: 'incoming_challenge'; challenger: Challenger }
  | { status: 'matched'; battle_uuid: string; robot: boolean }
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
  questionCount: number
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
  /** The 10 drawn question ids, or null when the pool is too small. */
  ids: string[] | null
  forQueue: bigint
}

/** A human opponent found before the transaction, with the questions already drawn (the draw cannot share a transaction connection). */
interface HumanMatch {
  forQueue: bigint
  otherQueue: bigint
  /** Side A is the pupil whose entry waited longer. */
  a: BattleStudent
  b: BattleStudent
  /** The queue whose id names the draw stream (the older entry). */
  streamQueue: bigint
  ids: string[]
}

/** The queue modes that count for `battle_daily_max` (FR-GM-01.9). Cabar Kawan (`challenge`) is not limited. */
const DAILY_MODES = ['quick_match', 'school_battle']
/** Entries read per poll when looking for a human; the oldest fitting one wins. */
const CANDIDATES_READ = 25

/** Stream of the question draw of a queue's battle. */
const poolStream = (queueId: bigint): string => `m16:battle:${idToString(queueId)}:pool`

/** FR-PA-29, 48 GAME-01: the robot comes once the entry has waited `battle_bot_fallback_seconds` (null: never a robot). */
const robotDue = (q: QueueRow, now: Date, fallbackMs: number | null): boolean => fallbackMs !== null && now.getTime() - q.createdAt.getTime() >= fallbackMs

const paramsOf = (q: QueueRow): BattleParams => ({
  questionType: q.questionType as BattleParams['questionType'],
  subjectId: q.subjectId === null ? null : idToString(q.subjectId),
  pkskDomainId: q.pkskDomainId === null ? null : idToString(q.pkskDomainId),
  pkskTargetLevel: q.pkskTargetLevel as BattleParams['pkskTargetLevel'],
  openToAll: q.openToAll,
  questionCount: q.questionCount as BattleQuestionCount,
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
  async start(who: { userId: string; role: string }, isTest: boolean, mode: QueueMode, body: unknown): Promise<{ queue_id: string }> {
    const { userId } = who
    const grade = await this.engine.deps.gradeOf(userId)
    let params: BattleParams
    try {
      params = await parseBattleParams(body, grade, this.engine.deps, who, await this.engine.questionCountDefault())
    } catch (e) {
      if (e instanceof ParamRefusal) throw e.forbidden ? rawForbidden() : rawInvalid()
      throw e
    }
    // 48 GAME-01: Battle Sekolah needs a school; no text is sent on this route (BR-M16-03), so the answer is 422 {}.
    if (mode === 'school_battle' && ((await this.engine.player(userId))?.schoolId ?? null) === null) throw rawInvalid()
    const now = this.clock.now()
    await this.assertUnderDailyMax(userId, isTest, now)
    if (!(await this.engine.poolOk(params, grade, 'm16:pool-check'))) throw rawInvalid()
    const row = await this.prisma.client.battleQueue.create({
      data: {
        ownerId: idFromString(userId),
        mode,
        questionType: params.questionType,
        subjectId: params.subjectId === null ? null : idFromString(params.subjectId),
        pkskDomainId: params.pkskDomainId === null ? null : idFromString(params.pkskDomainId),
        pkskTargetLevel: params.pkskTargetLevel,
        questionCount: params.questionCount,
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

  /**
   * FR-GM-01.9, AC-GM-01.9, DOC DEFECT 32: how many Quick Match and Battle Sekolah battles the pupil has in the Malaysia day of
   * `now`. A battle counts when the pupil is a human participant, a robot opponent included; a queue entry that never became a
   * battle does not. This is the only place that counts.
   */
  async battlesToday(userId: string, isTest: boolean, now: Date): Promise<number> {
    const from = startOfMytDay(now)
    return this.prisma.client.battle.count({
      where: {
        mode: { in: DAILY_MODES },
        isTest,
        createdAt: { gte: from, lt: new Date(from.getTime() + 86_400_000) },
        participants: { some: { userId: idFromString(userId), isBot: false } },
      },
    })
  }

  /** 429 BATTLE_DAILY_LIMIT (ERR-GAME-05) at `battle_daily_max`; the next Malaysia day resets it. */
  private async assertUnderDailyMax(userId: string, isTest: boolean, now: Date): Promise<void> {
    if ((await this.battlesToday(userId, isTest, now)) < (await this.engine.dailyMax())) return
    const nextDay = startOfMytDay(now).getTime() + 86_400_000
    throw new ApiError({ code: 'BATTLE_DAILY_LIMIT', status: 429, message: BATTLE_MESSAGES.dailyLimit, retryAfter: Math.max(1, Math.ceil((nextDay - now.getTime()) / 1000)) })
  }

  /** The robot flag of a matched battle: true when its seat B is the robot. */
  private async isRobotBattle(battleId: string): Promise<boolean> {
    return (await this.prisma.client.battleParticipant.count({ where: { battleId, isBot: true } })) > 0
  }

  private async challengerOf(userId: bigint): Promise<Challenger> {
    const p = await this.engine.player(idToString(userId))
    if (!p) throw rawNotFound(BATTLE_MESSAGES.noOpponent)
    // FR-GM-00.8: first given name, no school (`school` stays in the contract, always empty).
    return { name: displayName(p.name) || 'Pelajar', grade_label: gradeLabel(p.grade), school: '' }
  }

  /** M16-04. */
  async pollMatch(userId: string, isTest: boolean, queueId: string): Promise<PollMatch> {
    const key = this.queueKey(queueId)
    if (key === null) return { status: 'not_found' }
    const fallback = await this.engine.robotFallbackMs()
    const human = await this.prefetchHumanMatch(key, userId, isTest)
    const prefetched = await this.prefetchRobotBattle(key, userId, isTest, fallback)
    return this.prisma.transaction(async () => {
      const q = await this.lock(key)
      // 48 GAME-01: "Batal" removes the entry at once, so the owner polls it like an entry that does not exist.
      if (!q || idToString(q.ownerId) !== userId || q.isTest !== isTest || q.status === 'cancelled') return { status: 'not_found' as const }
      if (q.status === 'matched' && q.battleId) return { status: 'matched' as const, battle_uuid: q.battleId, robot: await this.isRobotBattle(q.battleId) }
      if (q.status === 'expired' || q.status === 'abandoned' || q.status === 'matched') return { status: 'expired' as const }
      const now = this.clock.now()
      if (now.getTime() - (q.lastPolledAt ?? q.createdAt).getTime() > QUEUE_ABANDONED_MS) {
        await this.prisma.client.battleQueue.update({ where: { id: q.id }, data: { status: 'abandoned' } })
        return { status: 'expired' as const }
      }
      // The robot comes first: with a fallback equal to the queue time the entry must not expire on the same poll.
      const robotComes = q.status === 'waiting' && q.joinerOutcome !== 'pending' && robotDue(q, now, fallback)
      if (!robotComes && now.getTime() - q.createdAt.getTime() >= QUEUE_EXPIRES_MS) {
        await this.prisma.client.battleQueue.update({ where: { id: q.id }, data: { status: 'expired' } })
        return { status: 'expired' as const }
      }
      await this.prisma.client.battleQueue.update({
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
      // FR-GM-01.5: a pupil is matched before the robot; the robot only comes when no human fits.
      if (q.status === 'waiting' && human && human.forQueue === q.id) {
        const battleId = await this.matchWithHuman(q, human, isTest, now)
        if (battleId !== null) return { status: 'matched' as const, battle_uuid: battleId, robot: false }
      }
      if (robotComes) {
        const battleId = await this.matchWithRobot(q, userId, isTest, prefetched)
        return { status: 'matched' as const, battle_uuid: battleId, robot: true }
      }
      return { status: 'waiting' as const }
    })
  }

  /**
   * The owner and the draw of a queue whose robot is due (read before the transaction: the questions owner hydrates SPM
   * pools with queries that must not share a transaction connection). Null when this poll cannot match.
   */
  private async prefetchRobotBattle(key: bigint, userId: string, isTest: boolean, fallback: number | null): Promise<Prefetch | null> {
    const q = (await this.prisma.client.battleQueue.findUnique({ where: { id: key } })) as QueueRow | null
    if (!q || idToString(q.ownerId) !== userId || q.isTest !== isTest || q.status !== 'waiting' || !robotDue(q, this.clock.now(), fallback)) return null
    const owner = await this.engine.player(userId)
    if (!owner) return null
    return { owner, ids: await this.engine.draw(paramsOf(q), owner.grade, poolStream(q.id)), forQueue: q.id }
  }

  /**
   * FR-GM-01.5, 48 GAME-01 "Matchmaking": the oldest other waiting entry with the same mode, type, subject (or PKSK domain and
   * level) and count, never the same pupil, never abandoned or expired. The same Tingkatan, unless both pupils chose to be
   * seen by every Tingkatan (`open_to_all`). Battle Sekolah needs two different schools (a pupil with no school is never matched
   * with a human there). Reads and draws here, before the transaction; `matchWithHuman` re-checks under the locks.
   */
  private async prefetchHumanMatch(key: bigint, userId: string, isTest: boolean): Promise<HumanMatch | null> {
    const q = (await this.prisma.client.battleQueue.findUnique({ where: { id: key } })) as QueueRow | null
    if (!q || idToString(q.ownerId) !== userId || q.isTest !== isTest || q.status !== 'waiting' || q.joinerOutcome === 'pending') return null
    const now = this.clock.now()
    if (now.getTime() - (q.lastPolledAt ?? q.createdAt).getTime() > QUEUE_ABANDONED_MS || now.getTime() - q.createdAt.getTime() >= QUEUE_EXPIRES_MS) return null
    const me = await this.engine.player(userId)
    if (!me || (q.mode === 'school_battle' && me.schoolId === null)) return null
    const candidates = (await this.prisma.client.battleQueue.findMany({
      where: {
        id: { not: q.id },
        ownerId: { not: q.ownerId },
        status: 'waiting',
        mode: q.mode,
        isTest: q.isTest,
        questionType: q.questionType,
        subjectId: q.subjectId,
        pkskDomainId: q.pkskDomainId,
        pkskTargetLevel: q.pkskTargetLevel,
        questionCount: q.questionCount,
        OR: [{ joinerOutcome: null }, { joinerOutcome: { not: 'pending' } }],
        createdAt: { gt: new Date(now.getTime() - QUEUE_EXPIRES_MS) },
        lastPolledAt: { gte: new Date(now.getTime() - QUEUE_ABANDONED_MS) },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: CANDIDATES_READ,
    })) as QueueRow[]
    for (const c of candidates) {
      const other = await this.engine.player(idToString(c.ownerId))
      if (!other || !this.fits(q, me, c, other)) continue
      const meFirst = q.createdAt.getTime() < c.createdAt.getTime() || (q.createdAt.getTime() === c.createdAt.getTime() && q.id < c.id)
      const [a, b] = meFirst ? [me, other] : [other, me]
      const streamQueue = meFirst ? q.id : c.id
      const ids = await this.engine.draw(paramsOf(q), a.grade, poolStream(streamQueue))
      if (ids === null) continue
      return { forQueue: q.id, otherQueue: c.id, a, b, streamQueue, ids }
    }
    return null
  }

  /** Same Tingkatan unless both are open to all; a school battle needs two schools that differ. */
  private fits(q: QueueRow, me: BattleStudent, c: QueueRow, other: BattleStudent): boolean {
    if (me.grade !== other.grade && !(q.openToAll && c.openToAll)) return false
    if (q.mode === 'school_battle') return other.schoolId !== null && me.schoolId !== null && other.schoolId !== me.schoolId
    return true
  }

  /**
   * Creates the battle of two waiting pupils in the poller's transaction (the poller's row is already locked). The other
   * row is locked with SKIP LOCKED, so two pupils polling at once never wait for each other: the one that cannot lock simply
   * tries again on its next poll. Null when the other entry moved on (matched, cancelled, expired, a joiner arrived).
   */
  private async matchWithHuman(q: QueueRow, human: HumanMatch, isTest: boolean, now: Date): Promise<string | null> {
    const locked = await this.prisma.client.$queryRaw<{ id: bigint }[]>`SELECT id FROM battle_queues WHERE id = ${human.otherQueue} FOR UPDATE SKIP LOCKED`
    if (locked.length === 0) return null
    const c = (await this.prisma.client.battleQueue.findUnique({ where: { id: human.otherQueue } })) as QueueRow | null
    if (
      !c ||
      c.status !== 'waiting' ||
      c.joinerOutcome === 'pending' ||
      c.isTest !== isTest ||
      c.ownerId === q.ownerId ||
      now.getTime() - (c.lastPolledAt ?? c.createdAt).getTime() > QUEUE_ABANDONED_MS ||
      now.getTime() - c.createdAt.getTime() >= QUEUE_EXPIRES_MS
    ) {
      return null
    }
    const battleId = await this.engine.createBattle({
      mode: q.mode as QueueMode,
      params: paramsOf(q),
      a: { id: human.a.id, schoolId: human.a.schoolId },
      b: { id: human.b.id, schoolId: human.b.schoolId },
      isTest,
      ownerGrade: human.a.grade,
      drawStream: poolStream(human.streamQueue),
      questionIds: human.ids,
    })
    await this.prisma.client.battleQueue.updateMany({ where: { id: { in: [q.id, c.id] } }, data: { status: 'matched', battleId, challengerUserId: null } })
    return battleId
  }

  private async matchWithRobot(q: QueueRow, ownerId: string, isTest: boolean, prefetched: Prefetch | null): Promise<string> {
    const ready = prefetched !== null && prefetched.forQueue === q.id ? prefetched : null
    const owner = ready?.owner ?? (await this.engine.player(ownerId))
    if (!owner) throw rawNotFound(BATTLE_MESSAGES.noOpponent)
    const battleId = await this.engine.createBattle({
      mode: q.mode as QueueMode,
      params: paramsOf(q),
      a: { id: owner.id, schoolId: owner.schoolId },
      b: null,
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

  /**
   * API-GAME-14, the "Batal" of the queue overlay. Another pupil's entry, an unknown id and an entry that already has its
   * battle are the same 404; an entry that already ended answers the same success.
   * Stored as `cancelled` (48 GAME-01), which is never matched and polls as `not_found`; a pending joiner polls `expired`.
   */
  async cancel(userId: string, isTest: boolean, queueId: string): Promise<{ cancelled: true }> {
    const notFound = () => ApiError.of('NOT_FOUND', { message: BATTLE_MESSAGES.queueNotFound })
    const key = this.queueKey(queueId)
    if (key === null) throw notFound()
    return this.prisma.transaction(async () => {
      const q = await this.lock(key)
      if (!q || idToString(q.ownerId) !== userId || q.isTest !== isTest || q.status === 'matched') throw notFound()
      if (q.status === 'waiting' || q.status === 'incoming_challenge') {
        await this.prisma.client.battleQueue.update({
          where: { id: q.id },
          data: { status: 'cancelled', challengerUserId: null, ...(q.joinerOutcome === 'pending' ? { joinerOutcome: 'expired' } : {}) },
        })
      }
      return { cancelled: true as const }
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
      if (q.status === 'matched' || q.status === 'expired' || q.status === 'abandoned' || q.status === 'cancelled') return { status: 'expired' as const }
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
