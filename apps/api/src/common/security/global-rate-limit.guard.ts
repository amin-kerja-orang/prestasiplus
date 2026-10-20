import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common'
import type { Request } from 'express'

import { RateLimiter, type RateLimitSpec } from '../throttle/rate-limit'

/** Default ceiling per client address per minute on every `/api` route except the health check. */
export const GLOBAL_RATE_SPEC: RateLimitSpec = {
  bucket: 'global',
  env: 'THROTTLE_GLOBAL_PER_MINUTE',
  default: 300,
  per: 'ip',
}

/**
 * Global per-address ceiling. It is a floor under the per-route `@RateLimit` buckets, which are counted separately
 * and stay stricter. Per process, in memory (a shared store is a follow-up). `req.ip` follows `TRUST_PROXY_HOPS`.
 */
@Injectable()
export class GlobalRateLimitGuard implements CanActivate {
  constructor(@Inject(RateLimiter) private readonly limiter: RateLimiter) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request>()
    const path = (req.originalUrl ?? req.url).split('?')[0]
    if (path === '/api/health' || path === '/api/health/') return true
    this.limiter.consume(GLOBAL_RATE_SPEC, req.ip ?? req.socket.remoteAddress ?? 'unknown')
    return true
  }
}
