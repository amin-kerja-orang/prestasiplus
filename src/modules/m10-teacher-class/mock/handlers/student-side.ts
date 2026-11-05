/**
 * SRS M10 v1.18 §7 #73 `GET /api/kelas-saya` (S33) and #75
 * `GET /api/set-soalan-saya` (S34); both **S** (any logged-in user, guest 401).
 *
 * - #73 lists the classrooms the user is actively enrolled in, newest first (single-page list
 *   envelope). School classes (`sc-…`) are not "joined" classes and are left out.
 * - There is no pupil join route (API-MUR-04): `POST /api/kelas-saya/join` answers the mock's 404. `joinByCode`
 *   stays only for the `enrol` test hook (source `code`).
 * - #75 (BR-M10-18, FR-M10-73): the sets the user may start, from `questionSets.visibleFor` (draft
 *   never; scheduled once due). `attemptsLeft` = `maxAttempts` − the user's completed sessions of
 *   mode `question_set` for the set (M05 Q-SESS-LINK), floored at 0, and `null` when attempts are
 *   unlimited (`maxAttempts` 0).
 */

import { route, unpaged, type RouteDef } from '@/mock/define'
import { users } from '@/modules/m01-authentication/mock'
import { curriculum } from '@/modules/m03-curriculum/mock'
import * as m05 from '@/modules/m05-practice/mock'

import { classroomsRepo } from '../repository/classrooms'
import { questionSetsRepo } from '../repository/question-sets'
import { ownerName } from './classes'
import { anySession, levelLabel, MSG, viewerId } from './common'

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
