/**
 * Children's names in battle surfaces (LEAD decision 2026-10-21, issue #76; privacy overrides fidelity).
 * A viewer sees a pupil's full name and id only inside their scope; everyone else gets first name + initial and no id.
 *
 * Mirrors BE-19's `canSeeName` (reports/performance/domain/privacy.ts) with one difference: BE-19 only serves own-school
 * data, so its school_admin branch is unscoped. Battle standings are national, so the school_admin branch here checks
 * that the pupil's CURRENT school is the viewer's own school.
 */
import type { RoleCode } from '@pp/contract'

export interface BattleViewer {
  userId: string
  role: RoleCode
  /** The school of the viewer's active scope (school admin), else null. */
  schoolId: string | null
}

/** The part of a viewer's scope that needs data: a teacher's own-class pupil ids (empty for every other role). */
export type OwnPupils = ReadonlySet<string>

export const NO_PUPILS: OwnPupils = new Set()

/** Full name and id are visible: admin (all), school admin (pupils of the own school), teacher (own classes), the pupil themself. */
export function canSeeName(viewer: BattleViewer, pupilId: string, pupilSchoolId: string | null, ownPupils: OwnPupils): boolean {
  if (viewer.userId === pupilId) return true
  if (viewer.role === 'admin') return true
  if (viewer.role === 'school_admin') return viewer.schoolId !== null && pupilSchoolId === viewer.schoolId
  if (viewer.role === 'teacher') return ownPupils.has(pupilId)
  return false
}

/** "Aina Zulkifli" becomes "Aina Z."; a one-word name stays; an empty name stays empty (callers keep their fallback). */
export function displayName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter((p) => p !== '')
  const first = parts[0]
  if (first === undefined) return ''
  const last = parts.length > 1 ? parts[parts.length - 1] : undefined
  const initial = last === undefined ? undefined : Array.from(last)[0]
  return initial === undefined ? first : `${first} ${initial.toUpperCase()}.`
}
