import { Module } from '@nestjs/common'

import { ThrottleModule } from '../../common/throttle'
import { StreakService } from './streak.service'
import { MeGamificationController, WalletController } from './wallet.controller'
import { WalletRepository } from './wallet.repository'
import { WalletService } from './wallet.service'

/**
 * M14 wallet, ledger and streak core (BE-11). Exports `WalletService` and `StreakService` for the modules
 * that credit or debit (practice BE-12, exams BE-16, missions BE-18, gamification and the shop BE-23, games
 * BE-44/45). The repository is NOT exported: nothing else may touch the wallet tables.
 */
@Module({
  imports: [ThrottleModule],
  controllers: [WalletController, MeGamificationController],
  providers: [WalletRepository, WalletService, StreakService],
  exports: [WalletService, StreakService],
})
export class WalletModule {}
