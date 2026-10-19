import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  type Provider,
} from '@nestjs/common'
import { APP_GUARD, Reflector } from '@nestjs/core'
import type { RoleCode } from '@pp/contract'
import type { Request } from 'express'

import { ApiError } from '../errors/api-error'
import { AUTH_CONTEXT_KEY, type AuthContext, type RequestWithAuth } from '../scope/auth-context'
import { CAPABILITY_KEY, IS_PUBLIC_KEY, ROLES_KEY } from './decorators'
import { SESSION_RESOLVER, type SessionResolver } from './session-resolver'

type AuthedRequest = Request & RequestWithAuth

function authOf(ctx: ExecutionContext): AuthContext | undefined {
  return ctx.switchToHttp().getRequest<AuthedRequest>()[AUTH_CONTEXT_KEY]
}

function isPublic(reflector: Reflector, ctx: ExecutionContext): boolean {
  return reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, [ctx.getHandler(), ctx.getClass()]) === true
}

/** Resolves the session (cookie -> fresh AuthContext) and sets `request.auth`. 401 when there is none. */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(SESSION_RESOLVER) private readonly resolver: SessionResolver,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (isPublic(this.reflector, ctx)) return true
    const req = ctx.switchToHttp().getRequest<AuthedRequest>()
    // A resolver CSRF error (ApiError CSRF_INVALID, 403) propagates unchanged.
    const auth = await this.resolver.resolve(req)
    if (!auth) throw ApiError.of('UNAUTHORIZED')
    req[AUTH_CONTEXT_KEY] = auth
    return true
  }
}

/** `@Roles(...)`: the ACTIVE role must be listed; the other roles of the account do not count. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    if (isPublic(this.reflector, ctx)) return true
    const roles = this.reflector.getAllAndOverride<RoleCode[] | undefined>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ])
    if (!roles || roles.length === 0) return true
    const auth = authOf(ctx)
    if (!auth) throw ApiError.of('UNAUTHORIZED')
    // ROLE_NOT_ALLOWED is the role-switch refusal; a role refusal on a route is the generic FORBIDDEN.
    if (!roles.includes(auth.active.role)) throw ApiError.of('FORBIDDEN')
    return true
  }
}

/** `@Capability(key)`: the active role/scope capability list must contain `key`. */
@Injectable()
export class CapabilityGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    if (isPublic(this.reflector, ctx)) return true
    const key = this.reflector.getAllAndOverride<string | undefined>(CAPABILITY_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ])
    if (!key) return true
    const auth = authOf(ctx)
    if (!auth) throw ApiError.of('UNAUTHORIZED')
    if (!auth.capabilities.includes(key)) throw ApiError.of('FORBIDDEN')
    return true
  }
}

/** Global guards in execution order: Auth, Roles, Capability. Register in the auth module. */
export const GUARD_PROVIDERS: Provider[] = [
  { provide: APP_GUARD, useClass: AuthGuard },
  { provide: APP_GUARD, useClass: RolesGuard },
  { provide: APP_GUARD, useClass: CapabilityGuard },
]
