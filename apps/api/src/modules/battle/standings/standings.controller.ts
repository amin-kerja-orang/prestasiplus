import { Controller, Get, Param, Query, Req, UseGuards, UseInterceptors } from '@nestjs/common'
import type { Request } from 'express'

import { NoStoreInterceptor, ok } from '../../../common/http'
import { ScopeContext, type RequestWithAuth } from '../../../common/scope'
import { RateLimit, RateLimitGuard } from '../../../common/throttle'
import { BATTLE_LIMITS } from '../battle.limits'
import { StandingsService } from './standings.service'

type Req = Request & RequestWithAuth

/** A repeated key (`?period=a&period=b`) arrives as an array: the first string wins; anything else reads as absent. */
const text = (v: unknown): string | undefined => {
  const x = Array.isArray(v) ? v[0] : v
  return typeof x === 'string' ? x : undefined
}

/**
 * Battle standings, school page and own history (M16-18..21), any signed-in role (the global guard makes anonymous
 * calls 401). Names and schools of players only; nothing else about a person is returned.
 */
@Controller('battle')
@UseGuards(RateLimitGuard)
@UseInterceptors(NoStoreInterceptor)
@RateLimit(BATTLE_LIMITS.read)
export class StandingsController {
  constructor(private readonly standings: StandingsService) {}

  @Get('standings/students')
  async students(@Query() query: Record<string, unknown>) {
    return ok(await this.standings.students(text(query.period)))
  }

  @Get('standings/schools')
  async schools(@Query() query: Record<string, unknown>) {
    return ok(await this.standings.schools(text(query.period), text(query.state)))
  }

  @Get('schools/:id')
  async school(@Param('id') id: string) {
    return ok(await this.standings.schoolPage(id))
  }

  @Get('history')
  async history(@Req() req: Req) {
    return ok(await this.standings.history(ScopeContext.fromRequest(req).userId))
  }
}
