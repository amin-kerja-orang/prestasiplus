import { Injectable } from '@nestjs/common'

/** One option of the "Kelas guru" select (contract `TeacherClassroomOption`). */
export interface TeacherClassroomRow {
  id: string
  name: string
  classCode: string
}

/** The class owner's answer to "which classes can a complimentary student be registered into for this teacher". */
export interface TeacherClassroomsProvider {
  /** The teacher's ACTIVE teacher-classes (kind `classroom`); any order, the service sorts them. */
  activeOf(teacherId: string): Promise<TeacherClassroomRow[]>
}

export class NoTeacherClassrooms implements TeacherClassroomsProvider {
  async activeOf(): Promise<TeacherClassroomRow[]> {
    return []
  }
}

/**
 * Holder the classes module (M10, the owner of the class store) plugs into on init, so the users module reads
 * classes without importing it (`ClassesModule` already imports `UsersModule`). Without a provider, `[]`.
 * The same pattern as `ClassesPorts`.
 */
@Injectable()
export class UsersPorts {
  private classroomsProvider: TeacherClassroomsProvider = new NoTeacherClassrooms()
  private classroomsSet = false

  get classrooms(): TeacherClassroomsProvider {
    return this.classroomsProvider
  }

  provideClassrooms(provider: TeacherClassroomsProvider): void {
    if (this.classroomsSet) throw new Error('UsersPorts: the teacher classrooms provider is already set')
    this.classroomsProvider = provider
    this.classroomsSet = true
  }
}
