import { type CanActivate, type ExecutionContext, Inject, Injectable, SetMetadata } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { Response } from 'express'

const PRAGMA_KEY = 'pp:school-admin:pragma-no-cache'

/** Marks a route whose answer carries a credential or a bulk list of minors: it also gets `Pragma: no-cache` (D57b). */
export const PragmaNoCache = (): MethodDecorator => SetMetadata(PRAGMA_KEY, true)

/**
 * Sets `Cache-Control: no-store` (and `Pragma: no-cache` on `@PragmaNoCache()` routes) in a GUARD, so the headers are on
 * every answer that is produced after it: success, 404, 403, 422 and the 429 of the rate limiter. (An interceptor runs after
 * the guards and would miss the 429.) Declare it BEFORE `RateLimitGuard`. The global guards (401, role, CSRF) run earlier and
 * answer without these headers; none of those answers carries data.
 */
@Injectable()
export class PeopleHeadersGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const res = ctx.switchToHttp().getResponse<Response>()
    res.setHeader('Cache-Control', 'no-store')
    if (this.reflector.getAllAndOverride<boolean | undefined>(PRAGMA_KEY, [ctx.getHandler(), ctx.getClass()])) res.setHeader('Pragma', 'no-cache')
    return true
  }
}
