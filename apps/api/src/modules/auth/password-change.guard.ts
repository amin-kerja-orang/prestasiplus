import { type CanActivate, type ExecutionContext, Inject, Injectable, SetMetadata } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { Request } from 'express'

import { ApiError } from '../../common/errors/api-error'
import { IS_PUBLIC_KEY } from '../../common/guards/decorators'
import { AUTH_CONTEXT_KEY, type RequestWithAuth } from '../../common/scope/auth-context'

export const ALLOW_PASSWORD_CHANGE_KEY = 'pp:allow-while-password-change-required'

/**
 * Marks a handler that must keep working while the account's `must_reset_password` flag is set: exactly
 * `GET /session` (the client reads its CSRF token and the flag there), `PUT /me/password` (the way out) and
 * logout (which is `@Public`, so it never reaches the guard). Nothing else carries this mark; it is matched by
 * handler identity, not by URL, so path case or a trailing slash cannot slip a route through.
 */
export const AllowWhilePasswordChangeRequired = (): MethodDecorator => SetMetadata(ALLOW_PASSWORD_CHANGE_KEY, true)

/**
 * Global guard, runs right after `AuthGuard`: while the account must change its password (BE-NFR-39, read fresh
 * on every request), every authenticated route answers 403 `PASSWORD_CHANGE_REQUIRED` unless it is allow-listed.
 * Role switch and Mod Pelajar are blocked too. `@Public` routes are unaffected.
 */
@Injectable()
export class PasswordChangeGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const targets = [ctx.getHandler(), ctx.getClass()]
    if (this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, targets) === true) return true
    const auth = ctx.switchToHttp().getRequest<Request & RequestWithAuth>()[AUTH_CONTEXT_KEY]
    if (!auth?.mustChangePassword) return true
    if (this.reflector.get<boolean | undefined>(ALLOW_PASSWORD_CHANGE_KEY, ctx.getHandler()) === true) return true
    throw ApiError.of('PASSWORD_CHANGE_REQUIRED')
  }
}
