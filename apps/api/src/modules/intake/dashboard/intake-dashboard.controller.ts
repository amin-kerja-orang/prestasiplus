import { Controller, Get, Inject, Query, UseGuards, UseInterceptors } from '@nestjs/common'
import { IntakeDashboardCostQuerySchema, IntakeDashboardQuerySchema, type IntakeDashboardCostQuery, type IntakeDashboardQuery } from '@pp/contract'

import { Roles } from '../../../common/guards/decorators'
import { NoStoreInterceptor, ok } from '../../../common/http'
import { RateLimit, RateLimitGuard } from '../../../common/throttle'
import { ZodValidationPipe } from '../../../common/validation/zod-validation.pipe'
import { INTAKE_DASHBOARD_LIMITS } from './intake-dashboard.constants'
import { IntakeDashboardService } from './intake-dashboard.service'

/**
 * `/intake/dashboard*` (BE-40). Admin Pusat only: the global guards give 401 without a session, `@Roles('admin')` gives
 * 403 to every other role. GET only (no CSRF). Every answer is `no-store` (platform cost and queue figures).
 */
@Controller('intake/dashboard')
@Roles('admin')
@UseGuards(RateLimitGuard)
@UseInterceptors(NoStoreInterceptor)
export class IntakeDashboardController {
  constructor(@Inject(IntakeDashboardService) private readonly service: IntakeDashboardService) {}

  @Get()
  @RateLimit(INTAKE_DASHBOARD_LIMITS.read)
  async dashboard(@Query(new ZodValidationPipe(IntakeDashboardQuerySchema)) query: IntakeDashboardQuery) {
    return ok(await this.service.dashboard(query.month))
  }

  @Get('cost')
  @RateLimit(INTAKE_DASHBOARD_LIMITS.read)
  async cost(@Query(new ZodValidationPipe(IntakeDashboardCostQuerySchema)) query: IntakeDashboardCostQuery) {
    return ok(await this.service.cost(query.month, query.provider ?? null))
  }
}
