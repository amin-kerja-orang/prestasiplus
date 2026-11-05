import { Controller, Get, Query, UseGuards, UseInterceptors } from '@nestjs/common'

import { Roles } from '../../../common/guards/decorators'
import { NoStoreInterceptor, ok } from '../../../common/http'
import { RateLimit, RateLimitGuard } from '../../../common/throttle'
import { CLASS_LIMITS } from '../classes.constants'
import { DatabankService } from './databank.service'

/**
 * Databank Soalan for teachers (S6-T19, API-GUR-27, R1-GUR-44d): a read-only browse of the question bank. Role `teacher` only
 * (an admin has no teacher screen); every answer is `no-store`; reads are rate limited per user like the other teacher reads.
 */
@Controller('guru/databank')
@Roles('teacher')
@UseGuards(RateLimitGuard)
@UseInterceptors(NoStoreInterceptor)
export class DatabankController {
  constructor(private readonly databank: DatabankService) {}

  @Get('overview')
  @RateLimit(CLASS_LIMITS.read)
  async overview() {
    return ok(await this.databank.overview())
  }

  @Get('questions')
  @RateLimit(CLASS_LIMITS.read)
  async questions(@Query() query: Record<string, unknown>) {
    return this.databank.questions(query)
  }
}
