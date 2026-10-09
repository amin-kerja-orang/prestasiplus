/**
 * The one school-scope guard of M27 Part B (build-plan M27.1 item 2; SRS BR-M27-19, 20, FR-M27-39 to 43).
 *
 * `requireSchoolAdminWithSchool`: 401 without a session, 403 for any role other than `school_admin`, 403 for
 * a school admin whose user has no school (a missing school never means "all schools"). `schoolOf(req)` then
 * gives the school of the session user and nothing else: no path, query or body value can change it.
 *
 * It does not reuse `handlers/dashboard.ts` (S0 belongs to another session).
 */

import { forbidden, unauthorized, type Middleware, type MockRequest } from '@/mock/define'
import { users } from '@/modules/m01-authentication/mock'
import { schools, type School } from '@/modules/m02-users-schools/mock'

export interface SchoolViewer {
  /** The session user. */
  userId: number
  /** The only school every M27 Part B query and write is confined to. */
  schoolId: number
}

/** Guard SA (SRS §19): 401 guest; 403 other role; 403 a school admin without a school. */
export const requireSchoolAdminWithSchool: Middleware = (req) => {
  const session = req.session
  if (!session) return unauthorized()
  if (session.role !== 'school_admin') return forbidden()
  return users.get(session.userId)?.schoolId == null ? forbidden() : undefined
}

/** The viewer of a request that passed {@link requireSchoolAdminWithSchool}. */
export function schoolOf(req: Pick<MockRequest, 'session'>): SchoolViewer {
  const session = req.session
  const schoolId = session ? users.get(session.userId)?.schoolId : null
  if (!session || schoolId == null) throw new Error('requireSchoolAdminWithSchool must run first')
  return { userId: session.userId, schoolId }
}

/** The viewer's school row. A user's school always exists (M02 `finalise` checks it). */
export function schoolRowOf(viewer: SchoolViewer): School {
  const school = schools.get(viewer.schoolId)
  if (!school) throw new Error(`M27: unknown school ${String(viewer.schoolId)}`)
  return school
}
