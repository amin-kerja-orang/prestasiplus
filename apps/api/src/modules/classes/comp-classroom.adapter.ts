import { Inject, Injectable } from '@nestjs/common'

import { CLOCK, type Clock } from '../../db/clock'
import type { CompClassroom, CompClassroomPort, CompEnrolmentView } from '../subscriptions/comp-students/classroom.port'
import { gradeOfLevel } from './classes.mapper'
import { ClassesRepository, type ClassRecord } from './classes.repository'

/** The classes a complimentary register accepts: an ACTIVE teacher class (kind `classroom`). One rule for `find` and the picker. */
export const isCompTargetClass = (cls: ClassRecord): boolean => cls.kind === 'classroom' && cls.isActive

/**
 * The real `COMP_CLASSROOM_PORT` of BE-25 (complimentary students): the seam between the central admin's
 * complimentary register and the classroom owner. `enrol` runs inside the register transaction (the repository
 * joins the current transaction), so a failed register leaves no half-filled roster.
 */
@Injectable()
export class CompClassroomAdapter implements CompClassroomPort {
  constructor(
    @Inject(ClassesRepository) private readonly repo: ClassesRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** An ACTIVE teacher class (kind `classroom`) with its school and the grade (1 to 11) of its level. */
  async find(classroomId: string): Promise<CompClassroom | null> {
    const cls = await this.repo.get(classroomId)
    if (!cls || !isCompTargetClass(cls)) return null
    const [levels, schools] = await Promise.all([this.repo.levelGrades([cls.educationLevelId]), this.repo.schoolNames([cls.schoolId])])
    return {
      id: cls.id,
      schoolId: cls.schoolId,
      schoolName: cls.schoolId === null ? null : (schools.get(cls.schoolId) ?? null),
      grade: gradeOfLevel(levels.get(cls.educationLevelId)),
    }
  }

  async enrol(classroomId: string, studentIds: readonly string[]): Promise<void> {
    await this.repo.enrolMany(classroomId, studentIds, 'complimentary', this.clock.now())
  }

  /** Per student: the first class by id (active ones give the list label and teacher) and every teacher-class enrolment (any status). */
  async describe(studentIds: readonly string[]): Promise<Map<string, CompEnrolmentView>> {
    const rows = await this.repo.enrolmentsOfStudents(studentIds)
    const [teachers, subjects] = await Promise.all([
      this.repo.userNames(rows.map((r) => r.classroom.teacherId)),
      this.repo.subjectNames(rows.map((r) => r.classroom.subjectId)),
    ])
    const teacherOf = (id: string | null): string => (id === null ? '' : (teachers.get(id) ?? ''))
    const out = new Map<string, CompEnrolmentView>()
    for (const r of [...rows].sort((a, b) => Number(BigInt(a.classroom.id) - BigInt(b.classroom.id)))) {
      let view = out.get(r.studentId)
      if (!view) {
        view = { classLabel: '', teacherName: '', classes: [] }
        out.set(r.studentId, view)
      }
      if (view.classLabel === '' && r.status === 'active') {
        view.classLabel = r.classroom.name
        view.teacherName = teacherOf(r.classroom.teacherId)
      }
      view.classes.push({
        name: r.classroom.name,
        classCode: r.classroom.joinCode ?? '-',
        subjectName: r.classroom.subjectId === null ? null : (subjects.get(r.classroom.subjectId) ?? null),
        teacherName: teacherOf(r.classroom.teacherId),
        status: r.status,
      })
    }
    return out
  }
}
