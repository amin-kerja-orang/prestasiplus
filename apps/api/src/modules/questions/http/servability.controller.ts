import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query, UseGuards, UseInterceptors } from '@nestjs/common'
import { ServabilityBatchRequestSchema, ServabilityLaneQuerySchema } from '@pp/contract'

import { Roles } from '../../../common/guards'
import { NoStoreInterceptor } from '../../../common/http'
import { ApiError } from '../../../common/errors/api-error'
import { listMeta, ok } from '../../../common/http/respond'
import { RateLimit, RateLimitGuard, type RateLimitSpec } from '../../../common/throttle'
import { isIdString } from '../../../db/ids'
import { toMytTimestamp } from '../../../common/time/myt'
import { OverviewCache } from '../serving/overview-cache'
import { ServabilityReadsService } from '../serving/servability-reads.service'
import { ServabilityService } from '../serving/servability.service'
import { BODY_MESSAGE, fieldsOf, invalid, parseBody } from './parse'

/** Reads are rate limited per user. Env `THROTTLE_SERVABILITY_READ_PER_MINUTE`, else 120. */
export const SERVABILITY_READ_LIMIT = {
  bucket: 'servability-read',
  env: 'THROTTLE_SERVABILITY_READ_PER_MINUTE',
  default: 120,
  per: 'user',
} as const satisfies RateLimitSpec

/**
 * The overview counts the whole bank (several aggregate statements over every question), so it has its OWN small bucket: a polling
 * hub or a script cannot drain the 120/min of the cheap reads above, and cannot hammer the database. Env
 * `THROTTLE_SERVABILITY_OVERVIEW_PER_MINUTE`, else 6 (the hub loads it once per visit).
 */
export const SERVABILITY_OVERVIEW_LIMIT = {
  bucket: 'servability-overview',
  env: 'THROTTLE_SERVABILITY_OVERVIEW_PER_MINUTE',
  default: 6,
  per: 'user',
} as const satisfies RateLimitSpec

/**
 * R1-B11 "Dilihat murid di": where a question is served to pupils and why not, for the Studio status bar, the question list, the
 * SPM hub cards and the two lanes. Admin Pusat only (the `admin` role), read-only; the batch is a POST because it carries ids and
 * so needs the CSRF header. Not under `/questions/...`, so `questions/:id` of the admin controller never swallows these paths.
 * Input is validated at the boundary: ids are decimal ids, at most 100 per batch, lane filters are bounded strings.
 */
@Roles('admin')
@Controller('admin/servability')
@UseGuards(RateLimitGuard)
@UseInterceptors(NoStoreInterceptor)
export class ServabilityController {
  constructor(
    @Inject(ServabilityService) private readonly servability: ServabilityService,
    @Inject(ServabilityReadsService) private readonly reads: ServabilityReadsService,
    @Inject(OverviewCache) private readonly overviewCache: OverviewCache,
  ) {}

  /** `questions/batch` is declared before `questions/:id` so it is never read as an id. */
  @Post('questions/batch')
  @HttpCode(200)
  @RateLimit(SERVABILITY_READ_LIMIT)
  async batch(@Body() body: unknown) {
    return ok(await this.reads.batch(parseBody(ServabilityBatchRequestSchema, body).ids))
  }

  @Get('questions/:id')
  @RateLimit(SERVABILITY_READ_LIMIT)
  async one(@Param('id') id: string) {
    if (!isIdString(id)) throw ApiError.of('NOT_FOUND')
    const report = await this.servability.report(id)
    if (!report) throw ApiError.of('NOT_FOUND')
    return ok(report)
  }

  @Get('overview')
  @RateLimit(SERVABILITY_OVERVIEW_LIMIT)
  async overview() {
    // H-A21: cached 5 minutes, stale-while-revalidate (the cold compute is slow on a large bank); `computedAt` says how old it is.
    const { value, computedAt } = await this.overviewCache.get(() => this.reads.overview())
    return ok({ ...value, computedAt: toMytTimestamp(computedAt) })
  }

  @Get('lanes/databank')
  @RateLimit(SERVABILITY_READ_LIMIT)
  async databank(@Query() query: unknown) {
    const res = await this.reads.databankLane(this.laneQuery(query))
    return { data: res.rows, meta: listMeta(res.page, res.pageSize, res.total) }
  }

  @Get('lanes/bijak-spm')
  @RateLimit(SERVABILITY_READ_LIMIT)
  async papers(@Query() query: unknown) {
    const res = await this.reads.paperLane(this.laneQuery(query))
    return { data: res.rows, meta: listMeta(res.page, res.pageSize, res.total) }
  }

  private laneQuery(raw: unknown) {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw invalid({ _: BODY_MESSAGE })
    // Empty values count as absent (a form that sends `search=`).
    const clean = Object.fromEntries(Object.entries(raw as Record<string, unknown>).filter(([, v]) => v !== ''))
    const res = ServabilityLaneQuerySchema.safeParse(clean)
    if (!res.success) throw invalid(fieldsOf(res.error))
    return res.data
  }
}
