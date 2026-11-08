/**
 * Port to the M14 `onGameResult` entry point (BE-44 AC 12, Open question 1). Battles report the caller at the end of a
 * battle (finished or forfeited) with coins 0 and xp 0, so the call changes no wallet or ledger row. The real owner of
 * M14 `onGameResult` (default proposal: BE-23) is not merged, so the provider below is a no-op. When the owner exists it
 * rebinds `GAME_RESULT_PORT` (`{ provide: GAME_RESULT_PORT, useExisting: ... }`); no battle test may depend on the effect.
 */
import { Injectable } from '@nestjs/common'

export type GameResultEvent = 'win' | 'finish' | 'forfeit' | 'forfeit_win'

export interface GameResultReport {
  userId: string
  game: 'battle'
  event: GameResultEvent
  /** Always 0 for a battle. */
  coins: 0
  /** Always 0 for a battle. */
  xp: 0
  correct: number
  total: number
  /** Mod Pelajar session: the owner must not credit anything. */
  isTest: boolean
}

export interface GameResultPort {
  onGameResult(report: GameResultReport): Promise<void>
}

export const GAME_RESULT_PORT = Symbol('GAME_RESULT_PORT')

/** Default binding: does nothing. */
@Injectable()
export class NoopGameResultPort implements GameResultPort {
  async onGameResult(): Promise<void> {}
}
