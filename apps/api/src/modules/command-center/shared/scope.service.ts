import { Inject, Injectable } from '@nestjs/common'

import { notFound } from '../http/errors'
import type { Viewer, ViewerRole } from '../http/viewer'
import { type ClassRow, CommandCenterRepository, type Ref, type UserBrief } from './command-center.repository'

/** What a viewer may open. Built once per request by `ScopeService.scopeOf`. */
export interface CcScope {
  userId: string
  role: ViewerRole
  /** Session school of a school admin; null otherwise. */
  schoolId: string | null
  /** Active `classroom` classes the viewer owns (teacher; normally empty for admin; empty for school admin). */
  ownedClassIds: string[]
  /** Effective schools of the owned classes (teacher drill scope). */
  ownedSchoolIds: string[]
}

/**
 * Drill scope (mock `command-center-drill-scope`). Every miss is a 404 "Not Found.", never 403, so ids cannot be probed:
 * - admin: everything that exists.
 * - teacher: the schools of own active classrooms, own teacher page, own active classrooms, their active non-test members.
 * - school_admin: the session school, its teachers, classes (class school, else owner school), pupils (users.school_id,
 *   active or not).
 * `is_test` enrolments never count as membership.
 */
@Injectable()
export class ScopeService {
  constructor(@Inject(CommandCenterRepository) private readonly repo: CommandCenterRepository) {}

  async scopeOf(viewer: Viewer): Promise<CcScope> {
    if (viewer.role === 'school_admin') {
      return { userId: viewer.userId, role: viewer.role, schoolId: viewer.schoolId, ownedClassIds: [], ownedSchoolIds: viewer.schoolId ? [viewer.schoolId] : [] }
    }
    const owned = await this.repo.classesOfOwner(viewer.userId, { activeClassroomsOnly: true })
    const ownedSchoolIds = [...new Set(owned.map((c) => c.effectiveSchoolId).filter((v): v is string => v !== null))]
    return { userId: viewer.userId, role: viewer.role, schoolId: null, ownedClassIds: owned.map((c) => c.id), ownedSchoolIds }
  }

  /** The school when it exists and the viewer may open it, else 404. */
  async assertSchoolInScope(scope: CcScope, schoolId: string): Promise<Ref> {
    if (scope.role === 'school_admin' && scope.schoolId !== schoolId) throw notFound()
    if (scope.role === 'teacher' && !scope.ownedSchoolIds.includes(schoolId)) throw notFound()
    const school = await this.repo.schoolRef(schoolId)
    if (!school) throw notFound()
    return school
  }

  /** The class when it is an active classroom with a teacher and the viewer may open it, else 404. */
  async assertClassInScope(scope: CcScope, classId: string): Promise<ClassRow> {
    if (scope.role === 'teacher' && !scope.ownedClassIds.includes(classId)) throw notFound()
    const cls = await this.repo.classById(classId)
    if (!cls || !cls.isActive || cls.kind !== 'classroom' || cls.ownerId === null) throw notFound()
    if (scope.role === 'school_admin' && cls.effectiveSchoolId !== scope.schoolId) throw notFound()
    return cls
  }

  /** The student (role `student`) when the viewer may open them, else 404. */
  async assertStudentInScope(scope: CcScope, studentId: string): Promise<UserBrief> {
    const user = await this.repo.userBrief(studentId)
    if (!user || !user.roles.includes('student')) throw notFound()
    if (scope.role === 'school_admin' && user.schoolId !== scope.schoolId) throw notFound()
    if (scope.role === 'teacher' && !(await this.repo.isTeacherStudent(scope.userId, studentId))) throw notFound()
    return user
  }

  /** The teacher page `/school/:sid/teacher/:uid`: the school must be openable and the teacher must belong to it (role teacher at the school, or owner of a class there). */
  async assertTeacherInScope(scope: CcScope, schoolId: string, teacherId: string): Promise<{ school: Ref; teacher: UserBrief }> {
    if (scope.role === 'teacher' && teacherId !== scope.userId) throw notFound()
    const school = await this.assertSchoolInScope(scope, schoolId)
    const teacher = await this.repo.userBrief(teacherId)
    if (!teacher) throw notFound()
    const atSchool = teacher.roles.includes('teacher') && teacher.schoolId === schoolId
    if (!atSchool) {
      const owned = await this.repo.classesOfOwner(teacherId, { activeClassroomsOnly: true })
      if (!owned.some((c) => c.effectiveSchoolId === schoolId)) throw notFound()
    }
    return { school, teacher }
  }
}
