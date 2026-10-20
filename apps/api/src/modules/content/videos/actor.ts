import { Logger } from '@nestjs/common'
import type { Request } from 'express'

import { ApiError } from '../../../common/errors/api-error'
import type { SessionResolver } from '../../../common/guards/session-resolver'
import { requestIdOf } from '../../../common/request/request-id'
import { AUTH_CONTEXT_KEY, type AuthContext, type RequestWithAuth } from '../../../common/scope/auth-context'
import type { VideoActor } from './videos.service'

const logger = new Logger('OptionalActor')

export type AuthedRequest = Request & RequestWithAuth

export function actorFrom(auth: AuthContext, req: Request): VideoActor {
  return {
    userId: auth.userId,
    role: auth.active.role,
    sessionRowId: auth.sessionRowId,
    scopeLevel: auth.active.scope.level,
    requestId: requestIdOf(req) ?? null,
    ip: req.ip ?? req.socket.remoteAddress ?? null,
    isTest: auth.mode !== null,
  }
}

/** The caller of a route behind the global auth guard. */
export function actorOf(req: AuthedRequest): VideoActor {
  const auth = req[AUTH_CONTEXT_KEY]
  if (!auth) throw ApiError.of('UNAUTHORIZED')
  return actorFrom(auth, req)
}

/** The caller of a public route: its session when there is a valid one, else a guest (a bad or stale cookie is a guest, never an error). */
export async function optionalActorOf(resolver: SessionResolver, req: AuthedRequest): Promise<VideoActor | null> {
  try {
    const auth = await resolver.resolve(req)
    return auth ? actorFrom(auth, req) : null
  } catch (err) {
    // No session is a null result, not an error: anything thrown is a fault (for example the database), so keep it visible.
    logger.warn(`Session lookup failed on a public route; treated as a guest (${err instanceof Error ? err.name : 'unknown'})`)
    return null
  }
}
