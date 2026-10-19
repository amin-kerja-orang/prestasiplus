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

import { ApiError } from '../../common/errors/api-error'
import { AUTH_CONTEXT_KEY, type RequestWithAuth } from '../../common/scope/auth-context'
import { CLOCK, type Clock } from '../../db/clock'

/**
 * `public`: unauthenticated lookups, counted per client address.
 * `read` and `write`: admin routes, counted per signed-in user (D57a).
 */
export type RateBucket = 'public' | 'read' | 'write'

export const RATE_BUCKET_KEY = 'pp:schools:rate-bucket'
export const RateLimit = (bucket: RateBucket): MethodDecorator & ClassDecorator => SetMetadata(RATE_BUCKET_KEY, bucket)

/** Requests per minute when the env key is unset (BE-05 working values; OQ-9 has no URS number yet). */
export const DEFAULT_LIMITS: Readonly<Record<RateBucket, number>> = { public: 60, read: 300, write: 30 }
const ENV_KEYS: Readonly<Record<RateBucket, string>> = {
  public: 'THROTTLE_PUBLIC_PER_MINUTE',
  read: 'THROTTLE_ADMIN_READ_PER_MINUTE',
  write: 'THROTTLE_ADMIN_WRITE_PER_MINUTE',
}
const WINDOW_MS = 60_000
const PURGE_AT = 10_000

function limitOf(config: ConfigService, bucket: RateBucket): number {
  const n = Number.parseInt(String(config.get<string>(ENV_KEYS[bucket]) ?? ''), 10)
  return Number.isInteger(n) && n >= 1 ? n : DEFAULT_LIMITS[bucket]
}

/**
 * Fixed-window counter, one per process (it resets on restart and is not shared between API
 * instances; a shared store is a deployment decision). Time comes from the injected clock.
 */
@Injectable()
export class RateLimiter {
  private readonly windows = new Map<string, { count: number; resetAt: number }>()
  private readonly limits: Record<RateBucket, number>

  constructor(
    @Inject(ConfigService) config: ConfigService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {
    this.limits = { public: limitOf(config, 'public'), read: limitOf(config, 'read'), write: limitOf(config, 'write') }
  }

  /** Counts one request; throws 429 `RATE_LIMITED` (with `retryAfter` seconds) when the window is full. */
  consume(bucket: RateBucket, subject: string): void {
    const now = this.clock.now().getTime()
    if (this.windows.size > PURGE_AT) {
      for (const [k, w] of this.windows) if (w.resetAt <= now) this.windows.delete(k)
    }
    const key = `${bucket}:${subject}`
    let w = this.windows.get(key)
    if (!w || w.resetAt <= now) {
      w = { count: 0, resetAt: now + WINDOW_MS }
      this.windows.set(key, w)
    }
    if (w.count >= this.limits[bucket]) {
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
    const bucket = this.reflector.getAllAndOverride<RateBucket | undefined>(RATE_BUCKET_KEY, [ctx.getHandler(), ctx.getClass()])
    if (!bucket) return true
    const req = ctx.switchToHttp().getRequest<Req>()
    const subject = bucket === 'public' ? (req.ip ?? req.socket.remoteAddress ?? 'unknown') : (req[AUTH_CONTEXT_KEY]?.userId ?? 'anonymous')
    this.limiter.consume(bucket, subject)
    return true
  }
}
