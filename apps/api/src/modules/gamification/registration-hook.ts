import { Inject, Injectable } from '@nestjs/common'

import type { RegisteredEvent, RegistrationHook } from '../account/registration-ports'
import { GamificationService } from './gamification.service'

/**
 * XR-M14-02(b) / BR-M14-19: M01's registration hook -> `GamificationService.applyReferral`, inside the registration
 * transaction. A real sign-up, so `isTest` is false. A pending teacher is a created account like any other and is
 * treated the same (the docs are silent; recorded as a deviation). `applyReferral` pays nothing for an empty,
 * unknown, own or already-used code.
 */
@Injectable()
export class GamificationRegistrationHook implements RegistrationHook {
  constructor(@Inject(GamificationService) private readonly gamification: GamificationService) {}

  async onRegistered(event: RegisteredEvent): Promise<void> {
    if (event.referralCode === null) return
    await this.gamification.applyReferral(event.userId, event.referralCode, { tx: event.tx, isTest: false, at: event.at })
  }
}
