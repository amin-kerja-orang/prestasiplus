/**
 * SRS M05 v1.17 §7 #9 `GET /api/practice/revision` (S6) and #10 `GET /api/practice/revision/:code`
 * (S7 guard). Any session (A). Counts are the viewer's eligible queued questions (BR-14, XL-19):
 * distinct questions, so S6, the S1 badge and the S7 guard agree.
 */

import { notFound, ok, requireAuth, route, type RouteDef } from '@/mock/define'

import type { RevisionOverview, RevisionSubject } from '../../api/types'
import { userQueue } from '../repository/reads'
import { activeSubjectByCode, practiceSubjects, userIdOf } from './common'

export const revisionRoutes: RouteDef[] = [
  route('GET', '/api/practice/revision', [requireAuth()], (req) => {
    const queue = userQueue(userIdOf(req))
    const bySubject = new Map<number, number>()
    for (const q of queue) bySubject.set(q.subjectId, (bySubject.get(q.subjectId) ?? 0) + 1)
    const body: RevisionOverview = {
      total: queue.length,
      // BR-01 order; only subjects with queued questions (FR-M05-70).
      subjects: practiceSubjects().flatMap((s) => {
        const count = bySubject.get(s.id) ?? 0
        return count > 0
          ? [{ code: s.code, name: s.name, nameEn: s.nameEn, icon: s.icon, color: s.color, count }]
          : []
      }),
    }
    return ok(body)
  }),

  route('GET', '/api/practice/revision/:code', [requireAuth()], (req) => {
    const s = activeSubjectByCode(String(req.params.code))
    if (!s) return notFound()
    const body: RevisionSubject = {
      subject: { id: s.id, code: s.code, name: s.name, color: s.color },
      // 0 is a 200: S7 then goes back to S6 with the info flash (FR-M05-72).
      count: userQueue(userIdOf(req), s.id).length,
    }
    return ok(body)
  }),
]
