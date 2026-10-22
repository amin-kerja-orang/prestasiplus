import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'

import { ok } from '../../../../common/http/respond'
import type { RequestWithAuth } from '../../../../common/scope'
import { RateLimit, RateLimitGuard } from '../../../../common/throttle'
import { callerOf } from '../../caller'
import { GAMES_LIMITS } from '../../games.constants'
import { JutawanService } from './jutawan.service'

type AuthedRequest = Request & RequestWithAuth

/** Jutawan Ilmu (M16-36 to M16-39). Any signed-in role. `start` is declared before the `:sessionId` routes. */
@Controller('games/jutawan')
@UseGuards(RateLimitGuard)
export class JutawanController {
  constructor(@Inject(JutawanService) private readonly jutawan: JutawanService) {}

  @Get()
  @RateLimit(GAMES_LIMITS.read)
  async page(@Query('darjah') darjah: unknown, @Req() req: AuthedRequest) {
    return ok(await this.jutawan.page(callerOf(req), darjah))
  }

  /** 200, not 201. */
  @Post('start')
  @HttpCode(200)
  @RateLimit(GAMES_LIMITS.write)
  async start(@Body() body: unknown, @Req() req: AuthedRequest) {
    return ok(await this.jutawan.start(callerOf(req), body))
  }

  @Post(':sessionId/answer')
  @HttpCode(200)
  @RateLimit(GAMES_LIMITS.write)
  async answer(@Param('sessionId') sessionId: string, @Body() body: unknown, @Req() req: AuthedRequest) {
    return ok(await this.jutawan.answer(callerOf(req), sessionId, body))
  }

  @Post(':sessionId/lifeline')
  @HttpCode(200)
  @RateLimit(GAMES_LIMITS.write)
  async lifeline(@Param('sessionId') sessionId: string, @Body() body: unknown, @Req() req: AuthedRequest) {
    return ok(await this.jutawan.lifeline(callerOf(req), sessionId, body))
  }
}
