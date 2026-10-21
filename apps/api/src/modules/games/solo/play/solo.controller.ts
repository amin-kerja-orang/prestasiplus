import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query, Req, Res, UseGuards, UseInterceptors } from '@nestjs/common'
import type { Request, Response } from 'express'

import { NoStoreInterceptor } from '../../../../common/http/no-store.interceptor'
import { ok } from '../../../../common/http/respond'
import type { RequestWithAuth } from '../../../../common/scope'
import { RateLimit, RateLimitGuard } from '../../../../common/throttle'
import { callerOf } from '../../caller'
import { GAMES_LIMITS } from '../../games.constants'
import { SoloService } from './solo.service'

type AuthedRequest = Request & RequestWithAuth

/**
 * Single-player games (M16-32, M16-33) and the D58a check / reveal routes. Any signed-in role. Route order matters:
 * the static `solo/kad-memori/reveal` is declared before the `solo/:game/...` routes.
 */
@Controller('games')
@UseGuards(RateLimitGuard)
export class SoloController {
  constructor(@Inject(SoloService) private readonly solo: SoloService) {}

  /** M16-32: creates a session row (so it is rate limited) and returns the keyless payload. */
  @Get('solo/:game')
  @RateLimit(GAMES_LIMITS.soloStart)
  async start(@Param('game') game: string, @Query('darjah') darjah: unknown, @Req() req: AuthedRequest) {
    return ok(await this.solo.start(callerOf(req), game, darjah))
  }

  /** [PROPOSED] Kad Memori: the face of the first card of a move. The face is no-store. */
  @Post('solo/kad-memori/reveal')
  @HttpCode(200)
  @UseInterceptors(NoStoreInterceptor)
  @RateLimit(GAMES_LIMITS.soloCheck)
  async reveal(@Body() body: unknown, @Req() req: AuthedRequest) {
    return ok(await this.solo.reveal(callerOf(req), body))
  }

  /** [PROPOSED] D58a: one answer checked by the server; the response carries the key (no-store). */
  @Post('solo/:game/check')
  @HttpCode(200)
  @UseInterceptors(NoStoreInterceptor)
  @RateLimit(GAMES_LIMITS.soloCheck)
  async check(@Param('game') game: string, @Body() body: unknown, @Req() req: AuthedRequest) {
    return ok(await this.solo.check(callerOf(req), game, body))
  }

  /** M16-33: RAW body and RAW error bodies (`{ message }`); 401, CSRF and 429 stay standard. */
  @Post('solo/:game/submit')
  @HttpCode(200)
  @RateLimit(GAMES_LIMITS.soloCheck)
  async submit(@Param('game') game: string, @Body() body: unknown, @Req() req: AuthedRequest, @Res({ passthrough: true }) res: Response) {
    const out = await this.solo.submit(callerOf(req), game, body)
    res.status(out.status)
    return out.body
  }
}
