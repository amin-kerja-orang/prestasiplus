import { Body, Controller, Get, HttpCode, Param, Post, Put, Query, UseGuards, UseInterceptors } from '@nestjs/common'
import {
  SubscriptionExtendRequestSchema,
  SubscriptionListQuerySchema,
  SubscriptionQuotaRequestSchema,
  SubscriptionUpgradeRequestSchema,
} from '@pp/contract'

import { Roles } from '../../common/guards/decorators'
import { NoStoreInterceptor, ok } from '../../common/http'
import { RateLimit, RateLimitGuard } from '../../common/throttle'
import { ZodValidationPipe } from '../../common/validation/zod-validation.pipe'
import { CurrentCaller, type Caller } from '../users/caller'
import { StrictBodyPipe } from './strict-body'
import { SUBSCRIPTION_LIMITS } from './subscriptions.constants'
import {
  SchoolSubscriptionsService,
  type ExtendBody,
  type QuotaBody,
  type SubscriptionListQuery,
  type UpgradeBody,
} from './subscriptions.service'

/**
 * School subscriptions (BE-25 part A). Central admin only, as the contract and the mock: a
 * school_admin gets 403. The repository still applies the caller's scope, so the rule "a school only
 * sees its own subscription (404 otherwise)" holds even if the role list is ever widened.
 * Everything here is `no-store` (school figures and minors' rosters) and rate limited per user.
 */
@Controller('admin')
@Roles('admin')
@UseGuards(RateLimitGuard)
@UseInterceptors(NoStoreInterceptor)
export class SubscriptionsController {
  constructor(private readonly subscriptions: SchoolSubscriptionsService) {}

  @Get('school-packages')
  @RateLimit(SUBSCRIPTION_LIMITS.read)
  async packages() {
    return ok(await this.subscriptions.packages())
  }

  @Get('school-subscriptions')
  @RateLimit(SUBSCRIPTION_LIMITS.read)
  async list(
    @CurrentCaller() caller: Caller,
    @Query(new ZodValidationPipe(SubscriptionListQuerySchema)) query: SubscriptionListQuery,
  ) {
    return this.subscriptions.list(caller, query)
  }

  @Post('school-subscriptions')
  @RateLimit(SUBSCRIPTION_LIMITS.write)
  async create(@CurrentCaller() caller: Caller, @Body() body: unknown) {
    return this.subscriptions.create(caller, body)
  }

  @Get('school-subscriptions/:id')
  @RateLimit(SUBSCRIPTION_LIMITS.read)
  async detail(@CurrentCaller() caller: Caller, @Param('id') id: string) {
    return ok(await this.subscriptions.detail(caller, id))
  }

  @Get('school-subscriptions/:id/students')
  @RateLimit(SUBSCRIPTION_LIMITS.read)
  async students(@CurrentCaller() caller: Caller, @Param('id') id: string, @Query() query: Record<string, unknown>) {
    return this.subscriptions.students(caller, id, query)
  }

  @Get('school-subscriptions/:id/renewal-invoice')
  @RateLimit(SUBSCRIPTION_LIMITS.read)
  async renewalInvoice(@CurrentCaller() caller: Caller, @Param('id') id: string) {
    return ok(await this.subscriptions.renewalInvoice(caller, id))
  }

  @Put('school-subscriptions/:id/quota')
  @RateLimit(SUBSCRIPTION_LIMITS.write)
  async quota(
    @CurrentCaller() caller: Caller,
    @Param('id') id: string,
    @Body(new StrictBodyPipe(SubscriptionQuotaRequestSchema)) body: QuotaBody,
  ) {
    return this.subscriptions.updateQuota(caller, id, body)
  }

  @Post('school-subscriptions/:id/extend')
  @HttpCode(200)
  @RateLimit(SUBSCRIPTION_LIMITS.write)
  async extend(
    @CurrentCaller() caller: Caller,
    @Param('id') id: string,
    @Body(new StrictBodyPipe(SubscriptionExtendRequestSchema)) body: ExtendBody,
  ) {
    return this.subscriptions.extend(caller, id, body)
  }

  @Post('school-subscriptions/:id/upgrade')
  @HttpCode(200)
  @RateLimit(SUBSCRIPTION_LIMITS.write)
  async upgrade(
    @CurrentCaller() caller: Caller,
    @Param('id') id: string,
    @Body(new StrictBodyPipe(SubscriptionUpgradeRequestSchema)) body: UpgradeBody,
  ) {
    return this.subscriptions.upgrade(caller, id, body)
  }

  @Post('school-subscriptions/:id/cancel')
  @HttpCode(200)
  @RateLimit(SUBSCRIPTION_LIMITS.write)
  async cancel(@CurrentCaller() caller: Caller, @Param('id') id: string) {
    return this.subscriptions.cancel(caller, id)
  }
}
