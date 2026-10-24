/**
 * SRS M10 v1.18 §7 #1 `GET /api/guru/dashboard` (S1) and #11 `GET /api/guru/remedial-progress` (S3).
 * Both **T**, both read-only, both scoped to the viewer's own records (BR-M10-01).
 *
 * #1 (BR-M10-05, BR-M10-06, FR-M10-09…13): the checklist, the stat cards and the viewer's active
 * classes. "Tindakan Hari Ini", "Padanan Rakan Pembimbing" and "Penghantaran Terkini" are empty for every
 * viewer (L-M10-01, OQ-M10-11), so `today`, `peerTutor` and `submissions` are always empty and
 * `assignments` is 0. The admin's "Soalan" figures are the observed constants (DV-M10-12); for any
 * other viewer they are computed from M04 (Q-CONTRIB plus the viewer's structured questions).
 *
 * #11 (BR-M10-13): `total` = the viewer's tests that are not cancelled, `completed`, `students` =
 * distinct students of those tests and `avgImprovement` = the rounded mean of (after − before) over
 * the completed ones (0 when none; the screen prints the sign, "+0%"). `rows` lists every test of
 * the viewer, newest first, cancelled ones included with their status.
 */

import { ok, raw, route, type RouteDef } from '@/mock/define'
import { users } from '@/modules/m01-authentication/mock'
import { questions, structured } from '@/modules/m04-question-bank/mock'

import {
  ADMIN_DASHBOARD_QUESTIONS,
  ADMIN_DASHBOARD_QUESTIONS_APPROVED,
  SNAPSHOT_USER_ID,
} from '../constants/display'
import { classroomsRepo } from '../repository/classrooms'
import { missionsRepo } from '../repository/missions'
import { remedialTestsRepo } from '../repository/remedial'
import { teacherOnly, viewerId } from './common'

/** BR-M10-06: the "Soalan" and "diluluskan" counts of a viewer. */
export function questionCounts(userId: number): { total: number; approved: number } {
  if (userId === SNAPSHOT_USER_ID) {
    return {
      total: ADMIN_DASHBOARD_QUESTIONS.value,
      approved: ADMIN_DASHBOARD_QUESTIONS_APPROVED.value,
    }
  }
  const objective = questions.contributions(userId, { page: 1 }).counts
  const own = structured.list({ viewer: { id: userId }, pageSize: 1 }).total
  const published = structured.list({
    viewer: { id: userId },
    status: 'published',
    pageSize: 1,
  }).total
  return { total: objective.total + own, approved: objective.approved + published }
}

export const dashboardRoutes: RouteDef[] = [
  route('GET', '/api/guru/dashboard', [teacherOnly], (req) => {
    const id = viewerId(req)
    const own = classroomsRepo.forTeacher(id)
    const active = own.filter((c) => c.isActive)
    const students = classroomsRepo.teacherStudentIds(id)
    const counts = questionCounts(id)
    return ok({
      checklist: {
        hasClass: own.length > 0,
        hasStudents: students.length > 0,
        hasMission: missionsRepo.forTeacher(id).length > 0,
      },
      stats: {
        activeClasses: active.length,
        totalClasses: own.length,
        students: students.length,
        questions: counts.total,
        questionsApproved: counts.approved,
        assignments: 0,
      },
      today: { students: [], topics: [], actions: [] },
      peerTutor: [],
      classes: active.map((c) => ({
        id: c.classId,
        name: c.name,
        studentCount: classroomsRepo.memberCount(c.kind, c.classId),
      })),
      submissions: [],
    })
  }),

  route('GET', '/api/guru/remedial-progress', [teacherOnly], (req) => {
    const tests = remedialTestsRepo.forTeacher(viewerId(req))
    const counted = tests.filter((t) => t.status !== 'cancelled')
    const completed = counted.filter((t) => t.status === 'completed' && t.afterAccuracy !== null)
    const gain = completed.map((t) => (t.afterAccuracy as number) - t.beforeAccuracy)
    return raw(200, {
      stats: {
        total: counted.length,
        completed: counted.filter((t) => t.status === 'completed').length,
        students: new Set(counted.map((t) => t.studentId)).size,
        avgImprovement:
          gain.length === 0 ? 0 : Math.round(gain.reduce((a, b) => a + b, 0) / gain.length),
      },
      rows: tests.map((t) => ({
        id: t.id,
        studentName: users.get(t.studentId)?.name ?? '',
        subjectName: t.subjectName,
        status: t.status,
        beforeAccuracy: t.beforeAccuracy,
        afterAccuracy: t.afterAccuracy,
      })),
    })
  }),
]
