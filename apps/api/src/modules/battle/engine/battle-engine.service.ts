/**
 * What the queue, the invitations and the arena share (BE-44): the pool pre-check, battle creation (the chosen count of
 * questions drawn once) and the report of a finished battle to M14.
 */
import { Inject, Injectable } from '@nestjs/common'
import { BATTLE_MESSAGES, type BattleQuestionCount, type GamesReward } from '@pp/contract'

import type { TxClient } from '../../../db/client'
import { CLOCK, type Clock } from '../../../db/clock'
import { idFromString } from '../../../db/ids'
import { PrismaService } from '../../../db/prisma.service'
import { prngStream } from '../../../db/prng'
import { GameSettingsService, GamesPorts, PACE_GUARD_REWARD, gameAnswerEntry, hasFastGap, rewardBlock, rewardNow } from '../../games'
import { BattleDeps, type BattleStudent } from '../battle.deps'
import { rawInvalid } from '../raw-response'
import type { BattleParams } from './battle-params'

export type BattleMode = 'quick_match' | 'school_battle' | 'challenge' | 'queue_join'
export type QueueMode = 'quick_match' | 'school_battle'

/** How long both players see the key and the points of a closed round before the next one opens (48 GAME-01 timers: 3 s). */
export const BATTLE_REVEAL_MS = 3000

export interface BattleTiming {
  /** N: seconds a question lasts (`battle_question_seconds`); points are scored against it. */
  questionSeconds: number
  /** `battle_grace_seconds`: an answer inside it still counts, as s = N. */
  graceSeconds: number
  /** N + grace in ms: the answer window of a round. */
  limitMs: number
  revealMs: number
}

export interface BattleSide {
  id: string
  schoolId: string | null
}

