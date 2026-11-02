import { Inject, Injectable } from '@nestjs/common'

import type { TeacherClassroomRow, TeacherClassroomsProvider } from '../users'
import { isCompTargetClass } from './comp-classroom.adapter'
import { ClassesRepository } from './classes.repository'

/**
 * The real `TeacherClassroomsProvider` of the admin lookup `GET /admin/teachers/:id/classrooms` (S7 "Kelas guru"):
 * the teacher's own classes that `POST /admin/comp-students` accepts (`CompClassroomAdapter.find`), so every
 * listed class is a valid target.
 */
@Injectable()
export class TeacherClassroomsAdapter implements TeacherClassroomsProvider {
  constructor(@Inject(ClassesRepository) private readonly repo: ClassesRepository) {}

  async activeOf(teacherId: string, scope?: { schoolId: string | null }): Promise<TeacherClassroomRow[]> {
    const rows = await this.repo.forTeacher(teacherId)
    return rows
      .filter(isCompTargetClass)
      .filter((c) => scope === undefined || (scope.schoolId !== null && c.schoolId === scope.schoolId))
      .map((c) => ({ id: c.id, name: c.name, classCode: c.joinCode ?? '-' }))
  }
}
