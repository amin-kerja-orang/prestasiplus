/**
 * The cross-screen pupil and teacher counts of the Prestasi screens (R1 S10-T07, FR-AS-4-1, AC-AS-4-1): XS-1 "Pelajar berdaftar" and
 * XS-3 "Guru" from `school-admin/xs-queries.ts` (R1 S6-T03). The real binding is the `XsQueries` class itself (`XS_COUNTS_PORT`
 * `useExisting`), so Prestasi shows the same number as the school admin Dashboard and every other screen; tests bind a fake.
 */

/** Scopes Prestasi sekolah shows: a school (school admin, teacher, officer of the school) or the whole platform (admin). */
export type XsCountsScope = { kind: 'school'; schoolId: string } | { kind: 'platform' }

/** XS-1 pupils of a scope: the count and the ascending decimal ids (`ids.length === count`). */
export interface XsCountedPupils {
  count: number
  ids: string[]
}

export interface XsCountsPort {
  /** XS-1: active, non-suspended pupil accounts of Tingkatan 1 to 5 (pending, deactivated, Darjah and grade-less pupils are out). */
  pupils(scope: XsCountsScope): Promise<XsCountedPupils>
  /** XS-3: approved, active teachers of the school (pending teachers, school admins and deactivated accounts are out). */
  teacherCount(schoolId: string): Promise<number>
  /** XS-3 as ids (`XsQueries.teachers`): the same teachers the count counts; the teacher cards of Prestasi sekolah list only these (`ids.length === count`). */
  teachers(schoolId: string): Promise<XsCountedPupils>
}

export const XS_COUNTS_PORT = Symbol('XS_COUNTS_PORT')