@Injectable()
export class BattleEngine {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CLOCK) readonly clock: Clock,
    @Inject(BattleDeps) readonly deps: BattleDeps,
    @Inject(GamesPorts) private readonly ports: GamesPorts,
    @Inject(GameSettingsService) private readonly settings: GameSettingsService,
  ) {}

  /** The robot's chance of a correct answer (`battle_bot_accuracy_pct`), read per answer. */
  botAccuracy(): Promise<number> {
    return this.ports.platformAccuracy.accuracy()
  }

  /** FR-GM-00.5, 48 section 3.5: one row of mode `battle`, in the caller's transaction. Never for a robot or Mod Pelajar: the caller decides. */
  recordAnswer(a: { userId: string; battleId: string; questionId: string; position: number; isCorrect: boolean; answeredAt: Date }): Promise<unknown> {
    return this.ports.answers.record(gameAnswerEntry({ userId: a.userId, attemptId: a.battleId, questionId: a.questionId, gameKey: 'battle', position: a.position, isCorrect: a.isCorrect, answeredAt: a.answeredAt }))
  }

  /**
   * The round clock (48 GAME-01 timers): N = `battle_question_seconds`, the grace `battle_grace_seconds` and the reveal. An
   * answer window is N + grace long; both settings are read per call, so an admin change reaches the next evaluation.
   */
  async timing(): Promise<BattleTiming> {
    const questionSeconds = await this.settings.get('battle_question_seconds')
    const graceSeconds = await this.settings.get('battle_grace_seconds')
    return { questionSeconds, graceSeconds, limitMs: (questionSeconds + graceSeconds) * 1000, revealMs: BATTLE_REVEAL_MS }
  }

  /** The chip used when a start carries no `question_count` (`battle_questions_default`: 5, 10, 15 or 20). */
  async questionCountDefault(): Promise<BattleQuestionCount> {
    return (await this.settings.get('battle_questions_default')) as BattleQuestionCount
  }

  /** How long a Cabar Kawan invitation lasts (`battle_invitation_hours`). */
  async invitationMs(): Promise<number> {
    return (await this.settings.get('battle_invitation_hours')) * 3_600_000
  }

  /** `battle_daily_max`: Quick Match and Battle Sekolah battles a pupil may have per Malaysia day. */
  dailyMax(): Promise<number> {
    return this.settings.get('battle_daily_max')
  }

  /** How long a queue entry waits for a human before the robot (`battle_bot_fallback_seconds`); null: never a robot. */
  async robotFallbackMs(): Promise<number | null> {
    const seconds = await this.settings.get('battle_bot_fallback_seconds')
    return seconds === 0 ? null : seconds * 1000
  }

  /** A user as a battle side (any role: a Mod Pelajar account is not a student); null when the account is gone. */
  async player(userId: string): Promise<BattleStudent | null> {
    return (await this.deps.players([userId])).get(userId) ?? null
  }

  /**
   * Draws the `params.questionCount` question ids of a battle with the stream `streamName` (null when the pool is too small, BR-M16-03). Call
   * it BEFORE a transaction: the questions owner hydrates SPM pools with queries that must not share a transaction
   * connection.
   */
  async draw(params: BattleParams, ownerGrade: number | null, streamName: string): Promise<string[] | null> {
    const levelId = await this.deps.levelIdOfGrade(ownerGrade)
    return this.deps.drawQuestions(
      { questionType: params.questionType, subjectId: params.subjectId, levelId, pkskDomainId: params.pkskDomainId, pkskTargetLevel: params.pkskTargetLevel },
      params.questionCount,
      prngStream(streamName),
    )
  }

  /** True when `params.questionCount` eligible keyless questions can be drawn for the params at the owner's level (BR-M16-03). */
  async poolOk(params: BattleParams, ownerGrade: number | null, streamName: string): Promise<boolean> {
    return (await this.draw(params, ownerGrade, streamName)) !== null
  }

  /**
   * Creates an `active` battle with its two participants and its drawn questions (`params.questionCount`). Runs in the caller's transaction: when
   * the pool cannot give 10 questions the whole unit rolls back with 422 "Soalan tidak mencukupi.". Side `b` null is the
   * robot: a seat with no user and no school, in a battle that counts for no ranking (DM-60, 48 section 3.6).
   */
  async createBattle(args: {
    mode: BattleMode
    params: BattleParams
    a: BattleSide
    b: BattleSide | null
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
    const now = this.clock.now()
    const row = await this.prisma.client.battle.create({
      data: {
        mode: args.mode,
        questionType: params.questionType,
        subjectId: params.subjectId === null ? null : idFromString(params.subjectId),
        pkskDomainId: params.pkskDomainId === null ? null : idFromString(params.pkskDomainId),
        pkskTargetLevel: params.pkskTargetLevel,
        levelId: levelId === null ? null : idFromString(levelId),
        isTest,
        questionCount: params.questionCount,
        countsForRanking: b !== null,
        createdAt: now,
        // 48 GAME-01 timers: round 1 opens when the battle becomes active.
        roundStartedAt: now,
        participants: {
          create: [
            { side: 'A', userId: idFromString(a.id), schoolId: a.schoolId === null ? null : idFromString(a.schoolId), isBot: false, isTest },
            b === null
              ? { side: 'B', userId: null, schoolId: null, isBot: true, isTest }
              : { side: 'B', userId: idFromString(b.id), schoolId: b.schoolId === null ? null : idFromString(b.schoolId), isBot: false, isTest },
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

  /** Rule 5 of 48 section 3.4: a gap between the pupil's answers (the first: from the battle start) is under the minimum. */
  private async paceTripped(battleId: string, userId: string, startedAt: Date): Promise<boolean> {
    const rows = await this.prisma.client.battleAnswer.findMany({ where: { battleId, userId: idFromString(userId) }, orderBy: { position: 'asc' }, select: { createdAt: true } })
    return hasFastGap(startedAt, rows.map((r) => r.createdAt), await this.settings.get('games_min_ms_per_answer'))
  }

  /**
   * FR-GM-00.3, 48 section 3.4: the one reward of a pupil for a finished battle, in the caller's transaction. A forfeit gives
   * the leaver nothing and the other pupil the win; a fast gap credits nothing and makes no call; Mod Pelajar never reports.
   */
  async report(args: {
    tx: TxClient
    battleId: string
    startedAt: Date
    userId: string
    side: 'A' | 'B'
    winner: 'A' | 'B' | null
    forfeited: boolean
    robotsOnly: boolean
    correct: number
    total: number
    isTest: boolean
  }): Promise<GamesReward | undefined> {
    if (args.isTest) return undefined
    const won = args.winner === args.side
    const left = args.forfeited && !won
    if (!left && (await this.paceTripped(args.battleId, args.userId, args.startedAt))) return PACE_GUARD_REWARD
    const event = args.forfeited ? (won ? 'forfeit_win' : 'forfeit') : won ? 'win' : 'finish'
    const outcome = left ? 'forfeit' : won ? 'win' : args.winner === null ? 'draw' : 'play'
    const asked = await rewardNow(this.settings, args.tx, { correct: args.correct, outcome, robotsOnly: args.robotsOnly, fastGap: false })
    const out = await this.ports.rewards.onGameResult(
      args.userId,
      { game: 'battle', event, coins: asked.coins, xp: asked.xp, correct: args.correct, total: args.total, key: args.battleId, session: { id: args.battleId, gameKey: 'battle' } },
      { tx: args.tx, isTest: false },
    )
    return rewardBlock(out)
  }

  /** The reward block of a finished battle read again; nothing for Mod Pelajar. */
  async rewardOf(battleId: string, userId: string, startedAt: Date, isTest: boolean): Promise<GamesReward | undefined> {
    if (isTest) return undefined
    const first = await this.ports.rewards.firstGameResult(battleId, userId)
    if (first) return rewardBlock(first)
    return (await this.paceTripped(battleId, userId, startedAt)) ? PACE_GUARD_REWARD : undefined
  }
}
