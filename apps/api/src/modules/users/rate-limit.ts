import { type CanActivate, type ExecutionContext, Inject, Injectable, SetMetadata } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Reflector } from '@nestjs/core'
import type { Request } from 'express'

import { ApiError } from '../../common/errors/api-error'
import { AUTH_CONTEXT_KEY, type RequestWithAuth } from '../../common/scope/auth-context'
import { CLOCK, type Clock } from '../../db/clock'

/**
 * `read` and `write` count requests per signed-in user per minute; `import` counts bulk imports per
 * user per hour (each row costs a slow password hash, so it is the tightest bucket).
 */
export type RateBucket = 'read' | 'write' | 'import'

export const RATE_BUCKET_KEY = 'pp:users:rate-bucket'
export const RateLimit = (bucket: RateBucket): MethodDecorator & ClassDecorator => SetMetadata(RATE_BUCKET_KEY, bucket)

/** Working values (OQ-9 has no URS number yet). Env keys override them. */
export const DEFAULT_LIMITS: Readonly<Record<RateBucket, number>> = { read: 300, write: 30, import: 10 }
const ENV_KEYS: Readonly<Record<RateBucket, string>> = {
  read: 'THROTTLE_ADMIN_READ_PER_MINUTE',
  write: 'THROTTLE_ADMIN_WRITE_PER_MINUTE',
  import: 'THROTTLE_IMPORT_PER_HOUR',
}
const WINDOW_MS: Readonly<Record<RateBucket, number>> = { read: 60_000, write: 60_000, import: 3_600_000 }
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
export class UsersRateLimiter {
  private readonly windows = new Map<string, { count: number; resetAt: number }>()
  private readonly limits: Record<RateBucket, number>

  constructor(
    @Inject(ConfigService) config: ConfigService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {
    this.limits = { read: limitOf(config, 'read'), write: limitOf(config, 'write'), import: limitOf(config, 'import') }
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
      w = { count: 0, resetAt: now + WINDOW_MS[bucket] }
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
 * Controller guard. It runs after the global auth and role guards, so a refused request (401, 403,
 * CSRF) is not counted against the user.
 */
@Injectable()
export class UsersRateLimitGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(UsersRateLimiter) private readonly limiter: UsersRateLimiter,
  ) {}

  canActivate(ctx: ExecutionContext): boolean {
    const bucket = this.reflector.getAllAndOverride<RateBucket | undefined>(RATE_BUCKET_KEY, [ctx.getHandler(), ctx.getClass()])
    if (!bucket) return true
    const req = ctx.switchToHttp().getRequest<Req>()
    this.limiter.consume(bucket, req[AUTH_CONTEXT_KEY]?.userId ?? 'anonymous')
    return true
  }
}
