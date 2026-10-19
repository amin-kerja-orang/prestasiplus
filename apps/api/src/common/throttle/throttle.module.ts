import { Module } from '@nestjs/common'

import { RateLimitGuard, RateLimiter } from './rate-limit'

/** Import this module in a feature module that uses `@UseGuards(RateLimitGuard)`; the limiter is one shared instance. */
@Module({
  providers: [RateLimiter, RateLimitGuard],
  exports: [RateLimiter, RateLimitGuard],
})
export class ThrottleModule {}
