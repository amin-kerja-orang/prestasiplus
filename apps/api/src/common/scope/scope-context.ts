import { type Provider, Scope as NestScope } from '@nestjs/common'
import { REQUEST } from '@nestjs/core'
import type { ActiveRole, RoleCode, Scope } from '@pp/contract'
import type { Request } from 'express'

import { ApiError } from '../errors/api-error'
import { AUTH_CONTEXT_KEY, type AuthContext, type RequestWithAuth } from './auth-context'
import { ScopeFilter } from './scope-filter'

/**
 * The active role and scope of the current request, read from `request.auth` (set by `AuthGuard` from
 * the current account rows). It is the only way services and repositories learn the scope: nothing
 * reads it from the query or body (ADR-0017).
 */
export class ScopeContext {
  /** Pass a request (read lazily: request-scoped providers are built before the guards run) or an AuthContext. */
  constructor(private readonly source: (Request & RequestWithAuth) | AuthContext) {}

  /** The request's AuthContext; throws 401 when there is none (a route not behind AuthGuard). */
  get auth(): AuthContext {
    const auth = 'sessionRowId' in this.source ? this.source : this.source[AUTH_CONTEXT_KEY]
    if (!auth) throw ApiError.of('UNAUTHORIZED')
    return auth
  }

  static fromRequest(req: Request & RequestWithAuth): ScopeContext {
    return new ScopeContext(req)
  }

  get userId(): string {
    return this.auth.userId
  }
  get active(): ActiveRole {
    return this.auth.active
  }
  get role(): RoleCode {
    return this.auth.active.role
  }
  get scope(): Scope {
    return this.auth.active.scope
  }
  /** True while Mod Pelajar is on (rows written are test data). */
  get isTest(): boolean {
    return this.auth.mode !== null
  }

  /** Filter helper for repositories. */
  filter(): ScopeFilter {
    return new ScopeFilter(this.auth)
  }
}

/** Request-scoped provider of `ScopeContext`; list it in the `providers` (and `exports`) of a module. */
export const SCOPE_CONTEXT_PROVIDER: Provider = {
  provide: ScopeContext,
  scope: NestScope.REQUEST,
  inject: [REQUEST],
  useFactory: (req: Request & RequestWithAuth) => ScopeContext.fromRequest(req),
}
