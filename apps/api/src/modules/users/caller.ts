import { createParamDecorator, type ExecutionContext } from '@nestjs/common'
import type { RoleCode } from '@pp/contract'
import type { Request } from 'express'

import { ApiError } from '../../common/errors/api-error'
import { requestIdOf } from '../../common/request/request-id'
import { AUTH_CONTEXT_KEY, type AuthContext, type RequestWithAuth } from '../../common/scope/auth-context'

/** Who is calling, flattened from the request's `AuthContext` (never from the query or body). */
export interface Caller {
  auth: AuthContext
  userId: string
  /** The ACTIVE role. */
  role: RoleCode
  /** Decimal school id of a school-scoped role; null for admin. */
  schoolId: string | null
  isAdmin: boolean
  requestId: string | null
  ip: string | null
}

export function callerOf(req: Request & RequestWithAuth): Caller {
  const auth = req[AUTH_CONTEXT_KEY]
  if (!auth) throw ApiError.of('UNAUTHORIZED')
  const { role, scope } = auth.active
  const schoolId = (scope.level === 'school' || scope.level === 'class') && scope.schoolId ? scope.schoolId : null
  return {
    auth,
    userId: auth.userId,
    role,
    schoolId,
    isAdmin: role === 'admin',
    requestId: requestIdOf(req) ?? null,
    ip: req.ip ?? req.socket.remoteAddress ?? null,
  }
}

/** `@CurrentCaller() caller: Caller` */
export const CurrentCaller = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Caller => callerOf(ctx.switchToHttp().getRequest<Request & RequestWithAuth>()),
)
