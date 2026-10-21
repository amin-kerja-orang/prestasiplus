import { Controller, Get, Param, Query, Req, UseGuards, UseInterceptors } from '@nestjs/common'
import type { Request } from 'express'

import { NoStoreInterceptor, ok } from '../../../common/http'
import { ScopeContext, type RequestWithAuth } from '../../../common/scope'
import { RateLimit, RateLimitGuard } from '../../../common/throttle'
import { type BattleViewer } from '../privacy'
import { BATTLE_LIMITS } from '../battle.limits'
import { StandingsService } from './standings.service'

type Req = Request & RequestWithAuth

/** A repeated key (`?period=a&period=b`) arrives as an array: the first string wins; anything else reads as absent. */
const text = (v: unknown): string | undefined => {
  const x = Array.isArray(v) ? v[0] : v
  return typeof x === 'string' ? x : undefined
}

/** The viewer of the children's names rule (LEAD 2026-10-21, issue #76): id, active role and the school of the active scope. */
const viewerOf = (req: Req): BattleViewer => {
  const s = ScopeContext.fromRequest(req)
  return { userId: s.userId, role: s.role, schoolId: s.scope.schoolId ?? null }
}

/**
 * Battle standings, school page and own history (M16-18..21), any signed-in role (the global guard makes anonymous
 * calls 401). Names and schools of players only; pupils outside the viewer's scope show first name + initial and no id (privacy.ts).
 */
@Controller('battle')
@UseGuards(RateLimitGuard)
@UseInterceptors(NoStoreInterceptor)
@RateLimit(BATTLE_LIMITS.read)
export class StandingsController {
  constructor(private readonly standings: StandingsService) {}

  @Get('standings/students')
  async students(@Req() req: Req, @Query() query: Record<string, unknown>) {
    return ok(await this.standings.students(text(query.period), viewerOf(req)))
  }

  @Get('standings/schools')
  async schools(@Query() query: Record<string, unknown>) {
    return ok(await this.standings.schools(text(query.period), text(query.state)))
  }

  @Get('schools/:id')
  async school(@Req() req: Req, @Param('id') id: string) {
    return ok(await this.standings.schoolPage(id, viewerOf(req)))
  }

  @Get('history')
  async history(@Req() req: Req) {
    return ok(await this.standings.history(viewerOf(req)))
  }
}
