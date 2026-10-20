import { Body, Controller, Get, Param, Post, Req, UseGuards, UseInterceptors } from '@nestjs/common'
import {
  BattleTournamentCreatedSchema,
  BattleTournamentDetailSchema,
  BattleTournamentActiveSchema,
  BattleTournamentFormOptionsSchema,
  BattleTournamentListItemSchema,
} from '@pp/contract'
import type { Request } from 'express'

import { Roles } from '../../../common/guards'
import { NoStoreInterceptor, ok } from '../../../common/http'
import { ScopeContext, type RequestWithAuth } from '../../../common/scope'
import { RateLimit, RateLimitGuard } from '../../../common/throttle'
import { BATTLE_LIMITS } from '../battle.limits'
import { TournamentsService, type TournamentViewer } from './tournaments.service'

function viewerOf(req: Request & RequestWithAuth): TournamentViewer {
  const s = ScopeContext.fromRequest(req)
  return { userId: s.userId, isAdmin: s.role === 'admin', isTest: s.isTest }
}

/** Tournament banner, list, form options, create and detail (M16-01, M16-42..45). Any signed-in role reads; admin writes. */
@Controller()
@UseGuards(RateLimitGuard)
@UseInterceptors(NoStoreInterceptor)
export class TournamentsController {
  constructor(private readonly tournaments: TournamentsService) {}

  /** M16-01: a bare array. */
  @Get('tournament/active')
  @RateLimit(BATTLE_LIMITS.read)
  async active(@Req() req: Request & RequestWithAuth) {
    return (await this.tournaments.active(viewerOf(req))).map((t) => BattleTournamentActiveSchema.parse(t))
  }

  @Get('tournaments')
  @RateLimit(BATTLE_LIMITS.read)
  async list(@Req() req: Request & RequestWithAuth) {
    return ok((await this.tournaments.list(viewerOf(req))).map((t) => BattleTournamentListItemSchema.parse(t)))
  }

  @Get('tournaments/form-options')
  @Roles('admin')
  @RateLimit(BATTLE_LIMITS.read)
  async formOptions() {
    return ok(BattleTournamentFormOptionsSchema.parse(await this.tournaments.formOptions()))
  }

  @Post('tournaments')
  @Roles('admin')
  @RateLimit(BATTLE_LIMITS.write)
  async create(@Req() req: Request & RequestWithAuth, @Body() body: unknown) {
    return ok(BattleTournamentCreatedSchema.parse(await this.tournaments.create(viewerOf(req), body)))
  }

  @Get('tournaments/:uuid')
  @RateLimit(BATTLE_LIMITS.read)
  async detail(@Req() req: Request & RequestWithAuth, @Param('uuid') uuid: string) {
    return ok(BattleTournamentDetailSchema.parse(await this.tournaments.detail(viewerOf(req), uuid)))
  }
}
