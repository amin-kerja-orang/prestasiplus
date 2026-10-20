import { createParamDecorator, type ExecutionContext } from '@nestjs/common'
import type { Request } from 'express'

import { requestIdOf } from '../../common/request/request-id'
import { type RequestWithAuth, ScopeContext } from '../../common/scope'

/** Who performed a write: what the audit row records (no request content). */
export interface ShopActor {
  userId: string
  role: string
  requestId: string | null
  ip: string | null
  isTest: boolean
}

export function actorOf(req: Request & RequestWithAuth): ShopActor {
  const scope = ScopeContext.fromRequest(req)
  return {
    userId: scope.userId,
    role: scope.role,
    requestId: requestIdOf(req) ?? null,
    ip: req.ip ?? req.socket.remoteAddress ?? null,
    isTest: scope.isTest,
  }
}

/** `@Actor()` hands the acting user to a controller method. */
export const Actor = createParamDecorator((_data: unknown, ctx: ExecutionContext): ShopActor => actorOf(ctx.switchToHttp().getRequest<Request & RequestWithAuth>()))
