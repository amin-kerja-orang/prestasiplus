import { Controller, Get, Inject, Query, UseGuards } from '@nestjs/common'

import { ok } from '../../../common/http/respond'
import { RateLimit, RateLimitGuard } from '../../../common/throttle'
import { GAMES_LIMITS } from '../games.constants'
import { LeaguesService } from './leagues.service'

/** Sekolah Bersaing weekly board (M16-50): a national board with no school scope. Any signed-in role. */
@Controller('sekolah-bersaing')
@UseGuards(RateLimitGuard)
export class SekolahBersaingController {
  constructor(@Inject(LeaguesService) private readonly leagues: LeaguesService) {}

  @Get()
  @RateLimit(GAMES_LIMITS.read)
  async board(@Query('week') week: unknown) {
    return ok(await this.leagues.sekolahBersaing(week))
  }
}
