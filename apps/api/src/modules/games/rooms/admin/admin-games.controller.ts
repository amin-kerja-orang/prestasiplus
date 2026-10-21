import { Body, Controller, Get, Inject, Put, UseGuards } from '@nestjs/common'

import { Roles } from '../../../../common/guards/decorators'
import { ok } from '../../../../common/http/respond'
import { RateLimit, RateLimitGuard } from '../../../../common/throttle'
import { GAMES_LIMITS } from '../../games.constants'
import { AdminGamesService } from './admin-games.service'

/** Admin game statistics and settings (M16-51, M16-52): role `admin` only. */
@Controller('admin/games')
@Roles('admin')
@UseGuards(RateLimitGuard)
export class AdminGamesController {
  constructor(@Inject(AdminGamesService) private readonly admin: AdminGamesService) {}

  @Get()
  @RateLimit(GAMES_LIMITS.read)
  async overview() {
    return ok(await this.admin.overview())
  }

  @Put('settings')
  @RateLimit(GAMES_LIMITS.write)
  async settings(@Body() body: unknown) {
    return ok(await this.admin.setQuizTiles(body))
  }
}
