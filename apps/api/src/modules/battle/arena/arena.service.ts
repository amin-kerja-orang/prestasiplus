/**
 * Lobby and arena (M16-15 to M16-17; BR-M16-02, BR-M16-07, BR-M16-08). Scoring is server side only: the body carries
 * `questionId`, `optionId` and `seconds`, nothing else is read. The answer key is revealed only in the answer response of
 * the question just answered. A battle is visible to its two players only (anyone else: 404 "Battle tidak dijumpai.").
 */
import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { BATTLE_MESSAGES, BATTLE_RULES, GAMES_ROBOT_NAME, battleArenaPoints, battleWinner, type GamesReward } from '@pp/contract'

import { ApiError } from '../../../common/errors/api-error'
import { toMytTimestamp } from '../../../common/time/myt'
import { CLOCK, type Clock } from '../../../db/clock'
import { idToString } from '../../../db/ids'
import { PrismaService } from '../../../db/prisma.service'
import { startGameSweep } from '../../games/core/time'
import type { ArenaQuestionView } from '../battle.deps'
import { BattleEngine, botAnswers, gradeLabel, isUuid } from '../engine'
import { displayName } from '../privacy'

/** Subjects whose SPM pool the lobby counts at the same time. */
const LOBBY_PARALLEL = 4
const SWEEP_BATTLES = 200

type Side = 'A' | 'B'
interface Result {
  winner: Side | null
  scoreA: number
  scoreB: number
  reward?: GamesReward
}

const notFound = (message: string = BATTLE_MESSAGES.battleNotFound): ApiError => ApiError.of('NOT_FOUND', { message })
const invalid = (field: string, message: string): ApiError => ApiError.of('VALIDATION_ERROR', { message, fields: { [field]: message } })

const asRecord = (body: unknown): Record<string, unknown> =>
  typeof body === 'object' && body !== null && !Array.isArray(body) ? (body as Record<string, unknown>) : {}

/** A participant that is a user; a robot has no `user_id` (DM-60). */
const hasUser = <P extends { userId: bigint | null }>(p: P): p is P & { userId: bigint } => p.userId !== null

