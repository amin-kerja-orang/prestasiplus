import { Controller, Get, Param, UseGuards, UseInterceptors } from '@nestjs/common'

import { listMeta, NoStoreInterceptor, ok, okList } from '../../../common/http'
import { RateLimit, RateLimitGuard } from '../../../common/throttle'
import { Actor, type ClassActor } from '../actor'
import { MISSION_LIMITS } from './missions.constants'
import { MissionsService } from './missions.service'
import { RemedialService } from './remedial.service'

/**
 * The student reads of assigned work (M05 #20, #20b, #21): any signed-in user, no role check. Answers are
 * `no-store` (they name pupils and teachers) and every route is rate limited per user (D57). The preview
 * carries the answer key and answers only the test's own teacher and an admin (checked in the service).
 */
@Controller()
@UseGuards(RateLimitGuard)
@UseInterceptors(NoStoreInterceptor)
export class MissionsController {
  constructor(
    private readonly missions: MissionsService,
    private readonly remedial: RemedialService,
  ) {}

  @Get('missions/today')
  @RateLimit(MISSION_LIMITS.read)
  async today(@Actor() actor: ClassActor) {
    const items = await this.missions.today(actor)
    return okList(items, listMeta(1, Math.max(1, items.length), items.length))
  }

  @Get('remedial-tests/mine')
  @RateLimit(MISSION_LIMITS.read)
  async mine(@Actor() actor: ClassActor) {
    const items = await this.remedial.mine(actor)
    return okList(items, listMeta(1, Math.max(1, items.length), items.length))
  }

  @Get('remedial-tests/:id')
  @RateLimit(MISSION_LIMITS.read)
  async preview(@Actor() actor: ClassActor, @Param('id') id: string) {
    return ok(await this.remedial.preview(actor, id))
  }
}
