import { Body, Controller, Get, Inject, Param, Post, Put, Req, UseGuards, UseInterceptors } from '@nestjs/common'
import type { Request } from 'express'

import { Roles } from '../../common/guards'
import { NoStoreInterceptor } from '../../common/http/no-store.interceptor'
import { ok } from '../../common/http/respond'
import { type RequestWithAuth, ScopeContext } from '../../common/scope'
import { RateLimit, RateLimitGuard } from '../../common/throttle'
import { retryable } from '../shop/shop.guard'
import { SPM_LIMITS } from './config'
import { type SpmCaller, SpmHubService } from './hub.service'
import { SpmTrackingService } from './tracking.service'

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

/**
 * API-BIJAK-13 Tracking A admin (S3-T05): Admin Pusat only. Bodies are read raw and validated in the service, so a missing set is 404 before a bad
 * body is 422. The list of sets is the lane read `GET /admin/servability/lanes/tracking-a` (API-BIJAK-12, D-8).
 */
@Roles('admin')
@Controller('admin/spm/tracking-a')
@UseGuards(RateLimitGuard)
@UseInterceptors(NoStoreInterceptor)
export class SpmAdminTrackingController {
  constructor(@Inject(SpmTrackingService) private readonly tracking: SpmTrackingService) {}

  @Post()
  @RateLimit(SPM_LIMITS.trackingWrite)
  async create(@Body() body: unknown) {
    return ok(await this.tracking.createSet(body))
  }

  @Get(':id')
  @RateLimit(SPM_LIMITS.trackingRead)
  async get(@Param('id') id: string) {
    return ok(await this.tracking.adminSet(id))
  }

  @Put(':id')
  @RateLimit(SPM_LIMITS.trackingWrite)
  async save(@Param('id') id: string, @Body() body: unknown) {
    // A deadlock between two saves has rolled back: a retryable 429, never a raw 500.
    return ok(await retryable(() => this.tracking.saveSet(id, body)))
  }
}
