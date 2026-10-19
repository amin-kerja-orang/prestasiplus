import type { ActiveRole, Mode, RoleCode, RoleGrant, Scope } from '@pp/contract'

/**
 * Who is calling, rebuilt by `AuthGuard` on every authenticated request from the session row and
 * the CURRENT account rows (users, user_roles, user_scopes), never from a stale snapshot (BE-NFR-39).
 * Guards, `ScopeContext` and services read it from `request.auth`; nothing reads scope from the
 * query or body (ADR-0017).
 */
export interface AuthContext {
  /** Internal id of the `sessions` row (never the cookie value). */
  sessionRowId: string
  /** Decimal-string user id. */
  userId: string
  /** All role grants of the account, with the server-derived scope of each. */
  roles: RoleGrant[]
  /** The role the request acts as: the chosen role, or `student`/`self` while Mod Pelajar is on. */
  active: ActiveRole
  /** Mod Pelajar state, or null. */
  mode: Mode | null
  /** Capability keys of the active role and scope (`capabilitiesFor` from `@pp/contract`). */
  capabilities: string[]
}

/** The request property `AuthGuard` sets. */
export const AUTH_CONTEXT_KEY = 'auth' as const

export interface RequestWithAuth {
  [AUTH_CONTEXT_KEY]?: AuthContext
}

/** The active scope of a request (shorthand for repositories and services). */
export function activeScope(auth: AuthContext): Scope {
  return auth.active.scope
}

/** The active role of a request. */
export function activeRole(auth: AuthContext): RoleCode {
  return auth.active.role
}
