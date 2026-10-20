import { Body, Controller, Get, HttpCode, Post, UseGuards, UseInterceptors } from '@nestjs/common'

import { listMeta, NoStoreInterceptor, okList } from '../../common/http'
import { RateLimit, RateLimitGuard } from '../../common/throttle'
import { Actor, type ClassActor } from './actor'
import { CLASS_LIMITS } from './classes.constants'
import { ClassesService } from './classes.service'

/**
 * "Kelas Saya" (SRS #73, #74): any signed-in account may list its joined classes; joining is limited to the
 * student (and the admin) inside the service so the refusal text is the mock's. The join has its own, tighter
 * throttle because the join code is a guessing target.
 */
@Controller('kelas-saya')
@UseGuards(RateLimitGuard)
@UseInterceptors(NoStoreInterceptor)
export class KelasSayaController {
  constructor(private readonly classes: ClassesService) {}

  @Get()
  @RateLimit(CLASS_LIMITS.read)
  async list(@Actor() actor: ClassActor) {
    const items = await this.classes.joinedClasses(actor)
    return okList(items, listMeta(1, Math.max(1, items.length), items.length))
  }

  @Post('join')
  @HttpCode(201)
  @RateLimit(CLASS_LIMITS.join)
  async join(@Actor() actor: ClassActor, @Body() body: unknown) {
    return this.classes.join(actor, body)
  }
}
