/**
 * The core `SessionResolver` (plugged into the auth middleware through `defineMockCore`). The
 * server calls it for every request that carries a Bearer token, inside its own transaction.
 *
 * - unknown, revoked or expired token → `null` (guarded routes answer `401 UNAUTHORIZED`);
 * - the session's user no longer exists, or has no session role (`unmapped`, M02 D9) → `null`;
 * - otherwise the session, with the **current** role of the user (an admin role change applies to
 *   the next request), and a non-remember session slides to now + 120 min (BR-06).
 *
 * An inactive user's open session stays valid (M01 BR-23: only the login is refused).
 */

import type { MockSession, SessionResolver } from '../auth/middleware'
import { sessions } from '../auth/sessions'
import { isSessionUser, users } from './users'

/** What the core puts on `req.session` (the guards need `token`, `userId`, `role`). */
export interface CoreSession extends MockSession {
  remember: boolean
  /** Epoch ms, after sliding. */
  expiresAt: number
}

export const resolveCoreSession: SessionResolver = (token, _req, ctx): CoreSession | null => {
  const row = sessions.resolve(token, ctx.clock.now())
  if (!row) return null
  const user = users.get(row.userId)
  if (!user || !isSessionUser(user)) return null
  return {
    token: row.id,
    userId: user.id,
    role: user.role,
    remember: row.remember,
    expiresAt: row.expiresAt,
  }
}
