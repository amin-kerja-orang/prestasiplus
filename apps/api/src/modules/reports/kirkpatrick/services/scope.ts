import type { RoleCode } from '@pp/contract'

import type { KirkpatrickRepository } from '../kirkpatrick.repository'

/** The caller as the services see them: from the session only, never from the query or body. */
export interface Ctx {
  userId: string
  role: RoleCode
  /** School of a school-scoped role (teacher, school_admin) from the session scope; null otherwise. */
  schoolId: string | null
  /** Mod Pelajar is on (rows written are test data). */
  isTest: boolean
}

/** Roles that read the Kirkpatrick levels (admin, teacher, school_admin). */
export const STAFF_ROLES: readonly RoleCode[] = ['admin', 'teacher', 'school_admin']
/** Teacher and school_admin are forced to the own school (contract SCOPE_NOTE). */
export const isSchoolForced = (role: RoleCode): boolean => role === 'teacher' || role === 'school_admin'

export interface Scope {
  /** Echoed in the overview: the school asked for (admin) or the own school (forced roles). */
  schoolId: string | null
  state: string | null
  /** `null` = every school; a list = those schools (possibly empty: the zero state). */
  schoolIds: string[] | null
}

export interface ScopeQuery {
  schoolId?: string | undefined
  state?: string | undefined
}

const EMPTY: Scope = { schoolId: null, state: null, schoolIds: [] }

/** A whole-number school id as the canonical decimal string ('' and undefined mean "all schools"). */
export function schoolIdOf(raw: string | undefined): string | null {
  const v = (raw ?? '').trim()
  return v === '' ? null : String(Number(v))
}

/**
 * BR-M12-01 with the contract scope rules: teacher and school_admin are forced to the own school whatever the
 * query says (a caller without a school gets the empty scope); admin chooses a school and/or a state. An unknown
 * school or state is the zero state.
 */
export async function resolveScope(repo: KirkpatrickRepository, ctx: Ctx, query: ScopeQuery, allowState: boolean): Promise<Scope> {
  if (isSchoolForced(ctx.role)) {
    return ctx.schoolId === null ? { ...EMPTY } : { schoolId: ctx.schoolId, state: null, schoolIds: [ctx.schoolId] }
  }
  const schoolId = schoolIdOf(query.schoolId)
  const state = allowState && query.state !== undefined && query.state.trim() !== '' ? query.state.trim() : null
  let schoolIds: string[] | null = null
  if (schoolId !== null) {
    const info = (await repo.schools([schoolId])).get(schoolId)
    schoolIds = info ? [schoolId] : []
    if (info && state !== null && info.state !== state) schoolIds = []
  } else if (state !== null) {
    schoolIds = await repo.schoolIdsOfState(state)
  }
  return { schoolId, state, schoolIds }
}

/** The platform for admin, the own school for the forced roles (reaction, chain, export). */
export function platformScope(ctx: Ctx): Scope {
  if (isSchoolForced(ctx.role)) {
    return ctx.schoolId === null ? { ...EMPTY } : { schoolId: ctx.schoolId, state: null, schoolIds: [ctx.schoolId] }
  }
  return { schoolId: null, state: null, schoolIds: null }
}
