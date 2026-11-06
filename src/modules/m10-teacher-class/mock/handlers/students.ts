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
  GURU_STUDENT_MESSAGES,
  GuruStudentCreateRequestSchema,
  TEACHER_STUDENTS_PAGE_SIZE,
  guruStudentCreatedMessage,
} from '@pp/contract'

import { toIsoMyt } from '@/lib/time'
import {
  conflict,
  created,
  fail,
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
import { practice } from '@/modules/m05-practice/mock'

import { classroomsRepo } from '../repository/classrooms'
import type { ClassroomRow } from '../repository/types'
import { missionsRepo } from '../repository/missions'
import { questionSetsRepo } from '../repository/question-sets'
import { teacherProfilesRepo } from '../repository/teacher-profiles'
import { bodyOf, intOf, MSG, teacherOnly, viewerId } from './common'

const SCHOOL_TAB_LIMIT = 200

interface StudentRef {
  id: number
  name: string
  grade: number | null
  username?: string | null
}

/** Longest username stem before the 2-digit suffix (the BE `USERNAME_STEM_MAX`). */
const USERNAME_STEM_MAX = 40
/** The default password of a pupil created in mock mode; the BE reads `PUPIL_DEFAULT_PASSWORD`. */
const MOCK_PUPIL_PASSWORD = 'demo-murid-01'

/** Username stem of a name (D113), the same rule as the BE `usernameStem`. */
export function usernameStem(name: string): string {
  const words = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z0-9]/g, ''))
    .filter((w) => w !== '')
  if (words.length === 0) return 'pelajar'
  const full = words.join('.')
  if (full.length <= USERNAME_STEM_MAX) return full
  let out = ''
  for (const w of words) {
    const next = out === '' ? w : `${out}.${w}`
    if (next.length > USERNAME_STEM_MAX) break
    out = next
  }
  return out !== '' ? out : (words[0] as string).slice(0, USERNAME_STEM_MAX)
}

/** A pupil's login name: the stored one (created in mock mode) or, for seeded rows, stem plus a suffix from the id. */
export const usernameOf = (s: StudentRef): string =>
  s.username ?? `${usernameStem(s.name)}${String((s.id % 99) + 1).padStart(2, '0')}`

interface StudentStats {
  tugasan: number
  skorPurata: number | null
  lastActiveAt: string | null
}

/**
 * The R1-GUR-41 figures of one pupil, derived from the M05 sessions as the BE `studentStats` does:
 * - tugasan: distinct completed Set Soalan sets and Misi of THIS teacher assigned to a class the pupil is in
 *   (a mission has no class in the mock: the pupil is one of its recipients);
 * - skorPurata: round(mean of correct / total x 100) over completed sessions with questions, null without;
 * - lastActiveAt: the latest completed session (the mock keeps no per-answer log for the roster).
 */
