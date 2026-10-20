import { Controller, Get, HttpCode, Inject, Post, UseGuards, UseInterceptors } from '@nestjs/common'
import { RateLimit, RateLimitGuard } from '../../../../common/throttle'
import { NoStoreInterceptor, ok } from '../../../../common/http'
import { Actor, AdminOnly, type WorkflowActor } from '../actor'
import { WORKFLOW_ADMIN_WRITE_LIMIT } from './limits'
import { QualityService } from './quality.service'

/** Quality dashboard and re-audit. Admin Pusat only. */
@AdminOnly()
@UseGuards(RateLimitGuard)
@UseInterceptors(NoStoreInterceptor)
@Controller('question-quality')
export class QualityController {
  constructor(@Inject(QualityService) private readonly quality: QualityService) {}

  @Get()
  async summary() {
    return ok(await this.quality.summary())
  }

  @Post('audit')
  @HttpCode(200)
  @RateLimit(WORKFLOW_ADMIN_WRITE_LIMIT)
  audit(@Actor() actor: WorkflowActor) {
    return this.quality.audit(actor)
  }
}
