import { Controller, Get, Inject, Param, Query, Req, Res, UseGuards, UseInterceptors } from '@nestjs/common'
import type { Response } from 'express'

import { Roles } from '../../../common/guards/decorators'
import { NoStoreInterceptor, ok } from '../../../common/http'
import { RateLimit, RateLimitGuard } from '../../../common/throttle'
import { PeopleHeadersGuard, PragmaNoCache } from '../people/people-headers.guard'
import type { SchoolAdminReq } from '../school-admin.actor'
import { SCHOOL_ADMIN_LIMITS } from '../school-admin.constants'
import { AMARAN_EXPORT_ROLES, AMARAN_ROLES, amaranCallerOf } from './amaran.access'
import { AmaranService } from './amaran.service'

type Req = SchoolAdminReq

/**
 * `/amaran/*` (BE-21 Part C, the M18 Amaran Awal routes). Roles: admin, school_admin and teacher; the CSV is admin and school_admin only.
 * The role guard answers 403 BEFORE any school lookup; an unknown and an out-of-scope school are the same 404. Every answer is
 * `no-store` (the lists name minors); the CSV also sends `Pragma: no-cache`, on success and on the 429, because
 * `PeopleHeadersGuard` runs before `RateLimitGuard`.
 */
@Controller('amaran')
@UseGuards(PeopleHeadersGuard, RateLimitGuard)
@UseInterceptors(NoStoreInterceptor)
export class AmaranController {
  constructor(@Inject(AmaranService) private readonly amaran: AmaranService) {}

  @Get('schools/:id')
  @Roles(...AMARAN_ROLES)
  @RateLimit(SCHOOL_ADMIN_LIMITS.read)
  async school(@Req() req: Req, @Param('id') id: string, @Query('tingkatan') tingkatan?: string) {
    return ok(await this.amaran.schoolRisk(amaranCallerOf(req), id, typeof tingkatan === 'string' ? tingkatan : undefined))
  }

  @Get('summary')
  @Roles(...AMARAN_ROLES)
  @RateLimit(SCHOOL_ADMIN_LIMITS.read) // a read screen (M18 S23): the contract documents no 429 here, only on the CSV export
  async summary(@Req() req: Req, @Query() query: Record<string, unknown>) {
    const text = (k: string): string | undefined => (typeof query[k] === 'string' ? (query[k] as string) : undefined)
    const q: { scope?: string; schoolId?: string; district?: string; state?: string } = {}
    for (const k of ['scope', 'schoolId', 'district', 'state'] as const) {
      const v = text(k)
      if (v !== undefined) q[k] = v
    }
    return ok(await this.amaran.summary(amaranCallerOf(req), q))
  }

  @Get('effectiveness')
  @Roles(...AMARAN_ROLES)
  @RateLimit(SCHOOL_ADMIN_LIMITS.read)
  async effectiveness(@Req() req: Req) {
    return ok(await this.amaran.effectiveness(amaranCallerOf(req)))
  }

  @Get('export/school/:id')
  @Roles(...AMARAN_EXPORT_ROLES)
  @PragmaNoCache()
  @RateLimit(SCHOOL_ADMIN_LIMITS.export)
  async exportCsv(@Req() req: Req, @Param('id') id: string, @Res({ passthrough: true }) res: Response): Promise<string> {
    const out = await this.amaran.exportCsv(amaranCallerOf(req), id)
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${out.fileName}"`)
    return out.csv
  }
}
