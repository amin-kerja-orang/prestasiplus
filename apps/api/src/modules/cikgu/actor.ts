import { createParamDecorator, type ExecutionContext } from '@nestjs/common'
import type { Request } from 'express'

import { ApiError } from '../../common/errors/api-error'
import { AUTH_CONTEXT_KEY, type RequestWithAuth } from '../../common/scope/auth-context'
import type { CikguActor } from './cikgu.service'

/** `@Actor() actor: CikguActor`: the signed-in user, from the request's `AuthContext` only (never from the query or body). */
export const Actor = createParamDecorator((_data: unknown, ctx: ExecutionContext): CikguActor => {
  const auth = ctx.switchToHttp().getRequest<Request & RequestWithAuth>()[AUTH_CONTEXT_KEY]
  if (!auth) throw ApiError.of('UNAUTHORIZED')
  return { userId: auth.userId, role: auth.active.role, isTest: auth.mode !== null }
})
