/** Read port over users and schools (BE-05). The real adapter is `UsersDirectoryAdapter`. */
export interface PupilRef {
  id: string
  name: string
  grade: number | null
  /** Level slug of the grade ('t4', 't5', ...), from BE-08; null when the grade maps to no level. */
  levelSlug: string | null
  /** Education level id of the grade (BE-08), for `PerformanceAnalytics.userLevelId`. */
  levelId: string | null
  schoolId: string | null
  isActive: boolean
  /** Holds the student role. Only students have a Prestasi 360. */
  isStudent: boolean
  /** Optional (public profile, BE-19): account creation time, tingkatan name and suspension. Absent = unknown. */
  createdAt?: Date
  levelName?: string | null
  isSuspended?: boolean
}

export interface SchoolRef {
  id: string
  name: string
  code: string | null
  type: string
  district: string | null
  state: string
}

export interface DirectoryPort {
  /** Unknown ids are absent from the map. */
  users(ids: readonly string[]): Promise<Map<string, PupilRef>>
  school(id: string): Promise<SchoolRef | null>
  /** Officers: schools in a state or a district (names, as stored on the school). */
  schoolsInScope(scope: { state?: string; district?: string }): Promise<SchoolRef[]>
  teachersOfSchool(schoolId: string): Promise<{ id: string; name: string }[]>
  /** Student accounts of a school (active and inactive; callers filter with `users()`). */
  pupilIdsOfSchool(schoolId: string): Promise<string[]>
  /** Student accounts per school, one grouped read. Schools without any are present with 0. */
  countPupils(schoolIds: readonly string[]): Promise<Map<string, number>>
  /** Teacher accounts per school, one grouped read. Schools without any are present with 0. */
  countTeachers(schoolIds: readonly string[]): Promise<Map<string, number>>
}

export const DIRECTORY_PORT = Symbol('DIRECTORY_PORT')
