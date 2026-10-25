/**
 * SRS M08 v1.11 §7 #1 school performance (S1), #2 levels (S2), #3 level detail (S3), #4 own classes
 * (S4). Any session but the pelajar for #1–#3 (403, UAT M-09); #4 any session. Scope (FR-M08-13): the admin sees every school; the school admin the own
 * school; every other role the own school (INFERRED, OQ-M08-04). An unknown level code is a 404.
 */

import { ok, requireAuth, route, str, notFound, type RouteDef } from '@/mock/define'
import { classrooms } from '@/modules/m10-teacher-class/mock'

import type { ClassCard, LevelCard } from '../../api/types'
import {
  LEVEL_NAME,
  classCard,
  levelDetail,
  schoolPerformance,
  type Scope,
} from '../repository/performance'
import {
  ownClasses,
  schoolViewRoles,
  subjectColorOf,
  subjectNameOf,
  viewerOf,
  type Viewer,
} from './common'

/** The data scope of a viewer (INFERRED for non-admin roles); no school → an empty school scope. */
export function scopeOf(viewer: Viewer): Scope {
  if (viewer.role === 'admin') return { kind: 'platform' }
  return { kind: 'school', schoolId: viewer.schoolId ?? -1 }
}

const isLevel = (v: string | number | undefined): v is 't4' | 't5' => v === 't4' || v === 't5'

export const performanceRoutes: RouteDef[] = [
  route('GET', '/api/performance/school', [schoolViewRoles], (req, ctx) => {
    const year = new Date(ctx.clock.now() + 8 * 3_600_000).getUTCFullYear()
    const scope = scopeOf(viewerOf(req))
    return ok(schoolPerformance(scope, year))
  }),

  route('GET', '/api/performance/levels', [schoolViewRoles], (req) => {
    const scope = scopeOf(viewerOf(req))
    const cards: LevelCard[] = (['t4', 't5'] as const).map((code) => {
      const slug = code === 't4' ? 'tingkatan-4' : 'tingkatan-5'
      if (scope.kind === 'platform') {
        const s = classrooms.levelSummary(slug)
        return { code, name: LEVEL_NAME[code], classes: s.classes, students: s.students }
      }
      const cls = classrooms.list({ educationLevel: slug, schoolId: scope.schoolId })
      const ids = new Set(cls.flatMap((c) => classrooms.memberIds(c.kind, c.classId)))
      return { code, name: LEVEL_NAME[code], classes: cls.length, students: ids.size }
    })
    return ok(cards)
  }),

  route(
    'GET',
    '/api/performance/levels/:code',
    [schoolViewRoles],
    (req) => {
      const code = req.params.code
      if (!isLevel(code)) return notFound()
      const scope = scopeOf(viewerOf(req))
      return ok(levelDetail(code, scope))
    },
    { params: { code: str() } },
  ),

  route('GET', '/api/performance/classes', [requireAuth()], (req) => {
    const cards: ClassCard[] = ownClasses(viewerOf(req)).map((c) =>
      classCard(c, subjectNameOf(c.subjectId), subjectColorOf(c.subjectId)),
    )
    return ok(cards)
  }),
]
