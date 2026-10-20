import type { RoleCode } from '@pp/contract'

import { ApiError } from '../../../common/errors/api-error'
import { requestIdOf } from '../../../common/request/request-id'
import { AUTH_CONTEXT_KEY } from '../../../common/scope/auth-context'
import { isIdString } from '../../../db/ids'
import type { ClassesRepository } from '../../classes'
import type { SchoolAdminReq } from '../school-admin.actor'

/** Roles that reach the Amaran routes in B1 (a PPD or JPN officer has no B1 endpoints). */
export const AMARAN_ROLES = ['admin', 'school_admin', 'teacher'] as const satisfies readonly RoleCode[]
/** Roles of the school CSV (a bulk list of minors): a teacher is refused. */
export const AMARAN_EXPORT_ROLES = ['admin', 'school_admin'] as const satisfies readonly RoleCode[]

/** The signed-in caller, from the session only (nothing in the query or body can widen it). `schoolId` is null for admin. */
export interface AmaranCaller {
  userId: string
  role: RoleCode
  schoolId: string | null
  sessionRowId: string
  scopeLevel: string
  isTest: boolean
  requestId: string | null
  ip: string | null
}

export function amaranCallerOf(req: SchoolAdminReq): AmaranCaller {
  const auth = req[AUTH_CONTEXT_KEY]
  if (!auth) throw ApiError.of('UNAUTHORIZED')
  const { role, scope } = auth.active
  const schoolId = (scope.level === 'school' || scope.level === 'class') && scope.schoolId ? scope.schoolId : null
  return {
    userId: auth.userId,
    role,
    schoolId,
    sessionRowId: auth.sessionRowId,
    scopeLevel: scope.level,
    isTest: auth.mode !== null,
    requestId: requestIdOf(req) ?? null,
    ip: req.ip ?? req.socket.remoteAddress ?? null,
  }
}

/** A school id from the path or query: plain decimal digits that fit an id, else null (the caller answers 404 / 422). */
export function schoolIdOf(raw: string | undefined): string | null {
  const v = (raw ?? '').trim()
  return /^[1-9]\d{0,18}$/.test(v) && isIdString(v) ? v : null
}

/**
 * May the caller read the risk data of this school? admin: any school; school_admin: the own school; teacher: the own school or
 * the school of a class the teacher owns. Callers turn `false` into the SAME 404 as an unknown school, so the answer cannot be
 * used to list valid school ids. A role outside `AMARAN_ROLES` never gets here (the `@Roles` guard answers 403 first).
 */
export async function canReadSchool(caller: AmaranCaller, schoolId: string, classes: Pick<ClassesRepository, 'forTeacher'>): Promise<boolean> {
  if (caller.role === 'admin') return true
  if (caller.role !== 'school_admin' && caller.role !== 'teacher') return false
  if (caller.schoolId !== null && caller.schoolId === schoolId) return true
  if (caller.role === 'teacher') return (await classes.forTeacher(caller.userId)).some((c) => c.schoolId === schoolId)
  return false
}
