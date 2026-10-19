/**
 * SRS M10 v1.18 §7 #73 `GET /api/kelas-saya`, #74 `POST /api/kelas-saya/join` (S33) and #75
 * `GET /api/set-soalan-saya` (S34); all **S** (any logged-in user, guest 401).
 *
 * - #73 lists the classrooms the user is actively enrolled in, newest first (single-page list
 *   envelope). School classes (`sc-…`) are not "joined" classes and are left out.
 * - #74 (BR-M10-02, FR-M10-39): `classCode` is compared trimmed and case-insensitively with the
 *   stored code of any length (so "DEMO-4S" joins). 422 for a blank code, 404 for an unknown code,
 *   409 when the user is already an active member. Only a
 *   student (or the admin, who has the screen) may join (SEC-M10-02); other roles get 403. The
 *   enrolment has source `code`. The messages are UNVERIFIED COPY.
 * - #75 (BR-M10-18, FR-M10-73): the sets the user may start, from `questionSets.visibleFor` (draft
 *   never; scheduled once due). `attemptsLeft` = `maxAttempts` − the user's completed sessions of
 *   mode `question_set` for the set (M05 Q-SESS-LINK), floored at 0, and `null` when attempts are
 *   unlimited (`maxAttempts` 0).
 */

import {
  created,
  forbidden,
  notFound,
  conflict,
  route,
  unpaged,
  validationError,
  type RouteDef,
} from '@/mock/define'
import { users } from '@/modules/m01-authentication/mock'
import { curriculum } from '@/modules/m03-curriculum/mock'
import * as m05 from '@/modules/m05-practice/mock'

import { classroomsRepo } from '../repository/classrooms'
import { questionSetsRepo } from '../repository/question-sets'
import { ownerName } from './classes'
import { anySession, bodyOf, levelLabel, MSG, textOf, viewerId, viewerRole } from './common'

const JOIN_ROLES = ['student', 'admin']

/** Enrols `userId` by code; the refusal is the response status and message. */
export function joinByCode(
  userId: number,
  rawCode: string,
  now: number,
):
  | { ok: true; classroomId: number; name: string }
  | { ok: false; status: 404 | 409; message: string } {
  const cls = classroomsRepo.findByJoinCode(rawCode)
  if (!cls) return { ok: false, status: 404, message: MSG.joinNotFound }
  if (classroomsRepo.memberIds(cls.kind, cls.classId).includes(userId)) {
    return { ok: false, status: 409, message: MSG.joinAlready }
  }
  classroomsRepo.enrol(
    { kind: cls.kind, classId: cls.classId, studentId: userId, source: 'code' },
    now,
  )
  return { ok: true, classroomId: cls.classId, name: cls.name }
}

/** Completed attempts of `userId` on a question set (M05 Q-SESS-LINK). */
function attemptsUsed(userId: number, setId: number): number {
  return m05.practice
    .history(userId, { modes: ['question_set'] })
    .filter((s) => s.questionSetId === setId).length
}

export const studentSideRoutes: RouteDef[] = [
  route('GET', '/api/kelas-saya', [anySession], (req) =>
    unpaged(
      classroomsRepo
        .forStudent(viewerId(req))
        .filter((c) => c.kind === 'classroom')
        .map((c) => ({
          id: c.classId,
          name: c.name,
          subjectName:
            c.subjectId === null ? null : (curriculum.subject(c.subjectId)?.name ?? null),
          teacherName: ownerName(c.teacherId),
          levelLabel: levelLabel(c.educationLevel),
        })),
    ),
  ),

  route('POST', '/api/kelas-saya/join', [anySession], (req, ctx) => {
    if (!JOIN_ROLES.includes(viewerRole(req))) return forbidden()
    const code = textOf(bodyOf(req).classCode) ?? ''
    if (code === '') return validationError({ classCode: MSG.classCode })
    const result = joinByCode(viewerId(req), code, ctx.clock.now())
    if (!result.ok)
      return result.status === 404 ? notFound(result.message) : conflict(result.message)
    return created({ classroomId: result.classroomId }, { message: MSG.joined(result.name) })
  }),

  route('GET', '/api/set-soalan-saya', [anySession], (req, ctx) => {
    const userId = viewerId(req)
    return unpaged(
      questionSetsRepo.visibleFor(userId, ctx.clock.now()).map((s) => ({
        id: s.id,
        title: s.title,
        teacherName: users.get(s.teacherId)?.name ?? null,
        questionCount: s.questionIds.length,
        timeLimitMinutes: s.timeLimitMinutes,
        attemptsLeft:
          s.maxAttempts === 0 ? null : Math.max(0, s.maxAttempts - attemptsUsed(userId, s.id)),
      })),
    )
  }),
]
