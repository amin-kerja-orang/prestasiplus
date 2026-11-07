import { Controller, Get, Inject, Param, Query, Req, UseInterceptors } from '@nestjs/common'
import { SpmHistoryQuerySchema } from '@pp/contract'
import type { Request } from 'express'

import { Roles } from '../../common/guards/decorators'
import { NoStoreInterceptor } from '../../common/http/no-store.interceptor'
import { ok } from '../../common/http/respond'
import { type RequestWithAuth, ScopeContext } from '../../common/scope'
import { fieldError } from './errors'
import { type SpmCaller, SpmHubService } from './hub.service'
import { SpmHistoryService } from './history.service'

type Req = Request & RequestWithAuth

function callerOf(req: Req): SpmCaller {
  const scope = ScopeContext.fromRequest(req)
  return { userId: scope.userId, role: scope.role, isTest: scope.isTest }
}

/**
 * The SPM hub read models (M06-01 to M06-07). Any signed-in role: the default-deny guard answers 401 without a
 * session. The only role-dependent field is `readiness` of Tracking A (active role `admin`, BR-M06-30).
 */
@Controller('spm')
@UseInterceptors(NoStoreInterceptor)
export class SpmController {
  constructor(
    @Inject(SpmHubService) private readonly hub: SpmHubService,
    @Inject(SpmHistoryService) private readonly history: SpmHistoryService,
  ) {}

  @Get('overview')
  async overview(@Req() req: Req) {
    return ok(await this.hub.overview(callerOf(req)))
  }

  /**
   * Sejarah Kuiz SPM (S3-T07 part F, API-BIJAK-07). Pupil only (the ACTIVE role `student`): the list is the caller's own work.
   * `mod` (alias `type`) and `halaman` are validated here; an unknown chip or a page that is not a positive integer is 422.
   */
  @Get('history')
  @Roles('student')
  async historyList(@Req() req: Req, @Query() query: Record<string, unknown>) {
    const parsed = SpmHistoryQuerySchema.safeParse(query)
    if (!parsed.success) {
      const fields: Record<string, string> = {}
      for (const issue of parsed.error.issues) fields[String(issue.path[0] ?? 'query')] ??= 'Nilai tidak sah.'
      throw fieldError(fields)
    }
    return await this.history.history(callerOf(req), parsed.data)
  }

  @Get('databank')
  async databank() {
    return ok(await this.hub.databank())
  }

  @Get('latih-tubi')
  async latihTubi() {
    return ok(await this.hub.latihTubiList())
  }

  @Get('latih-tubi/:code')
  async latihTubiConfig(@Param('code') code: string) {
    return ok(await this.hub.latihTubiConfig(code))
  }

  @Get('tracking-a')
  async trackingHub(@Req() req: Req) {
    return ok(await this.hub.trackingHub(callerOf(req)))
  }

  @Get('tracking-a/:code')
  async trackingSubject(@Param('code') code: string) {
    return ok(await this.hub.trackingSubject(code))
  }

  @Get('subjektif')
  async subjektif(@Req() req: Req) {
    return ok(await this.hub.subjektif(callerOf(req)))
  }
}
