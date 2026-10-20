import { Module } from '@nestjs/common'

import { AuditModule } from '../../common/audit'
import { ThrottleModule } from '../../common/throttle'
import { ClassesModule } from '../classes'
import { WalletModule } from '../wallet'
import { GamificationAdminController, RewardControlController } from './admin.controller'
import { GamificationAdminService } from './admin.service'
import { GamificationController } from './gamification.controller'
import { GamificationRepository } from './gamification.repository'
import { GamificationService } from './gamification.service'
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
 * `ClassesModule` (BE-17, owner of classes and enrolments) gives the teacher's pupils for the leaderboard name scope (#76).
 */
@Module({
  imports: [AuditModule, ThrottleModule, WalletModule, ClassesModule],
  controllers: [GamificationController, GamificationAdminController, RewardControlController],
  providers: [GamificationRepository, GamificationService, GamificationAdminService, GamificationPorts],
  exports: [GamificationService, GamificationAdminService, GamificationPorts],
})
export class GamificationModule {}
