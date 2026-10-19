import { Body, Controller, Get, HttpCode, Param, Post, UseGuards, UseInterceptors } from '@nestjs/common'

import { Roles } from '../../common/guards/decorators'
import { NoStoreInterceptor, ok } from '../../common/http'
import { RateLimit, RateLimitGuard } from '../../common/throttle'
import { CurrentCaller, type Caller } from '../users/caller'
import { SUBSCRIPTION_LIMITS } from './subscriptions.constants'
import { UserPackagesService } from './user-packages.service'

/** School-admin package cards (mock S16). Central admin only. */
@Controller('admin/users')
@Roles('admin')
@UseGuards(RateLimitGuard)
@UseInterceptors(NoStoreInterceptor)
export class UserPackagesController {
  constructor(private readonly packages: UserPackagesService) {}

  @Get(':id/packages')
  @RateLimit(SUBSCRIPTION_LIMITS.read)
  async view(@Param('id') id: string) {
    return ok(await this.packages.view(id))
  }

  /** The body is parsed inside the service, after the user checks (404, then 422), as the mock orders them. */
  @Post(':id/packages')
  @HttpCode(200)
  @RateLimit(SUBSCRIPTION_LIMITS.write)
  async assign(@CurrentCaller() caller: Caller, @Param('id') id: string, @Body() body: unknown) {
    return this.packages.assign(caller, id, body)
  }
}
