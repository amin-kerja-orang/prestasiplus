import { createParamDecorator, type ExecutionContext } from '@nestjs/common'
import type { RoleCode } from '@pp/contract'
import type { Request } from 'express'

import { ApiError } from '../../common/errors/api-error'
import { requestIdOf } from '../../common/request/request-id'
import { AUTH_CONTEXT_KEY, type AuthContext, type RequestWithAuth } from '../../common/scope/auth-context'

/**
 * Who is calling a PKSK route, from the request's `AuthContext` (never the query or body). Any signed-in role
 * may use the student routes, school-scoped or not, so unlike the admin `Caller` no school is required.
 */
export interface PkskActor {
  auth: AuthContext
  userId: string
  /** The ACTIVE role. */
  role: RoleCode
  /** Mod Pelajar is on: what the actor writes is test data (G-07). */
  isTest: boolean
  requestId: string | null
  ip: string | null
}

export function actorOf(req: Request & RequestWithAuth): PkskActor {
  const auth = req[AUTH_CONTEXT_KEY]
  if (!auth) throw ApiError.of('UNAUTHORIZED')
  return {
    auth,
    userId: auth.userId,
    role: auth.active.role,
    isTest: auth.mode !== null,
    requestId: requestIdOf(req) ?? null,
    ip: req.ip ?? req.socket.remoteAddress ?? null,
  }
}

/** `@Actor() actor: PkskActor` */
export const Actor = createParamDecorator((_data: unknown, ctx: ExecutionContext): PkskActor =>
  actorOf(ctx.switchToHttp().getRequest<Request & RequestWithAuth>()),
)