function statsOf(teacherId: number, studentId: number): StudentStats {
  const sessions = practice.history(studentId).filter((x) => x.status === 'completed')
  const done = new Set<string>()
  for (const x of sessions) {
    if (x.mode === 'question_set' && x.questionSetId !== null) {
      const set = questionSetsRepo.get(x.questionSetId)
      if (set && set.teacherId === teacherId && classroomsRepo.memberIds(set.classroomKind, set.classroomId).includes(studentId)) {
        done.add(`set:${String(set.id)}`)
      }
    } else if (x.mode === 'mission' && x.missionId !== null) {
      const mission = missionsRepo.get(x.missionId)
      if (mission && mission.teacherId === teacherId && mission.recipientIds.includes(studentId)) {
        done.add(`mission:${String(mission.id)}`)
      }
    }
  }
  const scored = sessions.filter((x) => x.total > 0)
  const ratio = scored.reduce((sum, x) => sum + x.correct / x.total, 0)
  const last = sessions.reduce((max, x) => Math.max(max, x.completedAtMs), 0)
  return {
    tugasan: done.size,
    skorPurata: scored.length > 0 ? Math.round((ratio / scored.length) * 100) : null,
    lastActiveAt: last > 0 ? toIsoMyt(last) : null,
  }
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
function studentBody(s: StudentRef, classes: Map<number, ClassRef[]>, teacherId: number) {
  const own = classes.get(s.id) ?? []
  return {
    id: s.id,
    name: s.name,
    levelName: s.grade === null ? null : (curriculum.levelForGrade(s.grade)?.name ?? null),
    classNames: own.map((c) => c.name),
    classes: own.map((c) => ({ id: c.id, name: c.name })),
    username: usernameOf(s),
    ...statsOf(teacherId, s.id),
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
    const pageSize = TEACHER_STUDENTS_PAGE_SIZE
    /** `page` is clamped to 1..totalPages like the BE; `count` is the match total before the school cap. */
    const pageOf = (rows: StudentRef[], count: number, schoolSet: boolean) => {
      const totalPages = Math.max(1, Math.ceil(rows.length / pageSize))
      const asked = Number(queryString(req.query, 'page'))
      const page = Number.isInteger(asked) && asked >= 1 ? Math.min(asked, totalPages) : 1
      return ok(
        rows.slice((page - 1) * pageSize, page * pageSize).map((s) => studentBody(s, names, id)),
        { meta: { count, schoolSet, page, pageSize, totalPages } },
      )
    }

    if (tab === 'school') {
      if (schoolId === null) {
        return ok([], { meta: { count: 0, schoolSet: false, page: 1, pageSize, totalPages: 1 } })
      }
      // every active student of the school, then the name filter, the A→Z order and the 200 cap
      const { rows } = users.adminList({
        role: 'student',
        schoolId,
        isActive: true,
        pageSize: Number.MAX_SAFE_INTEGER,
      })
      const matching = rows.filter(match).sort(byName)
      return pageOf(matching.slice(0, SCHOOL_TAB_LIMIT), matching.length, true)
    }

    const rows = users.getMany(classroomsRepo.teacherStudentIds(id)).filter(match).sort(byName)
    return pageOf(rows, rows.length, schoolId !== null)
  }),

  route('POST', '/api/guru/students', [teacherOnly], (req, ctx) => {
    // Mock mode sends the class id as a number; the contract (and the BE) read it as an opaque string.
    const raw = bodyOf(req)
    const parsed = GuruStudentCreateRequestSchema.safeParse(
      typeof raw.classroomId === 'number' ? { ...raw, classroomId: String(raw.classroomId) } : raw,
    )
    if (!parsed.success) {
      const fields: Record<string, string> = {}
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? 'name')
        if (!(key in fields)) fields[key] = issue.message
      }
      return validationError(fields)
    }
    const body = parsed.data
    const viewer = viewerId(req)
    const cls = classroomsRepo.get('classroom', Number(body.classroomId))
    if (!cls || cls.teacherId !== viewer || !cls.isActive) {
      const own = classroomsRepo.forTeacher(viewer).some((c) => c.isActive)
      return validationError({
        classroomId: own ? GURU_STUDENT_MESSAGES.classroom : GURU_STUDENT_MESSAGES.noActiveClass,
      })
    }
    const schoolId = teacherProfilesRepo.schoolOf(viewer)
    if (schoolId === null) return validationError({ classroomId: GURU_STUDENT_MESSAGES.noSchool })
    if (body.ic !== undefined && users.icInUse(body.ic)) {
      return fail(409, 'CONFLICT', GURU_STUDENT_MESSAGES.icTaken, { ic: GURU_STUDENT_MESSAGES.icTaken })
    }

    const taken = new Set(
      users.adminList({ role: 'student', schoolId, pageSize: Number.MAX_SAFE_INTEGER }).rows.map(usernameOf),
    )
    const stem = usernameStem(body.name)
    let username: string | undefined
    for (let n = 1; n <= 99 && username === undefined; n++) {
      const candidate = `${stem}${String(n).padStart(2, '0')}`
      if (!taken.has(candidate)) username = candidate
    }
    if (username === undefined) return conflict()

    const now = ctx.clock.now()
    const user = users.create(
      {
        name: body.name,
        email: `${username}.${String(schoolId)}@pelajar.mock.test`,
        username,
        role: 'student',
        grade: cls.levelId,
        schoolId,
        createdById: viewer,
      },
      now,
    )
    users.setPassword(user.id, MOCK_PUPIL_PASSWORD)
    if (body.ic !== undefined) users.setIcNumber(user.id, body.ic)
    classroomsRepo.enrol({ kind: cls.kind, classId: cls.classId, studentId: user.id, source: 'teacher' }, now)
    return created({
      id: user.id,
      name: body.name,
      username,
      message: guruStudentCreatedMessage(username, MOCK_PUPIL_PASSWORD),
    })
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
