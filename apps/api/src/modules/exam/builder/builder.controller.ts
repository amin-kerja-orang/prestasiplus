import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Post, Put, Query, UseGuards, UseInterceptors } from '@nestjs/common'

import { Roles } from '../../../common/guards'
import { NoStoreInterceptor } from '../../../common/http'
import { ok } from '../../../common/http/respond'
import { RateLimit, RateLimitGuard } from '../../../common/throttle'
import { Actor, type AuditActor } from './actor'
import { BIJAK_BUILDER_LIMITS } from './builder.constants'
import { BuilderService } from './builder.service'

/**
 * Paper builder (BE-39), Admin Pusat only. Bodies and the list query are read raw and parsed in the
 * service, so that a missing paper is 404 before a bad body is 422 (the mock's order). CSRF on every
 * mutation is enforced by the session guard. `POST preview` is declared before the `:id` routes.
 */
@Controller('admin/papers')
@Roles('admin')
@UseGuards(RateLimitGuard)
export class BuilderController {
  constructor(@Inject(BuilderService) private readonly builder: BuilderService) {}

  @Get()
  @RateLimit(BIJAK_BUILDER_LIMITS.read)
  list(@Query() query: unknown) {
    return this.builder.list(query)
  }

  @Post()
  @RateLimit(BIJAK_BUILDER_LIMITS.write)
  async create(@Actor() actor: AuditActor, @Body() body: unknown) {
    return ok(await this.builder.create(actor, body))
  }

  @Post('preview')
  @HttpCode(200)
  @RateLimit(BIJAK_BUILDER_LIMITS.write)
  @UseInterceptors(NoStoreInterceptor)
  async preview(@Body() body: unknown) {
    return ok(await this.builder.preview(body))
  }

  @Get(':id')
  @RateLimit(BIJAK_BUILDER_LIMITS.read)
  async get(@Param('id') id: string) {
    return ok(await this.builder.get(id))
  }

  @Put(':id')
  @RateLimit(BIJAK_BUILDER_LIMITS.write)
  async update(@Actor() actor: AuditActor, @Param('id') id: string, @Body() body: unknown) {
    return ok(await this.builder.update(actor, id, body))
  }

  @Delete(':id')
  @RateLimit(BIJAK_BUILDER_LIMITS.write)
  async remove(@Actor() actor: AuditActor, @Param('id') id: string) {
    return ok(await this.builder.remove(actor, id))
  }

  @Post(':id/publish')
  @HttpCode(200)
  @RateLimit(BIJAK_BUILDER_LIMITS.write)
  async publish(@Actor() actor: AuditActor, @Param('id') id: string) {
    return ok(await this.builder.publish(actor, id))
  }

  @Post(':id/withdraw')
  @HttpCode(200)
  @RateLimit(BIJAK_BUILDER_LIMITS.write)
  async withdraw(@Actor() actor: AuditActor, @Param('id') id: string) {
    return ok(await this.builder.withdraw(actor, id))
  }
}
