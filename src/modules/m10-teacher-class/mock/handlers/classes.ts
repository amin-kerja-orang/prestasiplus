/**
 * SRS M10 v1.18 §7 #12 `GET /api/guru/classes`, #13 `POST /api/guru/classes` and #14
 * `GET /api/guru/classes/:id/qr-data` (S4, S5). All **T** and owner-scoped (BR-M10-01, FR-M10-07).
 *
 * - #12 lists the viewer's own classes, newest first, active and inactive (the screen counts "{n}
 *   kelas aktif" itself); it uses the list envelope with a single page (live does not paginate).
 * - #13 (FR-M10-34, §5): `name` (≤ 255), `subjectId` (an active M03 subject) and `educationLevel`
 *   (one of the 11 slugs) are required; `schoolId` is optional and must name an M02 school (S5 has
 *   no other school rule, DV-M10-22: the level is not tied to the school type on the server).
 *   The class gets a unique 6-character join code (BR-M10-02) and the viewer as owner.
 * - #14 answers `{name, school, joinUrl}` for an own classroom; any other id (unknown, not owned, or
 *   a school class) is a generic 404 `NOT_FOUND`, never naming a model (SEC-M10-02, FR-M10-07).
 */

import {
  created,
  int,
  notFound,
  raw,
  route,
  unpaged,
  validationError,
  type RouteDef,
} from '@/mock/define'
import { curriculum } from '@/modules/m03-curriculum/mock'
import { schools } from '@/modules/m02-users-schools/mock'
import { users } from '@/modules/m01-authentication/mock'

import { LEVEL_SLUGS } from '../data/spec'
import { classroomsRepo } from '../repository/classrooms'
import type { ClassroomRow, EducationLevelSlug } from '../repository/types'
import { bodyOf, intOf, joinUrlOf, levelLabel, MSG, teacherOnly, textOf, viewerId } from './common'

/** The API `GuruClass` (#12, #13). */
export function classBody(row: ClassroomRow) {
  return {
    id: row.classId,
    kind: row.kind,
    teacherId: row.teacherId,
    schoolId: row.schoolId,
    name: row.name,
    subjectId: row.subjectId,
    subjectName: row.subjectId === null ? null : (curriculum.subject(row.subjectId)?.name ?? null),
    educationLevel: row.educationLevel,
    levelId: row.levelId,
    levelLabel: levelLabel(row.educationLevel),
    academicYear: row.academicYear,
    description: row.description,
    joinCode: row.joinCode,
    isActive: row.isActive,
    createdAt: row.createdAt,
    studentCount: classroomsRepo.memberCount(row.kind, row.classId),
  }
}

/** The viewer's own classroom `id`, or `undefined` (unknown, another teacher's, a school class). */
export function ownClassroom(userId: number, id: number): ClassroomRow | undefined {
  const row = classroomsRepo.get('classroom', id)
  return row && row.teacherId === userId ? row : undefined
}

export const classRoutes: RouteDef[] = [
  route('GET', '/api/guru/classes', [teacherOnly], (req) =>
    unpaged(classroomsRepo.forTeacher(viewerId(req)).map(classBody)),
  ),

  route('POST', '/api/guru/classes', [teacherOnly], (req, ctx) => {
    const b = bodyOf(req)
    const fields: Record<string, string> = {}

    const name = textOf(b.name) ?? ''
    if (name === '') fields.name = MSG.className
    else if ([...name].length > 255) fields.name = MSG.invalid

    const subjectId = intOf(b.subjectId)
    const subject = subjectId === undefined ? undefined : curriculum.subject(subjectId)
    if (!subject || !subject.isActive) fields.subjectId = MSG.subject

    const level = textOf(b.educationLevel) ?? ''
    if (!(LEVEL_SLUGS as readonly string[]).includes(level)) fields.educationLevel = MSG.level

    let schoolId: number | null = null
    if (b.schoolId !== undefined && b.schoolId !== null && b.schoolId !== '') {
      const id = intOf(b.schoolId)
      if (id === undefined || !schools.get(id)) fields.schoolId = MSG.school
      else schoolId = id
    }

    let description: string | null = null
    if (b.description !== undefined && b.description !== null) {
      const d = textOf(b.description)
      if (d === undefined || [...d].length > 2000) fields.description = MSG.invalid
      else description = d === '' ? null : d
    }

    if (Object.keys(fields).length > 0) return validationError(fields)
    const row = classroomsRepo.create(
      {
        name,
        teacherId: viewerId(req),
        schoolId,
        subjectId: subject?.id ?? null,
        educationLevel: level as EducationLevelSlug,
        description,
      },
      ctx.clock.now(),
    )
    return created(classBody(row))
  }),

  route(
    'GET',
    '/api/guru/classes/:id/qr-data',
    [teacherOnly],
    (req) => {
      const row = ownClassroom(viewerId(req), Number(req.params.id))
      if (!row) return notFound()
      return raw(200, {
        name: row.name,
        school: row.schoolId === null ? null : (schools.get(row.schoolId)?.name ?? null),
        joinUrl: joinUrlOf(row.joinCode),
      })
    },
    { params: { id: int() } },
  ),
]

/** Display name of a class owner (S33 card). */
export const ownerName = (teacherId: number | null): string | null =>
  teacherId === null ? null : (users.get(teacherId)?.name ?? null)
