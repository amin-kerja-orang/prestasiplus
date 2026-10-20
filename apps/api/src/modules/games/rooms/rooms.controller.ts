import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import type { Request } from 'express'

import { NoStoreInterceptor } from '../../../common/http/no-store.interceptor'
import { ok } from '../../../common/http/respond'
import type { RequestWithAuth } from '../../../common/scope'
import { RateLimit, RateLimitGuard } from '../../../common/throttle'
import { callerOf } from '../caller'
import { GAMES_LIMITS } from '../games.constants'
import { RoomsService } from './rooms.service'

type Req = Request & RequestWithAuth

/**
 * Hub, lobby and the six room games (M16-22..28). Any signed-in role. `GET /games/hub` is declared before every
 * `:game` route. Room codes are join codes: hub, create, join and the room view are `no-store` (D57b).
 */
@Controller('games')
@UseGuards(RateLimitGuard)
export class RoomsController {
  constructor(@Inject(RoomsService) private readonly rooms: RoomsService) {}

  @Get('hub')
  @RateLimit(GAMES_LIMITS.read)
  @UseInterceptors(NoStoreInterceptor)
  async hub(@Req() req: Req) {
    return ok(await this.rooms.hub(callerOf(req)))
  }

  @Get(':game/lobby')
  @RateLimit(GAMES_LIMITS.read)
  async lobby(@Param('game') game: string, @Req() req: Req) {
    return ok(await this.rooms.lobby(callerOf(req), game))
  }

  @Post(':game/rooms')
  @RateLimit(GAMES_LIMITS.write)
  @UseInterceptors(NoStoreInterceptor)
  async create(@Param('game') game: string, @Body() body: unknown, @Req() req: Req) {
    return ok(await this.rooms.create(callerOf(req), game, body))
  }

  @Post(':game/rooms/join')
  @HttpCode(200)
  @RateLimit(GAMES_LIMITS.write)
  @UseInterceptors(NoStoreInterceptor)
  async join(@Param('game') game: string, @Body() body: unknown, @Req() req: Req) {
    return ok(await this.rooms.join(callerOf(req), game, body))
  }

  @Get(':game/rooms/:code')
  @RateLimit(GAMES_LIMITS.read)
  @UseInterceptors(NoStoreInterceptor)
  async view(@Param('game') game: string, @Param('code') code: string, @Req() req: Req) {
    return ok(await this.rooms.view(callerOf(req), game, code))
  }

  @Post(':game/rooms/:code/start')
  @HttpCode(200)
  @RateLimit(GAMES_LIMITS.write)
  async start(@Param('game') game: string, @Param('code') code: string, @Req() req: Req) {
    return ok(await this.rooms.start(callerOf(req), game, code))
  }

  @Post(':game/rooms/:code/action')
  @HttpCode(200)
  @RateLimit(GAMES_LIMITS.write)
  async action(
    @Param('game') game: string,
    @Param('code') code: string,
    @Body() body: unknown,
    @Req() req: Req,
  ) {
    return ok(await this.rooms.action(callerOf(req), game, code, body))
  }
}
