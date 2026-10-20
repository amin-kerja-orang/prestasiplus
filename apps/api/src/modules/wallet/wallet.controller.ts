import { Controller, Get, Query, Req, UseGuards, UseInterceptors } from '@nestjs/common'
import type { Request } from 'express'

import { ApiError } from '../../common/errors/api-error'
import { NoStoreInterceptor, ok } from '../../common/http'
import { AUTH_CONTEXT_KEY, type RequestWithAuth } from '../../common/scope/auth-context'
import { RateLimit, RateLimitGuard } from '../../common/throttle'
import { isOverloadError } from '../auth/auth.errors'
import { WALLET_READ_LIMIT } from './wallet.constants'
import { WalletService } from './wallet.service'

type Req = Request & RequestWithAuth

/** The caller's own id: there is no id parameter, so no one can ask for another user's wallet. */
function me(req: Req): string {
  const auth = req[AUTH_CONTEXT_KEY]
  if (!auth) throw ApiError.of('UNAUTHORIZED')
  return auth.userId
}

/** A repeated key (`?type=a&type=b`) arrives as an array: the first string wins; anything else reads as empty. */
const first = (v: unknown): string => {
  const x = Array.isArray(v) ? v[0] : v
  return typeof x === 'string' ? x : ''
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
 * The signed-in user's own wallet and ledger (any role, M14 `S` routes). The session guard makes anonymous
 * calls 401. Money data is personal, so every answer is `no-store`.
 */
@Controller('gamification')
@UseGuards(RateLimitGuard)
@UseInterceptors(NoStoreInterceptor)
@RateLimit(WALLET_READ_LIMIT)
export class WalletController {
  constructor(private readonly wallet: WalletService) {}

  @Get('wallet')
  async summary(@Req() req: Req) {
    return ok(await guard(() => this.wallet.summary(me(req))))
  }

  @Get('transactions')
  async transactions(@Req() req: Req, @Query() query: Record<string, unknown>) {
    return guard(() => this.wallet.transactions(me(req), first(query.type)))
  }
}

/** App shell chips (`/api/me/gamification-summary`). */
@Controller('me')
@UseGuards(RateLimitGuard)
@UseInterceptors(NoStoreInterceptor)
@RateLimit(WALLET_READ_LIMIT)
export class MeGamificationController {
  constructor(private readonly wallet: WalletService) {}

  @Get('gamification-summary')
  async summary(@Req() req: Req) {
    return ok(await guard(() => this.wallet.gamificationSummary(me(req))))
  }
}
