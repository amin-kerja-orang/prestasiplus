import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards, UseInterceptors } from '@nestjs/common'

import { Roles } from '../../../common/guards/decorators'
import { NoStoreInterceptor, ok } from '../../../common/http'
import { RateLimit, RateLimitGuard } from '../../../common/throttle'
import { CurrentCaller, type Caller } from '../../users/caller'
import { SUBSCRIPTION_LIMITS } from '../subscriptions.constants'
import { CompStudentsService } from './comp-students.service'

/**
 * Complimentary students (BE-25 part A). Central admin only, `no-store` (minors' data, masked IC),
 * rate limited per user. Bodies are parsed inside the service (strict).
 */
@Controller('admin/comp-students')
@Roles('admin')
@UseGuards(RateLimitGuard)
@UseInterceptors(NoStoreInterceptor)
export class CompStudentsController {
  constructor(private readonly comp: CompStudentsService) {}

  @Get()
  @RateLimit(SUBSCRIPTION_LIMITS.read)
  async list(@Query() query: Record<string, unknown>) {
    return this.comp.list(query)
  }

  @Post()
  @RateLimit(SUBSCRIPTION_LIMITS.import)
  async register(@CurrentCaller() caller: Caller, @Body() body: unknown) {
    return this.comp.register(caller, body)
  }

  @Post('bulk-action')
  @HttpCode(200)
  @RateLimit(SUBSCRIPTION_LIMITS.write)
  async bulk(@CurrentCaller() caller: Caller, @Body() body: unknown) {
    return this.comp.bulk(caller, body)
  }

  @Get(':id')
  @RateLimit(SUBSCRIPTION_LIMITS.read)
  async detail(@Param('id') id: string) {
    return ok(await this.comp.detail(id))
  }

  @Post(':id/toggle-coins')
  @HttpCode(200)
  @RateLimit(SUBSCRIPTION_LIMITS.write)
  async toggleCoins(@CurrentCaller() caller: Caller, @Param('id') id: string) {
    return this.comp.toggleCoins(caller, id)
  }

  @Post(':id/toggle-active')
  @HttpCode(200)
  @RateLimit(SUBSCRIPTION_LIMITS.write)
  async toggleActive(@CurrentCaller() caller: Caller, @Param('id') id: string) {
    return this.comp.toggleActive(caller, id)
  }
}
