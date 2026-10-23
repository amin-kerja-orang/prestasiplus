/**
 * Roles that may open `/headcount*` (routes/headcount.ts, SRS M08 §9, OD-R3): admin, teacher, school admin.
 * Every other role, pelajar included, gets the 403 page there, so a link to it is not shown to them
 * (D2 of the 23 Oct sweep, D9 dead link).
 */
export const HEADCOUNT_ROLES: readonly string[] = ['admin', 'teacher', 'school_admin']

export const canOpenHeadcount = (role: string | null): boolean =>
  role !== null && HEADCOUNT_ROLES.includes(role)
