import { Inject, Module, type OnModuleInit } from '@nestjs/common'

import { AuditModule } from '../../common/audit'
import { ThrottleModule } from '../../common/throttle'
import { AuthPorts, AuthPortsModule } from '../auth/ports'
import { AccountPorts, AccountPortsModule } from '../account/registration-ports'
import { ClassesModule } from '../classes'
import { GamesCoreModule, GamesPorts } from '../games'
import { PerformanceModule } from '../reports/performance/performance.module'
import { PerformancePorts } from '../reports/performance/ports'
import { ShopModule, ShopPorts } from '../shop'
import { WalletModule } from '../wallet'
import { GamificationAdminController, RewardControlController } from './admin.controller'
import { ChallengeClaimsService } from './challenge-claims.service'
import { GamificationAdminService } from './admin.service'
import { GamesRewardsAdapter } from './games-rewards.adapter'
import { GamificationController } from './gamification.controller'
import { GamificationLoginHook } from './login-hook'
import { GamificationRegistrationHook } from './registration-hook'
import { GamificationRepository } from './gamification.repository'
import { GamificationService } from './gamification.service'
import { PerformanceGamificationAdapter } from './performance-gamification.adapter'
import { GamificationPorts } from './ports'

/**
 * M14 gamification beyond the wallet core (BE-23): the student routes (dashboard, challenges, achievements,
 * leaderboard, referral, share cards, convert), the admin economy and operations routes, and the entry points
 * other cards call inside their own transaction (`GamificationService.settleChallenges`, `completeChallenge`, and the claim `ChallengeClaimsService`,
 * `unlockAchievement`, `onGameResult`, `canEarnSyiling`, `applyReferral`; `GamificationAdminService.runDraw`).
 * Every movement goes through `WalletService` (BE-11); the repository reads the wallet tables and writes none of
 * them. The teacher economy is NOT built (D53/OWN-10): no `/guru/gamification*` route exists.
 *
 * `GamificationPorts` carries what M14 reads but M05 owns (practice day facts, mastery, session counts); BE-12/13
 * call `ports.providePracticeFacts(...)` from their own `onModuleInit`. Until then it answers "nothing yet".
 *
 * On init it also binds the login hook into `AuthPorts` (`onLogin`: streak and the daily +2, XR-M14-02(a)), the registration hook into `AccountPorts` (`applyReferral`, XR-M14-02(b)), `GamesRewardsAdapter` into the games' `GamesPorts.rewards` (BE-45), and
 * `PerformanceGamificationAdapter` into BE-19's `PerformancePorts` (the reports'
 * `GamificationReadPort`: public profile, rankings).
 * `ClassesModule` (BE-17, owner of classes and enrolments) gives the teacher's pupils for the leaderboard name scope (#76).
 */
@Module({
  imports: [AuditModule, ThrottleModule, AuthPortsModule, AccountPortsModule, WalletModule, PerformanceModule, ClassesModule, GamesCoreModule, ShopModule],
  controllers: [GamificationController, GamificationAdminController, RewardControlController],
  providers: [GamificationRepository, GamificationService, ChallengeClaimsService, GamificationAdminService, GamificationPorts, PerformanceGamificationAdapter, GamesRewardsAdapter, GamificationLoginHook, GamificationRegistrationHook],
  exports: [GamificationService, GamificationAdminService, GamificationPorts],
})
export class GamificationModule implements OnModuleInit {
  constructor(
    @Inject(ShopPorts) private readonly shopPorts: ShopPorts,
    @Inject(GamificationService) private readonly gamification: GamificationService,
    @Inject(PerformancePorts) private readonly performance: PerformancePorts,
    @Inject(PerformanceGamificationAdapter) private readonly gamificationRead: PerformanceGamificationAdapter,
    @Inject(GamesPorts) private readonly gamesPorts: GamesPorts,
    @Inject(GamesRewardsAdapter) private readonly gamesRewards: GamesRewardsAdapter,
    @Inject(AccountPorts) private readonly accountPorts: AccountPorts,
    @Inject(GamificationRegistrationHook) private readonly registrationHook: GamificationRegistrationHook,
    @Inject(AuthPorts) private readonly authPorts: AuthPorts,
    @Inject(GamificationLoginHook) private readonly loginHook: GamificationLoginHook,
  ) {}

  /** Binds the real gamification read port of BE-19's reports (once; `provideGamification` throws on a second call). */
  onModuleInit(): void {
    this.performance.provideGamification(this.gamificationRead)
    // D-13: the games' syiling follows `games_award_syiling` (seed 0 = XP only) instead of the never-earning default.
    this.gamesPorts.provideRewards(this.gamesRewards)
    // XR-M14-02(b): a self-registration with a referral code pays the new user 25 and the referrer 50, in the registration transaction.
    this.accountPorts.provideRegistrationHook(this.registrationHook)
    // XR-M14-02(a): a student's password login moves the streak and pays the first daily +2 (M01 FR-M01-69).
    this.authPorts.provideLoginHook(this.loginHook)
    // FR-GM-25.2: a real battle win evaluates the badges (Juara Battle) in the battle's transaction, in a savepoint.
    this.gamesPorts.provideBattleWonHook((userId, { tx }) => this.gamification.evaluateAchievementsSafely(userId, { tx, isTest: false }))
    // FR-GM-25.2: the shop cannot import this module (cycle), so a committed Kotak Misteri opening evaluates the badges through this hook.
    this.shopPorts.provideBoxOpenedHook(async (userId) => (await this.gamification.evaluateAchievementsSafely(userId, { isTest: false })).unlocked)
  }
}
