import { Body, Controller, Get, HttpCode, Inject, Post, Req, UseGuards, UseInterceptors } from '@nestjs/common'
import type { AccountMoodCheckin, AccountMoodToday } from '@pp/contract'
import type { Request } from 'express'

import { ApiError } from '../../common/errors/api-error'
import { Roles } from '../../common/guards/decorators'
import { NoStoreInterceptor } from '../../common/http/no-store.interceptor'
import { ok } from '../../common/http/respond'
import { AUTH_CONTEXT_KEY, type AuthContext, type RequestWithAuth } from '../../common/scope/auth-context'
import { RateLimit, RateLimitGuard } from '../../common/throttle'
import { ACCOUNT_LIMITS } from './account.constants'
import { MoodService } from './mood.service'

type AuthedRequest = Request & RequestWithAuth

function authOf(req: AuthedRequest): AuthContext {
  const auth = req[AUTH_CONTEXT_KEY]
  if (!auth) throw ApiError.of('UNAUTHORIZED')
  return auth
}

/**
 * API-MUR-11 (S5-T04): the pupil's mood of the day. Student only: any other active role is 403 FORBIDDEN. A pupil's mood is
 * personal data of a minor, so every response is `no-store`.
 */
@Controller('me/mood')
@Roles('student')
@UseGuards(RateLimitGuard)
@UseInterceptors(NoStoreInterceptor)
export class MoodController {
  constructor(@Inject(MoodService) private readonly mood: MoodService) {}

  @Post()
  @HttpCode(200)
  @RateLimit(ACCOUNT_LIMITS.write)
  async checkIn(@Body() raw: unknown, @Req() req: AuthedRequest): Promise<{ data: AccountMoodCheckin }> {
    return ok(await this.mood.checkIn(authOf(req), raw))
  }

  @Get('today')
  async today(@Req() req: AuthedRequest): Promise<{ data: AccountMoodToday }> {
    return ok(await this.mood.today(authOf(req)))
  }
}
