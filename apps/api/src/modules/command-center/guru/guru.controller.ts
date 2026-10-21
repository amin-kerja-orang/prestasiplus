import { Controller, Get, Inject, Query, Req, UseGuards, UseInterceptors } from '@nestjs/common'

import { Roles } from '../../../common/guards/decorators'
import { NoStoreInterceptor } from '../../../common/http'
import type { RequestWithAuth } from '../../../common/scope/auth-context'
import { RateLimit, RateLimitGuard } from '../../../common/throttle'
import { COMMAND_CENTER_READ } from '../command-center.constants'
import { ConditionalGetInterceptor } from '../http/etag.interceptor'
import { badgeIdOf, guruDrillQueryOf, overloadTo429 } from '../http/request'
import { viewerOf } from '../http/viewer'
import { GuruService } from './guru.service'

/**
 * Teacher Command Center routes 12 to 17 under `/guru/command-center`. Teacher and admin. Bodies are BARE (no `{ data }`).
 * The prefix is shared with BE-18's `remedial/*` routes (another controller); only the six routes below belong here.
 * OWNER: guru implementer (this file and `guru.service.ts`).
 */
@Controller('guru/command-center')
@Roles('teacher', 'admin')
@UseGuards(RateLimitGuard)
@RateLimit(COMMAND_CENTER_READ)
@UseInterceptors(NoStoreInterceptor, ConditionalGetInterceptor)
export class GuruController {
  constructor(@Inject(GuruService) private readonly guru: GuruService) {}

  @Get('live-data')
  liveData(@Req() req: RequestWithAuth) {
    const viewer = viewerOf(req)
    return overloadTo429(() => this.guru.liveData(viewer))
  }

  @Get('drill')
  drill(@Req() req: RequestWithAuth, @Query() query: { type?: unknown; filter?: unknown }) {
    const viewer = viewerOf(req)
    const { type, filter } = guruDrillQueryOf(query)
    return overloadTo429(() => this.guru.drill(viewer, type, filter))
  }

  @Get('evaluate')
  evaluate(@Req() req: RequestWithAuth) {
    const viewer = viewerOf(req)
    return overloadTo429(() => this.guru.evaluate(viewer))
  }

  @Get('predictive')
  predictive(@Req() req: RequestWithAuth) {
    const viewer = viewerOf(req)
    return overloadTo429(() => this.guru.predictive(viewer))
  }

  @Get('achievements')
  achievements(@Req() req: RequestWithAuth) {
    const viewer = viewerOf(req)
    return overloadTo429(() => this.guru.achievements(viewer))
  }

  @Get('badge-holders')
  badgeHolders(@Req() req: RequestWithAuth, @Query('badgeId') badgeId?: unknown) {
    const viewer = viewerOf(req)
    const id = badgeIdOf(badgeId)
    return overloadTo429(() => this.guru.badgeHolders(viewer, id))
  }
}
