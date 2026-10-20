import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'

import { ThrottleModule } from '../throttle/throttle.module'
import { GlobalRateLimitGuard } from './global-rate-limit.guard'
import { NulGuard } from './nul-guard'

/** Global guards (BE-33). Import it before the feature modules so they run before the auth guards. */
@Module({
  imports: [ThrottleModule],
  providers: [
    { provide: APP_GUARD, useClass: GlobalRateLimitGuard },
    { provide: APP_GUARD, useClass: NulGuard },
  ],
})
export class SecurityModule {}
