/**
 * SRS M11 v1.10 §7 #3–#7: the monitoring endpoints (mounted by M17 on `/admin/monitoring*`; one
 * component set serves both prefixes, FR-M11-52).
 *
 * Guard: admin, teacher and school admin (INFERRED alias scope, see `./common.ts`). A school admin is
 * forced to the viewer's own school: the overview and the export are filtered to it; the school, pupil
 * and teacher pages of another school, a pupil / teacher of another school and unknown ids are all 404
 * (existence is not revealed; role refusals stay 403; the pupil / teacher must also belong to the school; the
 * SEC-M11-02 recommendation, applied to this scope only — admin and teacher keep the live rule that the
 * school segment is not validated, BR-M11-29). Unknown ids are 404; the export `format` is validated
 * (422, PROPOSED).
 */

import {
  int,
  notFound,
  ok,
  queryString,
  route,
  validationError,
  type MockQuery,
  type RouteDef,
} from '@/mock/define'
import { users } from '@/modules/m01-authentication/mock'

import { monitoringRepo } from '../repository'
import { monitoringGuard, scopeOf, viewerOf } from './common'

const filtersOf = (query: MockQuery) => ({
  period: queryString(query, 'period') ?? '',
  state: queryString(query, 'state') ?? '',
  tahap: queryString(query, 'tahap') ?? '',
})

const pairParams = { params: { schoolId: int(), userId: int() } }

export const monitoringRoutes: RouteDef[] = [
  route('GET', '/api/monitoring/overview', [monitoringGuard], (req, ctx) => {
    const scopeSchoolId = scopeOf(viewerOf(req))
    return ok(
      monitoringRepo.overview(filtersOf(req.query), {
        now: ctx.clock.now(),
        ...(scopeSchoolId !== undefined ? { scopeSchoolId } : {}),
      }),
    )
  }),

  route(
    'GET',
    '/api/monitoring/schools/:schoolId',
    [monitoringGuard],
    (req) => {
      const schoolId = req.params.schoolId as number
      const scope = scopeOf(viewerOf(req))
      if (scope !== undefined && scope !== schoolId) return notFound()
      const detail = monitoringRepo.schoolDetail(schoolId)
      return detail ? ok(detail) : notFound()
    },
    { params: { schoolId: int() } },
  ),

  route(
    'GET',
    '/api/monitoring/schools/:schoolId/students/:userId',
    [monitoringGuard],
    (req) => {
      const schoolId = req.params.schoolId as number
      const userId = req.params.userId as number
      const scope = scopeOf(viewerOf(req))
      if (scope !== undefined) {
        if (scope !== schoolId) return notFound()
        const pupil = users.get(userId)
        if (pupil && pupil.schoolId !== scope) return notFound()
      }
      const detail = monitoringRepo.studentDetail(schoolId, userId)
      return detail ? ok(detail) : notFound()
    },
    pairParams,
  ),

  route(
    'GET',
    '/api/monitoring/schools/:schoolId/teachers/:userId',
    [monitoringGuard],
    (req) => {
      const schoolId = req.params.schoolId as number
      const userId = req.params.userId as number
      const scope = scopeOf(viewerOf(req))
      if (scope !== undefined) {
        if (scope !== schoolId) return notFound()
        const teacher = users.get(userId)
        if (teacher && teacher.schoolId !== scope) return notFound()
      }
      const detail = monitoringRepo.teacherDetail(schoolId, userId)
      return detail ? ok(detail) : notFound()
    },
    pairParams,
  ),

  route('GET', '/api/monitoring/export', [monitoringGuard], (req, ctx) => {
    const format = queryString(req.query, 'format')
    if (format !== 'pdf' && format !== 'csv') {
      return validationError({ format: 'Format eksport mesti pdf atau csv.' })
    }
    const scopeSchoolId = scopeOf(viewerOf(req))
    return ok(
      monitoringRepo.exportRows(format, filtersOf(req.query), {
        now: ctx.clock.now(),
        ...(scopeSchoolId !== undefined ? { scopeSchoolId } : {}),
      }),
    )
  }),
]
