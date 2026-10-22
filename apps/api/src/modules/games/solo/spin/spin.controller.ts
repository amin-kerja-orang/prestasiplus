import { Controller, Get, HttpCode, Inject, Post, Req, Res, UseGuards } from '@nestjs/common'
import type { Request, Response } from 'express'

import { ok } from '../../../../common/http/respond'
import type { RequestWithAuth } from '../../../../common/scope'
import { RateLimit, RateLimitGuard } from '../../../../common/throttle'
import { callerOf } from '../../caller'
import { GAMES_LIMITS } from '../../games.constants'
import { SpinService } from './spin.service'

type AuthedRequest = Request & RequestWithAuth

/** Roda Nasib (M16-34 page, M16-35 raw spin). Any signed-in role. */
@Controller('games/roda-nasib')
@UseGuards(RateLimitGuard)
export class SpinController {
  constructor(@Inject(SpinService) private readonly spin: SpinService) {}

  @Get()
  @RateLimit(GAMES_LIMITS.read)
  async page(@Req() req: AuthedRequest) {
    return ok(await this.spin.page(callerOf(req)))
  }

  /** RAW body; a second spin the same Malaysia day is 409 raw `{ success: false, message }`. */
  @Post('spin')
  @HttpCode(200)
  @RateLimit(GAMES_LIMITS.spin)
  async doSpin(@Req() req: AuthedRequest, @Res({ passthrough: true }) res: Response) {
    const out = await this.spin.spin(callerOf(req))
    res.status(out.status)
    return out.body
  }
}
