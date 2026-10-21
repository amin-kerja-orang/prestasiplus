import { Body, Controller, Get, HttpCode, Inject, Param, Post, Req, UseGuards, UseInterceptors } from '@nestjs/common'
import type { Request } from 'express'

import { NoStoreInterceptor } from '../../../common/http/no-store.interceptor'
import { ok } from '../../../common/http/respond'
import type { RequestWithAuth } from '../../../common/scope'
import { RateLimit, RateLimitGuard } from '../../../common/throttle'
import { callerOf } from '../caller'
import { GAMES_LIMITS } from '../games.constants'
import { LeaguesService } from './leagues.service'
import { parseLeagueInput } from './leagues.rules'

type Req = Request & RequestWithAuth

/**
 * Leagues (M16-46 to M16-49). Any signed-in role (default-deny auth and CSRF are global). `join` is declared
 * before `:id`; a non-numeric `:id` is a 404 from the service.
 */
@Controller('leagues')
@UseGuards(RateLimitGuard)
export class LeaguesController {
  constructor(@Inject(LeaguesService) private readonly leagues: LeaguesService) {}

  @Get()
  @RateLimit(GAMES_LIMITS.read)
  async list(@Req() req: Req) {
    return ok(await this.leagues.list(callerOf(req)))
  }

  @Post()
  @RateLimit(GAMES_LIMITS.write)
  async create(@Body() body: unknown, @Req() req: Req) {
    return ok(await this.leagues.create(callerOf(req), parseLeagueInput(body)))
  }

  @Post('join')
  @HttpCode(200)
  @RateLimit(GAMES_LIMITS.write)
  async join(@Body() body: unknown, @Req() req: Req) {
    const code = typeof body === 'object' && body !== null ? (body as Record<string, unknown>).invite_code : undefined
    return ok(await this.leagues.join(callerOf(req), code))
  }

  /** The detail carries the invite code: never cached. */
  @Get(':id')
  @UseInterceptors(NoStoreInterceptor)
  @RateLimit(GAMES_LIMITS.read)
  async detail(@Param('id') id: string, @Req() req: Req) {
    return ok(await this.leagues.detail(callerOf(req), id))
  }
}
