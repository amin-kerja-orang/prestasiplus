import { Body, Controller, Get, HttpCode, Inject, Post, Req, Res, UseGuards } from '@nestjs/common'
import type { Request, Response } from 'express'

import type { RequestWithAuth } from '../../../common/scope'
import { RateLimit, RateLimitGuard } from '../../../common/throttle'
import { callerOf } from '../caller'
import { rawError } from '../errors'
import { GAMES_LIMITS } from '../games.constants'
import { QuickMatchService } from './quick-match.service'

type Req = Request & RequestWithAuth

/** Papan Bijak quick match (M16-29..31): RAW bodies; the 422 is raw `{ error }`. 401/403/429 stay standard. */
@Controller('papan-bijak/quick-match')
@UseGuards(RateLimitGuard)
export class QuickMatchController {
  constructor(@Inject(QuickMatchService) private readonly quick: QuickMatchService) {}

  @Post()
  @HttpCode(200)
  @RateLimit(GAMES_LIMITS.write)
  async start(@Body() body: unknown, @Req() req: Req, @Res({ passthrough: true }) res: Response) {
    const r = await this.quick.start(callerOf(req), body)
    if (!r.ok) {
      res.status(422)
      return rawError(r.error)
    }
    return r.body
  }

  // A poll can advance the search (third poll matches), so it is limited per user like the other room reads.
  @Get('poll')
  @RateLimit(GAMES_LIMITS.read)
  async poll(@Req() req: Req) {
    return this.quick.poll(callerOf(req))
  }

  @Post('cancel')
  @HttpCode(200)
  @RateLimit(GAMES_LIMITS.write)
  async cancel(@Req() req: Req) {
    return this.quick.cancel(callerOf(req))
  }
}
