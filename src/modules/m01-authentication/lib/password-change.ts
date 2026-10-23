/**
 * The password change and the session re-read that must follow it (AM2-A1, DV-26, DV-27).
 *
 * `PUT /api/me/password` always rotates the caller's session (new cookie, new CSRF token), so the
 * stored `pp.auth.csrf` is stale after it: the next write would fail with 403 `CSRF_INVALID` until a
 * reload. Both callers (the forced-change page and the S8 profile card) use this one helper, which
 * re-reads `GET /api/session` and stores it (http mode only; in the mock `getSession` is `null` and
 * the session is kept).
 */

import { useSessionStore } from '@/stores/session'

import { changePassword, getSession } from '../api'
import type { ChangePasswordRequest } from '../api'

export interface PasswordChangeResult {
  /** The server's status text. */
  status: string
  /** `false` when the password changed but the new session could not be read (the stored CSRF is stale). */
  refreshed: boolean
}

/**
 * Changes the password, then re-reads and stores the session. A failure of the change rejects with
 * the API error (nothing changed); a failure of the re-read does not reject: it resolves with
 * `refreshed: false` because the password is already changed.
 */
export async function changePasswordAndRefresh(
  request: ChangePasswordRequest,
): Promise<PasswordChangeResult> {
  const session = useSessionStore()
  const status = await changePassword(request)
  try {
    const fresh = await getSession(session.remember)
    if (fresh) session.setSession(fresh)
    return { status, refreshed: true }
  } catch {
    return { status, refreshed: false }
  }
}
