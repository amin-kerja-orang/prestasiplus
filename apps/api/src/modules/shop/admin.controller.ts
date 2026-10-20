import { Body, Controller, Get, HttpCode, Param, Post, Put, Query, UseGuards, UseInterceptors } from '@nestjs/common'

import { NoStoreInterceptor, ok } from '../../common/http'
import { Roles } from '../../common/guards'
import { RateLimit, RateLimitGuard } from '../../common/throttle'
import { Actor, type ShopActor } from './actor'
import { ShopAdminService } from './admin.service'
import { SHOP_LIMITS } from './shop.constants'

/**
 * Admin routes of M15 (SRS #1 to #8): the `admin` role only (a student, also an admin in Mod Pelajar, is 403).
 * CSRF on every write is enforced by the session guard; writes are rate limited per user (429) and audited.
 * Declaration order matters: the static paths `bulk` and `redemptions...` come before `:id`, so they are never read as ids.
 */
@Roles('admin')
@Controller('admin/hadiah')
@UseGuards(RateLimitGuard)
@UseInterceptors(NoStoreInterceptor)
export class ShopAdminController {
  constructor(private readonly admin: ShopAdminService) {}

  @Get()
  list(@Query() query: Record<string, unknown>) {
    return this.admin.list(query)
  }

  @Post('bulk')
  @HttpCode(200)
  @RateLimit(SHOP_LIMITS.adminWrite)
  async bulk(@Actor() actor: ShopActor, @Body() body: unknown) {
    return ok(await this.admin.bulk(actor, body))
  }

  @Get('redemptions')
  queue(@Query() query: Record<string, unknown>) {
    return this.admin.queue(query)
  }

  @Post('redemptions/:id/deliver')
  @HttpCode(200)
  @RateLimit(SHOP_LIMITS.adminWrite)
  async deliver(@Actor() actor: ShopActor, @Param('id') id: string, @Body() body: unknown) {
    return ok(await this.admin.deliver(actor, id, body))
  }

  @Post('redemptions/:id/cancel')
  @HttpCode(200)
  @RateLimit(SHOP_LIMITS.adminWrite)
  async cancel(@Actor() actor: ShopActor, @Param('id') id: string) {
    return ok(await this.admin.cancel(actor, id))
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    return ok(await this.admin.get(id))
  }

  @Post()
  @RateLimit(SHOP_LIMITS.adminWrite)
  async create(@Actor() actor: ShopActor, @Body() body: unknown) {
    return ok(await this.admin.create(actor, body))
  }

  @Put(':id')
  @RateLimit(SHOP_LIMITS.adminWrite)
  async update(@Actor() actor: ShopActor, @Param('id') id: string, @Body() body: unknown) {
    return ok(await this.admin.update(actor, id, body))
  }
}
