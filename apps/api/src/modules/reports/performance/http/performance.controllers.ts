import { Controller, Get, Inject, Param, Query, Req, UseGuards, UseInterceptors } from '@nestjs/common'
import { PerformanceClassAnalyticsQuerySchema, PerformanceItemAnalysisQuerySchema } from '@pp/contract'
import type { Request } from 'express'

import { Roles } from '../../../../common/guards/decorators'
import { NoStoreInterceptor, ok } from '../../../../common/http'
import type { RequestWithAuth } from '../../../../common/scope'
import { RateLimit, RateLimitGuard, type RateLimitSpec } from '../../../../common/throttle'
import { ZodValidationPipe } from '../../../../common/validation/zod-validation.pipe'
import {
  AnalyticsService,
  ClassPerformanceService,
  ItemAnalysisService,
  SchoolPerformanceService,
  StudentPerformanceService,
  type ItemAnalysisSchoolQuery,
  type PerformanceClassAnalyticsQuery,
} from '../services'
import { BoundedQueryPipe, CtxFactory, overloadTo429, SafeIdPipe } from './request'

type Req = Request & RequestWithAuth

/** One bucket for the three controllers: a user browsing reports shares one budget (D57a). */
const READ = {
  bucket: 'performance.read',
  env: 'THROTTLE_PERFORMANCE_READ_PER_MINUTE',
  default: 120,
  per: 'user',
} as const satisfies RateLimitSpec

const itemAnalysisQuery = [new BoundedQueryPipe(), new ZodValidationPipe(PerformanceItemAnalysisQuerySchema)] as const

/**
 * Prestasi, Analitik and Analisa Item (BE-19 slice). Every body is pupil performance data, so every
 * response is `no-store` and every route is rate limited per user. Per-resource refusals (404 or
 * 403, per route as the contract says) come from the services.
 */
@Controller()
@UseGuards(RateLimitGuard)
@RateLimit(READ)
@UseInterceptors(NoStoreInterceptor)
export class AnalyticsController {
  constructor(
    @Inject(AnalyticsService) private readonly analytics: AnalyticsService,
    @Inject(CtxFactory) private readonly ctx: CtxFactory,
  ) {}

  @Get('analytics/me')
  async me(@Req() req: Req) {
    return ok(await overloadTo429(async () => this.analytics.me(await this.ctx.of(req))))
  }

  @Roles('admin', 'teacher')
  @Get('analytics/classes')
  async classes(
    @Query(new BoundedQueryPipe(), new ZodValidationPipe(PerformanceClassAnalyticsQuerySchema))
    query: PerformanceClassAnalyticsQuery,
    @Req() req: Req,
  ) {
    return ok(await overloadTo429(async () => this.analytics.classes(await this.ctx.of(req), query)))
  }
}

@Controller('performance')
@UseGuards(RateLimitGuard)
@RateLimit(READ)
@UseInterceptors(NoStoreInterceptor)
export class PerformanceController {
  constructor(
    @Inject(StudentPerformanceService) private readonly students: StudentPerformanceService,
    @Inject(SchoolPerformanceService) private readonly school: SchoolPerformanceService,
    @Inject(ClassPerformanceService) private readonly classes: ClassPerformanceService,
    @Inject(CtxFactory) private readonly ctx: CtxFactory,
  ) {}

  @Get('students/:userId')
  async student(@Param('userId', SafeIdPipe) userId: string, @Req() req: Req) {
    return ok(await overloadTo429(async () => this.students.student(await this.ctx.of(req), userId)))
  }

  @Get('school')
  async schoolScope(@Req() req: Req) {
    return ok(await overloadTo429(async () => this.school.school(await this.ctx.of(req))))
  }

  @Get('levels')
  async levels(@Req() req: Req) {
    return ok(await overloadTo429(async () => this.school.levels(await this.ctx.of(req))))
  }

  /** The level code is t4 or t5; the service answers 404 for anything else. */
  @Get('levels/:code')
  async level(@Param('code') code: string, @Req() req: Req) {
    return ok(await overloadTo429(async () => this.school.level(await this.ctx.of(req), code.slice(0, 16))))
  }

  @Get('classes')
  async ownClasses(@Req() req: Req) {
    return ok(await overloadTo429(async () => this.classes.ownClasses(await this.ctx.of(req))))
  }

  @Get('classes/:id')
  async classDashboard(@Param('id', SafeIdPipe) id: string, @Req() req: Req) {
    return ok(await overloadTo429(async () => this.classes.classDashboard(await this.ctx.of(req), id)))
  }
}

@Controller('item-analysis')
@UseGuards(RateLimitGuard)
@RateLimit(READ)
@UseInterceptors(NoStoreInterceptor)
export class ItemAnalysisController {
  constructor(
    @Inject(ItemAnalysisService) private readonly items: ItemAnalysisService,
    @Inject(CtxFactory) private readonly ctx: CtxFactory,
  ) {}

  @Roles('admin', 'teacher', 'school_admin', 'student', 'ppd_officer')
  @Get('school')
  async ownSchool(@Query(...itemAnalysisQuery) query: ItemAnalysisSchoolQuery, @Req() req: Req) {
    return ok(await overloadTo429(async () => this.items.school(await this.ctx.of(req), query)))
  }

  @Roles('admin', 'teacher', 'school_admin', 'student', 'ppd_officer')
  @Get('school/:schoolId')
  async schoolById(
    @Param('schoolId', SafeIdPipe) schoolId: string,
    @Query(...itemAnalysisQuery) query: ItemAnalysisSchoolQuery,
    @Req() req: Req,
  ) {
    return ok(await overloadTo429(async () => this.items.school(await this.ctx.of(req), query, schoolId)))
  }

  @Roles('admin', 'teacher')
  @Get('classes')
  async classList(@Req() req: Req) {
    return ok(await overloadTo429(async () => this.items.classList(await this.ctx.of(req))))
  }

  @Roles('admin', 'teacher')
  @Get('classes/:id')
  async classAnalysis(@Param('id', SafeIdPipe) id: string, @Req() req: Req) {
    return ok(await overloadTo429(async () => this.items.classAnalysis(await this.ctx.of(req), id)))
  }
}
