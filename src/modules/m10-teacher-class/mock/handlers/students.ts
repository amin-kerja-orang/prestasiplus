/**
 * SRS M10 v1.18 §7 #15 `GET /api/guru/students`, #16 `PUT /api/guru/students/:id` and #17
 * `DELETE /api/guru/students/:id` (S6 "Pelajar Saya"). All **T**.
 *
 * - #15 `?tab=mine|school&search=` (FR-M10-35…37, BR-M10-04, BR-M10-30): `mine` lists the distinct
 *   students with an active enrolment in an active class the viewer owns; `school` lists the active
 *   student accounts of the **teacher-profile** school (not the user school; no profile school →
 *   `[]` and `schoolSet: false`), at most 200 rows. `search` is a case-insensitive name filter. Rows
 *   are ordered by name A→Z; `classNames` = the viewer's own active classes the student is in;
 *   `classes` = the same classes as `{id, name}`, same order (SW5-03: names are not unique).
 *   `meta.count` is the number of students matching the tab and search (before the 200 cap).
 * - #16 `{classroomId}`: adds a student of the profile school to an own class (source `teacher`).
 *   422 for a bad body, 404 unknown student or class, 403 not own class or a student of another
 *   school, 409 already an active member. (INFERRED: S6 add control not observed.)
 * - #17 `?classroomId=`: removes a student from an own class (status `removed`); 422 bad id, 404
 *   unknown class or student not enrolled, 403 class not owned. Answers `{data:{removed:1}}`.
 */

import {
  conflict,
  forbidden,
  int,
  notFound,
  ok,
  queryString,
  route,
  validationError,
  type MockRequest,
  type RouteDef,
} from '@/mock/define'
import { users } from '@/modules/m01-authentication/mock'
import { curriculum } from '@/modules/m03-curriculum/mock'

import { classroomsRepo } from '../repository/classrooms'
import type { ClassroomRow } from '../repository/types'
import { teacherProfilesRepo } from '../repository/teacher-profiles'
import { bodyOf, intOf, MSG, teacherOnly, viewerId } from './common'

const SCHOOL_TAB_LIMIT = 200

interface StudentRef {
  id: number
  name: string
  grade: number | null
}

interface ClassRef {
  id: number
  name: string
}

/** Active classes the viewer owns → student id → the classes (the S6 chips), id and name. */
function classesByStudent(userId: number): Map<number, ClassRef[]> {
  const out = new Map<number, ClassRef[]>()
  for (const c of classroomsRepo.forTeacher(userId)) {
    if (!c.isActive) continue
    for (const sid of classroomsRepo.memberIds(c.kind, c.classId)) {
      const list = out.get(sid)
      const ref = { id: c.classId, name: c.name }
      if (list) list.push(ref)
      else out.set(sid, [ref])
    }
  }
  return out
}

/** SW5-03: `classes` is `classNames` with the ids, same order; class names are not unique. */
function studentBody(s: StudentRef, classes: Map<number, ClassRef[]>) {
  const own = classes.get(s.id) ?? []
  return {
    id: s.id,
    name: s.name,
    levelName: s.grade === null ? null : (curriculum.levelForGrade(s.grade)?.name ?? null),
    classNames: own.map((c) => c.name),
    classes: own.map((c) => ({ id: c.id, name: c.name })),
  }
}

const byName = (a: StudentRef, b: StudentRef): number => a.name.localeCompare(b.name) || a.id - b.id

/** The class named by `classroomId` and the refusal when the viewer may not use it. */
function ownedClass(req: MockRequest, value: unknown): OwnedClass {
  const id = intOf(value)
  if (id === undefined || id < 1) return { refusal: 422, message: MSG.classroom }
  const cls = classroomsRepo.get('classroom', id)
  if (!cls) return { refusal: 404, message: MSG.classroom }
  if (cls.teacherId !== viewerId(req)) return { refusal: 403, message: MSG.classNotOwn }
  return { cls }
}

type OwnedClass = { cls: ClassroomRow } | { refusal: 403 | 404 | 422; message: string }

/** The response of a refused class (`422` names the field). */
function refused(found: Extract<OwnedClass, { refusal: number }>) {
  if (found.refusal === 422) return validationError({ classroomId: found.message })
  return found.refusal === 404 ? notFound(found.message) : forbidden(found.message)
}

export const studentRoutes: RouteDef[] = [
  route('GET', '/api/guru/students', [teacherOnly], (req) => {
    const id = viewerId(req)
    const tab = queryString(req.query, 'tab') === 'school' ? 'school' : 'mine'
    const term = (queryString(req.query, 'search') ?? '').trim().toLowerCase()
    const match = (s: StudentRef) => term === '' || s.name.toLowerCase().includes(term)
    const names = classesByStudent(id)
    const schoolId = teacherProfilesRepo.schoolOf(id)

    if (tab === 'school') {
      if (schoolId === null) return ok([], { meta: { count: 0, schoolSet: false } })
      // every active student of the school, then the name filter, the A→Z order and the 200 cap
      const { rows } = users.adminList({
        role: 'student',
        schoolId,
        isActive: true,
        pageSize: Number.MAX_SAFE_INTEGER,
      })
      const matching = rows.filter(match).sort(byName)
      return ok(
        matching.slice(0, SCHOOL_TAB_LIMIT).map((s) => studentBody(s, names)),
        { meta: { count: matching.length, schoolSet: true } },
      )
    }

    const rows = users.getMany(classroomsRepo.teacherStudentIds(id)).filter(match).sort(byName)
    return ok(
      rows.map((s) => studentBody(s, names)),
      { meta: { count: rows.length, schoolSet: schoolId !== null } },
    )
  }),

  route(
    'PUT',
    '/api/guru/students/:id',
    [teacherOnly],
    (req, ctx) => {
      const found = ownedClass(req, bodyOf(req).classroomId)
      if ('refusal' in found && found.refusal === 422) return refused(found)
      const student = users.get(Number(req.params.id))
      if (!student || student.role !== 'student') return notFound(MSG.studentNotFound)
      if ('refusal' in found) return refused(found)
      const schoolId = teacherProfilesRepo.schoolOf(viewerId(req))
      if (schoolId === null || student.schoolId !== schoolId) {
        return forbidden(MSG.studentOtherSchool)
      }
      const { cls } = found
      if (classroomsRepo.memberIds(cls.kind, cls.classId).includes(student.id)) {
        return conflict(MSG.alreadyInClass)
      }
      const row = classroomsRepo.enrol(
        { kind: cls.kind, classId: cls.classId, studentId: student.id, source: 'teacher' },
        ctx.clock.now(),
      )
      return ok({
        classroomKind: row.classroomKind,
        classroomId: row.classroomId,
        studentId: row.studentId,
        status: row.status,
        source: row.source,
        joinedAt: row.joinedAt,
      })
    },
    { params: { id: int() } },
  ),

  route(
    'DELETE',
    '/api/guru/students/:id',
    [teacherOnly],
    (req) => {
      const found = ownedClass(req, queryString(req.query, 'classroomId'))
      if ('refusal' in found) return refused(found)
      const { cls } = found
      const studentId = Number(req.params.id)
      if (!classroomsRepo.memberIds(cls.kind, cls.classId).includes(studentId)) {
        return notFound(MSG.notInClass)
      }
      classroomsRepo.unenrol(cls.kind, cls.classId, studentId)
      return ok({ removed: 1 })
    },
    { params: { id: int() } },
  ),
]
