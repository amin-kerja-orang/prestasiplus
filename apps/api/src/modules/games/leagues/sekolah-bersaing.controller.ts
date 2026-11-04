import { Controller, Get, Inject, UseGuards } from '@nestjs/common'

import { Roles } from '../../../common/guards/decorators'
import { ok } from '../../../common/http/respond'
import { RateLimit, RateLimitGuard } from '../../../common/throttle'
import { GAMES_LIMITS } from '../games.constants'
import { LeaguesService } from './leagues.service'

/** Sekolah Bersaing live board (API-AS-14): a national board with no school scope, computed on request. School admin and admin only. */
@Controller('sekolah-bersaing')
@Roles('school_admin', 'admin')
@UseGuards(RateLimitGuard)
export class SekolahBersaingController {
  constructor(@Inject(LeaguesService) private readonly leagues: LeaguesService) {}

  @Get()
  @RateLimit(GAMES_LIMITS.read)
  async board() {
    return ok(await this.leagues.sekolahBersaing())
  }
}
