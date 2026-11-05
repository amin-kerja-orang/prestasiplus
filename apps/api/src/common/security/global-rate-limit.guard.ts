import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common'
import { ModuleRef } from '@nestjs/core'
import type { Request } from 'express'

import { SESSION_RESOLVER, type SessionResolver } from '../guards/session-resolver'
import { AuthConfig } from '../../modules/auth/auth.config'
import { sessionTokenOf } from '../../modules/auth/cookies'
import { RateLimiter, type RateLimitSpec } from '../throttle/rate-limit'

/**
 * Orchestrator probes: never throttled. Both answer without a session lookup. `/api/metrics` is NOT exempt: an
 * external call resolves the session cookie (a DB read), so it stays under the per-address ceiling; an internal
 * scrape every 15 s is far below it (G4 M1, PR #81).
 */
const EXEMPT_PATHS = new Set(['/api/health', '/api/ready'])

/** Default ceiling per client address per minute on every `/api` route except health and ready. */
export const GLOBAL_RATE_SPEC: RateLimitSpec = {
  bucket: 'global',
  env: 'THROTTLE_GLOBAL_PER_MINUTE',
  default: 300,
  per: 'ip',
}

/** Ceiling per signed-in user per minute (D115): a school behind one proxy must not share the per-address bucket. */
export const GLOBAL_USER_RATE_SPEC: RateLimitSpec = {
  bucket: 'global-user',
  env: 'THROTTLE_GLOBAL_USER_PER_MINUTE',
  default: 1200,
  per: 'user',
}

/** Internal: per address, requests that carried a well-formed session cookie that did not resolve (forged or stale). Same ceiling as the address bucket. */
const UNRESOLVED_SPEC: RateLimitSpec = { ...GLOBAL_RATE_SPEC, bucket: 'global-unresolved' }

/**
 * Global ceiling: per signed-in user (1200), per client address for everyone else (300). It is a floor under the per-route `@RateLimit` buckets, which are counted separately
 * and stay stricter. Per process, in memory (a shared store is a follow-up). `req.ip` is derived in common/net/client-ip.ts (TRUST_PROXY_HOPS or the trusted edge header).
 */
@Injectable()
export class GlobalRateLimitGuard implements CanActivate {
  constructor(
    @Inject(RateLimiter) private readonly limiter: RateLimiter,
    @Inject(ModuleRef) private readonly moduleRef: ModuleRef,
  ) {}

  /**
   * Design: this guard stays registered BEFORE `AuthGuard` (SecurityModule order), so the user is not known yet.
   * It asks the session resolver, which memoises per request, so `AuthGuard` reuses the result and the lookup is done
   * once. A request without a well-formed session cookie never reaches the database and is counted per address.
   * A well-formed cookie does cost one session lookup, so forged cookies are bounded: each one that does not resolve
   * to a user uses one unit of a per-address `global-unresolved` counter (same ceiling as the address bucket); once
   * that is used up the lookup is skipped and the request is counted as anonymous. Real signed-in users never use it.
   * The resolver and config are fetched lazily (`strict: false`) so importing the auth module here does not change
   * guard order. A CSRF refusal is swallowed here (counted per address); `AuthGuard` raises it itself.
   */
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request>()
    const path = (req.originalUrl ?? req.url).split('?')[0]
    if (EXEMPT_PATHS.has((path ?? '').replace(/\/$/, ''))) return true
    const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown'
    const userId = await this.userIdOf(req, ip)
    if (userId) this.limiter.consume(GLOBAL_USER_RATE_SPEC, userId)
    else this.limiter.consume(GLOBAL_RATE_SPEC, ip)
    return true
  }

  private async userIdOf(req: Request, ip: string): Promise<string | undefined> {
    let resolver: SessionResolver
    try {
      if (!sessionTokenOf(req, this.moduleRef.get(AuthConfig, { strict: false }))) return undefined
      resolver = this.moduleRef.get<SessionResolver>(SESSION_RESOLVER, { strict: false })
    } catch {
      return undefined // no auth module wired: everything is anonymous
    }
    if (this.limiter.remaining(UNRESOLVED_SPEC, ip) < 1) return undefined
    let userId: string | undefined
    try {
      userId = (await resolver.resolve(req))?.userId
    } catch {
      userId = undefined
    }
    if (!userId) {
      try {
        this.limiter.consume(UNRESOLVED_SPEC, ip)
      } catch {
        /* the counter is full: the address bucket answers */
      }
    }
    return userId
  }
}
