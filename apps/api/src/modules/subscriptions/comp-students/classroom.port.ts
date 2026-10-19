import { Injectable } from '@nestjs/common'
import type { CompStudentClass } from '../subscriptions.types'
/** The classroom a complimentary register targets (mock `classrooms.get('classroom', id)`). */
export interface CompClassroom {
  id: string
  schoolId: string | null
  schoolName: string | null
  /** Grade 1..11 of the class level; null when unknown. */
  grade: number | null
}

/** The class view of one student (mock `firstClass` and the S8 `classes`). */
export interface CompEnrolmentView {
  /** First active class name; "" when none. */
  classLabel: string
  teacherName: string
  classes: CompStudentClass[]
}

/**
 * Seam to the classroom owner (BE-17, M10). No classes table exists yet, so the default provider
 * finds no classroom (a register is refused with 422 "The selected classroom id is invalid.") and
 * shows no classes. BE-17 provides the real implementation under `COMP_CLASSROOM_PORT`.
 */
export interface CompClassroomPort {
  /** An ACTIVE classroom, or null. */
  find(classroomId: string): Promise<CompClassroom | null>
  /** Enrols the new students (source: complimentary). Runs inside the register transaction. */
  enrol(classroomId: string, studentIds: readonly string[]): Promise<void>
  /** Class views by student id; students without an enrolment are absent. */
  describe(studentIds: readonly string[]): Promise<Map<string, CompEnrolmentView>>
}

export const COMP_CLASSROOM_PORT = Symbol('COMP_CLASSROOM_PORT')

/** Default provider until BE-17 lands. */
@Injectable()
export class NoClassroomsPort implements CompClassroomPort {
  find(): Promise<CompClassroom | null> {
    return Promise.resolve(null)
  }

  enrol(): Promise<void> {
    return Promise.resolve()
  }

  describe(): Promise<Map<string, CompEnrolmentView>> {
    return Promise.resolve(new Map())
  }
}
