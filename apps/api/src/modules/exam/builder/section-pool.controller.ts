import { Body, Controller, Get, Inject, Param, Put, UseGuards } from '@nestjs/common'

import { Roles } from '../../../common/guards'
import { ok } from '../../../common/http/respond'
import { RateLimit, RateLimitGuard } from '../../../common/throttle'
import { Actor, type AuditActor } from './actor'
import { BIJAK_BUILDER_LIMITS } from './builder.constants'
import { SectionPoolService } from './section-pool.service'

/** Section pools of a question (R1-T34, G3), Admin Pusat only. CSRF on the write is enforced by the session guard. */
@Controller('admin/section-pools')
@Roles('admin')
@UseGuards(RateLimitGuard)
export class SectionPoolsController {
  constructor(@Inject(SectionPoolService) private readonly pools: SectionPoolService) {}

  @Get(':questionId')
  @RateLimit(BIJAK_BUILDER_LIMITS.read)
  async get(@Param('questionId') questionId: string) {
    return ok(await this.pools.get(questionId))
  }

  @Put(':questionId')
  @RateLimit(BIJAK_BUILDER_LIMITS.write)
  async set(@Actor() actor: AuditActor, @Param('questionId') questionId: string, @Body() body: unknown) {
    return ok(await this.pools.set(actor, questionId, body))
  }
}
