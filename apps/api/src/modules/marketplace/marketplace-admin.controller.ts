import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query, UseGuards, UseInterceptors } from '@nestjs/common'
import {
  MarketplaceAdminProductCreateSchema,
  MarketplaceAdminProductListQuerySchema,
  MarketplaceAdminProductUpdateSchema,
  MarketplaceAdminSellerListQuerySchema,
  type MarketplaceAdminProductCreate,
  type MarketplaceAdminProductListQuery,
  type MarketplaceAdminProductUpdate,
  type MarketplaceAdminSellerListQuery,
} from '@pp/contract'

import { Roles } from '../../common/guards'
import { NoStoreInterceptor, ok } from '../../common/http'
import { RateLimit, RateLimitGuard } from '../../common/throttle'
import { StrictZodValidationPipe } from '../../common/validation/strict-body'
import { Actor, type MarketplaceActor } from './marketplace-admin.actor'
import { MarketplaceAdminService } from './marketplace-admin.service'
import { MARKETPLACE_ADMIN_RATE as RATE } from './marketplace.constants'

/**
 * Admin routes of M20 (API-ADM-19, S7-T08): the `admin` role only (any other role is 403, no session 401). CSRF on
 * every write is enforced by the session guard; writes are rate limited per user and audited. Static paths
 * (`seller-options`) are declared before `:id`. Sellers are listed, read and moved between statuses; they are never
 * created or deleted here.
 */
@Roles('admin')
@Controller('admin/marketplace')
@UseGuards(RateLimitGuard)
@UseInterceptors(NoStoreInterceptor)
@RateLimit(RATE.read)
export class MarketplaceAdminController {
  constructor(private readonly admin: MarketplaceAdminService) {}

  @Get('products')
  async products(@Query(new StrictZodValidationPipe(MarketplaceAdminProductListQuerySchema)) query: MarketplaceAdminProductListQuery) {
    return this.admin.products(query)
  }

  @Post('products')
  @HttpCode(201)
  @RateLimit(RATE.write)
  async create(@Actor() actor: MarketplaceActor, @Body(new StrictZodValidationPipe(MarketplaceAdminProductCreateSchema)) body: MarketplaceAdminProductCreate) {
    return ok(await this.admin.create(actor, body))
  }

  @Get('products/:id')
  async product(@Param('id') id: string) {
    return ok(await this.admin.product(id))
  }

  @Put('products/:id')
  @RateLimit(RATE.write)
  async update(
    @Actor() actor: MarketplaceActor,
    @Param('id') id: string,
    @Body(new StrictZodValidationPipe(MarketplaceAdminProductUpdateSchema)) body: MarketplaceAdminProductUpdate,
  ) {
    return ok(await this.admin.update(actor, id, body))
  }

  @Delete('products/:id')
  @HttpCode(200)
  @RateLimit(RATE.write)
  async remove(@Actor() actor: MarketplaceActor, @Param('id') id: string) {
    return ok(await this.admin.remove(actor, id))
  }

  @Delete('products/:id/images/:imageId')
  @HttpCode(200)
  @RateLimit(RATE.write)
  async removeImage(@Actor() actor: MarketplaceActor, @Param('id') id: string, @Param('imageId') imageId: string) {
    return ok(await this.admin.removeImage(actor, id, imageId))
  }

  @Get('seller-options')
  async sellerOptions() {
    return ok(await this.admin.sellerOptions())
  }

  @Get('sellers')
  async sellers(@Query(new StrictZodValidationPipe(MarketplaceAdminSellerListQuerySchema)) query: MarketplaceAdminSellerListQuery) {
    return this.admin.sellers(query)
  }

  @Get('sellers/:id')
  async seller(@Param('id') id: string) {
    return ok(await this.admin.seller(id))
  }

  @Post('sellers/:id/approve')
  @HttpCode(200)
  @RateLimit(RATE.write)
  async approve(@Actor() actor: MarketplaceActor, @Param('id') id: string) {
    return ok(await this.admin.transition(actor, id, 'approve'))
  }

  @Post('sellers/:id/verify')
  @HttpCode(200)
  @RateLimit(RATE.write)
  async verify(@Actor() actor: MarketplaceActor, @Param('id') id: string) {
    return ok(await this.admin.transition(actor, id, 'verify'))
  }

  @Post('sellers/:id/suspend')
  @HttpCode(200)
  @RateLimit(RATE.write)
  async suspend(@Actor() actor: MarketplaceActor, @Param('id') id: string) {
    return ok(await this.admin.transition(actor, id, 'suspend'))
  }

  @Post('sellers/:id/ban')
  @HttpCode(200)
  @RateLimit(RATE.write)
  async ban(@Actor() actor: MarketplaceActor, @Param('id') id: string) {
    return ok(await this.admin.transition(actor, id, 'ban'))
  }
}
