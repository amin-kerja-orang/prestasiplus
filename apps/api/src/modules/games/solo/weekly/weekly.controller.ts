import { Controller, Get, Inject, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'

import { ok } from '../../../../common/http/respond'
import type { RequestWithAuth } from '../../../../common/scope'
import { RateLimit, RateLimitGuard } from '../../../../common/throttle'
import { callerOf } from '../../caller'
import { GAMES_LIMITS } from '../../games.constants'
import { WeeklyService } from './weekly.service'

/** Weekly competition (M16-40) and Uji Minda (M16-41, constant). `?week=` is ignored, as live. */
@Controller('games')
@UseGuards(RateLimitGuard)
export class WeeklyController {
  constructor(@Inject(WeeklyService) private readonly weekly: WeeklyService) {}

  @Get('pertandingan')
  @RateLimit(GAMES_LIMITS.read)
  async board(@Req() req: Request & RequestWithAuth) {
    return ok(await this.weekly.board(callerOf(req)))
  }

  @Get('uji-minda')
  @RateLimit(GAMES_LIMITS.read)
  ujiMinda() {
    return ok({ challenge: null })
  }
}
