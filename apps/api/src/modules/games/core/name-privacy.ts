/**
 * Children's names rule for every ranking-like read of the games module (LEAD decision 2026-10-21, issue #76).
 * It mirrors BE-19's `canSeeName` (`reports/performance/domain/privacy.ts`) and adds the school scope of a school
 * admin, which the tip version of BE-19 lacks. The module is pure: the viewer's scope is loaded once per request by
 * `NamePrivacy` (name-privacy.service.ts).
 *
 * A pupil's full name and real user id are shown only to: the pupil themself, an `admin` (everyone), a
 * `school_admin` (pupils of the own school) and a `teacher` (pupils of the own classes). Every other viewer gets
 * first name + initial ("Murid Contoh Alfa" -> "Murid C.") and `userId: null`.
 */
import type { RoleCode } from '@pp/contract'

export interface NameViewer {
  role: RoleCode
  userId: string
  /** The viewer's own school (a school admin's scope); null when none. */
  schoolId: string | null
  /** A teacher's pupils: distinct active pupils of the teacher's own classes. Empty for every other role. */
  ownPupilIds: ReadonlySet<string>
}

export interface NamedPupil {
  id: string
  name: string
  schoolId: string | null
  /** False for a staff or other adult account (their names are not children's names). Default true: unknown means protect. */
  isPupil?: boolean
}

/** What a ranking row may carry about a pupil. */
export interface ShownPupil {
  /** The real id, or null when the viewer may not see this pupil's name. */
  userId: string | null
  name: string
}

export function canSeeName(viewer: NameViewer, pupil: Pick<NamedPupil, 'id' | 'schoolId'>): boolean {
  if (viewer.userId === pupil.id) return true
  switch (viewer.role) {
    case 'admin':
      return true
    case 'school_admin':
      return viewer.schoolId !== null && pupil.schoolId !== null && viewer.schoolId === pupil.schoolId
    case 'teacher':
      return viewer.ownPupilIds.has(pupil.id)
    default:
      return false
  }
}

/** First name + initial of the next word: "Murid Contoh Alfa" -> "Murid C."; a single word stays as it is. */
export function displayName(fullName: string): string {
  const words = fullName.split(/\s+/).filter(Boolean)
  const first = words[0]
  if (first === undefined) return ''
  const second = words[1]
  if (second === undefined) return first
  return `${first} ${(Array.from(second)[0] ?? '').toUpperCase()}.`
}

/** The name and id a ranking row may show: the full pair for an adult account or within scope, else `displayName` and a null id. */
export function shownPupil(viewer: NameViewer, pupil: NamedPupil): ShownPupil {
  return pupil.isPupil === false || canSeeName(viewer, pupil) ? { userId: pupil.id, name: pupil.name } : { userId: null, name: displayName(pupil.name) }
}
