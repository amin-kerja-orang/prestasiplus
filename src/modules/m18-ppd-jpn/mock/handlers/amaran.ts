/**
 * SRS M18 §7 #21 (school risk page), #22 (executive summary), #24 (own-school effectiveness) and #30
 * (school CSV). Thin wrappers over `../repository/amaran` and `../repository/risk`: access by role and
 * scope (BR-M18-01, §9, FR-M18-09), `401` without a session, `403` for other roles or out-of-scope ids,
 * `404` for unknown ids (FR-M18-12).
 */

import {
  forbidden,
  int,
  notFound,
  ok,
  queryString,
  requireAuth,
  route,
  validationError,
  type MockRequest,
  type MockResponse,
  type RouteDef,
} from '@/mock/define'
import { contentDisposition } from '@/mock/server/respond'
import { users, type UserRow } from '@/modules/m01-authentication/mock'
import { schools } from '@/modules/m02-users-schools/mock'

import {
  effectivenessForSchool,
  parseTingkatan,
  schoolCsv,
  schoolRisk,
  summary,
  yyyymmdd,
} from '../repository/amaran'
import {
  ADMIN_PREVIEW_SCOPE,
  defaultScope,
  mayExportSchool,
  mayOpenSchool,
  mayOpenScope,
  ownSchoolOf,
} from '../repository/scope'
import { schoolIdsOfScope } from '../repository/risk'
import type { RiskScope } from '../repository/types'

/** Roles that reach the Amaran pages at all (§9 "A"): admin, officers, school admin, teacher. */
const AMARAN_ROLES: ReadonlySet<string> = new Set([
  'admin',
  'ppd_officer',
  'jpn_officer',
  'school_admin',
  'teacher',
])

function viewerOf(req: MockRequest): UserRow | null {
  const session = req.session
  if (!session) return null
  const user = users.get(session.userId)
  return user && AMARAN_ROLES.has(user.role) ? user : null
}

/** The export audit (SEC-M18-03): one entry per accepted download, read by the tests. */
export interface ExportAuditEntry {
  viewerId: number
  schoolId: number
  filename: string
  at: number
}
const exportAudit: ExportAuditEntry[] = []
export const amaranExportAudit = (): readonly ExportAuditEntry[] => exportAudit
export const resetAmaranExportAudit = (): void => {
  exportAudit.length = 0
}

export const amaranRoutes: RouteDef[] = [
  // #21 GET /api/amaran/schools/:id?tingkatan=
  route(
    'GET',
    '/api/amaran/schools/:id',
    [requireAuth()],
    (req, ctx): MockResponse => {
      const viewer = viewerOf(req)
      if (!viewer) return forbidden()
      const schoolId = req.params.id as number
      if (!schools.get(schoolId)) return notFound()
      if (!mayOpenSchool(viewer, schoolId)) return forbidden()
      const tingkatan = parseTingkatan(queryString(req.query, 'tingkatan'))
      const data = schoolRisk(schoolId, {
        now: ctx.clock.now(),
        ...(tingkatan ? { tingkatan } : {}),
      })
      return data ? ok(data) : notFound()
    },
    { params: { id: int() } },
  ),

  // #22 GET /api/amaran/summary?scope=&district=&state=&schoolId=
  route('GET', '/api/amaran/summary', [requireAuth()], (req, ctx): MockResponse => {
    const viewer = viewerOf(req)
    if (!viewer) return forbidden()
    const kind = queryString(req.query, 'scope')
    const state = queryString(req.query, 'state')
    const district = queryString(req.query, 'district')
    const schoolRaw = queryString(req.query, 'schoolId') ?? queryString(req.query, 'school_id')
    let scope: RiskScope | null
    if (kind === undefined) {
      scope = defaultScope(viewer)
      if (!scope) return forbidden()
    } else if (kind === 'school') {
      const id = schoolRaw === undefined ? NaN : Number(schoolRaw)
      if (!Number.isInteger(id)) return validationError({ schoolId: 'The school id is required.' })
      scope = { kind: 'school', schoolId: id }
    } else if (kind === 'district') {
      const own = defaultScope(viewer)
      const d = district ?? (own?.kind === 'district' ? own.district : undefined)
      const s = state ?? (own?.kind === 'district' ? own.state : undefined)
      if (d === undefined || s === undefined)
        return validationError({ district: 'The district and state are required.' })
      scope = { kind: 'district', district: d, state: s }
    } else if (kind === 'state') {
      const own = defaultScope(viewer)
      // Admin without a state: the admin preview state (DATA-M18-05, SRS §9).
      const s =
        state ??
        (own?.kind === 'state' ? own.state : viewer.role === 'admin' ? ADMIN_PREVIEW_SCOPE.state : undefined)
      if (s === undefined) return validationError({ state: 'The state is required.' })
      scope = { kind: 'state', state: s }
    } else {
      return validationError({ scope: 'The scope must be school, district or state.' })
    }
    if (scope.kind === 'school' && !schools.get(scope.schoolId)) return notFound()
    if (scope.kind !== 'school' && schoolIdsOfScope(scope).length === 0) return notFound()
    if (!mayOpenScope(viewer, scope)) return forbidden()
    const data = summary(scope, ctx.clock.now())
    return data ? ok(data) : notFound()
  }),

  // #24 GET /api/amaran/effectiveness (the viewer's school)
  route('GET', '/api/amaran/effectiveness', [requireAuth()], (req, ctx): MockResponse => {
    const viewer = viewerOf(req)
    if (!viewer) return forbidden()
    const schoolId = ownSchoolOf(viewer)
    if (schoolId === null) return forbidden()
    const data = effectivenessForSchool(schoolId, ctx.clock.now())
    return data ? ok(data) : forbidden()
  }),

  // #30 GET /api/amaran/export/school/:id
  route(
    'GET',
    '/api/amaran/export/school/:id',
    [requireAuth()],
    (req, ctx): MockResponse => {
      const viewer = viewerOf(req)
      if (!viewer) return forbidden()
      const schoolId = req.params.id as number
      if (!schools.get(schoolId)) return notFound()
      if (!mayExportSchool(viewer, schoolId)) return forbidden()
      const now = ctx.clock.now()
      const filename = `amaran-sekolah-${String(schoolId)}-${yyyymmdd(now)}.csv`
      exportAudit.push({ viewerId: viewer.id, schoolId, filename, at: now })
      return {
        status: 200,
        headers: {
          'content-type': 'text/csv; charset=utf-8',
          'content-disposition': contentDisposition(filename),
          'cache-control': 'no-store',
        },
        body: new Blob([schoolCsv(schoolId, { now })], { type: 'text/csv; charset=utf-8' }),
      }
    },
    { params: { id: int() } },
  ),
]
