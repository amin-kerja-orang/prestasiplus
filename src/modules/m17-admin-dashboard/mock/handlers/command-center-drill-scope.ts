/**
 * Viewer scope of the Command Center drill-down endpoints (SRS M17 v1.13 §7 #6–#13, guard **ATS**;
 * BR-M17-30, BR-M17-34, FR-M17-60, FR-M17-114, SEC-M17-13, §9).
 *
 * - **Admin**: every id that exists (fixture schools included, BR-M17-02).
 * - **Teacher** (M10 mount): the schools of the teacher's active classes, the teacher's own S5 page,
 *   the teacher's active classes, their active members (BR-M10-04) and the headcount configs of those
 *   classes. Any other id is a 404, never a 403, so a teacher cannot probe other ids (§7 "else 404").
 * - **School admin** (Admin Sekolah alias, BR-M17-34): the school is the session user's school, never
 *   the request's; no school is a 403; the school, its teachers (DV-M17-22 rule), the classes of the
 *   school, its pupils (active or not), their sessions and the headcount configs of those classes.
 *   An object of another school and an unknown id are both a 404 (OQ-M17-13), so existence is not shown.
 * - Every other role is refused by the guard with 403; a guest with 401.
 *
 * A class belongs to the school of its row, or, when the row has none, to its owner's school
 * ("effective school"; M10 teacher-created classes carry the school they were made at).
 */

import { forbidden, requireRole, type Middleware, type MockRequest } from '@/mock/define'
import { users } from '@/modules/m01-authentication/mock'
import { classrooms, type ClassroomRow } from '@/modules/m10-teacher-class/mock'

const roleGuard = requireRole('admin', 'teacher', 'school_admin')

/**
 * Guard **ATS**: admin, teacher or school admin (401 without a session, 403 for any other role, and
 * 403 for a school admin whose user has no school, BR-M17-34).
 */
export const adminTeacherOrSchoolAdmin: Middleware = (req, ctx) => {
  const refused = roleGuard(req, ctx)
  if (refused) return refused
  if (req.session?.role === 'school_admin' && users.get(req.session.userId)?.schoolId == null) {
    return forbidden()
  }
  return undefined
}

/** The school a class counts for: its own, else its owner's. */
export function effectiveSchoolId(cls: ClassroomRow): number | null {
  if (cls.schoolId !== null) return cls.schoolId
  return cls.teacherId === null ? null : (users.get(cls.teacherId)?.schoolId ?? null)
}

/** Active teacher-created classes of a school (S4 "Kelas", S5 list). */
export function activeClassesAt(schoolId: number): ClassroomRow[] {
  return classrooms
    .list({ kind: 'classroom', isActive: true })
    .filter((c) => effectiveSchoolId(c) === schoolId)
}

export interface DrillScope {
  readonly admin: boolean
  /** The school a school admin is fixed to, `null` for an admin or a teacher. */
  readonly schoolAdminSchoolId: number | null
  /** The viewing teacher, `null` for an admin or a school admin. */
  readonly teacherId: number | null
  /** A teacher's own active classes (empty for an admin). */
  readonly ownClasses: readonly ClassroomRow[]
  mayOpenSchool(schoolId: number): boolean
  mayOpenTeacher(schoolId: number, userId: number): boolean
  mayOpenClass(cls: ClassroomRow): boolean
  mayOpenStudent(userId: number): boolean
  mayOpenConfig(classroomId: number): boolean
}

/** The scope of the request's session (`adminTeacherOrSchoolAdmin` has run). */
export function scopeOf(req: MockRequest): DrillScope {
  if (!req.session) throw new Error('adminTeacherOrSchoolAdmin must run first')
  if (req.session.role === 'admin') return ADMIN_SCOPE
  if (req.session.role === 'school_admin') {
    const schoolId = users.get(req.session.userId)?.schoolId
    if (schoolId == null)
      throw new Error('a school admin without a school must be refused by the guard')
    return schoolAdminScope(schoolId)
  }
  const teacherId = req.session.userId
  const ownClasses = classrooms.list({ kind: 'classroom', teacherId, isActive: true })
  const classIds = new Set(ownClasses.map((c) => c.classId))
  const schoolIds = new Set<number>()
  for (const c of ownClasses) {
    const s = effectiveSchoolId(c)
    if (s !== null) schoolIds.add(s)
  }
  let students: Set<number> | null = null
  const studentSet = (): Set<number> =>
    (students ??= new Set(classrooms.teacherStudentIds(teacherId)))
  return {
    admin: false,
    schoolAdminSchoolId: null,
    teacherId,
    ownClasses,
    mayOpenSchool: (schoolId) => schoolIds.has(schoolId),
    mayOpenTeacher: (schoolId, userId) => userId === teacherId && schoolIds.has(schoolId),
    mayOpenClass: (cls) => cls.kind === 'classroom' && classIds.has(cls.classId),
    mayOpenStudent: (userId) => studentSet().has(userId),
    mayOpenConfig: (classroomId) => classIds.has(classroomId),
  }
}

function schoolAdminScope(schoolId: number): DrillScope {
  const classHere = (classroomId: number): boolean => {
    const cls = classrooms.get('classroom', classroomId)
    return cls !== undefined && effectiveSchoolId(cls) === schoolId
  }
  return {
    admin: false,
    schoolAdminSchoolId: schoolId,
    teacherId: null,
    ownClasses: [],
    mayOpenSchool: (id) => id === schoolId,
    mayOpenTeacher: (sid) => sid === schoolId,
    mayOpenClass: (cls) => cls.kind === 'classroom' && effectiveSchoolId(cls) === schoolId,
    mayOpenStudent: (userId) => {
      const user = users.get(userId)
      return user?.role === 'student' && user.schoolId === schoolId
    },
    mayOpenConfig: classHere,
  }
}

const ADMIN_SCOPE: DrillScope = {
  admin: true,
  schoolAdminSchoolId: null,
  teacherId: null,
  ownClasses: [],
  mayOpenSchool: () => true,
  mayOpenTeacher: () => true,
  mayOpenClass: () => true,
  mayOpenStudent: () => true,
  mayOpenConfig: () => true,
}
