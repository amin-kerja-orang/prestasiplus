/**
 * Helpers shared by the M12 handlers (SRS M12 v1.6 §7, §9, §11.1): the viewer, the role guards, the scope of a
 * request and the M12 error to response mapping.
 *
 * Access (independent of the URL prefix, SEC-M12-01):
 * - `scopedRoles` = admin, teacher and **school_admin** (S6-T02, FR-AS-11-1): every S1-S8 endpoint, the PDF, the
 *   intervention list and form and filter-options. The school administrator is always forced to its own school,
 *   whatever `schoolId` / `state` the request carries; a teacher and a school administrator get 404 for a pupil
 *   (or record) outside their school (D-T02-2, ERR-ACC-02);
 * - `reviewRoles` = teacher and school_admin: "Semak keputusan" (the admin answers 403);
 * - any logged-in user: `/api/kirkpatrick/me` and the feedback endpoints.
 */

import {
  abort,
  conflict,
  forbidden,
  notFound,
  queryString,
  requireRole,
  validationError,
  type MockRequest,
} from '@/mock/define'
import { users } from '@/modules/m01-authentication/mock'

import { M12Error } from '../repository/common'
import { emptyScope, resolveScope, type Scope } from '../repository/scope'

export const reviewRoles = requireRole('teacher', 'school_admin')
export const scopedRoles = requireRole('admin', 'teacher', 'school_admin')

export interface Viewer {
  id: number
  role: string
  schoolId: number | null
}

/** The viewer of a guarded route (`requireAuth` / `requireRole` has run). */
export function viewerOf(req: MockRequest): Viewer {
  if (!req.session) throw new Error('requireAuth() must run first')
  const { userId, role } = req.session
  return { id: userId, role, schoolId: users.get(userId)?.schoolId ?? null }
}

/** PROPOSED COPY: a query value that is not a whole number (SEC-M12-09). */
export const FIELD_INVALID = 'Medan ini tidak sah.'
/** PROPOSED COPY (same text as M09). */
export const FIELD_REQUIRED = 'Medan ini diperlukan.'

function schoolIdOf(req: MockRequest): number | null {
  const raw = queryString(req.query, 'schoolId')?.trim()
  if (raw === undefined || raw === '') return null
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(Number(raw))) {
    abort(validationError({ schoolId: FIELD_INVALID }))
  }
  return Number(raw)
}

/**
 * The scope of a scoped request (BR-M12-01): `schoolId` (and `state` when `allowState`) from the query; a
 * malformed `schoolId` answers 422; an unknown school or state is the zero state. The school administrator is
 * forced to the account's own school (INFERRED, see the file header); a school administrator without a school
 * gets the empty scope.
 */
export function scopeOf(req: MockRequest, options: { allowState?: boolean } = {}): Scope {
  const viewer = viewerOf(req)
  const schoolId = schoolIdOf(req)
  const state =
    options.allowState === true ? (queryString(req.query, 'state')?.trim() ?? null) : null
  if (viewer.role === 'school_admin') {
    return viewer.schoolId === null
      ? emptyScope()
      : resolveScope({ schoolId: viewer.schoolId, includeFixture: true })
  }
  return resolveScope({ schoolId, state })
}

/**
 * The scope of the endpoints that ignore the page query (reaction, chain, PDF): the school administrator's own
 * school, the whole population for the other roles.
 */
export function viewerScope(req: MockRequest): Scope {
  return viewerOf(req).role === 'school_admin' ? scopeOf(req) : resolveScope()
}

/** True when `pupilSchoolId` is outside the school of a teacher or school administrator (admin sees all). */
export function outsideSchool(viewer: Viewer, pupilSchoolId: number | null): boolean {
  if (viewer.role !== 'teacher' && viewer.role !== 'school_admin') return false
  return viewer.schoolId === null || pupilSchoolId !== viewer.schoolId
}

/** Answers a refused M12 write: 404, 403, 409 or 422 with the message under its field. */
export function refusal(error: unknown) {
  if (!(error instanceof M12Error)) throw error
  switch (error.code) {
    case 'NOT_FOUND':
      return notFound(error.message)
    case 'FORBIDDEN':
      return forbidden(error.message)
    case 'CONFLICT':
      return conflict(error.message)
    default:
      return validationError({ [error.field ?? 'form']: error.message }, error.message)
  }
}
