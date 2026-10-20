import { Body, Controller, Get, HttpCode, Param, Post, Query, Req, UseFilters, UseGuards, UseInterceptors } from '@nestjs/common'
import type { Request } from 'express'

import { NoStoreInterceptor } from '../../../common/http'
import { ScopeContext, type RequestWithAuth } from '../../../common/scope'
import { RateLimit, RateLimitGuard } from '../../../common/throttle'
import { BATTLE_LIMITS } from '../battle.limits'
import { BattleRawErrorFilter } from '../raw-response'
import { ForfeitService } from './forfeit.service'
import { InvitationsService } from './invitations.service'

type Req = Request & RequestWithAuth

const who = (req: Req) => {
  const s = ScopeContext.fromRequest(req)
  return { userId: s.userId, isTest: s.isTest }
}

/** Search, invitations (M16-07 to M16-11) and forfeit (M16-14): raw bodies, raw `{error}`. */
@Controller('battle')
@UseGuards(RateLimitGuard)
@UseInterceptors(NoStoreInterceptor)
@UseFilters(BattleRawErrorFilter)
export class InvitationsController {
  constructor(
    private readonly invitations: InvitationsService,
    private readonly forfeit: ForfeitService,
  ) {}

  @Get('search-opponent')
  @RateLimit(BATTLE_LIMITS.search)
  search(@Req() req: Req, @Query() query: Record<string, unknown>) {
    return this.invitations.search(who(req).userId, query.q)
  }

  @Post('invite')
  @HttpCode(200)
  @RateLimit(BATTLE_LIMITS.write)
  invite(@Req() req: Req, @Body() body: unknown) {
    const w = who(req)
    return this.invitations.invite(w.userId, w.isTest, body)
  }

  @Get('invitations')
  @RateLimit(BATTLE_LIMITS.read)
  list(@Req() req: Req) {
    const w = who(req)
    return this.invitations.list(w.userId, w.isTest)
  }

  @Post('invite/:uuid/accept')
  @HttpCode(200)
  @RateLimit(BATTLE_LIMITS.write)
  accept(@Req() req: Req, @Param('uuid') uuid: string) {
    const w = who(req)
    return this.invitations.accept(w.userId, w.isTest, uuid)
  }

  @Post('invite/:uuid/decline')
  @HttpCode(200)
  @RateLimit(BATTLE_LIMITS.write)
  decline(@Req() req: Req, @Param('uuid') uuid: string) {
    const w = who(req)
    return this.invitations.decline(w.userId, w.isTest, uuid)
  }

  @Post('forfeit/:uuid')
  @HttpCode(200)
  @RateLimit(BATTLE_LIMITS.write)
  forfeitBattle(@Req() req: Req, @Param('uuid') uuid: string) {
    return this.forfeit.forfeit(who(req).userId, uuid)
  }
}
