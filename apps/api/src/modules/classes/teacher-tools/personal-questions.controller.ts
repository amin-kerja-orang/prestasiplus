import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards, UseInterceptors } from '@nestjs/common'

import { Roles } from '../../../common/guards/decorators'
import { listMeta, NoStoreInterceptor, ok, okList } from '../../../common/http'
import { RateLimit, RateLimitGuard } from '../../../common/throttle'
import { Actor, type ClassActor } from '../actor'
import { CLASS_LIMITS } from '../classes.constants'
import { PersonalQuestionsService } from './personal-questions.service'

/**
 * Soalan & Rujukan (S6-T16, API-GUR-24): `GET/POST /api/guru/personal-questions`, `GET/PUT/DELETE /:id`. Role `teacher` only; own rows only
 * (another teacher's id is 404). Answers are `no-store`; reads and writes are rate limited per user (D57).
 */
@Controller('guru/personal-questions')
@Roles('teacher')
@UseGuards(RateLimitGuard)
@UseInterceptors(NoStoreInterceptor)
export class PersonalQuestionsController {
  constructor(private readonly personal: PersonalQuestionsService) {}

  @Get()
  @RateLimit(CLASS_LIMITS.read)
  async list(@Actor() actor: ClassActor, @Query() query: Record<string, unknown>) {
    const res = await this.personal.list(actor, query)
    return okList(res.rows, listMeta(res.page, res.pageSize, res.total))
  }

  @Post()
  @RateLimit(CLASS_LIMITS.write)
  async create(@Actor() actor: ClassActor, @Body() body: unknown) {
    return ok(await this.personal.create(actor, body))
  }

  @Get(':id')
  @RateLimit(CLASS_LIMITS.read)
  async get(@Actor() actor: ClassActor, @Param('id') id: string) {
    return ok(await this.personal.get(actor, id))
  }

  @Put(':id')
  @RateLimit(CLASS_LIMITS.write)
  async update(@Actor() actor: ClassActor, @Param('id') id: string, @Body() body: unknown) {
    return ok(await this.personal.update(actor, id, body))
  }

  @Delete(':id')
  @RateLimit(CLASS_LIMITS.write)
  async remove(@Actor() actor: ClassActor, @Param('id') id: string) {
    return ok(await this.personal.remove(actor, id))
  }
}
