import { Controller, Get, Inject, Param, Req, UseInterceptors } from '@nestjs/common'
import type { Request } from 'express'

import { NoStoreInterceptor } from '../../common/http/no-store.interceptor'
import { ok } from '../../common/http/respond'
import { type RequestWithAuth, ScopeContext } from '../../common/scope'
import { type SpmCaller, SpmHubService } from './hub.service'

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
  constructor(@Inject(SpmHubService) private readonly hub: SpmHubService) {}

  @Get('overview')
  async overview(@Req() req: Req) {
    return ok(await this.hub.overview(callerOf(req)))
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
