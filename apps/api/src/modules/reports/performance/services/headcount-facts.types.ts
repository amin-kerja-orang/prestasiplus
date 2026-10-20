/**
 * Types of the headcount facts (BE-19 Part B implements `HeadcountFactsService`; Part D reads it). One entry
 * is one student x config pair (a `headcount_entries` row with its config's class, subject and level).
 * Percentages are 0-100. Ids are decimal strings.
 */
export interface HeadcountEntryView {
  configId: string
  studentId: string
  classroomId: string
  subjectId: string
  /** Education level id: Tingkatan 4 or 5 (BR-M08-22). */
  levelId: string
  schoolId: string | null
  teacherId: string
  /** Config `updatedAt`. */
  configUpdatedAt: Date
  academicYear: number
  activeOtrs: number
  tov: number | null
  /** OTR targets by checkpoint 1..activeOtrs (null = none). */
  targets: readonly (number | null)[]
  /** Actual results (AR) by checkpoint (null = not keyed). */
  actuals: readonly (number | null)[]
  etr: number | null
  rs: number | null
  rsRecordedAt: Date | null
  dropped: boolean
}

export type HeadcountScope =
  | { kind: 'platform' }
  | { kind: 'school'; schoolId: string }
  | { kind: 'teacher'; teacherId: string }

export interface HeadcountFacts {
  /** Entries of one student, across the configs visible to the given scope. */
  entriesOfStudent(studentId: string, scope: HeadcountScope): Promise<HeadcountEntryView[]>
  /** Entries of the pupils in these classrooms. */
  entriesOfClasses(classroomIds: readonly string[]): Promise<HeadcountEntryView[]>
  /** Entries of a platform, school or teacher scope. */
  entriesInScope(scope: HeadcountScope): Promise<HeadcountEntryView[]>
}
