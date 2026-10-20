/**
 * What the queue, the invitations and the arena share (BE-44): the pool pre-check, the bot pick, battle creation
 * (ten questions drawn once) and the report of a finished battle to M14.
 */
import { Inject, Injectable } from '@nestjs/common'
import { BATTLE_MESSAGES, BATTLE_RULES } from '@pp/contract'

import { CLOCK, type Clock } from '../../../db/clock'
import { idFromString } from '../../../db/ids'
import { PrismaService } from '../../../db/prisma.service'
import { prngStream } from '../../../db/prng'
import { BattleDeps, type BattleStudent } from '../battle.deps'
import { GAME_RESULT_PORT, type GameResultEvent, type GameResultPort } from '../game-result.port'
import { rawInvalid } from '../raw-response'
import type { BattleParams } from './battle-params'
import { pickBot } from './bots'

export type BattleMode = 'quick_match' | 'school_battle' | 'challenge' | 'queue_join'
export type QueueMode = 'quick_match' | 'school_battle'

export interface BattleSide {
  id: string
  schoolId: string | null
}

@Injectable()
export class BattleEngine {
  private accuracy: Promise<number> | null = null

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CLOCK) readonly clock: Clock,
    @Inject(BattleDeps) readonly deps: BattleDeps,
    @Inject(GAME_RESULT_PORT) private readonly port: GameResultPort,
  ) {}

  /** The platform answer accuracy for the bots, read once per process start. */
  botAccuracy(): Promise<number> {
    this.accuracy ??= this.deps.platformAccuracy()
    return this.accuracy
  }

  /** A user as a battle side (any role: a Mod Pelajar account is not a student); null when the account is gone. */
  async player(userId: string): Promise<BattleStudent | null> {
    return (await this.deps.players([userId])).get(userId) ?? null
  }

  /**
   * Draws the 10 question ids of a battle with the stream `streamName` (null when the pool is too small, BR-M16-03). Call
   * it BEFORE a transaction: the questions owner hydrates SPM pools with queries that must not share a transaction
   * connection.
   */
  async draw(params: BattleParams, ownerGrade: number | null, streamName: string): Promise<string[] | null> {
    const levelId = await this.deps.levelIdOfGrade(ownerGrade)
    return this.deps.drawQuestions(
      { questionType: params.questionType, subjectId: params.subjectId, levelId },
      BATTLE_RULES.arenaQuestions,
      prngStream(streamName),
    )
  }

  /** True when 10 eligible keyless questions can be drawn for the params at the owner's level (BR-M16-03). */
  async poolOk(params: BattleParams, ownerGrade: number | null, streamName: string): Promise<boolean> {
    return (await this.draw(params, ownerGrade, streamName)) !== null
  }

  /** The opponent of a queue, picked with the stream `m16:battle:<queueId>`; null when no student can be found. */
  async pickOpponent(queueId: string, owner: BattleStudent, mode: QueueMode, openToAll: boolean): Promise<BattleStudent | null> {
    const candidates = await this.deps.activeStudents({ excludeIds: new Set([owner.id]) })
    return pickBot({ id: owner.id, grade: owner.grade, schoolId: owner.schoolId }, mode, openToAll, candidates, prngStream(`m16:battle:${queueId}`))
  }

  /**
   * Creates an `active` battle with its two participants and 10 drawn questions. Runs in the caller's transaction: when
   * the pool cannot give 10 questions the whole unit rolls back with 422 "Soalan tidak mencukupi.".
   */
  async createBattle(args: {
    mode: BattleMode
    params: BattleParams
    a: BattleSide
    b: BattleSide
    bIsBot: boolean
    isTest: boolean
    ownerGrade: number | null
    /** Ids drawn before the transaction (`draw`); undefined draws here, null means the pool was too small. */
    questionIds?: string[] | null
    /** Stream name of the draw when `questionIds` is undefined. */
    drawStream: string
  }): Promise<string> {
    const { params, a, b, isTest } = args
    const levelId = await this.deps.levelIdOfGrade(args.ownerGrade)
    const ids = args.questionIds === undefined ? await this.draw(params, args.ownerGrade, args.drawStream) : args.questionIds
    if (ids === null) throw rawInvalid(BATTLE_MESSAGES.poolTooSmall)
    const row = await this.prisma.client.battle.create({
      data: {
        mode: args.mode,
        questionType: params.questionType,
        subjectId: params.subjectId === null ? null : idFromString(params.subjectId),
        pkskDomainId: params.pkskDomainId === null ? null : idFromString(params.pkskDomainId),
        pkskTargetLevel: params.pkskTargetLevel,
        levelId: levelId === null ? null : idFromString(levelId),
        isTest,
        createdAt: this.clock.now(),
        participants: {
          create: [
            { side: 'A', userId: idFromString(a.id), schoolId: a.schoolId === null ? null : idFromString(a.schoolId), isBot: false, isTest },
            { side: 'B', userId: idFromString(b.id), schoolId: b.schoolId === null ? null : idFromString(b.schoolId), isBot: args.bIsBot, isTest },
          ],
        },
      },
      select: { id: true },
    })
    await this.prisma.client.battleQuestion.createMany({
      data: ids.map((q, i) => ({ battleId: row.id, position: i + 1, questionId: idFromString(q) })),
    })
    return row.id
  }

  /** M14 `onGameResult` for the caller at the end of a battle (AC 12): coins 0, xp 0. */
  async report(args: { userId: string; side: 'A' | 'B'; winner: 'A' | 'B' | null; forfeited: boolean; correct: number; total: number; isTest: boolean }): Promise<void> {
    const won = args.winner === args.side
    const event: GameResultEvent = args.forfeited ? (won ? 'forfeit_win' : 'forfeit') : won ? 'win' : 'finish'
    await this.port.onGameResult({ userId: args.userId, game: 'battle', event, coins: 0, xp: 0, correct: args.correct, total: args.total, isTest: args.isTest })
  }
}
