import { Body, Controller, Get, HttpCode, Inject, Param, Post, Put, Query, Req, Res, UseGuards, UseInterceptors } from '@nestjs/common'
import type { Response } from 'express'

import { Roles } from '../../../common/guards/decorators'
import { NoStoreInterceptor, ok } from '../../../common/http'
import { RateLimit, RateLimitGuard } from '../../../common/throttle'
import type { SchoolAdminReq } from '../school-admin.actor'
import { SCHOOL_ADMIN_LIMITS } from '../school-admin.constants'
import { PeopleHeadersGuard, PragmaNoCache } from './people-headers.guard'
import { peopleCtxOf } from './people.ctx'
import { PupilsService } from './pupils.service'

type Req = SchoolAdminReq

/**
 * `/admin-sekolah/pelajar/*` (BE-21 Part A). The static segments `form-options` and `export.csv` are declared before `:id`.
 * Pupils have no toggle route (a pupil id on a teacher route is 404, and the reverse). `Idempotency-Key` is accepted and
 * ignored (deviation OQ-4). Every answer is `no-store`; the credential and CSV routes also send `Pragma: no-cache`,
 * on success and on error.
 */
@Controller('admin-sekolah/pelajar')
@Roles('school_admin')
@UseGuards(PeopleHeadersGuard, RateLimitGuard)
@UseInterceptors(NoStoreInterceptor)
export class PupilsController {
  constructor(@Inject(PupilsService) private readonly pupils: PupilsService) {}

  @Get()
  @RateLimit(SCHOOL_ADMIN_LIMITS.read)
  list(@Req() req: Req, @Query() query: Record<string, unknown>) {
    return this.pupils.list(peopleCtxOf(req), query)
  }

  @Get('form-options')
  @RateLimit(SCHOOL_ADMIN_LIMITS.read)
  async formOptions(@Req() req: Req) {
    return ok(await this.pupils.formOptions(peopleCtxOf(req)))
  }

  @Get('export.csv')
  @PragmaNoCache()
  @RateLimit(SCHOOL_ADMIN_LIMITS.export)
  async exportCsv(@Req() req: Req, @Query() query: Record<string, unknown>, @Res({ passthrough: true }) res: Response): Promise<string> {
    const out = await this.pupils.exportCsv(peopleCtxOf(req), query)
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${out.fileName}"`)
    return out.csv
  }

  @Get(':id')
  @RateLimit(SCHOOL_ADMIN_LIMITS.read)
  async detail(@Req() req: Req, @Param('id') id: string) {
    return ok(await this.pupils.detail(peopleCtxOf(req), id))
  }

  @Post()
  @HttpCode(201)
  @PragmaNoCache()
  @RateLimit(SCHOOL_ADMIN_LIMITS.create)
  create(@Req() req: Req, @Body() body: unknown) {
    return this.pupils.create(peopleCtxOf(req), body)
  }

  @Put(':id')
  @RateLimit(SCHOOL_ADMIN_LIMITS.write)
  update(@Req() req: Req, @Param('id') id: string, @Body() body: unknown) {
    return this.pupils.update(peopleCtxOf(req), id, body)
  }

  @Post(':id/reset-password')
  @HttpCode(200)
  @PragmaNoCache()
  @RateLimit(SCHOOL_ADMIN_LIMITS.reset)
  resetPassword(@Req() req: Req, @Param('id') id: string, @Body() body: unknown) {
    return this.pupils.resetPassword(peopleCtxOf(req), id, body)
  }
}
