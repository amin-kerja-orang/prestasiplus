import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Post, Put, Req, UseGuards, UseInterceptors } from '@nestjs/common'
import type { Request } from 'express'

import { ApiError } from '../../../common/errors/api-error'
import { Roles } from '../../../common/guards/decorators'
import { NoStoreInterceptor } from '../../../common/http'
import { AUTH_CONTEXT_KEY, type RequestWithAuth } from '../../../common/scope/auth-context'
import { RateLimit, RateLimitGuard } from '../../../common/throttle'
import { actorOf, CONTENT_LIMITS } from '../shared/content-support'
import { BannersService } from './banners.service'

type Req = Request & RequestWithAuth

/** `GET /banners/active` (M09 #20): any signed-in user; the role picks the audience. */
@Controller()
@UseGuards(RateLimitGuard)
@UseInterceptors(NoStoreInterceptor)
export class ActiveBannersController {
  constructor(@Inject(BannersService) private readonly banners: BannersService) {}

  @Get('banners/active')
  @RateLimit(CONTENT_LIMITS.userRead)
  active(@Req() req: Req) {
    const auth = req[AUTH_CONTEXT_KEY]
    if (!auth) throw ApiError.of('UNAUTHORIZED')
    return this.banners.active(auth.active.role)
  }
}

/** Admin banners (M09 #15 to #19): admin only, `no-store`. */
@Controller('admin/banners')
@Roles('admin')
@UseGuards(RateLimitGuard)
@UseInterceptors(NoStoreInterceptor)
export class AdminBannersController {
  constructor(@Inject(BannersService) private readonly banners: BannersService) {}

  @Get()
  @RateLimit(CONTENT_LIMITS.adminRead)
  list() {
    return this.banners.list()
  }

  @Get(':id')
  @RateLimit(CONTENT_LIMITS.adminRead)
  async get(@Param('id') id: string) {
    return { data: await this.banners.get(id) }
  }

  @Post()
  @HttpCode(201)
  @RateLimit(CONTENT_LIMITS.adminWrite)
  create(@Req() req: Req, @Body() body: unknown) {
    return this.banners.create(actorOf(req), body)
  }

  @Put(':id')
  @RateLimit(CONTENT_LIMITS.adminWrite)
  update(@Req() req: Req, @Param('id') id: string, @Body() body: unknown) {
    return this.banners.update(actorOf(req), id, body)
  }

  @Delete(':id')
  @HttpCode(200)
  @RateLimit(CONTENT_LIMITS.adminWrite)
  remove(@Req() req: Req, @Param('id') id: string) {
    return this.banners.remove(actorOf(req), id)
  }
}
