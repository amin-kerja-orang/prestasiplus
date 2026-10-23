import { Inject, Injectable } from '@nestjs/common'

import type { TxClient } from '../../db/client'
import type { GameResultInput, GameResultOutcome, GameRewardsPort } from '../games'
import { GamificationService } from './gamification.service'

/**
 * The real `GameRewardsPort` of the games module (BE-45): a thin pass-through to `GamificationService`
 * (`canEarnSyiling`, the tier's board-game rates, `onGameResult`). Bound by `GamificationModule.onModuleInit`
 * through `GamesPorts.provideRewards`. Mod Pelajar (`isTest`) never earns: no call reaches the service.
 */
@Injectable()
export class GamesRewardsAdapter implements GameRewardsPort {
  constructor(@Inject(GamificationService) private readonly gamification: GamificationService) {}

  canEarnSyiling(userId: string, options: { tx?: TxClient } = {}): Promise<boolean> {
    return this.gamification.canEarnSyiling(userId, options.tx ? { tx: options.tx } : {})
  }

  tierRates(userId: string, options: { tx?: TxClient } = {}): Promise<{ correct: number; win: number }> {
    return this.gamification.boardGameRates(userId, options.tx ? { tx: options.tx } : {})
  }

  async onGameResult(userId: string, input: GameResultInput, options: { tx?: TxClient; isTest: boolean }): Promise<GameResultOutcome> {
    if (options.isTest) return { coinsCredited: 0, xpAdded: 0 }
    return this.gamification.onGameResult(userId, input, options.tx ? { tx: options.tx, isTest: false } : { isTest: false })
  }
}
