import type { Request } from 'express'

import { ApiError } from '../../common/errors/api-error'
import { requestIdOf } from '../../common/request/request-id'
import { AUTH_CONTEXT_KEY, type RequestWithAuth } from '../../common/scope/auth-context'

export type SchoolAdminReq = Request & RequestWithAuth

/** The signed-in school admin and the request facts the audit row needs. `schoolId` comes from the session, never the request. */
export interface SchoolAdminActor {
  userId: string
  role: string
  schoolId: string
  sessionRowId: string
  scopeLevel: string
  isTest: boolean
  requestId: string | null
  ip: string | null
}

/**
 * The school of the signed-in school admin, from the session ONLY (nothing in the query or body can choose it). A school admin
 * without a school is refused (403): a missing school never means "all schools". Admin Pusat is excluded by `@Roles`.
 */
export function schoolAdminOf(req: SchoolAdminReq): { actor: SchoolAdminActor; schoolId: string } {
  const auth = req[AUTH_CONTEXT_KEY]
  if (!auth) throw ApiError.of('UNAUTHORIZED')
  const { scope } = auth.active
  const schoolId = (scope.level === 'school' || scope.level === 'class') && scope.schoolId ? scope.schoolId : null
  if (schoolId === null) throw ApiError.of('FORBIDDEN')
  return {
    schoolId,
    actor: {
      userId: auth.userId,
      role: auth.active.role,
      schoolId,
      sessionRowId: auth.sessionRowId,
      scopeLevel: scope.level,
      isTest: auth.mode !== null,
      requestId: requestIdOf(req) ?? null,
      ip: req.ip ?? req.socket.remoteAddress ?? null,
    },
  }
}
