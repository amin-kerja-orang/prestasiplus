import { Controller, Get, Inject, Param, Query, Req, UseGuards, UseInterceptors } from '@nestjs/common'
import { PerformanceLeaderboardQuerySchema, PerformanceRankingQuerySchema } from '@pp/contract'
import type { Request } from 'express'

import { Public } from '../../../../common/guards/decorators'
import { NoStoreInterceptor, ok } from '../../../../common/http'
import type { RequestWithAuth } from '../../../../common/scope'
import { RateLimit, RateLimitGuard, type RateLimitSpec } from '../../../../common/throttle'
import { ZodValidationPipe } from '../../../../common/validation/zod-validation.pipe'
import {
  LeaderboardService,
  PublicProfileService,
  RankingService,
  WeeklyReportService,
  type RankingQueryInput,
} from '../services'
import { BoundedQueryPipe, CtxFactory, overloadTo429, SafeIdPipe } from './request'

type Req = Request & RequestWithAuth

/** Shares the signed-in read budget of the other performance routes (D57a). */
const READ = {
  bucket: 'performance.read',
  env: 'THROTTLE_PERFORMANCE_READ_PER_MINUTE',
  default: 120,
  per: 'user',
} as const satisfies RateLimitSpec

/** The anonymous profile: per client address, so enumeration of ids is slowed down (OQ-8). */
const PUBLIC = {
  bucket: 'performance.public',
  env: 'THROTTLE_PUBLIC_PER_MINUTE',
  default: 60,
  per: 'ip',
} as const satisfies RateLimitSpec

/** Rankings, practice leaderboard and the always-403 weekly report (S19, S20, S21). */
@Controller()
@UseGuards(RateLimitGuard)
@RateLimit(READ)
@UseInterceptors(NoStoreInterceptor)
export class SocialController {
  constructor(
    @Inject(RankingService) private readonly rankings: RankingService,
    @Inject(LeaderboardService) private readonly leaderboard: LeaderboardService,
    @Inject(WeeklyReportService) private readonly weekly: WeeklyReportService,
    @Inject(CtxFactory) private readonly ctx: CtxFactory,
  ) {}

  @Get('rankings')
  async ranking(
    @Query(new BoundedQueryPipe(), new ZodValidationPipe(PerformanceRankingQuerySchema)) query: RankingQueryInput,
    @Req() req: Req,
  ) {
    return ok(await overloadTo429(async () => this.rankings.rankings(await this.ctx.of(req), query)))
  }

  @Get('leaderboard')
  async board(
    @Query(new BoundedQueryPipe(), new ZodValidationPipe(PerformanceLeaderboardQuerySchema)) query: { period?: string },
    @Req() req: Req,
  ) {
    return ok(await overloadTo429(async () => this.leaderboard.leaderboard(await this.ctx.of(req), query.period)))
  }

  /** 403 for every role; 401 without a session comes from the global guard. */
  @Get('weekly-report')
  report(): never {
    return this.weekly.report()
  }
}

/** Anonymous profile of a pupil (S18): first name only, uniform 404, rate limited per client address. */
@Controller('public')
@Public()
@UseGuards(RateLimitGuard)
@UseInterceptors(NoStoreInterceptor)
export class PublicStudentController {
  constructor(@Inject(PublicProfileService) private readonly profiles: PublicProfileService) {}

  @Get('students/:id')
  @RateLimit(PUBLIC)
  async student(@Param('id', SafeIdPipe) id: string) {
    return ok(await overloadTo429(async () => this.profiles.profile(id, null)))
  }
}
