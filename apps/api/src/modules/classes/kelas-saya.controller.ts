import { Controller, Get, UseGuards, UseInterceptors } from '@nestjs/common'

import { listMeta, NoStoreInterceptor, okList } from '../../common/http'
import { RateLimit, RateLimitGuard } from '../../common/throttle'
import { Actor, type ClassActor } from './actor'
import { CLASS_LIMITS } from './classes.constants'
import { ClassesService } from './classes.service'

/**
 * "Kelas Saya" (SRS #73): any signed-in account may list its joined classes. There is no join route (API-MUR-04:
 * `POST /kelas-saya/join` answers the global 404 for every role).
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
}
