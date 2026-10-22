import { Body, Controller, HttpCode, Post, UseGuards, UseInterceptors } from '@nestjs/common'

import { NoStoreInterceptor, ok } from '../../common/http'
import { RateLimit, RateLimitGuard } from '../../common/throttle'
import { Actor } from './actor'
import { SPONSORSHIP_LIMITS } from './sponsorship.constants'
import { SponsorshipService, type SponsorshipActor } from './sponsorship.service'

/**
 * `POST /api/mohon-keluarga-angkat` (M21 #15): any signed-in role (the global guards give 401 without a session and 403
 * CSRF_INVALID without the token). The applicant is the session user. Rate limited per user (D57a). Every answer is
 * `no-store` (a minor's family data) and the body is never logged.
 */
@Controller('mohon-keluarga-angkat')
@UseGuards(RateLimitGuard)
@UseInterceptors(NoStoreInterceptor)
export class SponsorshipController {
  constructor(private readonly sponsorship: SponsorshipService) {}

  @Post()
  @HttpCode(201)
  @RateLimit(SPONSORSHIP_LIMITS.apply)
  async apply(@Actor() actor: SponsorshipActor, @Body() body: unknown) {
    return ok(await this.sponsorship.apply(actor, body))
  }
}
