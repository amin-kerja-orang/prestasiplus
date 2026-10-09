/**
 * SRS M27 Part B §19 read endpoints of S6, S7, S9, S10, S12: #6 `GET /pelajar`, #7 `GET /pelajar/:id`,
 * #10 `GET /guru`, #11 `GET /guru/:id`, #17 and #18 the CSV exports, #22 `GET /pelajar/form-options`.
 * Guard SA on all. Literal paths (`export.csv`, `form-options`) win over `:id` in the router; `:id` is parsed
 * here so the guard answers 401/403 before a malformed id answers 404. Check order of an object read: role,
 * then 404 (not of the school, not of the role, unknown), then 403 for an inactive account (BR-M27-31).
 */

import { formatDateKey } from '@/lib/time'
import {
  blob,
  forbidden,
  list,
  notFound,
  ok,
  queryString,
  route,
  type MockQuery,
  type RouteDef,
} from '@/mock/define'
import { m02Config } from '@/modules/m02-users-schools/mock'

import { csvFilename, usersCsv } from '../read-models/csv'
import { schoolInfoOf } from '../read-models/school-info'
import type { SchoolRole } from '../read-models/school-people'
import { requireSchoolAdminWithSchool, schoolOf } from '../read-models/school-scope'
import {
  activeClassroomOptions,
  detailOf,
  listPupils,
  listTeachers,
  lookupSchoolUser,
} from '../read-models/users-list'

const BASE = '/api/admin-sekolah'
const guard = [requireSchoolAdminWithSchool]

const listQuery = (query: MockQuery) => ({
  isActive: queryString(query, 'is_active'),
  search: queryString(query, 'search'),
  page: queryString(query, 'page'),
})

const detailRoute = (path: string, role: SchoolRole): RouteDef =>
  route('GET', path, guard, (req) => {
    const viewer = schoolOf(req)
    const found = lookupSchoolUser(viewer, role, String(req.params.id))
    if (found.kind === 'not_found') return notFound()
    if (found.kind === 'inactive') return forbidden()
    return ok(detailOf(found.user, viewer))
  })

const csvRoute = (path: string, role: SchoolRole): RouteDef =>
  route('GET', path, guard, (req, ctx) => {
    const body = usersCsv(schoolOf(req), role, {
      isActive: queryString(req.query, 'is_active'),
      search: queryString(req.query, 'search'),
    })
    return blob(
      new Blob([body], { type: 'text/csv; charset=utf-8' }),
      csvFilename(role, formatDateKey(ctx.clock.now())),
    )
  })

/** #22 (added v1.8): the S12 form data. Never carries the literal default password. */
const formOptionsRoute = route('GET', `${BASE}/pelajar/form-options`, guard, (req, ctx) => {
  const viewer = schoolOf(req)
  const secret = ctx.config.get('bulkImportDefaultPassword', m02Config().bulkImportDefaultPassword)
  return ok({
    school: schoolInfoOf(viewer),
    classes: activeClassroomOptions(viewer.schoolId),
    // Only the length of the default password shapes the placeholder, so the value never leaves M02.
    passwordPlaceholder: '•'.repeat(secret.length),
    passwordHint: 'Biarkan kosong untuk guna kata laluan lalai (minimum 8 aksara).',
    passwordMinLength: 8,
  })
})

export const userReadRoutes: RouteDef[] = [
  route('GET', `${BASE}/pelajar`, guard, (req) => {
    const out = listPupils(schoolOf(req), listQuery(req.query))
    return list(out.rows, out.meta)
  }),
  route('GET', `${BASE}/guru`, guard, (req) => {
    const out = listTeachers(schoolOf(req), listQuery(req.query))
    return list(out.rows, out.meta)
  }),
  csvRoute(`${BASE}/pelajar/export.csv`, 'student'),
  csvRoute(`${BASE}/guru/export.csv`, 'teacher'),
  formOptionsRoute,
  detailRoute(`${BASE}/pelajar/:id`, 'student'),
  detailRoute(`${BASE}/guru/:id`, 'teacher'),
]
