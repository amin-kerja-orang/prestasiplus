import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  SetMetadata,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Reflector } from '@nestjs/core'
import type { Request } from 'express'

import { ApiError } from '../errors/api-error'
import { AUTH_CONTEXT_KEY, type RequestWithAuth } from '../scope/auth-context'
import { CLOCK, type Clock } from '../../db/clock'

/** What a route is limited by: the client address (`ip`, for public routes) or the signed-in user (`user`). */
export type RateSubject = 'ip' | 'user'

/**
 * One limit. Routes naming the same `bucket` share one counter per subject. The ceiling (requests
 * per window, 60 s unless `windowSeconds` says otherwise) is read from the environment variable `env` (a positive integer), else `default`.
 */
export interface RateLimitSpec {
  bucket: string
  env: string
  default: number
  per: RateSubject
  /** Window length in seconds; 60 when omitted (use 3600 for a per-hour limit). */
  windowSeconds?: number
}

export const RATE_LIMIT_KEY = 'pp:rate-limit'

/** Limits the route (or every route of the controller). Use with `@UseGuards(RateLimitGuard)`. */
export const RateLimit = (spec: RateLimitSpec): MethodDecorator & ClassDecorator => SetMetadata(RATE_LIMIT_KEY, spec)

const DEFAULT_WINDOW_S = 60
const PURGE_AT = 10_000

/**
 * Fixed-window counter, one per process: it is NOT shared between API instances and resets on a
 * restart. Time comes from the injected clock. The per-address subject is `req.ip`, so
 * `TRUST_PROXY_HOPS` must match the deployment (behind a proxy, 0 would put every client in one bucket).
 */
@Injectable()
export class RateLimiter {
  private readonly windows = new Map<string, { count: number; resetAt: number }>()

  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  private ceiling(spec: RateLimitSpec): number {
    const n = Number.parseInt(String(this.config.get<string>(spec.env) ?? ''), 10)
    return Number.isInteger(n) && n >= 1 ? n : spec.default
  }

  /** Counts one request; throws 429 `RATE_LIMITED` (with `retryAfter` seconds) when the window is full. */
  consume(spec: RateLimitSpec, subject: string): void {
    const now = this.clock.now().getTime()
    if (this.windows.size > PURGE_AT) {
      for (const [k, w] of this.windows) if (w.resetAt <= now) this.windows.delete(k)
    }
    const key = `${spec.bucket}:${subject}`
    let w = this.windows.get(key)
    if (!w || w.resetAt <= now) {
      w = { count: 0, resetAt: now + (spec.windowSeconds ?? DEFAULT_WINDOW_S) * 1000 }
      this.windows.set(key, w)
    }
    if (w.count >= this.ceiling(spec)) {
      throw ApiError.of('RATE_LIMITED', { retryAfter: Math.max(1, Math.ceil((w.resetAt - now) / 1000)) })
    }
    w.count += 1
  }
}

type Req = Request & RequestWithAuth

/**
 * Controller guard. It runs after the global auth and role guards, so a request that is refused
 * (401, 403, CSRF) is not counted against the user, and a public route is counted before any work.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(RateLimiter) private readonly limiter: RateLimiter,
  ) {}

  canActivate(ctx: ExecutionContext): boolean {
    const spec = this.reflector.getAllAndOverride<RateLimitSpec | undefined>(RATE_LIMIT_KEY, [ctx.getHandler(), ctx.getClass()])
    if (!spec) return true
    const req = ctx.switchToHttp().getRequest<Req>()
    const subject = spec.per === 'ip' ? (req.ip ?? req.socket.remoteAddress ?? 'unknown') : (req[AUTH_CONTEXT_KEY]?.userId ?? 'anonymous')
    this.limiter.consume(spec, subject)
    return true
  }
}
