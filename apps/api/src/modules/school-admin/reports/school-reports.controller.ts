import { Controller, Get, Inject, Query, Req, UseGuards, UseInterceptors } from '@nestjs/common'

import { ApiError } from '../../../common/errors/api-error'
import { Roles } from '../../../common/guards/decorators'
import { NoStoreInterceptor, ok } from '../../../common/http'
import { RateLimit, RateLimitGuard } from '../../../common/throttle'
import { isOverloadError } from '../../auth/auth.errors'
import { PeopleHeadersGuard, PragmaNoCache } from '../people/people-headers.guard'
import { schoolAdminOf, type SchoolAdminReq } from '../school-admin.actor'
import { SCHOOL_ADMIN_LIMITS } from '../school-admin.constants'
import { ActivityService } from './activity.service'
import { ClassesService } from './classes.service'
import { HeatmapService } from './heatmap.service'
import { MonthlyService } from './monthly.service'
import { UsageService } from './usage.service'

type Req = SchoolAdminReq

/** A query value that is not a plain string (`?a=1&a=2`, `?a[b]=1`) counts as absent: the unknown-value defaults apply. */
const text = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined)

/**
 * The five read-only school reports of the Admin Sekolah (BE-21 Part B): usage, activity report, monthly report, DSKP heatmap and
 * the class list. The school is the session's (`schoolAdminOf`); nothing in the query can choose it. Every answer is `no-store`.
 * Unknown query values are not errors (the contract falls back to the defaults).
 */
@Controller('admin-sekolah')
@Roles('school_admin')
@UseGuards(PeopleHeadersGuard, RateLimitGuard)
@UseInterceptors(NoStoreInterceptor)
export class SchoolReportsController {
  constructor(
    @Inject(UsageService) private readonly usage: UsageService,
    @Inject(ActivityService) private readonly activity: ActivityService,
    @Inject(MonthlyService) private readonly monthly: MonthlyService,
    @Inject(HeatmapService) private readonly heatmap: HeatmapService,
    @Inject(ClassesService) private readonly classes: ClassesService,
  ) {}

  @Get('usage')
  @RateLimit(SCHOOL_ADMIN_LIMITS.read)
  async getUsage(@Req() req: Req, @Query('period') period: unknown) {
    const { schoolId } = schoolAdminOf(req)
    return ok(await this.guard(() => this.usage.usage(schoolId, text(period))))
  }

  /** Per-pupil names, coins and logins of minors: also `Pragma: no-cache`, on 200 and on 429 (the guard runs before the limiter). */
  @Get('laporan-aktiviti')
  @PragmaNoCache()
  @RateLimit(SCHOOL_ADMIN_LIMITS.read)
  async getActivity(@Req() req: Req, @Query('range') range: unknown) {
    const { schoolId } = schoolAdminOf(req)
    return ok(await this.guard(() => this.activity.report(schoolId, text(range))))
  }

  @Get('laporan-bulanan')
  @RateLimit(SCHOOL_ADMIN_LIMITS.read)
  async getMonthly(@Req() req: Req, @Query('bulan') bulan: unknown) {
    const { schoolId } = schoolAdminOf(req)
    return ok(await this.guard(() => this.monthly.report(schoolId, text(bulan))))
  }

  @Get('dskp-heatmap')
  @RateLimit(SCHOOL_ADMIN_LIMITS.read)
  async getHeatmap(@Req() req: Req, @Query('subjectId') subjectId: unknown, @Query('tingkatan') tingkatan: unknown) {
    const { schoolId } = schoolAdminOf(req)
    return ok(await this.guard(() => this.heatmap.heatmap(schoolId, { subjectId: text(subjectId), tingkatan: text(tingkatan) })))
  }

  /** The body is the list envelope plus the top-level `tiles` and `levels` (not wrapped in `data`). */
  @Get('kelas')
  @RateLimit(SCHOOL_ADMIN_LIMITS.read)
  async getClasses(@Req() req: Req, @Query('level') level: unknown, @Query('search') search: unknown, @Query('page') page: unknown) {
    const { schoolId } = schoolAdminOf(req)
    return this.guard(() => this.classes.list(schoolId, { level: text(level), search: text(search), page: text(page) }))
  }

  /** A database too busy to answer is a retryable 429, never a 500. */
  private async guard<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn()
    } catch (err) {
      if (isOverloadError(err)) throw ApiError.of('RATE_LIMITED', { retryAfter: 5 })
      throw err
    }
  }
}
