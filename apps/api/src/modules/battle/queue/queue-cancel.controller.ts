import { Controller, HttpCode, Param, Post, Req, UseGuards, UseInterceptors } from '@nestjs/common'
import type { Request } from 'express'

import { NoStoreInterceptor, ok } from '../../../common/http'
import type { RequestWithAuth } from '../../../common/scope'
import { RateLimit, RateLimitGuard } from '../../../common/throttle'
import { BATTLE_LIMITS } from '../battle.limits'
import { battleCaller } from '../engine'
import { QueueService } from './queue.service'

type Req = Request & RequestWithAuth

/** API-GAME-14 (any signed-in role, as the queue routes; own entry only): a `{data}` body and the standard error envelope. */
@Controller('battle/queue')
@UseGuards(RateLimitGuard)
@UseInterceptors(NoStoreInterceptor)
export class QueueCancelController {
  constructor(private readonly queue: QueueService) {}

  @Post(':queueId/cancel')
  @HttpCode(200)
  @RateLimit(BATTLE_LIMITS.write)
  async cancel(@Req() req: Req, @Param('queueId') queueId: string) {
    const who = battleCaller(req)
    return ok(await this.queue.cancel(who.userId, who.isTest, queueId))
  }
}
