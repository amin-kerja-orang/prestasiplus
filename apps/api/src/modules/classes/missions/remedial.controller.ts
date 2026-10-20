import { Body, Controller, Get, HttpCode, Post, UseGuards, UseInterceptors } from '@nestjs/common'

import { Roles } from '../../../common/guards/decorators'
import { NoStoreInterceptor } from '../../../common/http'
import { RateLimit, RateLimitGuard } from '../../../common/throttle'
import { Actor, type ClassActor } from '../actor'
import { MISSION_LIMITS } from './missions.constants'
import { RemedialService } from './remedial.service'

/**
 * Teacher remedial routes (M10 S2/S3, SRS #4 to #6, #11): teacher or admin; bare bodies as the mock; `no-store`;
 * reads and writes rate limited per user (D57). Bodies are parsed (strictly) inside the service so the field
 * failures are reported together. A teacher acts only on their own students and tests.
 */
@Controller('guru')
@Roles('teacher', 'admin')
@UseGuards(RateLimitGuard)
@UseInterceptors(NoStoreInterceptor)
export class RemedialController {
  constructor(private readonly remedial: RemedialService) {}

  @Get('remedial-progress')
  @RateLimit(MISSION_LIMITS.read)
  progress(@Actor() actor: ClassActor) {
    return this.remedial.progress(actor)
  }

  @Get('command-center/remedial/scan')
  @RateLimit(MISSION_LIMITS.read)
  scan(@Actor() actor: ClassActor) {
    return this.remedial.scan(actor)
  }

  @Post('command-center/remedial/generate')
  @HttpCode(201)
  @RateLimit(MISSION_LIMITS.write)
  generate(@Actor() actor: ClassActor, @Body() body: unknown) {
    return this.remedial.generate(actor, body)
  }

  @Post('command-center/remedial/cancel')
  @HttpCode(200)
  @RateLimit(MISSION_LIMITS.write)
  cancel(@Actor() actor: ClassActor, @Body() body: unknown) {
    return this.remedial.cancel(actor, body)
  }
}
