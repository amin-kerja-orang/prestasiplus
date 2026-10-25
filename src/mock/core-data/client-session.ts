/**
 * Opening a session for a user and the client-side session record (M01 DATA-M01-02
 * `ClientSession`, stored by the UI in `localStorage['pp.auth']`).
 *
 * `issueSession` is the one way to log a user in: the `setUser` test hook uses it, and the M01 auth
 * handlers (login, register, token reset; M01-T1) should use it too, answering
 * `{token, expiresAt, user}` from the result. It does **not** set `lastLoginAt`: the M01 handlers
 * call `users.recordLogin` on a successful login (BR-25).
 */

import { toIsoMyt } from '@/lib/time'

import { sessions } from '../auth/sessions'
import { toUserMe, type UserMe } from './me'
import type { SessionUserRow } from './users'

/** The `localStorage` key the UI reads (DATA-M01-02). */
export const PP_AUTH_STORAGE_KEY = 'pp.auth'

/** DATA-M01-02, as stored in `pp.auth`. */
export interface ClientSession {
  token: string
  remember: boolean
  /** ISO 8601 (+08:00): remember → +5 years; otherwise +120 min (sliding on the server). */
  expiresAt: string
  user: UserMe
  /** Real API only (V2-T31): CSRF token of the cookie session; the mock never writes it. */
  csrf?: string
  /** Real API only (AM2-A1): the account must change its password first; the mock never writes it. */
  mustChangePassword?: boolean
  /**
   * Present only on an impersonated session (XR-M27-21): the actor (school admin) and the path
   * "Kembali ke Admin" returns to. Not derived from `UserMe`; the shell renders the banner from it.
   */
  impersonator?: { id: number; name: string; returnTo: string }
  /** Client-only: Mod Pelajar parks the admin session here (v2-portals US-07); the mock never writes it. */
  mode?: {
    kind: 'mod_pelajar'
    returnRole: UserMe['role']
    since: string
    returnTo: string
    parent: { token: string; remember: boolean; expiresAt: string; user: UserMe }
  }
}

export function issueSession(
  user: SessionUserRow,
  remember: boolean,
  now: number,
  parentToken: string | null = null,
): ClientSession {
  const row = sessions.create(user.id, remember, now, parentToken)
  return {
    token: row.id,
    remember: row.remember,
    expiresAt: toIsoMyt(row.expiresAt),
    user: toUserMe(user),
  }
}
