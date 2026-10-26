import { Inject, Injectable, Logger } from '@nestjs/common'

import type { RegisteredEvent, RegistrationHook } from '../account/registration-ports'
import { GamificationService } from './gamification.service'

/**
 * XR-M14-02(b) / BR-M14-19: M01's registration hook -> `GamificationService.applyReferral`, inside the registration
 * transaction. A real sign-up, so `isTest` is false. A pending account (a teacher, created inactive until verified)
 * earns no referral: the hook returns before `applyReferral`, so no row and no credit (the docs are silent; recorded
 * as a deviation). `applyReferral` pays nothing for an empty, unknown, own or already-used code, none beyond the
 * referrer's daily cap, and credits only a party whose `coinsEnabled` is true.
 *
 * A referral is a bonus: it runs in a SAVEPOINT (`referral_apply`, the pattern of `evaluateAchievementsSafely`). If it
 * throws (a rule or a database error, which leaves the transaction aborted until the rollback), the work it did is
 * rolled back to the savepoint, the error NAME is logged (no user data, no code) and the registration carries on with
 * the user, role, session and audit row committed. This hook never throws.
 */
@Injectable()
export class GamificationRegistrationHook implements RegistrationHook {
  private readonly logger = new Logger(GamificationRegistrationHook.name)

  constructor(@Inject(GamificationService) private readonly gamification: GamificationService) {}

  async onRegistered(event: RegisteredEvent): Promise<void> {
    if (event.pending || event.referralCode === null) return
    const { tx } = event
    await tx.$executeRaw`SAVEPOINT referral_apply`
    try {
      await this.gamification.applyReferral(event.userId, event.referralCode, { tx, isTest: false, at: event.at })
    } catch (err) {
      this.logger.warn(`referral skipped at registration: ${err instanceof Error ? err.name : 'unknown error'}`)
      await tx.$executeRaw`ROLLBACK TO SAVEPOINT referral_apply`
    }
    await tx.$executeRaw`RELEASE SAVEPOINT referral_apply`
  }
}
