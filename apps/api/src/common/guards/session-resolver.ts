import type { Request } from 'express'

import type { AuthContext } from '../scope/auth-context'

/** Injection token of the session resolver (provided by the auth module, consumed by `AuthGuard`). */
export const SESSION_RESOLVER = Symbol('SESSION_RESOLVER')

export interface SessionResolver {
  /**
   * Cookie -> fresh AuthContext rebuilt from the current account rows (slides the session), or null
   * when there is no valid session.
   * Throws ApiError CSRF_INVALID (403) for a mutating method with a missing or wrong X-CSRF-Token on
   * a valid session.
   */
  resolve(req: Request): Promise<AuthContext | null>
}
