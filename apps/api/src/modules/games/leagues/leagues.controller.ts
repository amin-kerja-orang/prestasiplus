import { Body, Controller, Get, HttpCode, Inject, Param, Post, Req, UseGuards, UseInterceptors } from '@nestjs/common'
import type { Request } from 'express'

import { NoStoreInterceptor } from '../../../common/http/no-store.interceptor'
import { ApiError } from '../../../common/errors/api-error'
import { Roles } from '../../../common/guards/decorators'
import { ok } from '../../../common/http/respond'
import type { RequestWithAuth } from '../../../common/scope'
import { RateLimit, RateLimitGuard } from '../../../common/throttle'
import { callerOf } from '../caller'
import { GAMES_LIMITS } from '../games.constants'
import { LeaguesService } from './leagues.service'

type Req = Request & RequestWithAuth

/**
 * Leagues (M16-46, M16-47, M16-49; API-GAME-05 reads and API-ADM-25 writes). Reads: any signed-in role (default-deny
 * auth and CSRF are global). Create and school enrolment: Admin Pusat only (FR-GM-15.1). `join` is declared before
 * `:id` and answers 403 for every role (AC-GM-15.2). A non-numeric `:id` is a 404 from the service.
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
  @Roles('admin')
  @RateLimit(GAMES_LIMITS.write)
  async create(@Body() body: unknown, @Req() req: Req) {
    return ok(await this.leagues.create(callerOf(req), body))
  }

  /** Unused in R1 (API-GAME-05): no role joins by invite code; Admin Pusat enrols schools (`:id/schools`). */
  @Post('join')
  @RateLimit(GAMES_LIMITS.write)
  join(): never {
    throw ApiError.of('FORBIDDEN')
  }

  /** API-ADM-25: Admin Pusat enrols schools, all or nothing. Declared after `join`; the path has two segments. */
  @Post(':id/schools')
  @HttpCode(200)
  @Roles('admin')
  @RateLimit(GAMES_LIMITS.write)
  async enrol(@Param('id') id: string, @Body() body: unknown, @Req() req: Req) {
    return ok(await this.leagues.enrolSchools(callerOf(req), id, body))
  }

  /** The detail is read per viewer and kept out of shared caches. */
  @Get(':id')
  @UseInterceptors(NoStoreInterceptor)
  @RateLimit(GAMES_LIMITS.read)
  async detail(@Param('id') id: string, @Req() req: Req) {
    return ok(await this.leagues.detail(callerOf(req), id))
  }
}
