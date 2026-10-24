import { Controller, Delete, Get, HttpCode, Inject, Param, Post, Query, Req, Res, UseGuards, UseInterceptors, Body } from '@nestjs/common'
import type { Request, Response } from 'express'

import { Roles } from '../../../../common/guards/decorators'
import { NoStoreInterceptor, ok } from '../../../../common/http'
import { requestIdOf } from '../../../../common/request/request-id'
import type { RequestWithAuth } from '../../../../common/scope'
import { AUTH_CONTEXT_KEY } from '../../../../common/scope/auth-context'
import { RateLimit, RateLimitGuard, type RateLimitSpec } from '../../../../common/throttle'
import { ApiError } from '../../../../common/errors/api-error'
import { BoundedQueryPipe, CtxFactory, ctxOf, overloadTo429, SafeIdPipe } from '../http/request'
import { HeadcountService, type HeadcountWriteCtx } from './headcount.service'

type Req = Request & RequestWithAuth

/** Same per-user budget as the other performance reads (D57a). */
const READ = {
  bucket: 'performance.read',
  env: 'THROTTLE_PERFORMANCE_READ_PER_MINUTE',
  default: 120,
  per: 'user',
} as const satisfies RateLimitSpec

/** Own, tighter per-user bucket for the five write routes (they also sit behind the CSRF guard). */
const WRITE = {
  bucket: 'performance.write',
  env: 'THROTTLE_PERFORMANCE_WRITE_PER_MINUTE',
  default: 30,
  per: 'user',
} as const satisfies RateLimitSpec

function writeCtxOf(req: Req): HeadcountWriteCtx {
  const auth = req[AUTH_CONTEXT_KEY]
  if (!auth) throw ApiError.of('UNAUTHORIZED')
  return {
    ...ctxOf(req),
    requestId: requestIdOf(req) ?? null,
    ip: req.ip ?? req.socket.remoteAddress ?? null,
    sessionRowId: auth.sessionRowId,
    scopeLevel: auth.active.scope.level,
  }
}

const sortQuery = new BoundedQueryPipe()

/**
 * Headcount (TOV / RS) of M08 (BE-19): 12 routes under `/headcounts`. Roles admin, teacher and school_admin; every other
 * role gets 403 from `@Roles`. Every answer is `no-store` (pupil marks) and rate limited per user. The static routes are
 * declared before `:id`. A config outside the caller's scope is a 404, the same as an unknown one (OQ-3).
 */
@Controller('headcounts')
@Roles('admin', 'teacher', 'school_admin')
@UseGuards(RateLimitGuard)
@RateLimit(READ)
@UseInterceptors(NoStoreInterceptor)
export class HeadcountController {
  constructor(
    @Inject(HeadcountService) private readonly headcounts: HeadcountService,
    @Inject(CtxFactory) private readonly ctx: CtxFactory,
  ) {}

  @Get()
  async list(@Req() req: Req) {
    return ok(await overloadTo429(async () => this.headcounts.list(await this.ctx.of(req))))
  }

  @Get('dashboard')
  async dashboard(@Req() req: Req) {
    return ok(await overloadTo429(async () => this.headcounts.dashboard(await this.ctx.of(req))))
  }

  @Get('form-options')
  async formOptions(@Req() req: Req) {
    return ok(await overloadTo429(async () => this.headcounts.formOptions(await this.ctx.of(req))))
  }

  @Get('students/:userId')
  async student(@Param('userId', SafeIdPipe) userId: string, @Req() req: Req) {
    return ok(await overloadTo429(async () => this.headcounts.student(await this.ctx.of(req), userId)))
  }

  @Post()
  @RateLimit(WRITE)
  async create(@Body() body: unknown, @Req() req: Req) {
    return ok(await overloadTo429(async () => this.headcounts.create(writeCtxOf(req), body)))
  }

  @Post('auto-setup')
  @RateLimit(WRITE)
  @HttpCode(200)
  async autoSetup(@Body() body: unknown, @Req() req: Req) {
    return ok(await overloadTo429(async () => this.headcounts.autoSetup(writeCtxOf(req), body)))
  }

  @Get(':id/summary')
  async summary(@Param('id', SafeIdPipe) id: string, @Req() req: Req) {
    return ok(await overloadTo429(async () => this.headcounts.summary(await this.ctx.of(req), id)))
  }

  @Get(':id/export')
  async exportCsv(
    @Param('id', SafeIdPipe) id: string,
    @Query(sortQuery) query: Record<string, unknown>,
    @Req() req: Req,
    @Res() res: Response,
  ): Promise<void> {
    const sort = typeof query.sort === 'string' ? query.sort : undefined
    const file = await overloadTo429(async () => this.headcounts.exportCsv(await this.ctx.of(req), id, sort))
    const bytes = Buffer.from(file.csv, 'utf8')
    res.status(200)
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`)
    res.setHeader('Content-Length', String(bytes.length))
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.end(bytes)
  }

  @Get(':id')
  async detail(@Param('id', SafeIdPipe) id: string, @Query(sortQuery) query: Record<string, unknown>, @Req() req: Req) {
    const sort = typeof query.sort === 'string' ? query.sort : undefined
    return ok(await overloadTo429(async () => this.headcounts.detail(await this.ctx.of(req), id, sort)))
  }

  @Post(':id/drop-students')
  @RateLimit(WRITE)
  @HttpCode(200)
  async dropStudents(@Param('id', SafeIdPipe) id: string, @Body() body: unknown, @Req() req: Req) {
    return ok(await overloadTo429(async () => this.headcounts.dropStudents(writeCtxOf(req), id, body)))
  }

  @Post(':id/reset')
  @RateLimit(WRITE)
  @HttpCode(200)
  async reset(@Param('id', SafeIdPipe) id: string, @Req() req: Req) {
    return ok(await overloadTo429(async () => this.headcounts.reset(writeCtxOf(req), id)))
  }

  @Delete(':id')
  @RateLimit(WRITE)
  async remove(@Param('id', SafeIdPipe) id: string, @Req() req: Req) {
    return ok(await overloadTo429(async () => this.headcounts.remove(writeCtxOf(req), id)))
  }
}
