import { Controller, Get, Inject, Query, Req, UseGuards, UseInterceptors } from '@nestjs/common'
import { GuruWeeklyReportQuerySchema, type GuruWeeklyReportQuery } from '@pp/contract'
import type { Request } from 'express'

import { Roles } from '../../../../common/guards/decorators'
import { NoStoreInterceptor, ok } from '../../../../common/http'
import type { RequestWithAuth } from '../../../../common/scope'
import { RateLimit, RateLimitGuard, type RateLimitSpec } from '../../../../common/throttle'
import { ZodValidationPipe } from '../../../../common/validation/zod-validation.pipe'
import { WeeklyReportService } from '../services'
import { BoundedQueryPipe, ctxOf, overloadTo429 } from './request'

type Req = Request & RequestWithAuth

/** Shares the signed-in read budget of the other performance routes (D57a). */
const READ = {
  bucket: 'performance.read',
  env: 'THROTTLE_PERFORMANCE_READ_PER_MINUTE',
  default: 120,
  per: 'user',
} as const satisfies RateLimitSpec

/** API-GUR-21: teacher weekly class report (S6-T01). Role teacher only; the service answers 403 for another teacher's class. */
@Controller('guru')
@UseGuards(RateLimitGuard)
@RateLimit(READ)
@UseInterceptors(NoStoreInterceptor)
export class GuruWeeklyReportController {
  constructor(@Inject(WeeklyReportService) private readonly weekly: WeeklyReportService) {}

  @Get('weekly-report')
  @Roles('teacher')
  async report(
    @Query(new BoundedQueryPipe(), new ZodValidationPipe(GuruWeeklyReportQuerySchema)) query: GuruWeeklyReportQuery,
    @Req() req: Req,
  ) {
    return ok(await overloadTo429(() => this.weekly.guruReport(ctxOf(req).userId, query)))
  }
}
