import type { RoleCode } from '@pp/contract'

/** The caller as the services see them: from the session only, never from the query or body. */
export interface Ctx {
  userId: string
  role: RoleCode
  /** School of a school-scoped role (teacher, school_admin) from the session scope; null otherwise. */
  schoolId: string | null
}

/** Teacher and school_admin are forced to the own school (contract header); admin sees every school. */
export const isSchoolForced = (role: RoleCode): boolean => role === 'teacher' || role === 'school_admin'

/**
 * The school scope of a monitoring request: `null` = every school (admin), a list = those schools. A forced role
 * without a school gets the empty list (an empty view, never "all schools").
 */
export const scopeOf = (ctx: Ctx): string[] | null => (isSchoolForced(ctx.role) ? (ctx.schoolId === null ? [] : [ctx.schoolId]) : null)
