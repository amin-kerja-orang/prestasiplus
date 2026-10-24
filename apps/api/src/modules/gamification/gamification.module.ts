import { Inject, Module, type OnModuleInit } from '@nestjs/common'

import { AuditModule } from '../../common/audit'
import { ThrottleModule } from '../../common/throttle'
import { AccountPorts, AccountPortsModule } from '../account/registration-ports'
import { ClassesModule } from '../classes'
import { GamesCoreModule, GamesPorts } from '../games'
import { PerformanceModule } from '../reports/performance/performance.module'
import { PerformancePorts } from '../reports/performance/ports'
import { WalletModule } from '../wallet'
import { GamificationAdminController, RewardControlController } from './admin.controller'
import { GamificationAdminService } from './admin.service'
import { GamesRewardsAdapter } from './games-rewards.adapter'
import { GamificationController } from './gamification.controller'
import { GamificationRegistrationHook } from './registration-hook'
import { GamificationRepository } from './gamification.repository'
import { GamificationService } from './gamification.service'
import { PerformanceGamificationAdapter } from './performance-gamification.adapter'
import { GamificationPorts } from './ports'

/**
 * M14 gamification beyond the wallet core (BE-23): the student routes (dashboard, challenges, achievements,
 * leaderboard, referral, share cards, convert), the admin economy and operations routes, and the entry points
 * other cards call inside their own transaction (`GamificationService.settleChallenges`, `claimChallenge`,
 * `unlockAchievement`, `onGameResult`, `canEarnSyiling`, `applyReferral`; `GamificationAdminService.runDraw`).
 * Every movement goes through `WalletService` (BE-11); the repository reads the wallet tables and writes none of
 * them. The teacher economy is NOT built (D53/OWN-10): no `/guru/gamification*` route exists.
 *
 * `GamificationPorts` carries what M14 reads but M05 owns (practice day facts, mastery, session counts); BE-12/13
 * call `ports.providePracticeFacts(...)` from their own `onModuleInit`. Until then it answers "nothing yet".
 *
 * On init it also binds the registration hook into `AccountPorts` (`applyReferral`, XR-M14-02(b)), `GamesRewardsAdapter` into the games' `GamesPorts.rewards` (BE-45), and
 * `PerformanceGamificationAdapter` into BE-19's `PerformancePorts` (the reports'
 * `GamificationReadPort`: public profile, rankings).
 * `ClassesModule` (BE-17, owner of classes and enrolments) gives the teacher's pupils for the leaderboard name scope (#76).
 */
@Module({
  imports: [AuditModule, ThrottleModule, AccountPortsModule, WalletModule, PerformanceModule, ClassesModule, GamesCoreModule],
  controllers: [GamificationController, GamificationAdminController, RewardControlController],
  providers: [GamificationRepository, GamificationService, GamificationAdminService, GamificationPorts, PerformanceGamificationAdapter, GamesRewardsAdapter, GamificationRegistrationHook],
  exports: [GamificationService, GamificationAdminService, GamificationPorts],
})
export class GamificationModule implements OnModuleInit {
  constructor(
    @Inject(PerformancePorts) private readonly performance: PerformancePorts,
    @Inject(PerformanceGamificationAdapter) private readonly gamificationRead: PerformanceGamificationAdapter,
    @Inject(GamesPorts) private readonly gamesPorts: GamesPorts,
    @Inject(GamesRewardsAdapter) private readonly gamesRewards: GamesRewardsAdapter,
    @Inject(AccountPorts) private readonly accountPorts: AccountPorts,
    @Inject(GamificationRegistrationHook) private readonly registrationHook: GamificationRegistrationHook,
  ) {}

  /** Binds the real gamification read port of BE-19's reports (once; `provideGamification` throws on a second call). */
  onModuleInit(): void {
    this.performance.provideGamification(this.gamificationRead)
    // D-13: the games' syiling follows `games_award_syiling` (seed 0 = XP only) instead of the never-earning default.
    this.gamesPorts.provideRewards(this.gamesRewards)
    // XR-M14-02(b): a self-registration with a referral code pays the new user 25 and the referrer 50, in the registration transaction.
    this.accountPorts.provideRegistrationHook(this.registrationHook)
  }
}
