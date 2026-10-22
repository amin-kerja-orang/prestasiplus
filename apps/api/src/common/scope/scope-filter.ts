import { ApiError } from '../errors/api-error'
import type { AuthContext } from './auth-context'

/**
 * Where the scope-bearing values live on a model. Give the columns the model has; a level that
 * needs a column the model does not declare fails loudly (a programming error, never a silent
 * "no filter").
 */
export interface ScopeColumns {
  /** Column holding the school id (BigInt), for `school` and `class` scopes. Example: `schoolId`. */
  schoolColumn?: string
  /** Relation name to `School` (with `state` and `district` fields), for `district` and `state` scopes. */
  schoolRelation?: string
  /** Column holding the owner user id (BigInt), for the `self` scope. Example: `userId`. */
  userColumn?: string
}

export type WhereFragment = Record<string, unknown>

const MISSING = (what: string, level: string): Error =>
  new Error(`ScopeFilter: scope level "${level}" needs ${what} in ScopeColumns`)

/** A fragment no row satisfies (`id IN ()` is false in SQL), safe inside `AND: [...]`. */
const matchNothing = (relation: string): WhereFragment => ({ [relation]: { is: { id: { in: [] } } } })

/**
 * Builds the Prisma `where` fragment of the ACTIVE scope and checks single records against it.
 * The scope comes from `AuthContext` only. Merge the fragment with the repository's own filters
 * using `AND`, for example `where: { AND: [scope.where(cols), ownFilter] }`.
 *
 * Level semantics:
 * - `class` scope is the school: the contract carries no class ids, so `class` filters by `schoolColumn`.
 * - `self` filters by the owner column (`userColumn`) = the caller. For a `parent` the self scope is the
 *   linked children, which this column check does not express, so a parent gets NO rows here;
 *   BE-25 (parent portal) must build its own child-link filter.
 * - `schoolRelation` must be a to-one relation to `School` (it is used with `is: {...}`).
 */
export class ScopeFilter {
  constructor(private readonly auth: AuthContext) {}

  /** `where` fragment limiting a query to the active scope. National scope returns `{}`. */
  where(cols: ScopeColumns): WhereFragment {
    const { scope } = this.auth.active
    switch (scope.level) {
      case 'national':
        return {}
      case 'state':
        if (!cols.schoolRelation) throw MISSING('schoolRelation', 'state')
        // Fail closed: `{ state: undefined }` would mean "no filter" to Prisma, i.e. every state.
        if (!scope.stateCode) return matchNothing(cols.schoolRelation)
        return { [cols.schoolRelation]: { is: { state: scope.stateCode } } }
      case 'district':
        if (!cols.schoolRelation) throw MISSING('schoolRelation', 'district')
        // A district name is only unique inside its state, so both are always matched.
        if (!scope.stateCode || !scope.districtCode) return matchNothing(cols.schoolRelation)
        return { [cols.schoolRelation]: { is: { state: scope.stateCode, district: scope.districtCode } } }
      case 'school':
      case 'class':
        if (!cols.schoolColumn) throw MISSING('schoolColumn', scope.level)
        return { [cols.schoolColumn]: BigInt(scope.schoolId as string) }
      case 'self':
        if (!cols.userColumn) throw MISSING('userColumn', 'self')
        return { [cols.userColumn]: BigInt(this.auth.userId) }
    }
  }

  /** True when `record` lies inside the active scope. */
  isInScope(record: unknown, cols: ScopeColumns): boolean {
    if (record === null || record === undefined || typeof record !== 'object') return false
    const row = record as Record<string, unknown>
    const { scope } = this.auth.active
    switch (scope.level) {
      case 'national':
        return true
      case 'state':
      case 'district': {
        if (!cols.schoolRelation) throw MISSING('schoolRelation', scope.level)
        const school = row[cols.schoolRelation] as { state?: unknown; district?: unknown } | null | undefined
        if (!school) return false
        if (!scope.stateCode) return false // fail closed, as in where()
        if (school.state !== scope.stateCode) return false
        if (scope.level === 'state') return true
        return !!scope.districtCode && school.district === scope.districtCode
      }
      case 'school':
      case 'class': {
        if (!cols.schoolColumn) throw MISSING('schoolColumn', scope.level)
        const value = row[cols.schoolColumn]
        return value !== null && value !== undefined && String(value) === scope.schoolId
      }
      case 'self': {
        if (!cols.userColumn) throw MISSING('userColumn', 'self')
        const value = row[cols.userColumn]
        return value !== null && value !== undefined && String(value) === this.auth.userId
      }
    }
  }

  /**
   * Returns `record` when it is inside the active scope. A missing record and an out-of-scope
   * record both throw 404 `NOT_FOUND` (never 403, so existence is not revealed).
   */
  assertInScope<T>(record: T | null | undefined, cols: ScopeColumns): T {
    if (record === null || record === undefined || !this.isInScope(record, cols)) {
      throw ApiError.of('NOT_FOUND')
    }
    return record
  }
}
