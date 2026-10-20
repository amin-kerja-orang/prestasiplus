import { createParamDecorator, type ExecutionContext } from '@nestjs/common'
import type { RoleCode } from '@pp/contract'
import type { Request } from 'express'

import { ApiError } from '../../common/errors/api-error'
import { requestIdOf } from '../../common/request/request-id'
import { AUTH_CONTEXT_KEY, type AuthContext, type RequestWithAuth } from '../../common/scope/auth-context'

/**
 * Who is calling a class route, flattened from the request's `AuthContext` (never from the query or body).
 * Unlike the admin `Caller`, a student or admin without a school is allowed here: the learner routes
 * (`/kelas-saya`) are used by accounts with the `self` or `national` scope.
 */
export interface ClassActor {
  auth: AuthContext
  userId: string
  /** The ACTIVE role. */
  role: RoleCode
  /** Decimal id of the school of a school-scoped role (teacher); null otherwise. */
  schoolId: string | null
  /** Mod Pelajar is on: what the actor writes is test data. */
  isTest: boolean
  requestId: string | null
  ip: string | null
}

export function actorOf(req: Request & RequestWithAuth): ClassActor {
  const auth = req[AUTH_CONTEXT_KEY]
  if (!auth) throw ApiError.of('UNAUTHORIZED')
  const { role, scope } = auth.active
  const schoolId = (scope.level === 'school' || scope.level === 'class') && scope.schoolId ? scope.schoolId : null
  return {
    auth,
    userId: auth.userId,
    role,
    schoolId,
    isTest: auth.mode !== null,
    requestId: requestIdOf(req) ?? null,
    ip: req.ip ?? req.socket.remoteAddress ?? null,
  }
}

/** `@Actor() actor: ClassActor` */
export const Actor = createParamDecorator((_data: unknown, ctx: ExecutionContext): ClassActor =>
  actorOf(ctx.switchToHttp().getRequest<Request & RequestWithAuth>()),
)
