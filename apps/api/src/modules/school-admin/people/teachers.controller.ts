import { Body, Controller, Get, HttpCode, Inject, Param, Post, Put, Query, Req, Res, UseGuards, UseInterceptors } from '@nestjs/common'
import type { Response } from 'express'

import { Roles } from '../../../common/guards/decorators'
import { NoStoreInterceptor, ok } from '../../../common/http'
import { RateLimit, RateLimitGuard } from '../../../common/throttle'
import type { SchoolAdminReq } from '../school-admin.actor'
import { SCHOOL_ADMIN_LIMITS } from '../school-admin.constants'
import { PeopleHeadersGuard, PragmaNoCache } from './people-headers.guard'
import { peopleCtxOf } from './people.ctx'
import { TeachersService } from './teachers.service'

type Req = SchoolAdminReq

/**
 * `/admin-sekolah/guru/*` (BE-21 Part A). `export.csv` is declared before `:id`. `guru/pending` and `guru/:id/verify` belong to
 * `SchoolAdminController`, which is registered first. The `Idempotency-Key` header is accepted and ignored (deviation OQ-4).
 * Every answer is `no-store`; the credential and CSV routes also send `Pragma: no-cache`, on success and on error.
 */
@Controller('admin-sekolah/guru')
@Roles('school_admin')
@UseGuards(PeopleHeadersGuard, RateLimitGuard)
@UseInterceptors(NoStoreInterceptor)
export class TeachersController {
  constructor(@Inject(TeachersService) private readonly teachers: TeachersService) {}

  @Get()
  @RateLimit(SCHOOL_ADMIN_LIMITS.read)
  list(@Req() req: Req, @Query() query: Record<string, unknown>) {
    return this.teachers.list(peopleCtxOf(req), query)
  }

  @Get('export.csv')
  @PragmaNoCache()
  @RateLimit(SCHOOL_ADMIN_LIMITS.export)
  async exportCsv(@Req() req: Req, @Query() query: Record<string, unknown>, @Res({ passthrough: true }) res: Response): Promise<string> {
    const out = await this.teachers.exportCsv(peopleCtxOf(req), query)
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${out.fileName}"`)
    return out.csv
  }

  @Get(':id')
  @RateLimit(SCHOOL_ADMIN_LIMITS.read)
  async detail(@Req() req: Req, @Param('id') id: string) {
    return ok(await this.teachers.detail(peopleCtxOf(req), id))
  }

  @Post()
  @HttpCode(201)
  @PragmaNoCache()
  @RateLimit(SCHOOL_ADMIN_LIMITS.create)
  create(@Req() req: Req, @Body() body: unknown) {
    return this.teachers.create(peopleCtxOf(req), body)
  }

  @Put(':id')
  @RateLimit(SCHOOL_ADMIN_LIMITS.write)
  update(@Req() req: Req, @Param('id') id: string, @Body() body: unknown) {
    return this.teachers.update(peopleCtxOf(req), id, body)
  }

  @Post(':id/toggle-active')
  @HttpCode(200)
  @RateLimit(SCHOOL_ADMIN_LIMITS.write)
  toggle(@Req() req: Req, @Param('id') id: string) {
    return this.teachers.toggle(peopleCtxOf(req), id)
  }

  @Post(':id/reset-password')
  @HttpCode(200)
  @PragmaNoCache()
  @RateLimit(SCHOOL_ADMIN_LIMITS.reset)
  resetPassword(@Req() req: Req, @Param('id') id: string, @Body() body: unknown) {
    return this.teachers.resetPassword(peopleCtxOf(req), id, body)
  }
}
