import type { RoleCode } from '@pp/contract'

import { canSeeName } from '../reports/performance/domain/privacy'
import { REDACTED_ID } from '../reports/performance/domain/constants'

/**
 * Who reads a ranking that lists other people (the leaderboard): the caller's own id, active role and the school of
 * its active scope (null when the scope has none). Everything comes from the session, never from the request.
 */
export interface RankingViewer {
  userId: string
  role: RoleCode
  schoolId: string | null
}

/**
 * The pupils whose full name a viewer may see on a NATIONAL ranking (LEAD decision on #76): a teacher's pupils
 * (active, real members of the own active classes) and a school admin's school. Admin needs no set.
 */
export interface NameScope {
  ownPupils: ReadonlySet<string>
  schoolId: string | null
}

/** Shown instead of a pupil id on a redacted row (same value as the BE-19 reports; the contract id is not nullable yet). */
export const RANKING_REDACTED_ID = REDACTED_ID

/**
 * May `viewer` see the full name and id of `pupil` (whose school is `pupilSchoolId`) on a national ranking?
 * BE-19's `canSeeName` decides self, admin and teacher. It answers yes for every school admin because the BE-19 reports
 * are already scoped to the school; a national ranking is not, so a school admin sees names of the own school only.
 * Every other role (student, ppd_officer, parent, sponsor) sees only the own row.
 */
export function canSeeRankedName(viewer: RankingViewer, scope: NameScope, pupilId: string, pupilSchoolId: string | null): boolean {
  if (viewer.role === 'school_admin' && viewer.userId !== pupilId) return scope.schoolId !== null && pupilSchoolId === scope.schoolId
  return canSeeName(viewer.role, viewer.userId, pupilId, scope.ownPupils)
}

/** Name particles that are not a family name (Malay, Indian and Sarawak naming). */
const PARTICLES = new Set(['bin', 'binti', 'bt', 'bte', 'b.', 'bt.', 'a/l', 'a/p', 'al', 'ap', 'anak', 'ak', 'ak.', 's/o', 'd/o'])

/**
 * First name + initial (LEAD decision on #76): the first word and the first letter of the last word that is not a
 * name particle, e.g. "Nur Aina binti Kamal" -> "Nur K.". A one-word name stays as it is; an empty name gives ''.
 */
export function shortName(full: string): string {
  const words = full.trim().split(/\s+/).filter((w) => w !== '')
  const first = words[0]
  if (first === undefined) return ''
  const rest = words.slice(1).filter((w) => !PARTICLES.has(w.toLowerCase()))
  const last = rest.at(-1)
  return last === undefined ? first : `${first} ${last.charAt(0).toUpperCase()}.`
}
