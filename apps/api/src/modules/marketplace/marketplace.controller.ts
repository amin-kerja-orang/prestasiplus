import { Controller, Get, HttpCode, Param, Post, Query, UseGuards, UseInterceptors } from '@nestjs/common'

import { NoStoreInterceptor, ok } from '../../common/http'
import { RateLimit, RateLimitGuard } from '../../common/throttle'
import { MARKETPLACE_RATE as RATE } from './marketplace.constants'
import { MarketplaceService, type RawSearchQuery } from './marketplace.service'

/**
 * M20 buyer slice (BE-46): any signed-in role (the global guard answers 401 without a session). Product
 * and hand-off answers are `no-store` because they move counters. Seller and admin routes have no mock
 * route and are not served.
 */
@Controller('marketplace')
@UseGuards(RateLimitGuard)
export class MarketplaceController {
  constructor(private readonly marketplace: MarketplaceService) {}

  @Get('categories')
  async categories() {
    return ok(await this.marketplace.categories())
  }

  @Get('products')
  search(@Query() query: RawSearchQuery) {
    return this.marketplace.search(query ?? {})
  }

  @Get('products/:slug')
  @RateLimit(RATE.view)
  @UseInterceptors(NoStoreInterceptor)
  async product(@Param('slug') slug: string) {
    return ok(await this.marketplace.product(slug))
  }

  @Post('products/:slug/whatsapp')
  @HttpCode(200)
  @RateLimit(RATE.write)
  @UseInterceptors(NoStoreInterceptor)
  async whatsapp(@Param('slug') slug: string) {
    return ok(await this.marketplace.whatsapp(slug))
  }

  @Get('sellers/:id')
  async shop(@Param('id') id: string) {
    return ok(await this.marketplace.shop(id))
  }
}
