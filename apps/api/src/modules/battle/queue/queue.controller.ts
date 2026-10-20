import { Body, Controller, Get, HttpCode, Param, Post, Req, UseFilters, UseGuards, UseInterceptors } from '@nestjs/common'
import type { Request } from 'express'

import { NoStoreInterceptor } from '../../../common/http'
import { ScopeContext, type RequestWithAuth } from '../../../common/scope'
import { RateLimit, RateLimitGuard } from '../../../common/throttle'
import { BATTLE_LIMITS } from '../battle.limits'
import { BattleRawErrorFilter } from '../raw-response'
import { QueueService } from './queue.service'

type Req = Request & RequestWithAuth

const who = (req: Req) => {
  const s = ScopeContext.fromRequest(req)
  return { userId: s.userId, isTest: s.isTest }
}

/** Matchmaking queue routes M16-02 to M16-06, M16-12, M16-13 (any signed-in role; raw bodies, raw `{error}`). */
@Controller('battle')
@UseGuards(RateLimitGuard)
@UseInterceptors(NoStoreInterceptor)
@UseFilters(BattleRawErrorFilter)
export class QueueController {
  constructor(private readonly queue: QueueService) {}

  @Post('quick-match')
  @HttpCode(200)
  @RateLimit(BATTLE_LIMITS.write)
  quickMatch(@Req() req: Req, @Body() body: unknown) {
    const w = who(req)
    return this.queue.start(w.userId, w.isTest, 'quick_match', body)
  }

  @Post('school-battle')
  @HttpCode(200)
  @RateLimit(BATTLE_LIMITS.write)
  schoolBattle(@Req() req: Req, @Body() body: unknown) {
    const w = who(req)
    return this.queue.start(w.userId, w.isTest, 'school_battle', body)
  }

  @Get('poll-match/:queueId')
  @RateLimit(BATTLE_LIMITS.poll)
  pollMatch(@Req() req: Req, @Param('queueId') queueId: string) {
    const w = who(req)
    return this.queue.pollMatch(w.userId, w.isTest, queueId)
  }

  @Post('accept-challenger/:queueId')
  @HttpCode(200)
  @RateLimit(BATTLE_LIMITS.write)
  accept(@Req() req: Req, @Param('queueId') queueId: string) {
    const w = who(req)
    return this.queue.acceptChallenger(w.userId, w.isTest, queueId)
  }

  @Post('reject-challenger/:queueId')
  @HttpCode(200)
  @RateLimit(BATTLE_LIMITS.write)
  reject(@Req() req: Req, @Param('queueId') queueId: string) {
    const w = who(req)
    return this.queue.rejectChallenger(w.userId, w.isTest, queueId)
  }

  @Post('join-queue/:queueId')
  @HttpCode(200)
  @RateLimit(BATTLE_LIMITS.write)
  join(@Req() req: Req, @Param('queueId') queueId: string) {
    const w = who(req)
    return this.queue.joinQueue(w.userId, w.isTest, queueId)
  }

  @Get('poll-challenger/:queueId')
  @RateLimit(BATTLE_LIMITS.poll)
  pollChallenger(@Req() req: Req, @Param('queueId') queueId: string) {
    const w = who(req)
    return this.queue.pollChallenger(w.userId, w.isTest, queueId)
  }
}
