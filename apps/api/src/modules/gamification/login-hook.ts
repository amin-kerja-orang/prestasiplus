import { Inject, Injectable } from '@nestjs/common'

import type { LoginHook, PasswordLoginEvent } from '../auth/ports'
import { GamificationService } from './gamification.service'

/**
 * XR-M14-02(a) / BR-M14-14: M01's post-login hook -> `GamificationService.onLogin`. Only a student's password login
 * counts (an admin or teacher login adds neither a streak day nor a `daily_login` row, OBSERVED absence). Bound into
 * `AuthPorts` by `GamificationModule`; `AuthService` swallows any error and bounds the wait.
 */
@Injectable()
export class GamificationLoginHook implements LoginHook {
  constructor(@Inject(GamificationService) private readonly gamification: GamificationService) {}

  async onPasswordLogin(event: PasswordLoginEvent): Promise<void> {
    if (event.role !== 'student') return
    await this.gamification.onLogin(event.userId) // the day comes from the server clock, not from `event.at` (BE-11)
  }
}
