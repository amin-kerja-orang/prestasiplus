/**
 * SRS M11 v1.10 §7 #1 `GET /api/teacher/report` (S1) and #8 `GET /api/teacher/item-analysis` (S6).
 * **T** guard: admin and teacher; 403 for every other role (the school admin included, §9). Invalid
 * filter values are tolerated (SRS §5): `range` → 30, an unknown `classroomId` is ignored (S1) or gives
 * no rows (S6).
 */

import { ok, queryInt, route, type RouteDef } from '@/mock/define'

import { monitoringRepo } from '../repository'
import { teacherGuard, viewerOf } from './common'

export const reportRoutes: RouteDef[] = [
  route('GET', '/api/teacher/report', [teacherGuard], (req, ctx) => {
    const viewer = viewerOf(req)
    const range = queryInt(req.query, 'range')
    const classroomId = queryInt(req.query, 'classroomId')
    return ok(
      monitoringRepo.teacherReport(
        { id: viewer.id, role: viewer.role },
        {
          ...(range !== undefined ? { range } : {}),
          ...(classroomId !== undefined ? { classroomId } : {}),
        },
        ctx.clock.now(),
      ),
    )
  }),

  route('GET', '/api/teacher/item-analysis', [teacherGuard], (req) => {
    const viewer = viewerOf(req)
    const subjectId = queryInt(req.query, 'subjectId')
    const classroomId = queryInt(req.query, 'classroomId')
    return ok(
      monitoringRepo.itemAnalysis(
        { id: viewer.id, role: viewer.role },
        {
          ...(subjectId !== undefined ? { subjectId } : {}),
          ...(classroomId !== undefined ? { classroomId } : {}),
        },
      ),
    )
  }),
]
