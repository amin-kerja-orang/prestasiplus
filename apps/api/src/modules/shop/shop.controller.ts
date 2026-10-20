import { Controller, Get, HttpCode, Param, Post, Query, Body, UseGuards, UseInterceptors, Req } from '@nestjs/common'
import type { Request } from 'express'

import { ApiError } from '../../common/errors/api-error'
import { NoStoreInterceptor, ok } from '../../common/http'
import { AUTH_CONTEXT_KEY, type RequestWithAuth } from '../../common/scope/auth-context'
import { RateLimit, RateLimitGuard } from '../../common/throttle'
import { isOverloadError } from '../auth/auth.errors'
import { Actor, type ShopActor } from './actor'
import { SHOP_LIMITS } from './shop.constants'
import { ShopService } from './shop.service'

type Req = Request & RequestWithAuth

/** The caller's own id: there is no user id parameter anywhere, so no one can act on another user's shop data. */
function me(req: Req): string {
  const auth = req[AUTH_CONTEXT_KEY]
  if (!auth) throw ApiError.of('UNAUTHORIZED')
  return auth.userId
}

/** An overloaded database is a retryable 429, never a 500. */
async function guard<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    if (isOverloadError(err)) throw ApiError.of('RATE_LIMITED', { retryAfter: 5 })
    throw err
  }
}

/**
 * Student routes of M15 (any signed-in role, like the mock; the session guard makes anonymous calls 401 and checks
 * CSRF on every write). Every answer is `no-store`. The three spending writes are limited per user (429) and refused
 * in Mod Pelajar. The parent approval routes (`/parent/hadiah-approvals*`) are NOT built in B1 (UD-3): they answer 404.
 */
@Controller()
@UseGuards(RateLimitGuard)
@UseInterceptors(NoStoreInterceptor)
export class ShopController {
  constructor(private readonly shop: ShopService) {}

  @Get('hadiah-digital/items')
  digitalItems(@Query('cat') cat: unknown) {
    return this.shop.digitalItems(cat)
  }

  @Get('hadiah-digital/redemptions')
  digitalRedemptions() {
    return this.shop.digitalRedemptions()
  }

  @Post('hadiah/redemptions')
  @RateLimit(SHOP_LIMITS.write)
  async redeem(@Actor() actor: ShopActor, @Body() body: unknown) {
    return ok(await guard(() => this.shop.redeem(actor, body)))
  }

  @Get('gamification/mystery-boxes')
  async boxes(@Req() req: Req) {
    return ok(await guard(() => this.shop.boxes(me(req))))
  }

  @Post('gamification/mystery-boxes/:id/open')
  @HttpCode(200)
  @RateLimit(SHOP_LIMITS.write)
  async open(@Actor() actor: ShopActor, @Param('id') id: string) {
    return ok(await guard(() => this.shop.openBox(actor, id)))
  }

  @Get('cabutan')
  async cabutan(@Req() req: Req) {
    return ok(await guard(() => this.shop.cabutan(me(req))))
  }

  @Post('cabutan/:drawId/tickets')
  @RateLimit(SHOP_LIMITS.write)
  async buyTicket(@Actor() actor: ShopActor, @Param('drawId') drawId: string) {
    return ok(await guard(() => this.shop.buyTicket(actor, drawId)))
  }
}
