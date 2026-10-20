import { Body, Controller, Get, Inject, Param, Post, Query, Req, Res, UseGuards, UseInterceptors } from '@nestjs/common'
import {
  KIRKPATRICK_PDF,
  KirkpatrickFeedbackRequestSchema,
  KirkpatrickInterventionCreateRequestSchema,
  KirkpatrickSchoolQuerySchema,
  KirkpatrickScopeQuerySchema,
} from '@pp/contract'
import type { Request, Response } from 'express'

import { Roles } from '../../../../common/guards/decorators'
import { NoStoreInterceptor, ok } from '../../../../common/http'
import type { RequestWithAuth } from '../../../../common/scope'
import { RateLimit, RateLimitGuard } from '../../../../common/throttle'
import { KIRKPATRICK_LIMITS } from '../kirkpatrick.constants'
import { ExportService } from '../services/export.service'
import { FeedbackService } from '../services/feedback.service'
import { InterventionsService } from '../services/interventions.service'
import { LevelsService } from '../services/levels.service'
import type { ScopeQuery } from '../services/scope'
import { StudentService } from '../services/student.service'
import type { KirkpatrickFeedbackRequest, KirkpatrickInterventionCreateRequest } from '../types'
import { BoundedQueryPipe, PupilIdPipe, SummaryZodPipe, ctxOf, overloadTo429, writeCtxOf } from './request'

type Req = Request & RequestWithAuth

const scopeQuery = [new BoundedQueryPipe(), new SummaryZodPipe(KirkpatrickScopeQuerySchema)] as const
const schoolQuery = [new BoundedQueryPipe(), new SummaryZodPipe(KirkpatrickSchoolQuerySchema)] as const

/**
 * M12 Kirkpatrick levels, pupil views, intervention log and PDF export (BE-20, 12 of the module's 14 routes; the other two are in `FeedbackController`). Every body can hold
 * pupil data, so every response is `no-store` and every route is rate limited per user. Role refusals come from
 * `@Roles` (403); a missing session is 401 and a write without a CSRF token is 403 CSRF_INVALID (global guards).
 */
@Controller('kirkpatrick')
@UseGuards(RateLimitGuard)
@RateLimit(KIRKPATRICK_LIMITS.read)
@UseInterceptors(NoStoreInterceptor)
export class KirkpatrickController {
  constructor(
    @Inject(LevelsService) private readonly levels: LevelsService,
    @Inject(StudentService) private readonly students: StudentService,
    @Inject(InterventionsService) private readonly interventions: InterventionsService,
    @Inject(ExportService) private readonly exports: ExportService,
  ) {}

  @Roles('admin', 'teacher', 'school_admin')
  @Get('overview')
  async overview(@Query(...scopeQuery) query: ScopeQuery, @Req() req: Req) {
    return ok(await overloadTo429(() => this.levels.overview(ctxOf(req), query)))
  }

  @Roles('admin', 'teacher', 'school_admin')
  @Get('reaction')
  async reaction(@Req() req: Req) {
    return ok(await overloadTo429(() => this.levels.reaction(ctxOf(req))))
  }

  @Roles('admin', 'teacher', 'school_admin')
  @Get('learning')
  async learning(@Query(...schoolQuery) query: ScopeQuery, @Req() req: Req) {
    return ok(await overloadTo429(() => this.levels.learning(ctxOf(req), query)))
  }

  @Roles('admin', 'teacher', 'school_admin')
  @Get('behavior')
  async behavior(@Query(...schoolQuery) query: ScopeQuery, @Req() req: Req) {
    return ok(await overloadTo429(() => this.levels.behavior(ctxOf(req), query)))
  }

  @Roles('admin', 'teacher', 'school_admin')
  @Get('results')
  async results(@Query(...schoolQuery) query: ScopeQuery, @Req() req: Req) {
    return ok(await overloadTo429(() => this.levels.results(ctxOf(req), query)))
  }

  @Roles('admin', 'teacher', 'school_admin')
  @Get('chain')
  async chain(@Req() req: Req) {
    return ok(await overloadTo429(() => this.levels.chain(ctxOf(req))))
  }

  @Roles('admin', 'teacher', 'school_admin')
  @Get('filter-options')
  async filterOptions(@Req() req: Req) {
    return ok(await overloadTo429(() => this.levels.filterOptions(ctxOf(req))))
  }

  @Roles('admin', 'teacher', 'school_admin')
  @Get('students/:id')
  async student(@Param('id', PupilIdPipe) id: string, @Req() req: Req) {
    return ok(await overloadTo429(() => this.students.student(ctxOf(req), id)))
  }

  /** Any signed-in role: the viewer's own data. */
  @Get('me')
  async me(@Req() req: Req) {
    return ok(await overloadTo429(() => this.students.me(ctxOf(req))))
  }

  @Roles('admin', 'teacher', 'school_admin')
  @Get('export-pdf')
  async exportPdf(@Req() req: Req, @Res() res: Response): Promise<void> {
    const bytes = await overloadTo429(() => this.exports.chainPdf(ctxOf(req)))
    const body = Buffer.from(bytes)
    res
      .status(200)
      .set({
        'Content-Type': KIRKPATRICK_PDF.contentType,
        'Content-Disposition': `attachment; filename="${KIRKPATRICK_PDF.filename}"`,
        'Content-Length': String(body.length),
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      })
      .end(body)
  }

  @Roles('admin', 'teacher', 'school_admin')
  @Get('interventions')
  async listInterventions(@Req() req: Req) {
    return ok(await overloadTo429(() => this.interventions.list(ctxOf(req))))
  }

  @Roles('admin', 'teacher', 'school_admin')
  @Post('interventions')
  @RateLimit(KIRKPATRICK_LIMITS.write)
  async createIntervention(
    @Body(new SummaryZodPipe(KirkpatrickInterventionCreateRequestSchema)) body: KirkpatrickInterventionCreateRequest,
    @Req() req: Req,
  ) {
    return ok(await overloadTo429(() => this.interventions.create(writeCtxOf(req), body)))
  }
}

/** Monthly NPS and satisfaction: any signed-in role, own data only. */
@Controller('feedback')
@UseGuards(RateLimitGuard)
@RateLimit(KIRKPATRICK_LIMITS.read)
@UseInterceptors(NoStoreInterceptor)
export class FeedbackController {
  constructor(@Inject(FeedbackService) private readonly feedback: FeedbackService) {}

  @Get('status')
  async status(@Req() req: Req) {
    return ok(await overloadTo429(() => this.feedback.status(ctxOf(req))))
  }

  @Post()
  @RateLimit(KIRKPATRICK_LIMITS.write)
  async submit(@Body(new SummaryZodPipe(KirkpatrickFeedbackRequestSchema)) body: KirkpatrickFeedbackRequest, @Req() req: Req) {
    return ok(await overloadTo429(() => this.feedback.submit(ctxOf(req), body)))
  }
}
