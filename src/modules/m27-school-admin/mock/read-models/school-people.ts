/**
 * The people of a school as M27 reads them (D12: M27 owns no store). Pupils and teachers are the M01 `users`
 * rows with the school's id and the fixed role, active or not (BR-M27-19, 22). Every count and list goes
 * through `users.adminList`, the call S0 uses for its cards, so totals agree (BR-M27-37).
 */

import { users, type UserRow } from '@/modules/m01-authentication/mock'
import { classrooms } from '@/modules/m10-teacher-class/mock'

export type SchoolRole = 'student' | 'teacher'

export interface PeopleFilter {
  isActive?: boolean
  /** Name or e-mail substring, case-insensitive. */
  search?: string
}

/** Count of the school's users of a role, active or not (the S0 card call). */
export function countOf(schoolId: number, role: SchoolRole, isActive?: boolean): number {
  return users.adminList({
    role,
    schoolId,
    pageSize: 1,
    ...(isActive === undefined ? {} : { isActive }),
  }).total
}

/**
 * All matching users of the school, unpaged (a school is small: the largest generated one has about 776
 * pupils). Order is the owner's (`createdAt`, `id` descending); callers that need another order sort.
 */
export function peopleOf(schoolId: number, role: SchoolRole, filter: PeopleFilter = {}): UserRow[] {
  const total = countOf(schoolId, role)
  if (total === 0) return []
  return users.adminList({
    role,
    schoolId,
    pageSize: total,
    ...(filter.isActive === undefined ? {} : { isActive: filter.isActive }),
    ...(filter.search === undefined || filter.search.trim() === ''
      ? {}
      : { search: filter.search }),
  }).rows
}

/** FR-M27-90 / BR-M27-36: `grade` 7 to 11 "Tingkatan 1…5", 1 to 6 "Darjah 1…6", else null. */
export function gradeLabel(grade: number | null): string | null {
  if (grade === null) return null
  if (grade >= 7 && grade <= 11) return `Tingkatan ${String(grade - 6)}`
  if (grade >= 1 && grade <= 6) return `Darjah ${String(grade)}`
  return null
}

/** Up to two initials, upper case ("Siti Nur Aina" gives "SN"). */
export function initialsOf(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .filter((w) => w !== '')
  const letters = words.slice(0, 2).map((w) => Array.from(w)[0] ?? '')
  return letters.join('').toLocaleUpperCase('ms-MY')
}

/**
 * BR-M27-36: names of the pupil's active enrolments of both kinds, a class with `isActive = false` left out
 * (v1.8), in the owner's enrolment order by class key for a stable result.
 */
export function activeClassNamesOf(studentId: number): string[] {
  const names: string[] = []
  for (const e of classrooms
    .enrolmentsOf(studentId)
    .filter((x) => x.status === 'active')
    .sort((a, b) => a.classKey.localeCompare(b.classKey))) {
    const cls = classrooms.get(e.classroomKind, e.classroomId)
    if (cls?.isActive) names.push(cls.name)
  }
  return names
}

/** BR-M27-36 / G-7: active classes owned by the teacher (`forTeacher` also returns inactive ones). */
export function activeClassCountOf(teacherId: number): number {
  return classrooms.forTeacher(teacherId).filter((c) => c.isActive).length
}
