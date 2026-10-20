import { Controller, Get, Inject, Param, Query, Req, UseGuards, UseInterceptors } from '@nestjs/common'
import { AnalyticsExportQuerySchema } from '@pp/contract'
import type { Request } from 'express'

import { Roles } from '../../../../common/guards/decorators'
import { NoStoreInterceptor, ok } from '../../../../common/http'
import type { RequestWithAuth } from '../../../../common/scope'
import { RateLimit, RateLimitGuard } from '../../../../common/throttle'
import { ANALYTICS_LIMITS } from '../analytics.constants'
import { ItemAnalysisService } from '../services/item-analysis.service'
import { MonitoringService } from '../services/monitoring.service'
import { ReportService } from '../services/report.service'
import { StudentDetailService } from '../services/student-detail.service'
import { FieldsZodPipe, PathIdPipe, TolerantQueryPipe, ctxOf, overloadTo429 } from './request'

type Req = Request & RequestWithAuth

const filterQuery = new TolerantQueryPipe(['period', 'state', 'tahap'])
const exportQuery = [new TolerantQueryPipe(['period', 'state', 'tahap', 'format']), new FieldsZodPipe(AnalyticsExportQuerySchema)] as const
const reportQuery = new TolerantQueryPipe(['range', 'classroomId'])
const itemQuery = new TolerantQueryPipe(['subjectId', 'classroomId'])

interface FilterQuery {
  period?: string
  state?: string
  tahap?: string
}

/**
 * M11 monitoring (BE-20, 5 routes): admin sees every school; teacher and school_admin are forced to the own school from
 * the session. Role refusals come from `@Roles` (403), a missing session is 401 (global guard). Pupil and teacher
 * data travel in the body, so every response is `no-store`, and every route is rate limited per user.
 */
@Controller('monitoring')
@UseGuards(RateLimitGuard)
@RateLimit(ANALYTICS_LIMITS.read)
@UseInterceptors(NoStoreInterceptor)
export class MonitoringReportsController {
  constructor(
    @Inject(MonitoringService) private readonly monitoring: MonitoringService,
    @Inject(StudentDetailService) private readonly students: StudentDetailService,
  ) {}

  @Roles('admin', 'teacher', 'school_admin')
  @Get('overview')
  async overview(@Query(filterQuery) query: FilterQuery, @Req() req: Req) {
    return ok(await overloadTo429(() => this.monitoring.overview(ctxOf(req), query)))
  }

  @Roles('admin', 'teacher', 'school_admin')
  @Get('export')
  async export(@Query(...exportQuery) query: FilterQuery & { format: 'pdf' | 'csv' }, @Req() req: Req) {
    return ok(await overloadTo429(() => this.monitoring.exportRows(ctxOf(req), query.format, query)))
  }

  @Roles('admin', 'teacher', 'school_admin')
  @Get('schools/:schoolId')
  async school(@Param('schoolId', PathIdPipe) schoolId: string, @Req() req: Req) {
    return ok(await overloadTo429(() => this.monitoring.schoolDetail(ctxOf(req), schoolId)))
  }

  @Roles('admin', 'teacher', 'school_admin')
  @Get('schools/:schoolId/students/:userId')
  async student(@Param('schoolId', PathIdPipe) schoolId: string, @Param('userId', PathIdPipe) userId: string, @Req() req: Req) {
    return ok(await overloadTo429(() => this.students.detail(ctxOf(req), schoolId, userId)))
  }

  @Roles('admin', 'teacher', 'school_admin')
  @Get('schools/:schoolId/teachers/:userId')
  async teacher(@Param('schoolId', PathIdPipe) schoolId: string, @Param('userId', PathIdPipe) userId: string, @Req() req: Req) {
    return ok(await overloadTo429(() => this.monitoring.teacherDetail(ctxOf(req), schoolId, userId)))
  }
}

/** M11 teacher report and item analysis (BE-20, 2 routes): admin (empty population) and teacher (own classes). */
@Controller('teacher')
@UseGuards(RateLimitGuard)
@RateLimit(ANALYTICS_LIMITS.read)
@UseInterceptors(NoStoreInterceptor)
export class TeacherReportsController {
  constructor(
    @Inject(ReportService) private readonly report: ReportService,
    @Inject(ItemAnalysisService) private readonly items: ItemAnalysisService,
  ) {}

  @Roles('admin', 'teacher')
  @Get('report')
  async teacherReport(@Query(reportQuery) query: { range?: string; classroomId?: string }, @Req() req: Req) {
    return ok(await overloadTo429(() => this.report.report(ctxOf(req), query)))
  }

  @Roles('admin', 'teacher')
  @Get('item-analysis')
  async itemAnalysis(@Query(itemQuery) query: { subjectId?: string; classroomId?: string }, @Req() req: Req) {
    return ok(await overloadTo429(() => this.items.analyse(ctxOf(req), query)))
  }
}
