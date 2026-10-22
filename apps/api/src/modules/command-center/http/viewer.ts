import { ApiError } from '../../../common/errors/api-error'
import { AUTH_CONTEXT_KEY, type RequestWithAuth } from '../../../common/scope/auth-context'

export type ViewerRole = 'admin' | 'teacher' | 'school_admin'

/** The signed-in caller as the Command Center sees it. Everything comes from the session, never from the query, body or path. */
export interface Viewer {
  userId: string
  role: ViewerRole
  /** The school of a school admin (session only); null for admin and teacher. */
  schoolId: string | null
  /** Admin acting in Mod Pelajar has role `student` and is refused by `@Roles` already; this is always false here. */
  isAdmin: boolean
}

/**
 * The viewer of a request. `@Roles` has already refused other roles (403). A school admin without a school is refused here
 * (403), never answered with platform figures. A `?schoolId=` in the query is not read anywhere.
 */
export function viewerOf(req: RequestWithAuth): Viewer {
  const auth = req[AUTH_CONTEXT_KEY]
  if (!auth) throw ApiError.of('UNAUTHORIZED')
  const { role, scope } = auth.active
  if (role !== 'admin' && role !== 'teacher' && role !== 'school_admin') throw ApiError.of('FORBIDDEN')
  if (role === 'school_admin') {
    const schoolId = (scope.level === 'school' || scope.level === 'class') && scope.schoolId ? scope.schoolId : null
    if (schoolId === null) throw ApiError.of('FORBIDDEN')
    return { userId: auth.userId, role, schoolId, isAdmin: false }
  }
  return { userId: auth.userId, role, schoolId: null, isAdmin: role === 'admin' }
}
