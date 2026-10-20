import { Controller, Get, HttpCode, Inject, Param, Post, Req, UseGuards, UseInterceptors } from '@nestjs/common'
import type { Request } from 'express'

import { ApiError } from '../../common/errors/api-error'
import { Roles } from '../../common/guards/decorators'
import { NoStoreInterceptor, ok } from '../../common/http'
import { requestIdOf } from '../../common/request/request-id'
import { AUTH_CONTEXT_KEY, type RequestWithAuth } from '../../common/scope/auth-context'
import { RateLimit, RateLimitGuard } from '../../common/throttle'
import { callerOf } from '../users/caller'
import { DashboardService } from './dashboard.service'
import { PendingTeachersService, type SchoolAdminActor } from './pending-teachers.service'
import { SCHOOL_ADMIN_LIMITS } from './school-admin.constants'

type Req = Request & RequestWithAuth

/**
 * The school of the signed-in school admin, from the session ONLY (nothing in the query or body can choose it). A school admin
 * without a school is refused (403): a missing school never means "all schools". Admin Pusat is excluded by `@Roles`.
 */
function schoolAdminOf(req: Req): { actor: SchoolAdminActor; schoolId: string } {
  const auth = req[AUTH_CONTEXT_KEY]
  if (!auth) throw ApiError.of('UNAUTHORIZED')
  const { scope } = auth.active
  const schoolId = (scope.level === 'school' || scope.level === 'class') && scope.schoolId ? scope.schoolId : null
  if (schoolId === null) throw ApiError.of('FORBIDDEN')
  return {
    schoolId,
    actor: {
      userId: auth.userId,
      role: auth.active.role,
      schoolId,
      sessionRowId: auth.sessionRowId,
      scopeLevel: scope.level,
      isTest: auth.mode !== null,
      requestId: requestIdOf(req) ?? null,
      ip: req.ip ?? req.socket.remoteAddress ?? null,
    },
  }
}

/**
 * `/admin-sekolah/*` slice of BE-21: the school dashboard and the pending teachers. Every answer is `no-store`. The global
 * guards give 401 (no session) and 403 (CSRF on the POST); `@Roles('school_admin')` gives 403 to every other role.
 */
@Controller('admin-sekolah')
@Roles('school_admin')
@UseGuards(RateLimitGuard)
@UseInterceptors(NoStoreInterceptor)
export class SchoolAdminController {
  constructor(
    @Inject(DashboardService) private readonly dashboard: DashboardService,
    @Inject(PendingTeachersService) private readonly pending: PendingTeachersService,
  ) {}

  @Get('dashboard')
  @RateLimit(SCHOOL_ADMIN_LIMITS.read)
  async getDashboard(@Req() req: Req) {
    const { schoolId } = schoolAdminOf(req)
    const auth = req[AUTH_CONTEXT_KEY]
    if (!auth) throw ApiError.of('UNAUTHORIZED')
    const perf = { userId: auth.userId, role: auth.active.role, scope: auth.active.scope, isTest: auth.mode !== null }
    return ok(await this.dashboard.dashboard(callerOf(req), schoolId, perf))
  }

  /** Declared before any `:id` route so `pending` is never read as an id. */
  @Get('guru/pending')
  @RateLimit(SCHOOL_ADMIN_LIMITS.read)
  async listPending(@Req() req: Req) {
    return this.pending.list(schoolAdminOf(req).actor)
  }

  @Post('guru/:id/verify')
  @HttpCode(200)
  @RateLimit(SCHOOL_ADMIN_LIMITS.write)
  async verify(@Req() req: Req, @Param('id') id: string) {
    return this.pending.verify(schoolAdminOf(req).actor, id)
  }
}
