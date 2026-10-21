/**
 * Ports of the games module (BE-45). Same pattern as `PracticePorts`: the holder is exported by `GamesCoreModule`;
 * the owning card (or the lead) plugs the real adapter in from its own `onModuleInit`, tests before `app.init()`.
 * Registering one twice is a wiring error and throws.
 *
 * - `rewards`          BE-23 (`GamificationService.onGameResult` / `canEarnSyiling`). Default `WalletGameRewards`
 *                      (copies BE-23 semantics, credits through `WalletService`) but `canEarnSyiling` is FALSE until
 *                      BE-23 merges, because the `games_award_syiling` setting (seed 0) lives in BE-23. On the
 *                      BE-23 merge the lead rebinds this port to `GamificationService` (provideRewards).
 * - `weeklyPractice`   BE-13 (weekly practice ranking). Default: empty board.
 * - `platformAccuracy` BE-13 (platform answer accuracy, the bots' `p`). Default: the mock's fallback (0).
 * - `battle`           BE-44 (`BattleReadService.hasBattled`). Default: false.
 * - `botPool`          bot picker. Default: students of the host's school (school-scoped; a platform-wide pick needs a BE-05 read).
 */
import { Inject, Injectable } from '@nestjs/common'

import type { TxClient } from '../../../db/client'
import { BOT_ACCURACY_FALLBACK } from '../games.constants'
import { SchoolBotPool } from './bot-pool'
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
}

export interface GameResultOutcome {
  coinsCredited: number
  xpAdded: number
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

/* ---------------------------------------------------------------------------- weekly practice board */

export interface WeeklyPracticeRow {
  rank: number
  userId: string
  name: string
  sesi: number
  betul: number
  tepat: number
}

export interface WeeklyPracticeSource {
  /** The weekly practice ranking of `[weekStart, weekEnd]` (is_test rows excluded by the source). `me` null when unranked. */
  week(userId: string, weekStart: Date, weekEnd: Date): Promise<{ me: { rank: number; betul: number } | null; rows: WeeklyPracticeRow[] }>
}

export class NoWeeklyPractice implements WeeklyPracticeSource {
  async week(): Promise<{ me: null; rows: [] }> {
    return { me: null, rows: [] }
  }
}

/* ------------------------------------------------------------------------------ platform accuracy */

export interface PlatformAccuracySource {
  /** Platform answer accuracy 0..1 (the bots' probability of a correct answer). */
  accuracy(): Promise<number>
}

export class FallbackPlatformAccuracy implements PlatformAccuracySource {
  async accuracy(): Promise<number> {
    return BOT_ACCURACY_FALLBACK
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

/* --------------------------------------------------------------------------------------- bot pool */

export interface BotCandidate {
  id: string
  /** Display name only (D54(d)). */
  name: string
  grade: number | null
}

export interface BotPickInput {
  /** The room host: its school scopes the pool. */
  hostId: string
  /** Whether a candidate's grade fits the room (use `gradeFits`). */
  fits: (grade: number | null) => boolean
  /** User ids already in the room (and the host). */
  exclude: readonly string[]
  /** Named PRNG stream, e.g. `games:bot:<roomCode>:<n>`. */
  stream: string
}

export interface BotPoolPort {
  /** One fictitious student of a fitting grade not in `exclude`, or null when none exists. Deterministic per stream. */
  pick(input: BotPickInput): Promise<BotCandidate | null>
}

/* -------------------------------------------------------------------------------------- the holder */

@Injectable()
export class GamesPorts {
  private rewardsPort: GameRewardsPort
  private weeklySource: WeeklyPracticeSource = new NoWeeklyPractice()
  private accuracySource: PlatformAccuracySource = new FallbackPlatformAccuracy()
  private battlePort: BattleReadPort = new NoBattle()
  private botPoolPort: BotPoolPort
  private readonly bound = new Set<string>()

  constructor(@Inject(WalletGameRewards) rewards: WalletGameRewards, @Inject(SchoolBotPool) bots: SchoolBotPool) {
    this.rewardsPort = rewards
    this.botPoolPort = bots
  }

  get rewards(): GameRewardsPort {
    return this.rewardsPort
  }
  get weeklyPractice(): WeeklyPracticeSource {
    return this.weeklySource
  }
  get platformAccuracy(): PlatformAccuracySource {
    return this.accuracySource
  }
  get battle(): BattleReadPort {
    return this.battlePort
  }
  get botPool(): BotPoolPort {
    return this.botPoolPort
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
  provideWeeklyPractice(source: WeeklyPracticeSource): void {
    this.once('weekly practice source')
    this.weeklySource = source
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
  provideBotPool(port: BotPoolPort): void {
    this.once('bot pool')
    this.botPoolPort = port
  }
}
