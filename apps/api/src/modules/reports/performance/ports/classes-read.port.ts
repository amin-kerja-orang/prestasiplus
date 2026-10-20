/** Read port over classes (owner BE-17; real = ClassesRepository). The default answers "no classes". */
export interface ClassInfo {
  id: string
  kind: 'classroom' | 'school_class'
  name: string
  schoolId: string
  teacherId: string | null
  teacherName: string | null
  subjectId: string | null
  subjectName: string | null
  /** null becomes '#6366F1'. */
  color: string | null
  /** 't4' | 't5' | ... */
  levelSlug: string
  /** BE-17 display slug ('tahun-N' / 'tingkatan-N'): the wire `class.levelSlug` of Analisa Item. Absent or null: use `levelSlug`. */
  classLevelSlug?: string | null
  year: number
  joinCode: string
  isActive: boolean
  createdAt: Date
  /** Active enrolments. */
  studentCount: number
}

export interface ClassesReadPort {
  classesForTeacher(teacherId: string, opts?: { includeInactive?: boolean }): Promise<ClassInfo[]>
  /** Both kinds. */
  classesOfSchool(schoolId: string): Promise<ClassInfo[]>
  allClasses(): Promise<ClassInfo[]>
  /** No scope applied: services apply the access policy. */
  classById(id: string): Promise<ClassInfo | null>
  /** ACTIVE enrolments, stable order. */
  memberIds(classId: string): Promise<string[]>
  classIdsOfStudent(userId: string): Promise<string[]>
  /** Batch of classIdsOfStudent: pupil id to class ids (pupils without classes are present with []). */
  classIdsOfStudents(userIds: readonly string[]): Promise<Map<string, string[]>>
  /** Batch of memberIds: class id to ACTIVE member ids (unknown classes are present with []). */
  membersOf(classIds: readonly string[]): Promise<Map<string, string[]>>
  /** Batch of classById; unknown ids are skipped. */
  classesByIds(ids: readonly string[]): Promise<ClassInfo[]>
  /** True when the pupil is an ACTIVE member of an ACTIVE class of this teacher. */
  isMemberOfTeacher(teacherId: string, pupilId: string): Promise<boolean>
}

export const CLASSES_READ_PORT = Symbol('CLASSES_READ_PORT')

export class EmptyClasses implements ClassesReadPort {
  async classesForTeacher(): Promise<ClassInfo[]> {
    return []
  }
  async classesOfSchool(): Promise<ClassInfo[]> {
    return []
  }
  async allClasses(): Promise<ClassInfo[]> {
    return []
  }
  async classById(): Promise<ClassInfo | null> {
    return null
  }
  async memberIds(): Promise<string[]> {
    return []
  }
  async classIdsOfStudent(): Promise<string[]> {
    return []
  }
  async classIdsOfStudents(userIds: readonly string[]): Promise<Map<string, string[]>> {
    return new Map(userIds.map((id) => [id, []]))
  }
  async membersOf(classIds: readonly string[]): Promise<Map<string, string[]>> {
    return new Map(classIds.map((id) => [id, []]))
  }
  async classesByIds(): Promise<ClassInfo[]> {
    return []
  }
  async isMemberOfTeacher(): Promise<boolean> {
    return false
  }
}
