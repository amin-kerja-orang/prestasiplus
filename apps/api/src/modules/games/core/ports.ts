/**
 * Ports of the games module (BE-45). Same pattern as `PracticePorts`: the holder is exported by `GamesCoreModule`;
 * the owning card (or the lead) plugs the real adapter in from its own `onModuleInit`, tests before `app.init()`.
 * Registering one twice is a wiring error and throws.
 *
 * - `rewards`          BE-23 (`GamificationService.onGameResult` / `canEarnSyiling`). Default `WalletGameRewards`
 *                      (copies BE-23 semantics, credits through `WalletService`) but `canEarnSyiling` is FALSE until
 *                      BE-23 merges, because the `games_award_syiling` setting (seed 0) lives in BE-23. On the
 *                      BE-23 merge the lead rebinds this port to `GamificationService` (provideRewards).
 * - `platformAccuracy` The robots' chance of a correct answer, `p`. Default: the setting `battle_bot_accuracy_pct` (48 section 3.6).
 * - `battle`           BE-44 (`BattleReadService.hasBattled`). Default: false.
 */
import { Inject, Injectable } from '@nestjs/common'

import type { TxClient } from '../../../db/client'
import { AnswerLogPort, type AnswerLogEntry } from '../../practice/answer-log.port'
import { GameSettingsService } from './game-settings.service'
import { WalletGameRewards } from './wallet-rewards'

/* ---------------------------------------------------------------------------------------- rewards */

/** Same shape as BE-23 `onGameResult` input. `key` is the idempotency key (room code, session uuid, spin date). */
export interface GameResultInput {
  /** M14 game token: `papan_bijak`, `benteng_ilmu`, `perang_fakta`, `mathrace`, `jutawan`, `roda_nasib`, `betul_salah`, `cabaran_kilat`... */
  game: string
  event: string
  /** Absent for `papan_bijak`: the port uses the tier rates. */
  coins?: number
  /** Always 0 for games (BR-M16-28). */
  xp: number
  correct?: number
  total?: number
  detail?: Record<string, unknown>
  key?: string
  /**
   * The game session of this result (DM-87). With it, `GamificationService` records the one reward event of the
   * session and pupil and applies the daily caps; without it (Roda Nasib) the result stays on `key`.
   */
  session?: GameResultSession
}

export interface GameResultSession {
  /** `game_rooms.session_id` or the solo session uuid. */
  id: string
  /** The game key of 48 section 3.5 (`betul-salah`), not the M14 token: the ledger source is `game:<game key>`. */
  gameKey: string
}

/** Which daily cap of 48 section 3.4 rule 4 reduced a reward. */
export type GameRewardCapReason = 'xp_cap' | 'syiling_cap' | 'xp_and_syiling_cap'

export interface GameResultOutcome {
  coinsCredited: number
  xpAdded: number
  /** Only for a result with `session`: the cap that reduced it, or null. */
  cappedReason?: GameRewardCapReason | null
}

export interface GameRewardsPort {
  /** `games_award_syiling` = 1 and the user's coins enabled. */
  canEarnSyiling(userId: string, options?: { tx?: TxClient }): Promise<boolean>
  /** Papan Bijak coins per correct answer / per win of the user's tier. Default {0,0}. */
  tierRates(userId: string, options?: { tx?: TxClient }): Promise<{ correct: number; win: number }>
  /**
   * Reports one game result; credits syiling only when allowed, idempotent per `(game source, key)`.
   * Mod Pelajar (`isTest`): callers must NOT call this at all (the actor never earns); an implementation
   * still returns `{0, 0}` for `isTest` as a second guard.
   */
  onGameResult(userId: string, input: GameResultInput, options: { tx?: TxClient; isTest: boolean }): Promise<GameResultOutcome>
}

/* ------------------------------------------------------------------------------ platform accuracy */

export interface PlatformAccuracySource {
  /** The robots' probability of a correct answer, 0..1. */
  accuracy(): Promise<number>
}

/** Read per call, so a saved change applies to the next answer (48 section 2). */
export class RobotAccuracySetting implements PlatformAccuracySource {
  constructor(private readonly settings: GameSettingsService) {}

  async accuracy(): Promise<number> {
    return (await this.settings.get('battle_bot_accuracy_pct')) / 100
  }
}

/* ------------------------------------------------------------------------------------------ battle */

export interface BattleReadPort {
  /** The user has a finished or forfeited battle (BE-44 `BattleReadService.hasBattled`). */
  hasBattled(userId: string): Promise<boolean>
}

export class NoBattle implements BattleReadPort {
  async hasBattled(): Promise<boolean> {
    return false
  }
}

/* ------------------------------------------------------------------------------------------ answers */

/**
 * FR-GM-00.5, 48 section 3.5: the row of one answered or timed-out bank question. Marks follow `isCorrect`, a timeout is
 * not correct. The pupil's pick and seconds stay in the per-game logs. Mod Pelajar writes no row at all: callers skip it.
 */
export function gameAnswerEntry(a: { userId: string; attemptId: string; questionId: string; gameKey: string; position: number; isCorrect: boolean; answeredAt: Date }): AnswerLogEntry {
  return {
    userId: a.userId,
    attemptId: a.attemptId,
    questionId: a.questionId,
    partRef: `${a.gameKey}#${String(a.position)}`,
    mode: a.gameKey === 'battle' ? 'battle' : 'game',
    isCorrect: a.isCorrect,
    marksAwarded: a.isCorrect ? 1 : 0,
    marksMax: 1,
    answeredAt: a.answeredAt,
    isTest: false,
  }
}

/* -------------------------------------------------------------------------------------- the holder */

@Injectable()
export class GamesPorts {
  private rewardsPort: GameRewardsPort
  private accuracySource: PlatformAccuracySource
  private battlePort: BattleReadPort = new NoBattle()
  private readonly bound = new Set<string>()

  constructor(
    @Inject(WalletGameRewards) rewards: WalletGameRewards,
    @Inject(GameSettingsService) settings: GameSettingsService,
    /** The one writer of `practice_answers` (S5-T15); joins the caller's transaction. */
    @Inject(AnswerLogPort) readonly answers: AnswerLogPort,
  ) {
    this.rewardsPort = rewards
    this.accuracySource = new RobotAccuracySetting(settings)
  }

  get rewards(): GameRewardsPort {
    return this.rewardsPort
  }
  get platformAccuracy(): PlatformAccuracySource {
    return this.accuracySource
  }
  get battle(): BattleReadPort {
    return this.battlePort
  }

  private once(name: string): void {
    if (this.bound.has(name)) throw new Error(`GamesPorts: the ${name} is already set`)
    this.bound.add(name)
  }

  /** BE-23 (GamificationService). */
  provideRewards(port: GameRewardsPort): void {
    this.once('rewards port')
    this.rewardsPort = port
  }
  /** BE-13. */
  providePlatformAccuracy(source: PlatformAccuracySource): void {
    this.once('platform accuracy source')
    this.accuracySource = source
  }
  /** BE-44. */
  provideBattle(port: BattleReadPort): void {
    this.once('battle port')
    this.battlePort = port
  }
}
