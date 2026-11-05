import type { Request } from 'express'

import { REPORT_SCOPE_MESSAGES } from '@pp/contract'

import { isIdString } from '../../db/ids'
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

/** The one thing the read-scope resolver needs from the schools owner (`SchoolsRepository.get` fits). */
export interface SchoolLookup {
  get(id: string): Promise<{ id: string } | null>
}

/**
 * API-ADM-22 read scope of the five school reports. `school_admin`: exactly `schoolAdminOf` (session school; `?schoolId` is
 * ignored). `admin`: `?schoolId=` is required, a canonical id (422 `fields.schoolId` when absent, repeated or malformed) of an
 * existing school (404 otherwise); the returned actor keeps role `admin` and carries the chosen school. Any other role is 403.
 * Never use this on a write route: those stay on `schoolAdminOf`.
 */
export async function schoolReadScopeOf(
  req: SchoolAdminReq,
  rawSchoolId: unknown,
  schools: SchoolLookup,
): Promise<{ actor: SchoolAdminActor; schoolId: string }> {
  const auth = req[AUTH_CONTEXT_KEY]
  if (!auth) throw ApiError.of('UNAUTHORIZED')
  if (auth.active.role !== 'admin') return schoolAdminOf(req)
  const raw = typeof rawSchoolId === 'string' ? rawSchoolId.trim() : ''
  if (!/^[1-9]\d{0,18}$/.test(raw) || !isIdString(raw)) {
    const message = REPORT_SCOPE_MESSAGES.schoolIdRequired
    throw ApiError.of('VALIDATION_ERROR', { message, fields: { schoolId: message } })
  }
  if (!(await schools.get(raw))) throw ApiError.of('NOT_FOUND')
  return {
    schoolId: raw,
    actor: {
      userId: auth.userId,
      role: auth.active.role,
      schoolId: raw,
      sessionRowId: auth.sessionRowId,
      scopeLevel: auth.active.scope.level,
      isTest: auth.mode !== null,
      requestId: requestIdOf(req) ?? null,
      ip: req.ip ?? req.socket.remoteAddress ?? null,
    },
  }
}