@Injectable()
export class ArenaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ArenaService.name)
  private stopSweep: () => void = () => undefined

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(BattleEngine) private readonly engine: BattleEngine,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    this.stopSweep = startGameSweep(ArenaService.name, this.config.get<string>('NODE_ENV'), () => this.sweepClocks())
  }

  onModuleDestroy(): void {
    this.stopSweep()
  }

  /** FR-GM-00.7: one pass over the active battles with a question past its time. Returns how many pupils timed out. */
  async sweepClocks(): Promise<number> {
    const cutoff = new Date(this.clock.now().getTime() - (await this.engine.questionLimitMs()))
    const due = await this.prisma.client.$queryRaw<{ id: string }[]>`
      SELECT b.id::text AS id FROM battles b
       WHERE b.status = 'active' AND b.created_at <= ${cutoff}
         AND NOT EXISTS (SELECT 1 FROM battle_answers a WHERE a.battle_id = b.id AND a.created_at > ${cutoff})
       ORDER BY b.created_at
       LIMIT ${SWEEP_BATTLES}`
    let timedOut = 0
    for (const { id } of due) {
      try {
        const battle = await this.prisma.client.battle.findUnique({ where: { id }, include: { participants: true } })
        for (const seat of battle?.participants.filter(hasUser).filter((p) => !p.isBot) ?? []) {
          if (await this.timeOutSeat(id, seat)) timedOut += 1
        }
      } catch (err) {
        this.logger.warn(`Battle clock failed for ${id}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
    return timedOut
  }

  /** The seat's question has run out: stores the timeout through the path of an answer. False when nothing is due or it moved first. */
  private async timeOutSeat(uuid: string, seat: { id: bigint; side: string; userId: bigint }): Promise<boolean> {
    const done = await this.prisma.client.battleAnswer.count({ where: { battleId: uuid, userId: seat.userId } })
    const battle = await this.prisma.client.battle.findUnique({ where: { id: uuid } })
    if (!battle || battle.status !== 'active' || done >= BATTLE_RULES.arenaQuestions) return false
    const served = await this.servedAt(uuid, seat.userId, done, battle.createdAt)
    if (this.clock.now().getTime() - served.getTime() <= (await this.engine.questionLimitMs())) return false
    const expected = await this.questionAt(uuid, done + 1)
    if (!expected) return false
    try {
      await this.store(uuid, seat, done, expected, null, BATTLE_RULES.questionSeconds, served)
      return true
    } catch (err) {
      if (err instanceof ApiError) return false // the pupil's own answer got in first, or the battle ended
      throw err
    }
  }

  /** When the pupil's question was served: the battle start (question 1), then the previous answer. */
  private async servedAt(uuid: string, userId: bigint, done: number, startedAt: Date): Promise<Date> {
    if (done === 0) return startedAt
    const previous = await this.prisma.client.battleAnswer.findUnique({ where: { battleId_userId_position: { battleId: uuid, userId, position: done } }, select: { createdAt: true } })
    return previous?.createdAt ?? startedAt
  }

  /** M16-15. */
  async lobby(who: { userId: string; role: string }) {
    const deps = this.engine.deps
    const grade = await deps.gradeOf(who.userId)
    const unlocked = grade !== null && grade >= BATTLE_RULES.spmMinGrade
    const subjects = (await deps.subjects()).sort((a, b) => (BigInt(a.id) < BigInt(b.id) ? -1 : 1))
    const out = {
      grade,
      gradeLabel: gradeLabel(grade),
      spmUnlocked: unlocked,
      subjects: subjects.map((s) => ({ id: s.id, name: s.name, icon: s.icon, colour: s.colour, core: s.core })),
      pkskDomains: (await deps.pkskDomains()).map((d) => ({ id: d.id, name: d.name, icon: d.icon, colour: d.colour })),
      pkskAccess: await deps.pkskAccess(who),
    }
    if (!unlocked) return out
    // Bounded parallelism: a few subjects at a time (the counts are cached by the deps).
    const withPool = new Set<string>()
    for (let i = 0; i < subjects.length; i += LOBBY_PARALLEL) {
      const batch = subjects.slice(i, i + LOBBY_PARALLEL)
      const counts = await Promise.all(batch.map((s) => deps.spmPoolCount(s.id)))
      batch.forEach((s, j) => (counts[j] ?? 0) > 0 && withPool.add(s.id))
    }
    return { ...out, spmSubjects: subjects.filter((s) => withPool.has(s.id)).map((s) => ({ id: s.id, name: s.name })) }
  }

  private async load(uuid: string, userId: string) {
    if (!isUuid(uuid)) throw notFound()
    const battle = await this.prisma.client.battle.findUnique({ where: { id: uuid }, include: { participants: true } })
    // A seat marked is_bot, also one from before FR-GM-00.4 that still points at a pupil, is not a participant: same not-found as a stranger.
    const mine = battle?.participants.filter(hasUser).find((p) => idToString(p.userId) === userId && !p.isBot)
    if (!battle || !mine) throw notFound()
    return { battle, mine }
  }

  private questionAt(uuid: string, position: number): Promise<{ questionId: bigint } | null> {
    return this.prisma.client.battleQuestion.findUnique({ where: { battleId_position: { battleId: uuid, position } }, select: { questionId: true } })
  }

  /** M16-16. */
  async view(uuid: string, userId: string) {
    const opened = await this.load(uuid, userId)
    // 48 section 3.3: a poll moves the clock too. A question past its time is a timeout, then the battle is read as it now stands.
    if (opened.battle.status === 'active') await this.timeOutSeat(uuid, opened.mine)
    const { battle, mine } = await this.load(uuid, userId)
    const a = battle.participants.find((p) => p.side === 'A')
    const b = battle.participants.find((p) => p.side === 'B')
    if (!a || !b) throw notFound()
    const done = await this.prisma.client.battleAnswer.count({ where: { battleId: uuid, userId: mine.userId } })
    const active = battle.status === 'active'
    let question: ArenaQuestionView | null = null
    if (active) {
      const row = await this.questionAt(uuid, done + 1)
      question = row ? await this.engine.deps.arenaQuestion(idToString(row.questionId)) : null
      if (!question) throw notFound(BATTLE_MESSAGES.questionNotFound)
    }
    const served = active ? await this.servedAt(uuid, mine.userId, done, battle.createdAt) : null
    const reward = active ? undefined : await this.engine.rewardOf(uuid, userId, battle.createdAt, battle.isTest)
    const people = await this.engine.deps.players([a, b].filter(hasUser).map((p) => idToString(p.userId)))
    // FR-GM-00.8, 48 section 3.10: the opponent by first given name, no school; `school` stays in the contract, always empty.
    // FR-MUR-21-9: a robot is "Robot PrestasiPlus", also on a seat from before FR-GM-00.4 that still points at a pupil.
    const player = (p: typeof a) => {
      if (p.isBot) return { name: GAMES_ROBOT_NAME, school: '', isBot: true }
      const name = (p.userId === null ? undefined : people.get(idToString(p.userId)))?.name ?? ''
      return { name: (p.side === mine.side ? name : displayName(name)) || 'Pelajar', school: '', isBot: false }
    }
    return {
      uuid,
      status: battle.status,
      you: mine.side as Side,
      players: { A: player(a), B: player(b) },
      scores: { A: a.score, B: b.score },
      index: Math.min(done + 1, BATTLE_RULES.arenaQuestions),
      total: BATTLE_RULES.arenaQuestions,
      question,
      secondsLeft: active ? BATTLE_RULES.questionSeconds : 0,
      ...(served ? { roundEndsAt: toMytTimestamp(new Date(served.getTime() + (await this.engine.questionLimitMs()))) } : {}),
      ...(active ? {} : { result: { winner: battle.winner as Side | null, scoreA: a.score, scoreB: b.score, ...(reward ? { reward } : {}) } as Result }),
    }
  }

  /**
   * M16-17. Everything that reads the owners' tables (grading, the next question, the bot accuracy) happens BEFORE the
   * transaction; the transaction then locks the battle row and re-checks that the caller's position did not move, so two
   * identical concurrent answers store one answer (the loser gets "Soalan tidak sah." like any replay).
   */
  async answer(uuid: string, userId: string, body: unknown) {
    const input = asRecord(body)
    const { battle, mine } = await this.load(uuid, userId)
    if (battle.status !== 'active') throw ApiError.of('CONFLICT', { message: BATTLE_MESSAGES.battleOver })
    const done = await this.prisma.client.battleAnswer.count({ where: { battleId: uuid, userId: mine.userId } })
    const expected = done < BATTLE_RULES.arenaQuestions ? await this.questionAt(uuid, done + 1) : null
    if (!expected) throw ApiError.of('CONFLICT', { message: BATTLE_MESSAGES.battleOver })
    const questionId = idToString(expected.questionId)
    if (input.questionId !== questionId) throw invalid('questionId', BATTLE_MESSAGES.questionInvalid)
    const raw = input.optionId ?? null
    if (raw !== null && !(typeof raw === 'number' && Number.isInteger(raw) && raw >= 0 && raw <= 3)) throw invalid('optionId', BATTLE_MESSAGES.answerInvalid)
    const optionId = raw as number | null
    const seconds = input.seconds
    if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0 || seconds > BATTLE_RULES.questionSeconds) {
      throw invalid('seconds', BATTLE_MESSAGES.timeInvalid)
    }
    return this.store(uuid, mine, done, expected, optionId, seconds, await this.servedAt(uuid, mine.userId, done, battle.createdAt))
  }

  /**
   * Grades and stores one answer or timeout of a seat. Time is the server's: the question was served when the battle started
   * (question 1) or when the previous answer was stored. The client's `seconds` can only make the answer slower, never faster.
   */
  private async store(uuid: string, mine: { id: bigint; side: string; userId: bigint }, done: number, expected: { questionId: bigint }, optionId: number | null, seconds: number, served: Date) {
    const userId = idToString(mine.userId)
    const questionId = idToString(expected.questionId)
    const now = this.clock.now()
    const elapsedMs = now.getTime() - served.getTime()
    const elapsed = Math.max(0, Math.floor(elapsedMs / 1000))
    const timedOut = elapsedMs > (await this.engine.questionLimitMs())
    const whole = timedOut ? BATTLE_RULES.questionSeconds : Math.min(BATTLE_RULES.questionSeconds, Math.max(Math.floor(seconds), elapsed))
    const graded = await this.engine.deps.gradeAnswer(questionId, timedOut ? null : optionId)
    if (!graded) throw notFound(BATTLE_MESSAGES.questionNotFound)
    const index = done + 1
    const last = index >= BATTLE_RULES.arenaQuestions
    const nextRow = last ? null : await this.questionAt(uuid, index + 1)
    const next = nextRow ? await this.engine.deps.arenaQuestion(idToString(nextRow.questionId)) : null
    if (!last && !next) throw notFound(BATTLE_MESSAGES.questionNotFound)
    const bot = botAnswers(uuid, await this.engine.botAccuracy())[done]
    if (!bot) throw notFound()

    const points = graded.correct ? battleArenaPoints(whole) : 0
    return this.prisma
      .transaction(async (tx) => {
        await this.prisma.client.$queryRaw`SELECT id FROM battles WHERE id = ${uuid}::uuid FOR UPDATE`
        const locked = await this.prisma.client.battle.findUnique({ where: { id: uuid }, include: { participants: true } })
        if (!locked) throw notFound()
        if (locked.status !== 'active') throw ApiError.of('CONFLICT', { message: BATTLE_MESSAGES.battleOver })
        // Another answer of the caller got in first: this position is no longer the next one.
        if ((await this.prisma.client.battleAnswer.count({ where: { battleId: uuid, userId: mine.userId } })) !== done) throw invalid('questionId', BATTLE_MESSAGES.questionInvalid)
        const opp = locked.participants.find((p) => p.side !== mine.side)
        if (!opp) throw notFound()
        await this.prisma.client.battleAnswer.create({
          data: { battleId: uuid, userId: mine.userId, position: index, questionId: expected.questionId, optionId: timedOut ? null : optionId, correct: graded.correct, seconds: whole, points, createdAt: now },
        })
        if (!locked.isTest) await this.engine.recordAnswer({ userId, battleId: uuid, questionId, position: index, isCorrect: graded.correct, answeredAt: now })
        // The opponent is simulated from its pre-drawn list (D53(a)); a row already there for this position is kept as it is.
        const simulated = await this.prisma.client.battleAnswer.createMany({
          data: [
            {
              battleId: uuid,
              userId: opp.userId,
              position: index,
              questionId: expected.questionId,
              optionId: bot.correct ? graded.correctOptionId : null,
              correct: bot.correct,
              seconds: bot.seconds,
              points: bot.points,
              createdAt: now,
            },
          ],
          skipDuplicates: true,
        })
        await this.prisma.client.battleParticipant.update({
          where: { id: mine.id },
          data: { score: { increment: points }, correct: { increment: graded.correct ? 1 : 0 } },
        })
        if (simulated.count === 1) {
          await this.prisma.client.battleParticipant.update({
            where: { id: opp.id },
            data: { score: { increment: bot.points }, correct: { increment: bot.correct ? 1 : 0 } },
          })
        }
        await this.prisma.client.battle.update({ where: { id: uuid }, data: { answered: Math.max(locked.answered, index) } })
        const meNow = await this.prisma.client.battleParticipant.findUniqueOrThrow({ where: { id: mine.id } })
        const oppNow = await this.prisma.client.battleParticipant.findUniqueOrThrow({ where: { id: opp.id } })
        const base = {
          correct: graded.correct,
          correctOptionId: graded.correctOptionId,
          points,
          you: { score: meNow.score },
          opponent: { answered: true as const, correct: bot.correct, score: oppNow.score },
        }
        if (!last) return { ...base, next: next as ArenaQuestionView }
        const scoreA = mine.side === 'A' ? meNow.score : oppNow.score
        const scoreB = mine.side === 'A' ? oppNow.score : meNow.score
        const winner = battleWinner(scoreA, scoreB)
        await this.prisma.client.battle.update({ where: { id: uuid }, data: { status: 'finished', winner, finishedAt: now } })
        const reward = await this.engine.report({ tx, battleId: uuid, startedAt: locked.createdAt, userId, side: mine.side as Side, winner, forfeited: false, robotsOnly: opp.isBot, correct: meNow.correct, total: index, isTest: locked.isTest })
        return { ...base, result: { winner, scoreA, scoreB, ...(reward ? { reward } : {}) } as Result }
      })
      .catch((e: unknown) => {
        // A unique violation on (battle, user, position) is a replay of an answered position.
        if (typeof e === 'object' && e !== null && (e as { code?: unknown }).code === 'P2002') throw invalid('questionId', BATTLE_MESSAGES.questionInvalid)
        throw e
      })
  }
}
