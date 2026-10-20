import { createParamDecorator, type ExecutionContext } from '@nestjs/common'
import type { Request } from 'express'

import { requestIdOf } from '../../common/request/request-id'
import { type RequestWithAuth, ScopeContext } from '../../common/scope'

/** Who performed an admin write: what the audit row records (BE-NFR-08). No request content. */
export interface AuditActor {
  userId: string
  role: string
  requestId: string | null
  ip: string | null
  isTest: boolean
}

export function actorOf(req: Request & RequestWithAuth): AuditActor {
  const scope = ScopeContext.fromRequest(req)
  return {
    userId: scope.userId,
    role: scope.role,
    requestId: requestIdOf(req) ?? null,
    ip: req.ip ?? req.socket.remoteAddress ?? null,
    isTest: scope.isTest,
  }
}

/** `@Actor()` hands the acting admin to a controller method. */
export const Actor = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuditActor =>
  actorOf(ctx.switchToHttp().getRequest<Request & RequestWithAuth>()),
)
