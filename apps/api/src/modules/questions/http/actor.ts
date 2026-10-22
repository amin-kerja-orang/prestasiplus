import { createParamDecorator, type ExecutionContext } from '@nestjs/common'
import type { Request } from 'express'

import { requestIdOf } from '../../../common/request/request-id'
import { type RequestWithAuth, ScopeContext } from '../../../common/scope'
import type { QuestionActor } from '../types'

/** Who performs a write: what the service and the audit row need (no request content). */
export interface HttpActor extends QuestionActor {
  /** Active role code of the session (`admin` or `teacher` on these routes). */
  roleCode: string
  /** Scope level of the active role (audit `scope_level`). */
  scopeLevel?: string
  requestId: string | null
  ip: string | null
  isTest: boolean
}

export function actorOf(req: Request & RequestWithAuth): HttpActor {
  const scope = ScopeContext.fromRequest(req)
  return {
    userId: scope.userId,
    role: scope.role === 'admin' ? 'admin' : 'teacher',
    roleCode: scope.role,
    scopeLevel: scope.scope.level,
    requestId: requestIdOf(req) ?? null,
    ip: req.ip ?? req.socket.remoteAddress ?? null,
    isTest: scope.isTest,
  }
}

/** `@Actor()` hands the signed-in user to a controller method. */
export const Actor = createParamDecorator((_data: unknown, ctx: ExecutionContext): HttpActor =>
  actorOf(ctx.switchToHttp().getRequest<Request & RequestWithAuth>()),
)
