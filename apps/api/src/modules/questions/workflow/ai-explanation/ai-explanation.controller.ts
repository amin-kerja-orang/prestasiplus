import { Controller, HttpCode, Inject, Param, Post, Query, UseGuards, UseInterceptors } from '@nestjs/common'

import { NoStoreInterceptor } from '../../../../common/http'
import { RateLimit, RateLimitGuard } from '../../../../common/throttle'
import { AdminOnly } from '../actor'
import { WORKFLOW_ADMIN_WRITE_LIMIT } from '../quality/limits'
import { AiExplanationService } from './ai-explanation.service'

/**
 * `POST /questions/:id/ai-explanation`: STUB (OD-7), no network. Admin Pusat only. Only `force=1`
 * regenerates an existing explanation; any other value is ignored. Raw body `{ ok, message, stub }`.
 */
@AdminOnly()
@UseGuards(RateLimitGuard)
@UseInterceptors(NoStoreInterceptor)
@Controller('questions')
export class AiExplanationController {
  constructor(@Inject(AiExplanationService) private readonly ai: AiExplanationService) {}

  @Post(':id/ai-explanation')
  @HttpCode(200)
  @RateLimit(WORKFLOW_ADMIN_WRITE_LIMIT)
  generate(@Param('id') id: string, @Query('force') force?: string) {
    return this.ai.generate(id, force === '1')
  }
}
