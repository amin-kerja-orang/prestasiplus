import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query, Req, UseGuards, UseInterceptors } from '@nestjs/common'

import { ApiError } from '../../../common/errors/api-error'
import { Roles } from '../../../common/guards/decorators'
import { NoStoreInterceptor } from '../../../common/http'
import { requestIdOf } from '../../../common/request/request-id'
import { AUTH_CONTEXT_KEY } from '../../../common/scope/auth-context'
import { RateLimit, RateLimitGuard } from '../../../common/throttle'
import { schoolAdminOf, type SchoolAdminReq } from '../school-admin.actor'
import { SCHOOL_ADMIN_LIMITS } from '../school-admin.constants'
import { EssayReviewService, type EssayReviewActor } from './essay-review.service'

/** The school of a school admin comes from the session only; Admin Pusat has no school (every school). */
function actorOf(req: SchoolAdminReq): EssayReviewActor {
  const auth = req[AUTH_CONTEXT_KEY]
  if (!auth) throw ApiError.of('UNAUTHORIZED')
  if (auth.active.role !== 'admin') {
    const { actor, schoolId } = schoolAdminOf(req)
    return { ...actor, schoolId }
  }
  return {
    userId: auth.userId,
    role: auth.active.role,
    schoolId: null,
    sessionRowId: auth.sessionRowId,
    scopeLevel: auth.active.scope.level,
    isTest: auth.mode !== null,
    requestId: requestIdOf(req) ?? null,
    ip: req.ip ?? req.socket.remoteAddress ?? null,
  }
}

/**
 * Tanda Karangan: one controller, two doors. `/admin-sekolah/tanda-karangan` (school admin, own school) and
 * `/admin/spm/tanda-karangan` (Admin Pusat, every school). Every answer is `no-store` (pupils' work).
 */
@Controller(['admin-sekolah/tanda-karangan', 'admin/spm/tanda-karangan'])
@Roles('school_admin', 'admin')
@UseGuards(RateLimitGuard)
@UseInterceptors(NoStoreInterceptor)
export class EssayReviewController {
  constructor(@Inject(EssayReviewService) private readonly service: EssayReviewService) {}

  @Get()
  @RateLimit(SCHOOL_ADMIN_LIMITS.read)
  async list(@Req() req: SchoolAdminReq, @Query('page') page?: unknown) {
    return this.service.list(actorOf(req), page)
  }

  @Post(':id/sahkan')
  @HttpCode(200)
  @RateLimit(SCHOOL_ADMIN_LIMITS.write)
  async confirm(@Req() req: SchoolAdminReq, @Param('id') id: string, @Body() body: unknown) {
    return this.service.confirm(actorOf(req), id, body)
  }
}
