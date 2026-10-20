import { Body, Controller, Get, Headers, HttpCode, Post, Query, Req, UseGuards, UseInterceptors } from '@nestjs/common'
import type { Request } from 'express'

import { ApiError } from '../../common/errors/api-error'
import { NoStoreInterceptor, ok } from '../../common/http'
import { AUTH_CONTEXT_KEY, type RequestWithAuth } from '../../common/scope/auth-context'
import { RateLimit, RateLimitGuard } from '../../common/throttle'
import { isOverloadError } from '../auth/auth.errors'
import { isTestActor } from '../wallet'
import { GAMIFICATION_LIMITS, IDEMPOTENCY_HEADER, IDEMPOTENCY_KEY_PATTERN } from './gamification.constants'
import { GamificationService, type Viewer } from './gamification.service'
import { bodyOf, intOf, queryText, validationFailure } from './validation'
import { GAMIFICATION_MESSAGES as MSG } from '@pp/contract'

type Req = Request & RequestWithAuth

/** The caller's own id and Mod Pelajar state: there is no id parameter, so nobody can ask for another user's data. */
function viewerOf(req: Req): Viewer {
  const auth = req[AUTH_CONTEXT_KEY]
  if (!auth) throw ApiError.of('UNAUTHORIZED')
  return { userId: auth.userId, isTest: isTestActor(auth) }
}

/** An overloaded database is a retryable 429, never a 500. */
async function guard<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    if (isOverloadError(err)) throw ApiError.of('RATE_LIMITED', { retryAfter: 5 })
    throw err
  }
}

/**
 * The signed-in user's own gamification (M14 `S` routes beyond the wallet core): any logged-in user, as the mock
 * (`anySession`); the session guard makes anonymous calls 401 and CSRF is checked on every mutation. Every figure is
 * the caller's own; money data is personal, so every answer is `no-store`. Reads are rate limited per user, the
 * conversion has its own ceiling (429 `RATE_LIMITED`).
 */
@Controller('gamification')
@UseGuards(RateLimitGuard)
@UseInterceptors(NoStoreInterceptor)
@RateLimit(GAMIFICATION_LIMITS.read)
export class GamificationController {
  constructor(private readonly gamification: GamificationService) {}

  @Get('dashboard')
  async dashboard(@Req() req: Req) {
    return ok(await guard(() => this.gamification.dashboard(viewerOf(req).userId)))
  }

  @Get('challenges')
  async challenges(@Req() req: Req) {
    return guard(() => this.gamification.challengesToday(viewerOf(req).userId))
  }

  /** The period and every other query are ignored (FR-M14-08, FR-M14-42). */
  @Get('leaderboard')
  async leaderboard(@Req() req: Req) {
    viewerOf(req)
    return ok(await guard(() => this.gamification.leaderboard()))
  }

  @Get('achievements')
  async achievements(@Req() req: Req, @Query() query: Record<string, unknown>) {
    return ok(await guard(() => this.gamification.achievements(viewerOf(req).userId, queryText(query.rarity))))
  }

  @Get('share-cards')
  async shareCards(@Req() req: Req) {
    return ok(await guard(() => this.gamification.shareCards(viewerOf(req).userId)))
  }

  /** The first read creates the caller's code (a write on a GET, BR-M14-18). */
  @Get('referral')
  async referral(@Req() req: Req) {
    return ok(await guard(() => this.gamification.referral(viewerOf(req).userId)))
  }

  @Get('convert')
  async convertView(@Req() req: Req) {
    return ok(await guard(() => this.gamification.convertView(viewerOf(req).userId)))
  }

  @Post('convert')
  @HttpCode(200)
  @RateLimit(GAMIFICATION_LIMITS.convert)
  async convert(@Req() req: Req, @Body() body: unknown, @Headers(IDEMPOTENCY_HEADER) idempotencyKey: string | undefined) {
    const amount = intOf(bodyOf(body).syilingAmount)
    if (amount === undefined) throw validationFailure({ syilingAmount: MSG.amountInvalid }, MSG.amountInvalid)
    if (idempotencyKey !== undefined && !IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)) {
      throw validationFailure({ 'Idempotency-Key': MSG.invalid })
    }
    return ok(await guard(() => this.gamification.convert(viewerOf(req), amount, idempotencyKey ?? null)))
  }
}
