import { Body, Controller, Get, Inject, Param, Put, Req, UseGuards, UseInterceptors } from '@nestjs/common'
import { ACCOUNT_TEACHER_PROFILE_MESSAGES, type AccountTeacherProfile, type AccountTeacherPublic } from '@pp/contract'
import type { Request } from 'express'

import { ApiError } from '../../common/errors/api-error'
import { NoStoreInterceptor } from '../../common/http/no-store.interceptor'
import { ok } from '../../common/http/respond'
import { requestIdOf } from '../../common/request/request-id'
import { AUTH_CONTEXT_KEY, type AuthContext, type RequestWithAuth } from '../../common/scope/auth-context'
import { RateLimit, RateLimitGuard } from '../../common/throttle'
import type { RequestInfo } from '../auth/auth.service'
import { ACCOUNT_LIMITS } from './account.constants'
import { TeacherProfileService } from './teacher-profile.service'

type AuthedRequest = Request & RequestWithAuth

function authOf(req: AuthedRequest): AuthContext {
  const auth = req[AUTH_CONTEXT_KEY]
  if (!auth) throw ApiError.of('UNAUTHORIZED')
  return auth
}

function infoOf(req: Request): RequestInfo {
  const ua = req.headers['user-agent']
  return { ip: req.ip ?? req.socket.remoteAddress ?? 'unknown', userAgent: typeof ua === 'string' ? ua : null, requestId: requestIdOf(req) ?? null }
}

/** API-GUR-22, own half: `/account/teacher-profile`. Teacher role only; personal data, so every response is `no-store`. */
@Controller('account/teacher-profile')
@UseGuards(RateLimitGuard)
@UseInterceptors(NoStoreInterceptor)
export class TeacherProfileController {
  constructor(@Inject(TeacherProfileService) private readonly profile: TeacherProfileService) {}

  @Get()
  async get(@Req() req: AuthedRequest): Promise<{ data: AccountTeacherProfile }> {
    return ok(await this.profile.get(authOf(req)))
  }

  @Put()
  @RateLimit(ACCOUNT_LIMITS.write)
  async save(@Body() raw: unknown, @Req() req: AuthedRequest): Promise<{ data: AccountTeacherProfile; status: string }> {
    return { data: await this.profile.save(authOf(req), raw, infoOf(req)), status: ACCOUNT_TEACHER_PROFILE_MESSAGES.saved }
  }
}

/**
 * API-GUR-22, card half: `GET /public/teachers/:id`. The prefix is historical: it needs a session of a teacher, an admin or a school
 * admin (not authenticated by `@Public`), and another role gets the uniform 404.
 */
@Controller('public/teachers')
@UseInterceptors(NoStoreInterceptor)
export class TeacherCardController {
  constructor(@Inject(TeacherProfileService) private readonly profile: TeacherProfileService) {}

  @Get(':id')
  async card(@Param('id') id: string, @Req() req: AuthedRequest): Promise<{ data: AccountTeacherPublic }> {
    return ok(await this.profile.card(authOf(req), id))
  }
}
