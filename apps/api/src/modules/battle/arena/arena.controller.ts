import { Body, Controller, Get, HttpCode, Param, Post, Req, UseGuards, UseInterceptors } from '@nestjs/common'
import type { Request } from 'express'

import { NoStoreInterceptor, ok } from '../../../common/http'
import { ScopeContext, type RequestWithAuth } from '../../../common/scope'
import { RateLimit, RateLimitGuard } from '../../../common/throttle'
import { BATTLE_LIMITS } from '../battle.limits'
import { ArenaService } from './arena.service'

type Req = Request & RequestWithAuth

/** Lobby and arena (M16-15 to M16-17): `{data}` bodies and the standard error envelope (any signed-in role). */
@Controller('battle')
@UseGuards(RateLimitGuard)
@UseInterceptors(NoStoreInterceptor)
export class ArenaController {
  constructor(private readonly arena: ArenaService) {}

  @Get('lobby')
  @RateLimit(BATTLE_LIMITS.read)
  async lobby(@Req() req: Req) {
    return ok(await this.arena.lobby(ScopeContext.fromRequest(req).userId))
  }

  @Get('arena/:uuid')
  @RateLimit(BATTLE_LIMITS.read)
  async view(@Req() req: Req, @Param('uuid') uuid: string) {
    return ok(await this.arena.view(uuid, ScopeContext.fromRequest(req).userId))
  }

  @Post('arena/:uuid/answer')
  @HttpCode(200)
  @RateLimit(BATTLE_LIMITS.write)
  async answer(@Req() req: Req, @Param('uuid') uuid: string, @Body() body: unknown) {
    return ok(await this.arena.answer(uuid, ScopeContext.fromRequest(req).userId, body))
  }
}
